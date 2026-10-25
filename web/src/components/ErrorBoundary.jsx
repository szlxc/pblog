import { Component } from 'react';

/**
 * 错误边界：捕获子树渲染异常，避免整页黑屏。
 * 出现异常时显示可恢复的提示，并提供「重试」按钮。
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // 控制台保留完整堆栈，方便排查
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="error-boundary">
        <div className="error-boundary__card">
          <h2>{this.props.title || '页面出了点问题'}</h2>
          <p className="muted">已拦截异常，页面其余部分仍可使用。</p>
          <pre className="error-boundary__detail">{String(error?.message || error)}</pre>
          <div className="error-boundary__actions">
            <button className="btn btn--solid" onClick={this.reset}>重试</button>
            <button className="btn" onClick={() => window.location.reload()}>刷新页面</button>
          </div>
        </div>
      </div>
    );
  }
}
