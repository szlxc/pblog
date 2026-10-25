/**
 * 主题系统
 *
 * 优先级（高 → 低）：
 *   1. 登录用户保存在服务端的个人偏好（users.preferences.theme）
 *   2. 本机 localStorage（未登录时的匿名偏好）
 *   3. 站点默认值（PBLOG.json 的 sites.theme，可在管理端「主题外观」修改）
 *
 * 写入策略：
 *   - 总是写 localStorage（立即生效）
 *   - 已登录时，防抖 800ms 后同步到服务端，下次登录自动恢复
 */
import { useEffect, useState, useCallback, useRef } from 'react';

const KEY = 'pblog.settings';

export const DEFAULT_THEME = {
  mode: null,           // null = 跟随站点默认
  skin: null,           // null = 跟随站点默认；acrylic | liquid | material | classic
  accent: null,         // { accent, accentSoft } 或 null
  accentName: null,
  fontSize: 'md',       // sm | md | lg
  radius: null,         // number(px) 或 null
  radiusTouched: false, // 用户是否手动调过圆角（调过就不再被风格覆盖）
  readingWidth: null,   // number(px) 或 null
};

/**
 * 界面风格定义
 *
 * 皮肤 = 质感层（由 skin.css 的 --sx-* 变量实现）+ 一套推荐配色/明暗。
 * 切风格时会套用推荐值，用户之后仍可在面板里单独改配色，
 * 两者不互相覆盖：配色是「显式偏好」，只在用户切换风格那一刻被推荐值填充。
 *
 * recommended：
 *   mode  推荐明暗。亚克力/液态玻璃依赖背景透出，深色更能体现质感；
 *         Material 在浅色下层次最清晰（M3 的默认基调）。
 *   accent 推荐强调色，与该风格的材质气质匹配。
 *   radius 推荐圆角，符合各设计体系的基准（Fluent 8 / M3 16 / iOS 20）。
 *          用户已在面板里显式调过圆角时不覆盖。
 */
export const SKINS = [
  {
    key: 'classic',
    label: '原有风格',
    desc: '扁平、克制，不加修饰',
    recommended: { mode: null, accent: null, accentName: null, radius: null },
  },
  {
    key: 'acrylic',
    label: '亚克力',
    desc: '磨砂半透明，Windows 质感',
    platform: 'Windows',
    recommended: { mode: 'dark', accent: { accent: '#4aa3ff', accentSoft: '#2b7fd4' }, accentName: '亚克力蓝', radius: 12 },
  },
  {
    key: 'liquid',
    label: '液态玻璃',
    desc: '通透流动，大圆角高光',
    platform: 'iOS',
    recommended: { mode: 'dark', accent: { accent: '#7cc7ff', accentSoft: '#4f9fe0' }, accentName: '玻璃蓝', radius: 20 },
  },
  {
    key: 'material',
    label: 'Material',
    desc: '色阶分层，层次分明',
    platform: 'Android',
    recommended: { mode: 'light', accent: { accent: '#6750a4', accentSoft: '#7f67be' }, accentName: 'Material 紫', radius: 16 },
  },
];

export const SKIN_KEYS = SKINS.map((s) => s.key);
export const DEFAULT_SKIN = 'classic';

/** 取风格定义，未知值回落到原有风格 */
export function getSkin(key) {
  return SKINS.find((s) => s.key === key) || SKINS[0];
}

/** 切换风格时要一起写入的偏好（推荐配色/明暗/圆角） */
export function skinPreset(key, current = {}) {
  // 只有已知的 key 才生效，避免把任意值（甚至对象）写进偏好
  const skinKey = SKIN_KEYS.includes(key) ? key : DEFAULT_SKIN;
  const rec = getSkin(skinKey).recommended || {};
  const patch = { skin: skinKey };
  if (rec.mode !== undefined) patch.mode = rec.mode;
  if (rec.accent !== undefined) {
    patch.accent = rec.accent;
    patch.accentName = rec.accent ? (rec.accentName || null) : null;
  }
  /* 圆角：
     用户手动拖过滑杆（radiusTouched 为 true）就保留他的值；
     否则跟随风格推荐值。没有这个标记的话，
     切到第一个风格时写入的圆角会永久生效，
     之后换风格圆角就不变了（实测踩到过）。 */
  if (!current.radiusTouched) {
    patch.radius = rec.radius ?? null;
  }
  return patch;
}

export function loadLocalSettings() {
  try {
    return { ...DEFAULT_THEME, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch (_) {
    return { ...DEFAULT_THEME };
  }
}

export function saveLocalSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {}
}

function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
}

/**
 * 应用主题到 CSS 变量
 * @param {object} s      用户偏好
 * @param {object} site   站点默认（site.theme）
 */
