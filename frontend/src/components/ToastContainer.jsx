import { useWeb3 } from '../hooks/useBlockchainContext';
import { CheckCircle2, XCircle, AlertCircle, Info, X, Ban } from 'lucide-react';

// Toast type config — includes a distinct 'rejected' variant for wallet rejections
const TOAST_CONFIG = {
  success:  { Icon: CheckCircle2, color: 'var(--color-success)',        bar: '#22c55e' },
  error:    { Icon: XCircle,      color: 'var(--color-danger)',         bar: '#ef4444' },
  warning:  { Icon: AlertCircle,  color: 'var(--color-warning)',        bar: '#f59e0b' },
  info:     { Icon: Info,         color: 'var(--color-primary)',        bar: '#6366f1' },
  rejected: { Icon: Ban,          color: 'var(--color-warning)',        bar: '#f59e0b' },
};

// Inline keyframes injected once via a style tag
const PROGRESS_STYLE = `
@keyframes toast-shrink {
  from { width: 100%; }
  to   { width: 0%;   }
}
.toast-progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  border-radius: 0 0 var(--radius-md, 8px) var(--radius-md, 8px);
  animation: toast-shrink linear forwards;
  opacity: 0.7;
}
.toast {
  position: relative;
  overflow: hidden;
}
`;

let styleInjected = false;
function injectStyle() {
  if (styleInjected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent = PROGRESS_STYLE;
  document.head.appendChild(el);
  styleInjected = true;
}

export default function ToastContainer() {
  const { toasts, removeToast } = useWeb3();
  injectStyle();

  if (!toasts.length) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => {
        // Map 'warning' with wallet-rejection keywords to 'rejected' type for distinct styling
        const isWalletRejection = t.type === 'warning' && (
          t.title?.toLowerCase().includes('reject') ||
          t.message?.toLowerCase().includes('reject')
        );
        const resolvedType = isWalletRejection ? 'rejected' : (t.type || 'info');
        const { Icon, color, bar } = TOAST_CONFIG[resolvedType] || TOAST_CONFIG.info;
        const duration = t.duration || 6000;

        return (
          <div key={t.id} className={`toast ${t.type}`} role="alert">
            <Icon size={16} color={color} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            <div className="toast-content">
              <div className="toast-title" style={{ color }}>
                {isWalletRejection ? '🚫 ' : ''}{t.title}
              </div>
              {t.message && <div className="toast-message">{t.message}</div>}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="btn btn-ghost btn-icon"
              style={{ padding: 2, color: 'var(--color-text-muted)' }}
              aria-label="Dismiss notification"
            >
              <X size={13} />
            </button>
            {/* Countdown progress bar */}
            <div
              className="toast-progress-bar"
              style={{
                background: bar,
                animationDuration: `${duration}ms`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
