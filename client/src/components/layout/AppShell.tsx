import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CalendarCheck2, ChevronDown, LayoutDashboard, LogOut, Map as MapIcon, Plus, Repeat2, Settings2, TrendingUp, UserRound } from 'lucide-react';
import { meApi, reviewApi } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { useI18n } from '../../i18n';
import { LEARNING_KEYS, qk, useActiveLanguage, useEnrollments, useLanguageName } from '../../lib/queries';
import { LanguageMark } from '../ui';

export function Brand() {
  const { t } = useI18n();
  return (
    <Link to="/" className="brand" aria-label={t('app.name')}>
      <span className="brand__word">{t('app.name')}</span>
      <span className="brand__dot" aria-hidden />
    </Link>
  );
}

function LanguageSwitcher() {
  const { t } = useI18n();
  const { user, setUser } = useAuth();
  const { data: enrollments } = useEnrollments();
  const languageName = useLanguageName();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const switchLanguage = useMutation({
    mutationFn: (code: string) => meApi.update({ activeLanguage: code }),
    onSuccess: (updated) => {
      setUser(updated);
      for (const key of LEARNING_KEYS) void queryClient.invalidateQueries({ queryKey: key });
      setOpen(false);
    },
  });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = user?.activeLanguage;
  return (
    <div className="lang-switch" ref={ref}>
      <button className="lang-switch__button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} aria-label={t('nav.language')}>
        {active ? <LanguageMark code={active} /> : null}
        <span style={{ flex: 1, fontWeight: 560, fontSize: 'var(--text-sm)' }}>{active ? languageName(active) : t('nav.addLanguage')}</span>
        <ChevronDown size={16} aria-hidden />
      </button>
      {open ? (
        <div className="lang-switch__menu" role="menu">
          {(enrollments ?? []).map((e) => (
            <button key={e.language} role="menuitem" className="lang-switch__item" onClick={() => switchLanguage.mutate(e.language)}>
              <LanguageMark code={e.language} />
              <span style={{ flex: 1 }}>{languageName(e.language)}</span>
              <span className="tag">{e.level}</span>
            </button>
          ))}
          <button
            role="menuitem"
            className="lang-switch__item"
            onClick={() => {
              setOpen(false);
              navigate('/onboarding?add=1');
            }}
          >
            <Plus size={18} aria-hidden />
            <span>{t('nav.addLanguage')}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function useDueReviews() {
  const { code } = useActiveLanguage();
  const { data } = useQuery({
    queryKey: qk.reviewQueue(code ?? '', 'auto'),
    queryFn: () => reviewApi.queue(code!, 'auto'),
    enabled: !!code,
    staleTime: 60_000,
  });
  return data ? data.cards.length : 0;
}

export function AppShell() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const due = useDueReviews();
  const items = [
    { to: '/today', label: t('nav.today'), icon: CalendarCheck2 },
    { to: '/path', label: t('nav.path'), icon: MapIcon },
    { to: '/review', label: t('nav.review'), icon: Repeat2, badge: due },
    { to: '/vocabulary', label: t('nav.vocabulary'), icon: BookOpen },
    { to: '/progress', label: t('nav.progress'), icon: TrendingUp },
  ];
  const initials = (user?.name ?? '?').trim().slice(0, 1).toUpperCase();

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        {t('app.skipToContent')}
      </a>
      <aside className="sidebar">
        <Brand />
        <LanguageSwitcher />
        <nav className="nav" aria-label={t('nav.main')}>
          {items.map(({ to, label, icon: Icon, badge }) => (
            <NavLink key={to} to={to} className="nav__link">
              <Icon size={18} aria-hidden />
              {label}
              {badge ? <span className="nav__badge">{badge}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__foot">
          {user?.role === 'admin' ? (
            <NavLink to="/admin" className="nav__link">
              <LayoutDashboard size={18} aria-hidden />
              {t('nav.admin')}
            </NavLink>
          ) : null}
          <NavLink to="/profile" className="nav__link">
            <Settings2 size={18} aria-hidden />
            {t('nav.profile')}
          </NavLink>
          <div className="user-chip">
            <span className="user-chip__avatar" aria-hidden>
              {initials}
            </span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</span>
            <button
              className="btn btn--ghost btn--icon btn--sm"
              aria-label={t('nav.logout')}
              title={t('nav.logout')}
              onClick={async () => {
                await logout();
                navigate('/');
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <header className="topbar">
        <Brand />
        <LanguageSwitcher />
      </header>

      <main id="main" className="main">
        <div className="main__inner">
          <Outlet />
        </div>
      </main>

      <nav className="tabbar" aria-label={t('nav.main')}>
        {[...items.filter((i) => i.to !== '/vocabulary'), { to: '/profile', label: t('nav.profile'), icon: UserRound, badge: 0 }].map(
          ({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="tabbar__link">
              <Icon size={20} aria-hidden />
              {label}
            </NavLink>
          ),
        )}
      </nav>
    </div>
  );
}
