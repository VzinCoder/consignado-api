import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="max-w-[440px] items-center gap-4 rounded-xl p-10 text-center shadow-none">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent">
          <SearchX className="size-6 text-primary" aria-hidden />
        </div>
        <h1 className="text-[22px] font-bold">Página não encontrada</h1>
        <p className="text-[15px] text-muted-foreground">
          Confira o endereço. Se veio de um link, ele pode estar incompleto.
        </p>
        <Button asChild>
          <Link href="/">Ir para o início</Link>
        </Button>
      </Card>
    </main>
  );
}
