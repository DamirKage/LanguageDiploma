export type ErrorCode =
  | 'validation_failed'
  | 'unauthorized'
  | 'invalid_credentials'
  | 'token_expired'
  | 'forbidden'
  | 'account_blocked'
  | 'not_found'
  | 'conflict'
  | 'email_taken'
  | 'invalid_token'
  | 'weak_password'
  | 'wrong_password'
  | 'rate_limited'
  | 'attempt_completed'
  | 'attempt_not_finished'
  | 'answer_mismatch'
  | 'not_enrolled'
  | 'no_exercises'
  | 'upload_rejected'
  | 'dictionary_unavailable'
  | 'csrf_failed'
  | 'internal';

/**
 * Default Russian messages. Clients should prefer translating by `code`;
 * the message is a readable fallback that never contains internal details.
 */
const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  validation_failed: 'Проверьте правильность заполнения полей.',
  unauthorized: 'Требуется вход в аккаунт.',
  invalid_credentials: 'Неверный адрес электронной почты или пароль.',
  token_expired: 'Сессия истекла. Войдите снова.',
  forbidden: 'Недостаточно прав для этого действия.',
  account_blocked: 'Аккаунт заблокирован. Обратитесь к администратору.',
  not_found: 'Запрошенный ресурс не найден.',
  conflict: 'Действие конфликтует с текущим состоянием данных.',
  email_taken: 'Аккаунт с таким адресом уже существует.',
  invalid_token: 'Ссылка недействительна или устарела.',
  weak_password: 'Пароль слишком простой.',
  wrong_password: 'Текущий пароль указан неверно.',
  rate_limited: 'Слишком много запросов. Повторите попытку позже.',
  attempt_completed: 'Эта попытка уже завершена.',
  attempt_not_finished: 'Сначала ответьте на все задания.',
  answer_mismatch: 'Ответ не соответствует текущему заданию.',
  not_enrolled: 'Сначала выберите этот язык для изучения.',
  no_exercises: 'Для этого занятия пока нет подходящих заданий.',
  upload_rejected: 'Файл не принят: проверьте тип и размер.',
  dictionary_unavailable: 'Словарный сервис временно недоступен.',
  csrf_failed: 'Запрос отклонён из соображений безопасности.',
  internal: 'Внутренняя ошибка сервера. Попробуйте позже.',
};

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message?: string,
    public readonly details?: Array<{ path: string; code: string; message: string }>,
  ) {
    super(message ?? DEFAULT_MESSAGES[code]);
  }
}

export const errors = {
  validation: (details: AppError['details']) => new AppError(400, 'validation_failed', undefined, details),
  unauthorized: (code: ErrorCode = 'unauthorized') => new AppError(401, code),
  forbidden: (code: ErrorCode = 'forbidden') => new AppError(403, code),
  notFound: () => new AppError(404, 'not_found'),
  conflict: (code: ErrorCode = 'conflict') => new AppError(409, code),
  badRequest: (code: ErrorCode) => new AppError(400, code),
};

export function defaultMessage(code: ErrorCode): string {
  return DEFAULT_MESSAGES[code];
}
