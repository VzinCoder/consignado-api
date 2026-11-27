import { NextResponse, type NextRequest } from 'next/server';
import { getSimulatorEnv } from './lib/env';
import { SESSION_COOKIE, verifySessionToken } from './lib/session';

const PUBLIC_ADMIN_PATHS = ['/admin/login', '/api/admin/login'];

/** Protege a área administrativa: páginas redirecionam para o login, APIs respondem 401. */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_ADMIN_PATHS.includes(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token, getSimulatorEnv().SESSION_SECRET);
  if (session) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Faça login para continuar.' } },
      { status: 401 },
    );
  }
  return NextResponse.redirect(new URL('/admin/login', request.url));
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
