export type GoalDomainBucket = 'articulation' | 'language' | 'pragmatics' | 'unknown';

export const DOMAIN_META = {
  articulation: { color: '#f97316', label: 'Articulation' },
  language: { color: '#3b82f6', label: 'Language' },
  pragmatics: { color: '#a855f7', label: 'Pragmatics' },
  unknown: { color: '#6b7280', label: 'Other' },
} as const;

/**
 * Infer clinical domain bucket from goal text (keyword buckets; same logic as legacy
 * inferGoalDomainFromDescription, mapped to articulation / language / pragmatics / unknown).
 */
export function inferGoalDomain(goalText: string): GoalDomainBucket {
  const text = goalText.trim();
  if (!text) return 'unknown';

  const d = text.toLowerCase();

  const hasArt =
    /\b(phoneme|phonemes|phonological|articulation)\b/i.test(d) ||
    /\b(speech sounds?|consonants?|syllables?)\b/i.test(d) ||
    /\/[a-z]{1,4}\//i.test(text);

  const hasRec =
    /\breceptive\b/i.test(d) ||
    /\bcomprehension\b/i.test(d) ||
    /\bcomprehend(s|ing|ed)?\b/i.test(d) ||
    /\bfollowing directions\b/i.test(d) ||
    /\b(listening|listen to)\b/i.test(d) ||
    /\bunderstanding\b/i.test(d) ||
    /\bidentif(y|ying|ied|ication)\b/i.test(d) ||
    /\bwh[- ]?questions?\b/i.test(d) ||
    /\b(answer|answers|answering|answered)\b/i.test(d);

  const hasExp =
    /\b(expressive|expressing|expression|expressions?)\b/i.test(d) ||
    /\b(express|expressed)\b/i.test(d) ||
    /\b(vocabulary|grammar|narrative|sentences?|formulate|formulating|formulated)\b/i.test(d) ||
    /\b(utterance|utterances|morpheme|morphemes|syntax)\b/i.test(d) ||
    /\b(compare and contrast|descriptive language)\b/i.test(d);

  const hasPrag =
    /\bpragmatic(s)?\b/i.test(d) ||
    /\b(social communication|turn[- ]taking|topic maintenance|conversational topic)\b/i.test(d) ||
    /\b(initiate|initiating|greeting|greetings)\b/i.test(d) ||
    /\bmaintain\b.*\btopic\b/i.test(d);

  const hasFluency =
    /\b(fluency|stutter|stammer|dysfluen|disfluen|prolongation|blocking|hesitation)\b/i.test(d);

  const hasVoice =
    /\b(voice disorder|dysphonia|vocal quality|hoarse|hoarseness|resonance disorder|phonation)\b/i.test(
      d
    ) ||
    (/\bvoice\b/i.test(d) && /\b(therapy|disorder|quality|projection|volume)\b/i.test(d));

  if (hasFluency) return 'unknown';
  if (hasVoice) return 'unknown';
  if (hasPrag) return 'pragmatics';
  if (/\bphonological\b/i.test(d) || /\b(cluster reduction|final consonant|fronting|gliding|stopping)\b/i.test(d)) {
    return 'articulation';
  }
  if (hasArt) return 'articulation';
  if (hasRec && hasExp) return 'language';
  if (hasRec) return 'language';
  if (hasExp) return 'language';

  return 'unknown';
}
