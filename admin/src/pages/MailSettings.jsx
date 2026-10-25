import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Icon } from '../components/Icon';
import { useToast } from '../components/ui';

/** SMTP 邮件配置：用于邮箱验证与找回密码 */
export default function MailSettings() {
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const toast = useToast();

  useEffect(() => {
    api.get('/admin/mail-config').then(({ data }) => setCfg(data)).catch((e) => toast.error(e.message));
  }, [toast]);

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/admin/mail-config', cfg);
      toast.toast('已保存，立即生效');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const testConn = async () => {
    setTesting(true); setResult(null);
    try {
      const r = await api.post('/admin/mail-config/test');
      setResult(r);
    } catch (e) { setResult({ ok: false, message: e.message }); } finally { setTesting(false); }
  };

  const sendTest = async () => {
    if (!testTo.trim()) { toast.error('请填写收件邮箱'); return; }
    setTesting(true); setResult(null);
    try {
      const r = await api.post('/admin/mail-config/send-test', { to: testTo.trim() });
      setResult({ ok: r.sent, message: r.sent ? '测试邮件已发送，请查收' : `发送失败：${r.reason}` });
    } catch (e) { setResult({ ok: false, message: e.message }); } finally { setTesting(false); }
  };

  if (!cfg) return <div className="panel"><div className="panel__body"><span className="spinner" /></div></div>;
  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));

  return (
    <div>
      <div className="page-title">
        <div>
          <h2>邮件设置</h2>
          <p>用于访客注册时的邮箱验证与找回密码，保存后立即生效</p>
        </div>
        <button className="btn btn--primary" onClick={save} disabled={busy}>
          {busy ? <span className="spinner" /> : <Icon name="check" size={15} />}保存
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 18, alignItems: 'start' }}>
        <div className="panel">
          <div className="panel__head"><h3>SMTP 服务器</h3></div>
          <div className="panel__body">
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18, fontSize: '0.9rem' }}>
              <input type="checkbox" checked={!!cfg.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
              启用邮件功能
            </label>

            <div className="form-grid">
              <div className="field">
                <label>SMTP 主机</label>
                <input className="input" value={cfg.host || ''} onChange={(e) => set({ host: e.target.value })} placeholder="smtp.qq.com" />
              </div>
              <div className="field">
                <label>端口</label>
                <input className="input" type="number" value={cfg.port || 465} onChange={(e) => set({ port: Number(e.target.value) })} />
              </div>
              <div className="field">
                <label>加密方式</label>
                <select className="select" value={cfg.secure ? 'ssl' : 'plain'} onChange={(e) => set({ secure: e.target.value === 'ssl' })}>
                  <option value="ssl">SSL（465）</option>
                  <option value="plain">STARTTLS（587）</option>
                </select>
              </div>
              <div className="field">
                <label>发件人名称</label>
                <input className="input" value={cfg.fromName || ''} onChange={(e) => set({ fromName: e.target.value })} />
              </div>
              <div className="field">
                <label>账号（邮箱地址）</label>
                <input className="input" value={cfg.user || ''} onChange={(e) => set({ user: e.target.value })} placeholder="you@qq.com" />
              </div>
              <div className="field">
                <label>密码 / 授权码</label>
                <input className="input" type="password" value={cfg.pass || ''} onChange={(e) => set({ pass: e.target.value })} placeholder="留 ******** 表示不修改" />
              </div>
              <div className="field field--full">
                <label>发件人邮箱（可留空，默认同账号）</label>
                <input className="input" value={cfg.fromEmail || ''} onChange={(e) => set({ fromEmail: e.target.value })} />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 16, fontSize: '0.88rem' }}>
              <input type="checkbox" checked={!!cfg.requireVerify} onChange={(e) => set({ requireVerify: e.target.checked })} />
              注册后需验证邮箱才能登录（关闭则填了邮箱也直接可用）
            </label>

            <div className="form-actions">
              <button className="btn" onClick={testConn} disabled={testing}>
                {testing ? <span className="spinner" /> : null}测试连接
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <div className="panel">
            <div className="panel__head"><h3>发送测试邮件</h3></div>
            <div className="panel__body">
              <div className="field">
                <label>收件邮箱</label>
                <input className="input" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="your@email.com" />
              </div>
              <button className="btn btn--block" onClick={sendTest} disabled={testing}>发送</button>
              {result && (
                <p style={{ marginTop: 12, fontSize: '0.84rem', color: result.ok ? 'var(--ok)' : 'var(--danger)' }}>
                  {result.message}
                </p>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel__head"><h3>常见配置</h3></div>
            <div className="panel__body" style={{ fontSize: '0.82rem', lineHeight: 1.9, color: 'var(--text-dim)' }}>
              <p style={{ margin: '0 0 8px' }}><strong>QQ 邮箱</strong><br />smtp.qq.com · 465 · SSL<br />密码填「授权码」，非登录密码</p>
              <p style={{ margin: '0 0 8px' }}><strong>163 邮箱</strong><br />smtp.163.com · 465 · SSL<br />同样使用授权码</p>
              <p style={{ margin: 0 }}><strong>Gmail</strong><br />smtp.gmail.com · 587 · STARTTLS<br />需开启两步验证并使用应用专用密码</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
