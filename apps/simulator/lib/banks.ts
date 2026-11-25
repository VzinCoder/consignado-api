import { Bird, Flower2, Landmark, Sailboat, Sprout, type LucideIcon } from 'lucide-react';

/** Bank icons from the Pencil design. Unknown banks fall back to a generic icon. */
const BANK_ICONS: Record<string, LucideIcon> = {
  ipe: Flower2,
  mandacaru: Sprout,
  jangada: Sailboat,
  carcara: Bird,
};

export const bankIcon = (slug: string): LucideIcon => BANK_ICONS[slug] ?? Landmark;
