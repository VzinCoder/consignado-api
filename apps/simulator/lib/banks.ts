import { Bird, Flower2, Landmark, Sailboat, Sprout, type LucideIcon } from 'lucide-react';

/** Ícones dos bancos conforme o design no Pencil. Bancos desconhecidos usam um ícone genérico. */
const BANK_ICONS: Record<string, LucideIcon> = {
  ipe: Flower2,
  mandacaru: Sprout,
  jangada: Sailboat,
  carcara: Bird,
};

export const bankIcon = (slug: string): LucideIcon => BANK_ICONS[slug] ?? Landmark;
