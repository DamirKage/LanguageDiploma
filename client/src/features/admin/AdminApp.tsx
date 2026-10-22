import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookA, FileCheck2, Globe2, Image, LayoutDashboard, Layers, LogOut, Users } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Brand } from '../../components/layout/AppShell';
import { useI18n } from '../../i18n';
import { AdminDashboard } from './AdminDashboard';
import { AdminContent } from './AdminContent';
import { LessonEditorPage } from './LessonEditor';
import { AdminWords } from './AdminWords';
import { AdminTests, TestEditorPage } from './AdminTests';
import { AdminUsers } from './AdminUsers';
import { AdminMedia } from './AdminMedia';
import { AdminLanguages } from './AdminLanguages';
import { NotFoundPage } from '../landing/NotFoundPage';

export default function AdminApp() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = [
    { to: '/admin', label: t('admin.nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/admin/content', label: t('admin.nav.content'), icon: Layers },
    { to: '/admin/words', label: t('admin.nav.words'), icon: BookA },
    { to: '/admin/tests', label: t('admin.nav.tests'), icon: FileCheck2 },
    { to: '/admin/languages', label: t('admin.nav.languages'), icon: Globe2 },
    { to: '/admin/media', label: t('admin.nav.media'), icon: Image },
    { to: '/admin/users', label: t('admin.nav.users'), icon: Users },
  ];
  return (
    <div className="shell admin">
      <a href="#main" className="skip-link">
        {t('app.skipToContent')}
      </a>
      <aside className="sidebar">
        <Brand />
        <p className="eyebrow" style={{ padding: '0 var(--s2)' }}>
          {t('admin.title')}
        </p>
        <nav className="nav" aria-label={t('admin.title')}>
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav__link">
              <Icon size={18} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__foot">
          {user?.activeLanguage ? (
            <NavLink to="/today" className="nav__link">
              <ArrowLeft size={18} aria-hidden />
              {t('nav.backToApp')}
            </NavLink>
          ) : null}
          <button
            className="nav__link"
            style={{ border: 0, background: 'transparent', textAlign: 'left' }}
            onClick={async () => {
              await logout();
              navigate('/');
            }}
          >
            <LogOut size={18} aria-hidden />
            {t('nav.logout')}
          </button>
        </div>
      </aside>
      <header className="topbar">
        <Brand />
        <span className="small muted">{t('admin.title')}</span>
      </header>
      <nav className="admin-tabs" aria-label={t('admin.title')}>
        {items.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end} className="admin-tabs__link">
            {label}
          </NavLink>
        ))}
      </nav>
      <main id="main" className="main">
        <div className="main__inner">
          <Routes>
            <Route index element={<AdminDashboard />} />
            <Route path="content" element={<AdminContent />} />
            <Route path="content/lessons/new" element={<LessonEditorPage />} />
            <Route path="content/lessons/:id" element={<LessonEditorPage />} />
            <Route path="words" element={<AdminWords />} />
            <Route path="tests" element={<AdminTests />} />
            <Route path="tests/:id" element={<TestEditorPage />} />
            <Route path="languages" element={<AdminLanguages />} />
            <Route path="media" element={<AdminMedia />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
