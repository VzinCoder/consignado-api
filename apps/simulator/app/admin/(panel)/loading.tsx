import { Loader2 } from 'lucide-react';

export default function AdminLoading() {
  return (
    <div className="flex items-center gap-2 py-24 text-muted-foreground">
      <Loader2 className="animate-spin" /> Carregando...
    </div>
  );
}
