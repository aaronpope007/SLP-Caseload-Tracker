/**
 * Display-time strip for leaked billing codes in MA note narrative.
 * Keep regex patterns in sync with stripBillingCodesFromMaNote in api/src/utils/maActivityLogNote.ts.
 */
export function stripBillingCodesFromNote(text: string): string {
  let out = text;
  const patterns: RegExp[] = [
    /\b9250[78](?:-[A-Z]{2})?\b/gi,
    /\bF80\.(?:0|1|2|89)\b/gi,
    /\bF98\.5\b/gi,
    /\bR49\.0\b/gi,
    /\bF\d{2}(?:\.\d{1,3})?\b/g,
    /\bICD-?\s*10(?:\s*code[s]?)?\s*:?\s*[A-Z]?\d[\w.]*\b/gi,
    /\bCPT\s*(?:code)?\s*:?\s*\d{5}\b/gi,
    /\(\s*9250[78]\s*\)/g,
    /\(\s*F\d{2}(?:\.\d+)?\s*\)/g,
  ];
  for (const re of patterns) {
    out = out.replace(re, '');
  }
  return out
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .trim();
}
