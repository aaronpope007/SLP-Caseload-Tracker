/** Short descriptions for common SLP CPT codes (prompt context only; does not change billing logic). */
export function cptDescriptionForPrompt(code: string | undefined | null): string {
  const c = (code || '').trim();
  const map: Record<string, string> = {
    '92507': 'Treatment of speech, language, voice, communication, and/or auditory processing disorder; individual',
    '92508': 'Group treatment of speech, language, voice, communication, and/or auditory processing disorders',
    '92521': 'Evaluation of speech fluency (e.g., stuttering, cluttering)',
    '92522': 'Evaluation of speech sound production (e.g., articulation, phonological process, apraxia, dysarthria)',
    '92523': 'Evaluation of speech sound production with evaluation of language comprehension and expression',
    '92524': 'Behavioral and qualitative analysis of voice and resonance',
    '92526': 'Treatment of swallowing dysfunction and/or oral function for feeding',
  };
  return map[c] || 'Speech-language pathology service';
}
