import { GOAL_DOMAINS_SET } from '../constants/goalDomains';

export const DOMAIN_TO_ICD10: Record<
  string,
  { codes: string[]; descriptions: string[] }
> = {
  Articulation: {
    codes: ['F80.0'],
    descriptions: ['Phonological disorder'],
  },
  Phonology: {
    codes: ['F80.0'],
    descriptions: ['Phonological disorder'],
  },
  'Expressive Language': {
    codes: ['F80.1'],
    descriptions: ['Expressive language disorder'],
  },
  'Receptive Language': {
    codes: ['F80.2'],
    descriptions: ['Mixed receptive-expressive language disorder'],
  },
  'Mixed Language': {
    codes: ['F80.2'],
    descriptions: ['Mixed receptive-expressive language disorder'],
  },
  Pragmatics: {
    codes: ['F80.89'],
    descriptions: ['Other developmental disorders of speech and language'],
  },
  Fluency: {
    codes: ['F98.5'],
    descriptions: ['Stuttering'],
  },
  Voice: {
    codes: ['R49.0'],
    descriptions: ['Dysphonia'],
  },
};

export function getIcdCodesFromDomain(domain: string): { codes: string[]; descriptions: string[] } {
  const trimmed = domain.trim();
  if (!trimmed || !GOAL_DOMAINS_SET.has(trimmed)) {
    return { codes: [], descriptions: [] };
  }
  return DOMAIN_TO_ICD10[trimmed] ?? { codes: [], descriptions: [] };
}

/** Stable order for session log / exports */
const ICD_SORT_ORDER = ['F80.0', 'F80.1', 'F80.2', 'F80.89', 'F98.5', 'R49.0'];

export function sortIcdCodes(codes: Iterable<string>): string[] {
  const uniq = [...new Set(codes)];
  return uniq.sort((a, b) => {
    const ia = ICD_SORT_ORDER.indexOf(a);
    const ib = ICD_SORT_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/**
 * Merge ICD rows from multiple goal domains; dedupe codes; one description per code (first wins).
 */
export function mergeIcdFromDomains(domains: (string | null | undefined)[]): {
  codes: string[];
  descriptions: string[];
} {
  const codeToDesc = new Map<string, string>();
  for (const dom of domains) {
    const { codes, descriptions } = getIcdCodesFromDomain(dom ?? '');
    codes.forEach((c, i) => {
      if (!codeToDesc.has(c)) {
        codeToDesc.set(c, descriptions[i] ?? c);
      }
    });
  }
  const codes = sortIcdCodes(codeToDesc.keys());
  const descriptions = codes.map((c) => codeToDesc.get(c) ?? c);
  return { codes, descriptions };
}
