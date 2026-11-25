import type { SimulationStatus } from '@zelafin/core';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Props {
  status: SimulationStatus;
  needsRetry: boolean;
}

/** Admin wording from the Pencil frames (Interessado, Em análise, Respondida, Pendente). */
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

export function StatusBadge(props: Props) {
  const { label, tone } = adminStatusLabel(props);
  return <Badge className={cn('rounded-full font-medium', tone)}>{label}</Badge>;
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

/** Maps the URL filter to the core filter. */
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
