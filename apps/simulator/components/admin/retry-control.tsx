'use client';

import { useMutation } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { request } from '@/lib/api-client';

const retrySchema = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'FAILED']) });

const OUTCOME: Record<z.infer<typeof retrySchema>['status'], string> = {
  APPROVED: 'O banco aprovou a simulação.',
  REJECTED: 'O banco respondeu, mas não aprovou.',
  FAILED: 'O banco continua fora do ar. Tente de novo mais tarde.',
  PENDING: 'O banco ainda está respondendo.',
};

/** Tela 13: reconsulta um banco FAILED e atualiza a página renderizada no servidor. */
export function RetryControl({
  bankResultId,
  bankName,
}: {
  bankResultId: string;
  bankName: string;
}) {
  const router = useRouter();
  const retry = useMutation({
    mutationFn: () =>
      request(`/api/admin/bank-results/${bankResultId}/retry`, retrySchema, { method: 'POST' }),
    onSuccess: ({ status }) => {
      toast.success(`Reconsulta enviada para ${bankName}.`, { description: OUTCOME[status] });
      router.refresh();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível reconsultar.');
      router.refresh();
    },
  });

  return (
    <div className="flex items-center gap-2">
      {retry.isPending ? (
        <Badge className="rounded-full bg-warning font-medium text-warning-foreground">
          Reconsultando
        </Badge>
      ) : (
        <Badge className="rounded-full bg-destructive-muted font-medium text-destructive">
          Falhou
        </Badge>
      )}
      <Button variant="outline" size="sm" onClick={() => retry.mutate()} disabled={retry.isPending}>
        <RefreshCw className={retry.isPending ? 'animate-spin' : undefined} /> Reconsultar
      </Button>
    </div>
  );
}
