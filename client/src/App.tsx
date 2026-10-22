import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { PageLoader } from './components/ui';
import { LandingPage } from './features/landing/LandingPage';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './features/auth/AuthPages';
import { NotFoundPage } from './features/landing/NotFoundPage';

const OnboardingPage = lazy(() => import('./features/onboarding/OnboardingPage'));
const TodayPage = lazy(() => import('./features/today/TodayPage'));
const PathPage = lazy(() => import('./features/path/PathPage'));
const LessonPage = lazy(() => import('./features/lesson/LessonPage'));
const PlayerPage = lazy(() => import('./features/lesson/PlayerPage'));
const ReviewPage = lazy(() => import('./features/review/ReviewPage'));
const VocabularyPage = lazy(() => import('./features/vocabulary/VocabularyPage'));
const ProgressPage = lazy(() => import('./features/progress/ProgressPage'));
const ProfilePage = lazy(() => import('./features/profile/ProfilePage'));
const AdminApp = lazy(() => import('./features/admin/AdminApp'));

function RequireAuth({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <PageLoader />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (admin && user?.role !== 'admin') return <Navigate to="/today" replace />;
  return <>{children}</>;
}

/** Learners finish onboarding (language, goals, time) before entering the app. */
function RequireOnboarded({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user && user.role !== 'admin' && (!user.onboarded || !user.activeLanguage)) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  if (status === 'loading') return <PageLoader />;
  if (status === 'authenticated') return <Navigate to={user?.role === 'admin' && !user.activeLanguage ? '/admin' : '/today'} replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<PublicOnly><LandingPage /></PublicOnly>} />
        <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
        <Route path="/learn/:attemptId" element={<RequireAuth><PlayerPage /></RequireAuth>} />
        <Route path="/review/session" element={<RequireAuth><ReviewPage session /></RequireAuth>} />
        <Route path="/admin/*" element={<RequireAuth admin><AdminApp /></RequireAuth>} />
        <Route
          element={
            <RequireAuth>
              <RequireOnboarded>
                <AppShell />
              </RequireOnboarded>
            </RequireAuth>
          }
        >
          <Route path="/today" element={<TodayPage />} />
          <Route path="/path" element={<PathPage />} />
          <Route path="/lessons/:lessonId" element={<LessonPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/vocabulary" element={<VocabularyPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
