import type { Icd10CodeEntry } from '../types';

/** Normalize API/stored icd10Codes (legacy string[] or object array) for UI. */
export function normalizeIcd10Codes(
  codes?: Icd10CodeEntry[] | string[],
  descriptions?: string[]
): Icd10CodeEntry[] {
  if (!codes?.length) return [];
  const first = codes[0];
  if (typeof first === 'string') {
    return (codes as string[])
      .map((code, i) => ({
        code: String(code).trim(),
        description: descriptions?.[i]?.trim() ?? '',
        primary: false,
      }))
      .filter((e) => e.code.length > 0);
  }
  return (codes as Icd10CodeEntry[]).map((entry) => ({
    code: String(entry.code ?? '').trim(),
    description: String(entry.description ?? '').trim(),
    primary: Boolean(entry.primary),
    startDate: entry.startDate?.trim() || undefined,
  })).filter((e) => e.code.length > 0);
}

export function icd10CodesEqual(a: Icd10CodeEntry[], b: Icd10CodeEntry[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
