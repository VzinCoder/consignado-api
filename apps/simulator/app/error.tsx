'use client';

import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/** Unexpected failures (e.g. database offline) show this page instead of the framework default. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="max-w-[440px] items-center gap-4 rounded-xl p-10 text-center shadow-none">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive-muted">
          <TriangleAlert className="size-6 text-destructive" aria-hidden />
        </div>
        <h1 className="text-[22px] font-bold">Algo deu errado</h1>
        <p className="text-[15px] text-muted-foreground">
          Não foi possível carregar esta página agora. Tente de novo em instantes.
        </p>
        <Button onClick={reset}>Tentar de novo</Button>
      </Card>
    </main>
  );
}
