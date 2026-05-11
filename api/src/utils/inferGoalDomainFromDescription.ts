import type { GoalDomain } from '../constants/goalDomains';

/**
 * One-time migration helper: keyword buckets (legacy session-log ICD inference),
 * mapped to a single canonical goal domain.
 */
export function inferGoalDomainFromDescription(description: string): GoalDomain | null {
  const text = description.trim();
  if (!text) return null;

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
    /\b(utterance|utterances|morpheme|morphemes|syntax)\b/i.test(d);

  const hasPrag =
    /\bpragmatic(s)?\b/i.test(d) ||
    /\b(social communication|turn[- ]taking|topic maintenance)\b/i.test(d) ||
    /\binitiating\b/i.test(d);

  const hasFluency =
    /\b(fluency|stutter|stammer|dysfluen|disfluen|prolongation|blocking|hesitation)\b/i.test(d);

  const hasVoice =
    /\b(voice disorder|dysphonia|vocal quality|hoarse|hoarseness|resonance disorder|phonation)\b/i.test(
      d
    ) ||
    (/\bvoice\b/i.test(d) && /\b(therapy|disorder|quality|projection|volume)\b/i.test(d));

  if (hasFluency) return 'Fluency';
  if (hasVoice) return 'Voice';
  if (hasPrag) return 'Pragmatics';
  if (hasRec && hasExp) return 'Mixed Language';
  if (hasRec) return 'Receptive Language';
  if (hasExp) return 'Expressive Language';
  if (/\bphonological\b/i.test(d) || /\b(cluster reduction|final consonant|fronting|gliding|stopping)\b/i.test(d)) {
    return 'Phonology';
  }
  if (hasArt) return 'Articulation';

  return null;
}
