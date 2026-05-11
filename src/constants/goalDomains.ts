export const GOAL_DOMAINS = [
  'Articulation',
  'Phonology',
  'Expressive Language',
  'Receptive Language',
  'Mixed Language',
  'Pragmatics',
  'Fluency',
  'Voice',
] as const;

export type GoalDomain = (typeof GOAL_DOMAINS)[number];

export const GOAL_DOMAINS_SET = new Set<string>(GOAL_DOMAINS);

/** Map legacy template / DB values onto `GOAL_DOMAINS` for form controls. */
export function normalizeGoalDomainForForm(value: string | null | undefined): string {
  if (!value?.trim()) return '';
  const v = value.trim();
  if (GOAL_DOMAINS_SET.has(v)) return v;
  const legacy: Record<string, GoalDomain> = {
    Language: 'Mixed Language',
    AAC: 'Expressive Language',
  };
  return legacy[v] ?? '';
}
