'use strict';

/**
 * 轻量 Markdown 渲染器（零第三方依赖）
 * 支持：标题(带 id)、段落、粗体/斜体/删除线、行内代码、围栏代码块、
 *      有序/无序列表(嵌套一层)、引用、表格、分割线、链接、图片、自动链接、
 *      任务列表、脚注式引用块中的行内公式保持原样
 *
 * 输出 HTML 前会做一次白名单清洗（sanitizeHtml），避免 XSS。
 */

const { escapeHtml } = require('./text');

const CODE_LANGS_WITH_LABEL = true;

function slugifyHeading(text) {
  return String(text)
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'section';
}

/* ------------------------- 行内解析 ------------------------- */
function inline(text, opts = {}) {
  let s = String(text);
  const codeStore = [];

  // 1. 行内代码先抽出，避免内部再被解析
  s = s.replace(/`([^`\n]+)`/g, (_, code) => {
    codeStore.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000CODE${codeStore.length - 1}\u0000`;
  });

  // 2. 图片
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, alt, src, title) => {
    const safeSrc = safeUrl(src);
    if (!safeSrc) return escapeHtml(alt);
    return `<img src="${escapeHtml(safeSrc)}" alt="${escapeHtml(alt)}"${
      title ? ` title="${escapeHtml(title)}"` : ''
    } loading="lazy" decoding="async">`;
  });

  // 3. 链接
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, label, href, title) => {
    const safe = safeUrl(href);
    if (!safe) return escapeHtml(label);
    const external = /^https?:\/\//i.test(safe);
    return `<a href="${escapeHtml(safe)}"${title ? ` title="${escapeHtml(title)}"` : ''}${
      external ? ' target="_blank" rel="noopener noreferrer nofollow"' : ''
    }>${label}</a>`;
  });

  // 4. 自动链接
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, pre, url) =>
    `${pre}<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(url)}</a>`);

  // 5. 粗体 / 斜体 / 删除线 / 高亮
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/==([^=]+)==/g, '<mark>$1</mark>');

  // 6. 行内换行
  s = s.replace(/ {2,}\n/g, '<br>\n');

  // 7. 还原行内代码
  s = s.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => codeStore[Number(i)]);
  return s;
}

