import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, X } from 'lucide-react';
import { ApiError } from '../../api/client';
import { useI18n, type MessageKey } from '../../i18n';

type ButtonVariant = 'primary' | 'accent' | 'ghost' | 'danger' | 'default';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  icon?: boolean;
  loading?: boolean;
}

export function buttonClass({ variant = 'default', size = 'md', block, icon }: Pick<ButtonProps, 'variant' | 'size' | 'block' | 'icon'>) {
  return ['btn', variant !== 'default' && `btn--${variant}`, size !== 'md' && `btn--${size}`, block && 'btn--block', icon && 'btn--icon']
    .filter(Boolean)
    .join(' ');
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, icon, loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[buttonClass({ variant, size, block, icon }), className].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner" style={{ width: 16, height: 16 }} aria-hidden /> : null}
      {children}
    </button>
  );
});

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint ? (
        <span id={hintId} className="field__hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput({ className, ...props }, ref) {
  return <input ref={ref} className={['input', className].filter(Boolean).join(' ')} {...props} />;
});

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  const { t } = useI18n();
  return (
    <div className="input-group">
      <input className="input" type={visible ? 'text' : 'password'} {...props} />
      <button
        type="button"
        className="btn btn--ghost btn--icon btn--sm input-group__action"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={['select', className].filter(Boolean).join(' ')} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={['textarea', className].filter(Boolean).join(' ')} {...props} />;
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <span role="status" className="row" style={{ gap: 8 }}>
      <span className="spinner" aria-hidden />
      <span className="visually-hidden">{label ?? t('app.loading')}</span>
    </span>
  );
}

export function PageLoader() {
  return (
    <div className="page-loader">
      <Spinner />
    </div>
  );
}

export function errorMessage(error: unknown, t: ReturnType<typeof useI18n>): string {
  if (error instanceof ApiError) {
    if (error.code === 'network') return t.t('common.networkError');
    return t.tx(`errors.${error.code}`, error.message || t.t('common.unknownError'));
  }
  return t.t('common.unknownError');
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const i18n = useI18n();
  return (
    <div className="state" role="alert">
      <AlertCircle size={28} className="muted" aria-hidden />
      <p className="state__lead">{errorMessage(error, i18n)}</p>
      {onRetry ? (
        <Button onClick={onRetry} size="sm">
          {i18n.t('common.retry')}
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, lead, action }: { title: ReactNode; lead?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state">
      <p className="state__title">{title}</p>
      {lead ? <p className="state__lead">{lead}</p> : null}
      {action}
    </div>
  );
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'ok' | 'bad' | 'warn'; children: ReactNode }) {
  return (
    <div className={`alert ${tone !== 'info' ? `alert--${tone}` : ''}`} role={tone === 'bad' ? 'alert' : 'status'}>
      {tone === 'ok' ? <CheckCircle2 size={16} aria-hidden /> : <AlertCircle size={16} aria-hidden />}
      <div>{children}</div>
    </div>
  );
}

export function LanguageMark({ code, size = 'md' }: { code: string; size?: 'md' | 'lg' }) {
  return (
    <span className={`lang-mark ${size === 'lg' ? 'lang-mark--lg' : ''}`} data-lang={code} aria-hidden>
      {code}
    </span>
  );
}

export function Meter({ value, max = 100, tone, label }: { value: number; max?: number; tone?: 'accent' | 'ok' | 'bad' | 'warn'; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`meter ${tone ? `meter--${tone}` : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <div className="meter__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close?.();
  }, [open]);
  return (
    <dialog ref={ref} className={`dialog ${wide ? 'dialog--wide' : ''}`} onClose={onClose} onCancel={onClose} aria-labelledby="dialog-title">
      {open ? (
        <>
          <div className="dialog__head">
            <h2 id="dialog-title" style={{ fontSize: 'var(--text-lg)' }}>
              {title}
            </h2>
            <Button variant="ghost" icon size="sm" onClick={onClose} aria-label={t('common.close')}>
              <X size={18} />
            </Button>
          </div>
          <div className="dialog__body">{children}</div>
          {footer ? <div className="dialog__foot">{footer}</div> : null}
        </>
      ) : null}
    </dialog>
  );
}

interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'bad';
}

const ToastContext = createContext<(message: string, tone?: 'info' | 'bad') => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: 'info' | 'bad' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.tone === 'bad' ? 'toast--bad' : ''}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/** Section with a rule-underlined heading, the main structural device of the interface. */
export function Section({ title, aside, children, id }: { title: ReactNode; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="section" aria-labelledby={id}>
      <div className="section__head">
        <h2 className="section__title" id={id}>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function useTitle(key: MessageKey | null, extra?: string) {
  const { t } = useI18n();
  useEffect(() => {
    const parts = [extra, key ? t(key) : null, t('app.name')].filter(Boolean);
    document.title = parts.join(' — ');
  }, [key, extra, t]);
}
