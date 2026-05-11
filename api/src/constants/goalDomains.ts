/** Must match `src/constants/goalDomains.ts` */
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
