import { ArrowRight, User } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-[78px] max-w-[1312px] items-center justify-between px-6">
        <Link href="/" aria-label="Zelafin, página inicial">
          <Image src="/logo.png" alt="Zelafin" width={144} height={32} priority />
        </Link>
        <nav className="flex items-center gap-2 text-sm font-medium">
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href="/#como-funciona">Como funciona</Link>
          </Button>
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href="/#duvidas">Dúvidas</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/admin">
              <User /> Entrar
            </Link>
          </Button>
          <Button asChild>
            <Link href="/#simular">
              Simular agora <ArrowRight />
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