export function applyTheme(s, site) {
  const root = document.documentElement;
  // 站点锁定了风格时，个人偏好里的 skin 一律忽略
  if (site?.skinLocked) s = { ...s, skin: null };
  const fallbackMode = site?.mode || 'dark';
  const mode = (s.mode || fallbackMode) === 'system'
    ? (systemPrefersDark() ? 'dark' : 'light')
    : (s.mode || fallbackMode);

  root.dataset.theme = mode;

  const fontSize = s.fontSize || 'md';
  root.dataset.font = fontSize;

  /* ---------- 界面风格 ----------
     优先级与配色一致：个人偏好 > 站点默认。
     写入 data-skin 后由 skin.css 接管质感层（模糊/边框/阴影/高光），
     这里不碰任何颜色变量，所以换风格不会干扰用户的配色选择。 */
  const skin = s.skin || site?.skin || DEFAULT_SKIN;
  root.dataset.skin = SKIN_KEYS.includes(skin) ? skin : DEFAULT_SKIN;

  // 强调色：用户选了就用用户的，否则用站点默认
  const up = s.accent?.accent;
  const accent = up || site?.accent;
  const accentSoft = s.accent?.accentSoft || (up ? up : site?.accentSoft) || accent;
  if (accent) {
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-soft', accentSoft || accent);
  } else {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-soft');
  }

  const radius = s.radius ?? site?.radius;
  if (radius !== null && radius !== undefined) root.style.setProperty('--radius', `${radius}px`);
  else root.style.removeProperty('--radius');

  const rw = s.readingWidth;
  if (rw) root.style.setProperty('--reading', `${rw}px`);
  else root.style.removeProperty('--reading');
}

/**
 * 把偏好差异防抖同步到账号
 * 只在真正变化时才发请求（比较序列化快照），避免拖动滑杆刷接口。
 */
function scheduleSync(next, syncer, saveTimer, lastSynced) {
  if (!syncer?.enabled) return;
  if (saveTimer.current) clearTimeout(saveTimer.current);
  saveTimer.current = setTimeout(() => {
    const payload = {
      mode: next.mode, skin: next.skin, accent: next.accent, accentName: next.accentName,
      fontSize: next.fontSize, radius: next.radius, radiusTouched: next.radiusTouched,
      readingWidth: next.readingWidth,
    };
    const snap = JSON.stringify(payload);
    if (snap === lastSynced.current) return;
    lastSynced.current = snap;
    syncer.save(next).catch(() => {});
  }, 800);
}

/**
 * 主题 hook
 * @param {object} site        站点配置（来自 SiteContext）
 * @param {object} syncer      { enabled, load, save } 由 MemberProvider 注入
 */
export function useTheme(site, syncer) {
  const [settings, setSettings] = useState(loadLocalSettings);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef(null);
  const lastSynced = useRef(null);

  /* ---------- 启动：先本地，再尝试覆盖为账户偏好 ---------- */
  useEffect(() => {
    let alive = true;
    const local = loadLocalSettings();
    setSettings(local);
    setReady(true);

    if (!syncer?.enabled) return () => { alive = false; };

    syncer.load()
      .then((remote) => {
        if (!alive || !remote) return;
        if (remote.preferences?.theme && Object.keys(remote.preferences.theme).length) {
          const merged = { ...local, ...remote.preferences.theme };
          setSettings(merged);
          saveLocalSettings(merged);
        }
      })
      .catch(() => {});

    return () => { alive = false; };
  }, [syncer?.enabled]);

  /* ---------- 应用到 DOM ---------- */
  useEffect(() => {
    if (!ready) return;
    applyTheme(settings, site?.theme);
  }, [settings, site, ready]);

  /* ---------- 跟随系统模式 ---------- */
  useEffect(() => {
    if ((settings.mode || site?.theme?.mode) !== 'system') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(settings, site?.theme);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings, site]);

  /* ---------- 变更：本地立即写，账户防抖同步 ---------- */
  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveLocalSettings(next);

      scheduleSync(next, syncer, saveTimer, lastSynced);
      return next;
    });
  }, [syncer]);

  const reset = useCallback(() => {
    const blank = { ...DEFAULT_THEME };
    setSettings(blank);
    saveLocalSettings(blank);
    if (syncer?.enabled) syncer.save(blank).catch(() => {});
  }, [syncer]);

  /**
   * 切换界面风格
   * 同时套用该风格的推荐明暗/配色/圆角（用户之后仍可单独改），
   * 这样「选风格」是一步到位的，不需要用户自己配一遍。
   */
  const setSkin = useCallback((key) => {
    setSettings((prev) => {
      const next = { ...prev, ...skinPreset(key, prev) };
      saveLocalSettings(next);
      scheduleSync(next, syncer, saveTimer, lastSynced);
      return next;
    });
  }, [syncer]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  return { settings, update, reset, setSkin, ready };
}

/** 导出给管理端复用：把后台的 theme 配置转成前台 settings 形状 */
export function themeConfigToSettings(theme) {
  return {
    mode: theme?.mode || null,
    skin: theme?.skin || null,
    accent: theme?.accent ? { accent: theme.accent, accentSoft: theme.accentSoft || theme.accent } : null,
    fontSize: theme?.fontSize || 'md',
    radius: theme?.radius ?? null,
    radiusTouched: theme?.radiusTouched ?? false,
    readingWidth: theme?.readingWidth ?? null,
  };
}
