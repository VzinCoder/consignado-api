import {
  BadgeCheck,
  Bell,
  Layers,
  Search,
  ShieldCheck,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import { SimulationRequestForm } from '@/components/simulation-request-form';
import { SiteHeader } from '@/components/site-header';
import { Card } from '@/components/ui/card';

const TRUST: [LucideIcon, string][] = [
  [ShieldCheck, 'Dados protegidos'],
  [BadgeCheck, 'Sem compromisso'],
  [Timer, 'Resposta em minutos'],
];

const FEATURES: [LucideIcon, string, string][] = [
  [Search, 'Compare em um só lugar', 'Receba ofertas de diferentes bancos, sem burocracia.'],
  [
    Layers,
    'Veja o custo total',
    'Saiba o valor das parcelas e o total a pagar, de forma transparente.',
  ],
  [
    Bell,
    'Acompanhe cada resposta',
    'Veja o andamento das propostas e seja avisado a cada novidade.',
  ],
];

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-[1312px] items-center gap-12 px-6 py-16 lg:grid-cols-[1fr_420px] lg:py-20">
          <div className="flex flex-col gap-6">
            <span className="w-fit rounded-full bg-accent px-3 py-1 text-xs font-medium text-primary">
              Crédito consignado · simulação gratuita
            </span>
            <h1 className="max-w-[640px] text-5xl leading-[1.05] font-extrabold tracking-tight lg:text-[68px]">
              Seu crédito, com tudo às claras.
            </h1>
            <p className="max-w-[560px] text-xl text-muted-foreground">
              Compare ofertas de diferentes bancos e escolha com tranquilidade — sem letras miúdas,
              sem pressa.
            </p>
            <ul className="flex flex-wrap gap-6">
              {TRUST.map(([Icon, label]) => (
                <li
                  key={label}
                  className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground"
                >
                  <Icon className="size-4 text-primary" aria-hidden /> {label}
                </li>
              ))}
            </ul>
          </div>

          <Card id="simular" className="gap-5 rounded-xl p-7 shadow-sm">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">Simule seu empréstimo consignado</h2>
              <p className="text-sm text-muted-foreground">Leva menos de um minuto.</p>
            </div>
            <SimulationRequestForm />
          </Card>
        </section>

        <section id="como-funciona" className="border-t border-border bg-card/60">
          <div className="mx-auto grid max-w-[1312px] gap-8 px-6 py-12 md:grid-cols-3">
            {FEATURES.map(([Icon, title, text]) => (
              <div key={title} className="flex gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent">
                  <Icon className="size-5 text-primary" aria-hidden />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-[17px] font-bold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
