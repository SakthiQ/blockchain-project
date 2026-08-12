/**
 * Toast Notification System
 * Renders floating notification toasts from the Web3 context
 */
import { useWeb3 } from '../hooks/useWeb3';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';

const ICON_MAP = {
  success: <CheckCircle2 size={18} color="var(--color-accent-success)" />,
  error:   <XCircle     size={18} color="var(--color-accent-danger)"  />,
  warning: <AlertCircle size={18} color="var(--color-accent-warning)" />,
  info:    <Info        size={18} color="var(--color-accent-primary)"  />,
};

export default function ToastContainer() {
  const { toasts, removeToast } = useWeb3();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          <div className="toast-icon">{ICON_MAP[toast.type] || ICON_MAP.info}</div>
          <div className="toast-content">
            <div className="toast-title">{toast.title}</div>
            {toast.message && (
              <div className="toast-message">{toast.message}</div>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-muted)', padding: '2px',
              display: 'flex', alignItems: 'center', flexShrink: 0
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
