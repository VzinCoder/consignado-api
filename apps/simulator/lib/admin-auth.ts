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

/** For admin pages: second layer after proxy.ts. */
export async function requireAdminPage(): Promise<Session> {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  return session;
}

/** For admin API routes: returns a 401 response when there is no valid session. */
export async function adminApiGuard(): Promise<Response | null> {
  return (await getAdminSession()) ? null : unauthorized();
}
