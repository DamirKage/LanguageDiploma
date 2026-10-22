import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { I18nProvider } from '../i18n';

vi.mock('../api/client', async (orig) => {
  const actual = await orig<typeof import('../api/client')>();
  return { ...actual, refreshSession: vi.fn(() => Promise.reject(new actual.ApiError(401, 'unauthorized', 'x'))) };
});
vi.mock('../api/endpoints', () => ({
  authApi: { login: vi.fn(() => Promise.reject(new ApiError(401, 'invalid_credentials', 'Invalid'))) },
  catalogApi: { languages: vi.fn(() => Promise.resolve([])) },
}));

const { AuthProvider } = await import('../auth/AuthContext');
const { LoginPage } = await import('../features/auth/AuthPages');

describe('login page', () => {
  it('shows a Russian error message for wrong credentials', async () => {
    render(
      <I18nProvider>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <AuthProvider>
              <LoginPage />
            </AuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </I18nProvider>,
    );
    await userEvent.type(screen.getByLabelText('Электронная почта'), 'a@b.kz');
    await userEvent.type(screen.getByLabelText('Пароль'), 'wrong1234');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByText('Неверный адрес электронной почты или пароль.')).toBeInTheDocument();
  });
});
