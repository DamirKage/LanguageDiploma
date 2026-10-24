import { z, type ZodType } from 'zod';
import { routeRegistry } from './lib/http';

function toSchema(schema: ZodType | undefined): Record<string, unknown> | undefined {
  if (!schema) return undefined;
  try {
    const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
    delete json.$schema;
    return json;
  } catch {
    return { type: 'object' };
  }
}

function parametersFrom(schema: ZodType | undefined, location: 'path' | 'query') {
  const json = toSchema(schema) as { properties?: Record<string, unknown>; required?: string[] } | undefined;
  if (!json?.properties) return [];
  return Object.entries(json.properties).map(([name, propSchema]) => ({
    name,
    in: location,
    required: location === 'path' || (json.required ?? []).includes(name),
    schema: propSchema,
  }));
}

const errorResponse = {
  description: 'Ошибка',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
};

export function buildOpenApiDocument() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const { method, path, spec } of routeRegistry) {
    const openApiPath = path.replace(/:(\w+)/g, '{$1}') || '/';
    const responses: Record<string, unknown> = {
      [String(spec.status ?? 200)]: { description: spec.returns ? `Успешно. Тело: \`${spec.returns}\` (см. shared/src/api.ts)` : 'Успешно' },
      400: errorResponse,
    };
    if (spec.access !== 'public') responses[401] = errorResponse;
    if (spec.access === 'admin') responses[403] = errorResponse;
    const bodySchema = toSchema(spec.body);
    paths[openApiPath] ??= {};
    paths[openApiPath]![method] = {
      summary: spec.summary,
      description: spec.description,
      tags: spec.tags,
      security: spec.access === 'public' ? [] : [{ bearerAuth: [] }],
      parameters: [...parametersFrom(spec.params, 'path'), ...parametersFrom(spec.query, 'query')],
      ...(bodySchema ? { requestBody: { required: true, content: { 'application/json': { schema: bodySchema } } } } : {}),
      ...(spec.multipart
        ? {
            requestBody: {
              required: true,
              content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } },
            },
          }
        : {}),
      responses,
    };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'LinguaPath — REST API',
      version: '1.0.0',
      description:
        'API персонализированной платформы для изучения языков. Access-токен передаётся в заголовке `Authorization: Bearer …`; refresh-токен хранится в httpOnly-cookie и обновляется через `POST /api/auth/refresh` с заголовком `X-Requested-With: linguapath`.',
    },
    servers: [{ url: '/' }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, code: { type: 'string' }, message: { type: 'string' } } } },
              },
              required: ['code', 'message'],
            },
          },
        },
      },
    },
    paths,
  };
}
