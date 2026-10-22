import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { z, type ZodType } from 'zod';
import { errors } from './errors';
import { authenticate, type AuthUser } from '../modules/auth/middleware';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
type Access = 'public' | 'user' | 'admin' | 'optional';

export interface RouteSpec<B extends ZodType | undefined, Q extends ZodType | undefined, P extends ZodType | undefined> {
  summary: string;
  description?: string;
  tags: string[];
  access: Access;
  body?: B;
  query?: Q;
  params?: P;
  status?: number;
  /** Name of the shared DTO returned, documented as a description only. */
  returns?: string;
  middleware?: RequestHandler[];
  /** Request body is multipart/form-data (documented, not validated by zod). */
  multipart?: boolean;
}

type Infer<T> = T extends ZodType ? z.infer<T> : undefined;

export interface HandlerContext<B, Q, P> {
  body: B;
  query: Q;
  params: P;
  user: AuthUser;
  optionalUser: AuthUser | null;
  req: Request;
  res: Response;
}

export interface RegisteredRoute {
  method: Method;
  path: string;
  spec: RouteSpec<ZodType | undefined, ZodType | undefined, ZodType | undefined>;
}

export const routeRegistry: RegisteredRoute[] = [];

function issuesToDetails(error: z.ZodError, prefix: string) {
  return error.issues.map((issue) => ({
    path: [prefix, ...issue.path.map(String)].join('.'),
    code: issue.code,
    message: issue.message,
  }));
}

/**
 * Express router whose routes are validated with zod and recorded for the OpenAPI document.
 * Handlers return the response body; `undefined` produces 204 No Content.
 */
export function createApiRouter(prefix: string) {
  const router = Router();

  function add(method: Method) {
    return <
      B extends ZodType | undefined = undefined,
      Q extends ZodType | undefined = undefined,
      P extends ZodType | undefined = undefined,
    >(
      path: string,
      spec: RouteSpec<B, Q, P>,
      handler: (ctx: HandlerContext<Infer<B>, Infer<Q>, Infer<P>>) => unknown | Promise<unknown>,
    ) => {
      routeRegistry.push({ method, path: prefix + path, spec: spec as RegisteredRoute['spec'] });
      const chain: RequestHandler[] = [];
      if (spec.access !== 'public') chain.push(authenticate(spec.access));
      chain.push(...(spec.middleware ?? []));
      chain.push(async (req: Request, res: Response, next: NextFunction) => {
        const valid: Record<string, unknown> = {};
        for (const [key, schema] of [
          ['params', spec.params],
          ['query', spec.query],
          ['body', spec.body],
        ] as const) {
          if (!schema) continue;
          const result = schema.safeParse(req[key] ?? {});
          if (!result.success) throw errors.validation(issuesToDetails(result.error, key));
          valid[key] = result.data;
        }
        const user = res.locals.user as AuthUser | undefined;
        const out = await handler({
          body: valid.body as Infer<B>,
          query: valid.query as Infer<Q>,
          params: valid.params as Infer<P>,
          user: user as AuthUser,
          optionalUser: user ?? null,
          req,
          res,
        });
        if (res.headersSent) return;
        if (out === undefined) res.status(204).end();
        else res.status(spec.status ?? 200).json(out);
        void next;
      });
      router[method](prefix + path, ...chain);
    };
  }

  return {
    router,
    get: add('get'),
    post: add('post'),
    put: add('put'),
    patch: add('patch'),
    delete: add('delete'),
  };
}

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Некорректный идентификатор');
export const idParams = z.object({ id: objectId });
export const languageCode = z.string().trim().toLowerCase().regex(/^[a-z]{2,3}$/, 'Некорректный код языка');
export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
