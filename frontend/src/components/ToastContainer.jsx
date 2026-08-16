import { useWeb3 } from '../hooks/useWeb3';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';

const ICONS = {
  success: { Icon: CheckCircle2, color: 'var(--c-green)'  },
  error:   { Icon: XCircle,      color: 'var(--c-red)'    },
  warning: { Icon: AlertCircle,  color: 'var(--c-amber)'  },
  info:    { Icon: Info,         color: 'var(--c-brand)'  },
};

export default function ToastContainer() {
  const { toasts, removeToast } = useWeb3();
  if (!toasts.length) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => {
        const { Icon, color } = ICONS[t.type] || ICONS.info;
        return (
          <div key={t.id} className={`toast ${t.type}`} role="alert">
            <Icon size={16} color={color} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            <div className="toast-content">
              <div className="toast-title">{t.title}</div>
              {t.message && <div className="toast-message">{t.message}</div>}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="btn btn-ghost btn-icon"
              style={{ padding: 2, color: 'var(--t-muted)' }}
              aria-label="Dismiss notification"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
