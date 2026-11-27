import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSimulatorEnv } from './env';
import { unauthorized } from './http-error';
import { SESSION_COOKIE, verifySessionToken, type Session } from './session';

export async function getAdminSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, getSimulatorEnv().SESSION_SECRET);
}

/** Para páginas do admin: segunda camada de proteção após o proxy.ts. */
export async function requireAdminPage(): Promise<Session> {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  return session;
}

/** Para rotas de API do admin: retorna resposta 401 quando não há sessão válida. */
export async function adminApiGuard(): Promise<Response | null> {
  return (await getAdminSession()) ? null : unauthorized();
}
