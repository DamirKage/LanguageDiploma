import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { authApi } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { Brand } from '../../components/layout/AppShell';
import { ThemeSwitch } from '../../components/theme/ThemePicker';
import { Alert, Button, errorMessage, Field, PasswordInput, TextInput, useTitle } from '../../components/ui';
import { useI18n } from '../../i18n';

function AuthLayout({ title, lead, children, footer }: { title: string; lead?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="public">
      <header className="public__head">
        <Brand />
        <ThemeSwitch />
      </header>
      <main className="public__main" id="main">
        <div className="auth-card">
          <div className="stack" style={{ '--gap': 'var(--s2)' } as React.CSSProperties}>
            <h1>{title}</h1>
            {lead ? <p className="muted">{lead}</p> : null}
          </div>
          {children}
          {footer ? <p className="small muted">{footer}</p> : null}
        </div>
      </main>
    </div>
  );
}

function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  return Object.fromEntries(error.details.map((d) => [d.path.replace(/^body\./, ''), d.message]));
}

export function LoginPage() {
  const i18n = useI18n();
  const { t } = i18n;
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  useTitle('auth.loginTitle');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const user = await login(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? (user.role === 'admin' && !user.activeLanguage ? '/admin' : user.onboarded ? '/today' : '/onboarding'), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title={t('auth.loginTitle')}
      lead={t('auth.loginLead')}
      footer={
        <>
          {t('auth.noAccount')} <Link to="/register">{t('auth.toRegister')}</Link>
        </>
      }
    >
      <form className="stack" onSubmit={submit} noValidate>
        {error ? <Alert tone="bad">{errorMessage(error, i18n)}</Alert> : null}
        <Field label={t('auth.email')}>
          {(p) => <TextInput {...p} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label={t('auth.password')} hint={<Link to="/forgot-password">{t('auth.forgot')}</Link>}>
          {(p) => <PasswordInput {...p} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={pending}>
          {t('auth.submitLogin')}
        </Button>
      </form>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const i18n = useI18n();
  const { t } = i18n;
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const errors = fieldErrors(error);
  useTitle('auth.registerTitle');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await register(form);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title={t('auth.registerTitle')}
      lead={t('auth.registerLead')}
      footer={
        <>
          {t('auth.haveAccount')} <Link to="/login">{t('auth.toLogin')}</Link>
        </>
      }
    >
      <form className="stack" onSubmit={submit} noValidate>
        {error && !Object.keys(errors).length ? <Alert tone="bad">{errorMessage(error, i18n)}</Alert> : null}
        <Field label={t('auth.name')} error={errors.name ? t('common.required') : null}>
          {(p) => <TextInput {...p} autoComplete="given-name" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        </Field>
        <Field label={t('auth.email')} error={errors.email ? t('errors.validation_failed') : null}>
          {(p) => <TextInput {...p} type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
        </Field>
        <Field label={t('auth.password')} hint={t('auth.passwordHint')}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={pending}>
          {t('auth.submitRegister')}
        </Button>
      </form>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const i18n = useI18n();
  const { t } = i18n;
  const [email, setEmail] = useState('');
  const [done, setDone] = useState<{ devResetUrl?: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  useTitle('auth.forgotTitle');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      setDone(await authApi.forgot(email));
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout title={t('auth.forgotTitle')} lead={t('auth.forgotLead')} footer={<Link to="/login">{t('auth.toLogin')}</Link>}>
      {done ? (
        <div className="stack">
          <Alert tone="ok">{t('auth.forgotDone')}</Alert>
          {done.devResetUrl ? (
            <Alert tone="warn">
              {t('auth.devResetLink')}{' '}
              <a href={new URL(done.devResetUrl).pathname + new URL(done.devResetUrl).search}>{t('auth.openResetLink')}</a>
            </Alert>
          ) : null}
        </div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          {error ? <Alert tone="bad">{errorMessage(error, i18n)}</Alert> : null}
          <Field label={t('auth.email')}>
            {(p) => <TextInput {...p} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Button type="submit" variant="primary" size="lg" block loading={pending}>
            {t('auth.forgotSubmit')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const i18n = useI18n();
  const { t } = i18n;
  const [params] = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  useTitle('auth.resetTitle');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setPending(true);
    setError(null);
    try {
      await authApi.reset(token, password);
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout title={t('auth.resetTitle')} lead={t('auth.resetLead')} footer={<Link to="/login">{t('auth.toLogin')}</Link>}>
      {!token ? (
        <Alert tone="bad">{t('auth.resetMissingToken')}</Alert>
      ) : done ? (
        <Alert tone="ok">{t('auth.resetDone')}</Alert>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          {error ? <Alert tone="bad">{errorMessage(error, i18n)}</Alert> : null}
          <Field label={t('auth.newPassword')} hint={t('auth.passwordHint')}>
            {(p) => <PasswordInput {...p} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Button type="submit" variant="primary" size="lg" block loading={pending}>
            {t('auth.resetSubmit')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
