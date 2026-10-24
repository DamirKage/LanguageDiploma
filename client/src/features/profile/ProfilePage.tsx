import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CEFR_LEVELS, DAILY_MINUTES_OPTIONS, LEARNING_GOALS, type CefrLevel, type LearningGoal } from '@linguapath/shared';
import { learningApi, meApi } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { Alert, Button, buttonClass, Dialog, errorMessage, Field, LanguageMark, PasswordInput, Section, Select, TextInput, useTitle, useToast } from '../../components/ui';
import { ThemePicker } from '../../components/theme/ThemePicker';
import { useI18n } from '../../i18n';
import { LEARNING_KEYS, useEnrollments, useLanguageName } from '../../lib/queries';

function timezones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  return intl.supportedValuesOf?.('timeZone') ?? ['Asia/Almaty', 'Asia/Aqtobe', 'Europe/Moscow', 'Europe/Berlin', 'UTC'];
}

export default function ProfilePage() {
  const i18n = useI18n();
  const { t } = i18n;
  const { user, setUser, applySession, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: enrollments } = useEnrollments();
  const languageName = useLanguageName();
  const [form, setForm] = useState({ name: user!.name, timezone: user!.timezone, dailyMinutes: user!.dailyMinutes, goals: user!.goals as LearningGoal[] });
  const [passwords, setPasswords] = useState({ current: '', next: '' });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  useTitle('profile.title');

  const invalidate = () => {
    for (const key of LEARNING_KEYS) void queryClient.invalidateQueries({ queryKey: key });
  };

  const save = useMutation({
    mutationFn: () => meApi.update(form),
    onSuccess: (u) => {
      setUser(u);
      toast(t('common.saved'));
      invalidate();
    },
  });
  const changePassword = useMutation({
    mutationFn: () => meApi.changePassword(passwords.current, passwords.next),
    onSuccess: (auth) => {
      applySession(auth);
      setPasswords({ current: '', next: '' });
      toast(t('profile.passwordChanged'));
    },
  });
  const makeActive = useMutation({
    mutationFn: (code: string) => meApi.update({ activeLanguage: code }),
    onSuccess: (u) => {
      setUser(u);
      invalidate();
    },
  });
  const setLevel = useMutation({
    mutationFn: ({ code, level }: { code: string; level: CefrLevel }) => meApi.setLevel(code, level),
    onSuccess: invalidate,
  });
  const placement = useMutation({
    mutationFn: (code: string) => learningApi.startPlacement(code),
    onSuccess: (attempt) => navigate(`/learn/${attempt.id}`),
    onError: (err) => toast(errorMessage(err, i18n), 'bad'),
  });
  const remove = useMutation({
    mutationFn: () => meApi.deleteAccount(deletePassword),
    onSuccess: async () => {
      toast(t('profile.deleted'));
      await logout().catch(() => undefined);
      navigate('/');
    },
  });

  const submitProfile = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <>
      <header className="page-head">
        <h1>{t('profile.title')}</h1>
        <p className="page-head__lead">{user!.email}</p>
      </header>

      <form className="settings" onSubmit={submitProfile}>
        <Section title={t('profile.personal')}>
          <div className="form-grid">
            <Field label={t('profile.name')}>{(p) => <TextInput {...p} value={form.name} maxLength={80} required onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
            <Field label={t('profile.timezone')} hint={t('profile.timezoneHint')}>
              {(p) => (
                <Select {...p} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                  {timezones().map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </Section>

        <Section title={t('profile.study')}>
          <Field label={t('profile.dailyMinutes')}>
            {(p) => (
              <Select {...p} value={form.dailyMinutes} onChange={(e) => setForm({ ...form, dailyMinutes: Number(e.target.value) })}>
                {DAILY_MINUTES_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {t('onboarding.timeOption', { n })}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <fieldset className="fieldset">
            <legend className="field__label">{t('profile.goals')}</legend>
            <div className="chip-list">
              {LEARNING_GOALS.map((goal) => (
                <label key={goal} className="checkbox">
                  <input
                    type="checkbox"
                    checked={form.goals.includes(goal)}
                    onChange={(e) => setForm({ ...form, goals: e.target.checked ? [...form.goals, goal] : form.goals.filter((g) => g !== goal) })}
                  />
                  {t(`goals.${goal}`)}
                </label>
              ))}
            </div>
          </fieldset>
          {save.error ? <Alert tone="bad">{errorMessage(save.error, i18n)}</Alert> : null}
          <div>
            <Button type="submit" variant="primary" loading={save.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </Section>
      </form>

      <Section title={t('profile.languages')} aside={<Link to="/onboarding?add=1" className={buttonClass({ size: 'sm' })}>{t('profile.addLanguage')}</Link>}>
        <ul className="lang-list">
          {(enrollments ?? []).map((e) => (
            <li key={e.language} className="lang-list__row">
              <LanguageMark code={e.language} size="lg" />
              <div className="stack" style={{ '--gap': '2px', flex: 1 } as React.CSSProperties}>
                <span className="lang-list__name">{languageName(e.language)}</span>
                <span className="caption">{e.placementLevel ? t('profile.placementResult', { level: e.placementLevel }) : null}</span>
              </div>
              <Select
                aria-label={t('profile.languageLevel')}
                value={e.level}
                style={{ width: 'auto' }}
                onChange={(ev) => setLevel.mutate({ code: e.language, level: ev.target.value as CefrLevel })}
              >
                {CEFR_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
              <Button size="sm" variant="ghost" onClick={() => placement.mutate(e.language)} loading={placement.isPending && placement.variables === e.language}>
                {t('profile.retakePlacement')}
              </Button>
              {user!.activeLanguage === e.language ? (
                <span className="tag tag--accent">{t('profile.active')}</span>
              ) : (
                <Button size="sm" onClick={() => makeActive.mutate(e.language)}>
                  {t('profile.makeActive')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('theme.label')}>
        <p className="small muted">{t('theme.hint')}</p>
        <ThemePicker />
      </Section>

      <Section title={t('profile.security')}>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            changePassword.mutate();
          }}
        >
          <Field label={t('profile.currentPassword')}>
            {(p) => <PasswordInput {...p} autoComplete="current-password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} />}
          </Field>
          <Field label={t('profile.newPassword')} hint={t('auth.passwordHint')}>
            {(p) => <PasswordInput {...p} autoComplete="new-password" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} />}
          </Field>
          {changePassword.error ? <Alert tone="bad">{errorMessage(changePassword.error, i18n)}</Alert> : null}
          <div>
            <Button type="submit" disabled={!passwords.current || !passwords.next} loading={changePassword.isPending}>
              {t('profile.changePassword')}
            </Button>
          </div>
        </form>
      </Section>

      <Section title={t('profile.danger')}>
        <p className="muted small">{t('profile.dangerLead')}</p>
        <div>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            {t('profile.deleteAccount')}
          </Button>
        </div>
      </Section>

      <div className="mobile-only">
        <Button
          block
          onClick={async () => {
            await logout();
            navigate('/');
          }}
        >
          {t('nav.logout')}
        </Button>
      </div>

      <Dialog
        open={deleteOpen}
        title={t('profile.deleteAccount')}
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <Button onClick={() => setDeleteOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" disabled={!deletePassword} loading={remove.isPending} onClick={() => remove.mutate()}>
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <div className="stack">
          <p>{t('profile.dangerLead')}</p>
          <Field label={t('profile.deleteConfirm')}>{(p) => <PasswordInput {...p} value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />}</Field>
          {remove.error ? <Alert tone="bad">{errorMessage(remove.error, i18n)}</Alert> : null}
        </div>
      </Dialog>
    </>
  );
}
