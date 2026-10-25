import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { Pagination, EmptyState, ConfirmDialog, useToast, Modal } from '../components/ui';

const sizeText = (n) => {
  const v = Number(n) || 0;
  if (v > 1024 * 1024) return `${(v / 1024 / 1024).toFixed(2)} MB`;
  if (v > 1024) return `${(v / 1024).toFixed(0)} KB`;
  return `${v} B`;
};

export default function Media() {
  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [over, setOver] = useState(false);
  const [pct, setPct] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setRows(null);
    try {
      const { data, meta: m } = await api.get('/admin/media', { page, pageSize: 24 });
      setRows(data);
      setMeta(m);
    } catch (e) { toast.error(e.message); setRows([]); }
  }, [page, toast]);

  useEffect(() => { load(); }, [load]);

  const uploadFiles = async (files) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (!list.length) { toast.error('请上传图片文件'); return; }
    let ok = 0;
    for (const f of list) {
      setPct(0);
      try { await api.upload(f, setPct); ok++; }
      catch (e) { toast.error(`${f.name}: ${e.message}`); }
    }
    setPct(null);
    if (ok) { toast.toast(`已上传 ${ok} 个文件`); load(); }
  };

  const copy = async (url) => {
    try { await navigator.clipboard.writeText(url); toast.toast('链接已复制'); }
    catch (_) { toast.error('复制失败，请手动选择'); }
  };

  const remove = async () => {
    setBusy(true);
    try { await api.del(`/admin/media/${confirm.id}`); toast.toast('已删除'); setConfirm(null); load(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const saveAlt = async () => {
    setBusy(true);
    try {
      await api.put(`/admin/media/${detail.id}`, { alt: detail.alt });
      toast.toast('已保存'); setDetail(null); load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="page-title">
        <div><h2>媒体库</h2><p>上传图片并在文章中引用，支持拖拽上传</p></div>
        <button className="btn btn--primary" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={15} />上传图片
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { uploadFiles(e.target.files); e.target.value = ''; }} />
      </div>

      <div
        className={`dropzone${over ? ' is-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); uploadFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}
      >
        <Icon name="image" size={26} />
        <p style={{ margin: '8px 0 0' }}>拖拽图片到这里，或点击选择文件</p>
        <p className="faint" style={{ margin: '4px 0 0', fontSize: '0.78rem' }}>支持 JPG / PNG / WebP / GIF / SVG</p>
        {pct !== null && <div className="progress"><div className="progress__bar" style={{ width: `${pct}%` }} /></div>}
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="panel__body">
          {!rows && <div className="spinner" />}
          {rows && !rows.length && <EmptyState icon="image" title="还没有上传任何图片" />}
          {rows && rows.length > 0 && (
            <div className="media-grid">
              {rows.map((m) => (
                <div key={m.id} className="media-item">
                  <img src={m.url} alt={m.alt || m.filename} className="media-item__thumb" loading="lazy" />
                  <div className="media-item__meta">
                    <strong title={m.filename}>{m.filename}</strong>
                    <span>{sizeText(m.size)}{m.width ? ` · ${m.width}×${m.height}` : ''}</span>
                  </div>
                  <div className="media-item__actions">
                    <button className="icon-btn" title="复制链接" onClick={() => copy(m.url)}><Icon name="copy" size={14} /></button>
                    <button className="icon-btn" title="详情/Alt" onClick={() => setDetail({ ...m })}><Icon name="edit" size={14} /></button>
                    <button className="icon-btn" title="删除" onClick={() => setConfirm(m)}><Icon name="trash" size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {meta && meta.totalPages > 1 && <Pagination meta={meta} onChange={setPage} />}
      </div>

      <Modal open={!!detail} title="图片信息" onClose={() => setDetail(null)}
        footer={(
          <>
            <button className="btn" onClick={() => setDetail(null)} disabled={busy}>关闭</button>
            <button className="btn btn--primary" onClick={saveAlt} disabled={busy}>保存</button>
          </>
        )}>
        {detail && (
          <div>
            <img src={detail.url} alt="" style={{ width: '100%', borderRadius: 8, marginBottom: 14, maxHeight: 260, objectFit: 'contain' }} />
            <div className="field">
              <label>图片地址</label>
              <input className="input" readOnly value={detail.url} onFocus={(e) => e.target.select()} />
            </div>
            <div className="field">
              <label>Alt 文本（利于无障碍与 SEO）</label>
              <input className="input" value={detail.alt || ''} onChange={(e) => setDetail({ ...detail, alt: e.target.value })} />
            </div>
            <p className="faint" style={{ fontSize: '0.76rem', margin: 0 }}>
              {detail.width ? `${detail.width} × ${detail.height}px · ` : ''}{sizeText(detail.size)} · {detail.mime}
            </p>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} danger busy={busy} title="删除图片"
        message={`确定删除「${confirm?.filename || ''}」？已引用该图片的文章将显示为空。`}
        onCancel={() => setConfirm(null)} onConfirm={remove} />
    </div>
  );
}
