// Mirrors public.commission_for() in the database. Keep both in sync.
export const TIERS = [
  { min: 10000, commission: 4000 },
  { min: 5000, commission: 2000 },
  { min: 2500, commission: 1000 },
  { min: 1000, commission: 400 },
  { min: 250, commission: 100 },
] as const;

export const MIN_QUALIFIED_REFERRALS = 3;

export function commissionFor(amount: number): number {
  return TIERS.find((t) => amount >= t.min)?.commission ?? 0;
}

export const ksh = (n: number | string) =>
  `KSh ${Number(n).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
