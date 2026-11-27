import type { SimulationStatus } from '@zelafin/core';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Props {
  status: SimulationStatus;
  needsRetry: boolean;
}

/** Rótulos do admin definidos no design Pencil (Interessado, Em análise, Respondida, Pendente). */
export function adminStatusLabel({ status, needsRetry }: Props): { label: string; tone: string } {
  if (status === 'INTERESTED') {
    return { label: 'Interessado', tone: 'bg-primary text-primary-foreground' };
  }
  if (status === 'PROCESSING') {
    return { label: 'Em análise', tone: 'bg-warning text-warning-foreground' };
  }
  if (status === 'EXPIRED') return { label: 'Expirada', tone: 'bg-muted text-muted-foreground' };
  if (needsRetry) return { label: 'Pendente', tone: 'bg-muted text-muted-foreground' };
  return { label: 'Respondida', tone: 'bg-accent text-primary' };
}

/**
 * Status principal mais um marcador "Reconsultar" quando algum banco falhou numa simulação cujo rótulo principal
 * ainda não é "Pendente" (ex.: um cliente interessado): o filtro "Pendente" mostra todos eles.
 */
export function StatusBadge(props: Props) {
  const { label, tone } = adminStatusLabel(props);
  const extraRetryMarker = props.needsRetry && label !== 'Pendente';
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge className={cn('rounded-full font-medium', tone)}>{label}</Badge>
      {extraRetryMarker && (
        <Badge className="rounded-full bg-destructive-muted font-medium text-destructive">
          Reconsultar
        </Badge>
      )}
    </span>
  );
}

export const STATUS_FILTERS = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'interessado', label: 'Interessado' },
  { value: 'em-analise', label: 'Em análise' },
  { value: 'respondida', label: 'Respondida' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'expirada', label: 'Expirada' },
] as const;

export type StatusFilterValue = (typeof STATUS_FILTERS)[number]['value'];

/** Mapeia o filtro da URL para o filtro do core. */
export function toCoreFilter(value: string | undefined): {
  status?: SimulationStatus;
  needsRetry?: boolean;
} {
  switch (value) {
    case 'interessado':
      return { status: 'INTERESTED' };
    case 'em-analise':
      return { status: 'PROCESSING' };
    case 'respondida':
      return { status: 'COMPLETED', needsRetry: false };
    case 'pendente':
      return { needsRetry: true };
    case 'expirada':
      return { status: 'EXPIRED' };
    default:
      return {};
  }
}
