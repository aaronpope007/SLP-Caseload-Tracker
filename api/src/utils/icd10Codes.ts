import { parseJsonField, stringifyJsonField } from './jsonHelpers';
import type { Icd10CodeEntry } from '../schemas/index';

/** Parse stored icd10Codes JSON (+ optional legacy icd10Descriptions) into object array. */
export function parseStoredIcd10Codes(
  codesJson: string | null | undefined,
  descriptionsJson?: string | null
): Icd10CodeEntry[] {
  const raw = parseJsonField<unknown>(codesJson, []);
  const legacyDescriptions = parseJsonField<string[]>(descriptionsJson, []);

  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }

  if (raw.every((item) => typeof item === 'string')) {
    return (raw as string[])
      .map((code, i) => ({
        code: String(code).trim(),
        description: legacyDescriptions[i]?.trim() ?? '',
        primary: false,
        startDate: undefined as string | undefined,
      }))
      .filter((e) => e.code.length > 0);
  }

  return (raw as Icd10CodeEntry[])
    .map((entry) => ({
      code: String(entry?.code ?? '').trim(),
      description: String(entry?.description ?? '').trim(),
      primary: Boolean(entry?.primary),
      startDate: entry?.startDate?.trim() || undefined,
    }))
    .filter((e) => e.code.length > 0);
}

/** Serialize validated icd10Codes for DB + derive icd10Primary JSON entry. */
export function serializeIcd10ForDb(codes: Icd10CodeEntry[]): {
  icd10CodesJson: string;
  icd10PrimaryJson: string | null;
} {
  const normalized = codes.map((entry) => ({
    code: entry.code.trim(),
    description: (entry.description ?? '').trim(),
    primary: Boolean(entry.primary),
    ...(entry.startDate?.trim() ? { startDate: entry.startDate.trim() } : {}),
  }));

  const primaryEntry = normalized.find((e) => e.primary) ?? null;

  return {
    icd10CodesJson: stringifyJsonField(normalized) ?? '[]',
    icd10PrimaryJson: primaryEntry ? stringifyJsonField(primaryEntry) : null,
  };
}
