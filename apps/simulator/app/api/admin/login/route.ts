import { cookies } from 'next/headers';
import { z } from 'zod';
import { getSimulatorEnv } from '@/lib/env';
import { errorJson, invalidRequest } from '@/lib/http-error';
import { getContainer, handle, readJson } from '@/lib/server';
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken, safeEqual } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const loginSchema = z.object({ username: z.string().trim(), password: z.string() });

export function POST(request: Request) {
  return handle(async () => {
    const parsed = loginSchema.safeParse(await readJson(request));
    if (!parsed.success) return invalidRequest(parsed.error);

    const env = getSimulatorEnv();
    const [userOk, passwordOk] = await Promise.all([
      safeEqual(parsed.data.username.toLowerCase(), env.ADMIN_USERNAME.toLowerCase()),
      safeEqual(parsed.data.password, env.ADMIN_PASSWORD),
    ]);
    const { logger } = getContainer();
    if (!userOk || !passwordOk) {
      logger.warn('tentativa de login do admin recusada', {});
      return errorJson(401, {
        error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' },
      });
    }

    (await cookies()).set(
      SESSION_COOKIE,
      await createSessionToken(env.ADMIN_USERNAME, env.SESSION_SECRET),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.NODE_ENV === 'production',
        path: '/',
        maxAge: SESSION_TTL_SECONDS,
      },
    );
    logger.info('login do admin', {});
    return new Response(null, { status: 204 });
  });
}
