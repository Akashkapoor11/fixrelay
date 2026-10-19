import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[FixRelay] Uncaught render error:', error, info.componentStack);
  }
  override render() {
    if (this.state.error) {
      return (
        <div style={{ fontFamily: 'Inter, sans-serif', padding: '48px 32px', maxWidth: 520, margin: '60px auto', background: '#fff', border: '1px solid #e8edf2', borderRadius: 16, boxShadow: '0 8px 30px #20334808' }}>
          <h1 style={{ color: '#15283b', fontSize: 22, fontWeight: 750, letterSpacing: -0.6, margin: '0 0 10px' }}>FixRelay encountered an error</h1>
          <p style={{ color: '#7c8b9c', fontSize: 13, lineHeight: 1.6, margin: '0 0 18px' }}>Something went wrong rendering this page. Refresh to try again, or check the browser console for details.</p>
          <pre style={{ background: '#f5f7fa', border: '1px solid #e3e9ef', borderRadius: 8, padding: 12, fontSize: 11, color: '#526279', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{this.state.error.message}</pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 18, background: '#178f7e', color: '#fff', border: 0, borderRadius: 8, padding: '10px 18px', fontSize: 12, fontWeight: 750, cursor: 'pointer' }}>Reload workspace</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root was not found.');

createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