/** 只允许安全协议 */
function safeUrl(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^(javascript|data|vbscript):/i.test(u)) return '';
  if (/^(https?:|\/|\.\/|\.\.\/|#|mailto:|tel:)/i.test(u)) return u;
  if (/^[\w./-]+$/.test(u)) return u;
  return '';
}

/* ------------------------- 代码高亮（极简） ------------------------- */
const KEYWORDS = {
  js: 'const let var function return if else for while class extends new this import export from default async await try catch throw typeof instanceof null undefined true false switch case break continue do of in yield delete void',
  ts: 'const let var function return if else for while class extends implements interface type enum new this import export from default async await try catch throw typeof instanceof null undefined true false private public protected readonly as any string number boolean',
  python: 'def class return if elif else for while import from as with try except finally raise lambda None True False and or not in is pass yield async await global nonlocal',
  java: 'public private protected class interface extends implements new return if else for while do switch case break continue try catch finally throw throws static final void int long double float boolean char String import package this super null true false',
  go: 'package import func var const type struct interface return if else for range switch case break continue defer go chan map make new nil true false string int int64 float64 bool error',
  rust: 'fn let mut const static struct enum impl trait use mod pub return if else match for while loop in as where self Self crate super true false Option Result String Vec',
  sql: 'SELECT FROM WHERE INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE ALTER DROP INDEX JOIN LEFT RIGHT INNER OUTER ON GROUP BY ORDER HAVING LIMIT OFFSET AND OR NOT NULL PRIMARY KEY FOREIGN REFERENCES',
  bash: 'if then else elif fi for do done while case esac function return export local echo cd ls cat grep sed awk curl sudo npm node git',
  c: 'int char float double void return if else for while do switch case break continue struct union enum typedef static const sizeof include define NULL',
};

function highlight(code, lang) {
  const key = (lang || '').toLowerCase();
  const kwList = KEYWORDS[key];
  let out = escapeHtml(code);

  // 字符串
  out = out.replace(/(&quot;|&#39;|"|')((?:\\.|(?!\1).)*)\1/g, (m) => `<span class="tok-str">${m}</span>`);
  // 注释
  out = out.replace(/(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)/g, (m) => `<span class="tok-com">${m}</span>`);
  // 数字
  out = out.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');

  if (kwList) {
    const re = new RegExp(`\\b(${kwList.split(' ').filter(Boolean).join('|')})\\b`, 'g');
    // 只在标签外替换
    out = out.replace(/(<span[^>]*>[\s\S]*?<\/span>)|(\b[\w$]+\b)/g, (m, tagged, word) => {
      if (tagged) return tagged;
      return re.source && new RegExp(`^(${kwList.split(' ').filter(Boolean).join('|')})$`).test(word)
        ? `<span class="tok-kw">${word}</span>`
        : word;
    });
  }
  return out;
}

/* ------------------------- 块级解析 ------------------------- */
function render(markdown) {
  const src = String(markdown || '').replace(/\r\n?/g, '\n');
  const lines = src.split('\n');
  const html = [];
  const toc = [];
  let i = 0;
  const headingCount = new Map();

  while (i < lines.length) {
    const line = lines[i];

    // 围栏代码块
    const fence = line.match(/^(```+|~~~+)\s*([\w+#-]*)\s*$/);
    if (fence) {
      const marker = fence[1][0];
      const lang = fence[2] || '';
      const buf = [];
      i++;
      while (i < lines.length && !new RegExp(`^${marker}{3,}\\s*$`).test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // 跳过结束围栏
      const code = buf.join('\n');
      const langLabel = CODE_LANGS_WITH_LABEL && lang
        ? `<span class="code-lang">${escapeHtml(lang)}</span>` : '';
      html.push(
        `<figure class="code-block${lang ? ` lang-${escapeHtml(lang)}` : ''}">` +
        `<figcaption>${langLabel}<button type="button" class="code-copy" data-copy="1" aria-label="复制代码">复制</button></figcaption>` +
        `<pre><code class="language-${escapeHtml(lang || 'text')}">${highlight(code, lang)}</code></pre></figure>`
      );
      continue;
    }

    // 空行
    if (!line.trim()) { i++; continue; }

    // 分割线
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
      html.push('<hr>');
      i++;
      continue;
    }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const rawText = h[2].trim();
      let id = slugifyHeading(rawText.replace(/[*_`~]/g, ''));
      const n = (headingCount.get(id) || 0) + 1;
      headingCount.set(id, n);
      if (n > 1) id = `${id}-${n}`;
      if (level >= 2 && level <= 4) {
        toc.push({ level, id, text: rawText.replace(/[*_`~]/g, '') });
      }
      html.push(`<h${level} id="${escapeHtml(id)}">${inline(rawText)}</h${level}>`);
      i++;
      continue;
    }

    // 引用块（可嵌套 >）
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      html.push(`<blockquote>${render(buf.join('\n')).html}</blockquote>`);
      continue;
    }

    // 表格
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?[\s:-]+\|/.test(lines[i + 1] || '')) {
      const header = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((c) => {
        const t = c.trim();
        if (/^:.*:$/.test(t)) return 'center';
        if (/:$/.test(t)) return 'right';
        return 'left';
      });
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const thead = `<thead><tr>${header.map((c, idx) =>
        `<th style="text-align:${aligns[idx] || 'left'}">${inline(c.trim())}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows.map((r) =>
        `<tr>${header.map((_, idx) =>
          `<td style="text-align:${aligns[idx] || 'left'}">${inline((r[idx] || '').trim())}</td>`).join('')}</tr>`).join('')}</tbody>`;
      html.push(`<div class="table-wrap"><table>${thead}${tbody}</table></div>`);
      continue;
    }

    // 任务列表 / 无序列表 / 有序列表
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[2]);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        if (!m) {
          // 允许多行列表项（缩进续行）
          if (lines[i].trim() && /^\s{2,}/.test(lines[i])) {
            if (items.length) items[items.length - 1].text += '\n' + lines[i].trim();
            i++;
            continue;
          }
          break;
        }
        let text = m[3];
        let checked = null;
        const task = text.match(/^\[([ xX])\]\s+(.*)$/);
        if (task) { checked = task[1].toLowerCase() === 'x'; text = task[2]; }
        items.push({ text, checked });
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      const cls = items.some((it) => it.checked !== null) ? ' class="task-list"' : '';
      html.push(`<${tag}${cls}>${items.map((it) => {
        if (it.checked !== null) {
          return `<li class="task-item${it.checked ? ' done' : ''}"><input type="checkbox" disabled${it.checked ? ' checked' : ''}><span>${inline(it.text)}</span></li>`;
        }
        return `<li>${inline(it.text)}</li>`;
      }).join('')}</${tag}>`);
      continue;
    }

    // 段落
    const buf = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^(```+|~~~+)/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !/^(\s*)([-*+]|\d+\.)\s+/.test(lines[i]) &&
      !/^\s*([-*_])\s*(\1\s*){2,}$/.test(lines[i]) &&
      !/^\s*\|.*\|\s*$/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    if (buf.length) html.push(`<p>${inline(buf.join('\n'))}</p>`);
    else i++;
  }

  return { html: html.join('\n'), toc };
}

function splitRow(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|');
}

/* ------------------------- 白名单清洗 ------------------------- */
const ALLOWED_TAGS = [
  'a', 'p', 'br', 'hr', 'strong', 'em', 'del', 'mark', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li', 'input', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'figure',
  'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span', 'img',
];

/**
 * 依赖 sanitize-html 时使用它做最强清洗；未安装时退化到正则清洗。
 */
let sanitizeHtmlLib = null;
try { sanitizeHtmlLib = require('sanitize-html'); } catch (_) { /* 可选依赖 */ }

function sanitize(html) {
  if (sanitizeHtmlLib) {
    return sanitizeHtmlLib(html, {
      allowedTags: ALLOWED_TAGS.concat(['section', 'sup', 'sub', 'kbd']),
      allowedAttributes: {
        '*': ['class', 'id', 'style', 'title'],
        a: ['href', 'target', 'rel', 'title'],
        img: ['src', 'alt', 'title', 'loading', 'decoding', 'width', 'height'],
        input: ['type', 'checked', 'disabled'],
        code: ['class'],
        pre: ['class'],
      },
      allowedStyles: {
        '*': { 'text-align': [/^left$|^right$|^center$/] },
      },
      allowedSchemes: ['http', 'https', 'mailto', 'tel'],
      transformTags: {
        a: (tagName, attribs) => ({
          tagName,
          attribs: /^https?:/i.test(attribs.href || '')
            ? { ...attribs, rel: 'noopener noreferrer nofollow', target: '_blank' }
            : attribs,
        }),
      },
    });
  }
  // 退化：先按正则反向移除脚本类标签
  return String(html)
    .replace(/<(script|style|iframe|object|embed|form)[\s\S]*?<\/\1>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/href\s*=\s*("|')\s*javascript:[^"']*\1/gi, 'href="#"')
    .replace(/src\s*=\s*("|')\s*javascript:[^"']*\1/gi, 'src=""');
}

/** 渲染并清洗，返回 { html, toc } */
function renderSafe(markdown) {
  const { html, toc } = render(markdown);
  return { html: sanitize(html), toc };
}

module.exports = { render, renderSafe, sanitize, inline, slugifyHeading };
