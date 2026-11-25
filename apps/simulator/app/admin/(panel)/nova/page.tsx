import { NewSimulationForm } from '@/components/admin/new-simulation-form';

export default function NewAdminSimulationPage() {
  return (
    <div className="flex max-w-[960px] flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-extrabold">Nova simulação</h1>
        <p className="text-sm text-muted-foreground">
          Para clientes atendidos por telefone ou WhatsApp. O cliente recebe as ofertas por link.
        </p>
      </div>
      <NewSimulationForm />
    </div>
  );
}
