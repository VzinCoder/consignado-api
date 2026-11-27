'use client';

import { CirclePlus, FileText, LayoutDashboard, LogOut, type LucideIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Avatar } from '@/components/admin/avatar';
import { cn } from '@/lib/utils';

const NAV: [string, string, LucideIcon][] = [
  ['/admin', 'Visão geral', LayoutDashboard],
  ['/admin/simulacoes', 'Simulações', FileText],
  ['/admin/nova', 'Nova simulação', CirclePlus],
];

/** "maria.souza@zelafin.com.br" -> "Maria Souza" */
const displayName = (username: string) =>
  (username.split('@')[0] ?? username)
    .split(/[._-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const isActive = (pathname: string, href: string) =>
  href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

export function AdminSidebar({ username }: { username: string }) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } finally {
      // Navegação completa descarta o Router Cache e os dados do painel em memória.
      window.location.replace('/admin/login');
    }
  }

  return (
    <aside className="sticky top-0 flex h-screen w-[248px] shrink-0 flex-col gap-7 border-r border-border bg-card px-4 py-6">
      <Link href="/admin" className="px-2">
        <Image
          src="/logo.png"
          alt="Zelafin"
          width={126}
          height={28}
          className="h-7 w-auto"
          priority
        />
      </Link>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(([href, label, Icon]) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted',
                active && 'bg-accent font-bold text-primary hover:bg-accent',
              )}
            >
              <Icon className="size-4" aria-hidden /> {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-2.5 border-t border-border px-2 pt-3">
        <Avatar name={displayName(username)} className="bg-accent text-xs text-primary" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-semibold" title={username}>
            {displayName(username)}
          </span>
          <span className="text-xs text-muted-foreground">Atendimento</span>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          disabled={loggingOut}
          aria-label="Sair"
          title="Sair"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  );
}
