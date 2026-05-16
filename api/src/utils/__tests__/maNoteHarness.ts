/**
 * MA note harness — run from repo root:
 *   cd api && npm run ma-note-harness
 * or:
 *   npx tsx api/src/utils/__tests__/maNoteHarness.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  maNoteStyleVariantIndex,
  postProcessMaActivityLogNote,
  stripBillingCodesFromMaNote,
} from '../maActivityLogNote.js';
import {
  buildSoapNoteGenerationSession,
  generateSessionNotesWithGemini,
  type SessionNotePromptSession,
} from '../geminiSessionNotes.js';
import { generateSessionNotesWithAnthropic } from '../anthropicSessionNotes.js';
import { inferGoalDomain, type GoalDomainBucket } from '../goalDomainMap.js';
import { parseStoredIcd10Codes } from '../icd10Codes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const VARIANT_SAMPLES: Array<{ name: string; date: string }> = [
  { name: 'Abdullhamid Abdi', date: '2026-05-01' },
  { name: 'Emerie', date: '2026-05-01' },
  { name: 'Aizen', date: '2026-05-05' },
  { name: 'Mason Yang', date: '2026-05-07' },
  { name: 'Damien', date: '2026-04-28' },
  { name: 'Charlie Vang', date: '2026-05-12' },
  { name: 'Mugen Yang', date: '2026-05-01' },
  { name: 'Zakou Lor', date: '2026-05-08' },
];

const LEAK_SAMPLES = [
  'Treatment targeting phonological disorder (F80.0) was provided via Zoom.',
  'Group speech-language treatment (92508) addressed /k/ production.',
  'The clinician provided 92507-GN services addressing expressive language (F80.1).',
  'No codes here — this note is clean and should pass through unchanged.',
];

/** Student-profile ICD-10 shape (SpedForms-aligned); not inferred from goal domain. */
const STUDENT_ICD_FIXTURE = [
  { code: 'F80.0', description: 'Phonological disorder', primary: true },
  { code: 'F80.2', description: 'Mixed receptive-expressive language disorder', primary: false },
] as const;

const GOAL_DOMAIN_CASES: Array<{ goal: string; expected: GoalDomainBucket }> = [
  { goal: 'Charlie will produce /k/ in all positions of words', expected: 'articulation' },
  { goal: 'Student will answer wh-questions following a short story', expected: 'language' },
  { goal: 'Student will initiate greetings with peers in 3/5 opportunities', expected: 'pragmatics' },
  { goal: 'Student will retell a narrative using 4+ story elements', expected: 'language' },
  { goal: '/s/ production at the sentence level with minimal cueing', expected: 'articulation' },
  { goal: 'Student will compare and contrast two objects using descriptive language', expected: 'language' },
  { goal: 'Student will maintain conversational topic for 3+ exchanges', expected: 'pragmatics' },
];

const CODE_IN_TEXT =
  /\b(?:9250[78](?:-[A-Z]{2})?|F\d{2}(?:\.\d{1,3})?|F98\.5|R49\.0|ICD-?\s*10|CPT)\b/gi;

function codesFound(text: string): string[] {
  return [...text.matchAll(CODE_IN_TEXT)].map((m) => m[0]);
}

function strippedLabels(before: string, after: string): string[] {
  const beforeCodes = codesFound(before);
  const afterSet = new Set(codesFound(after).map((c) => c.toUpperCase()));
  return beforeCodes.filter((c) => !afterSet.has(c.toUpperCase()));
}

function runStudentIcdFixture(): boolean {
  console.log('\n=== 1. Student ICD-10 object shape (parseStoredIcd10Codes) ===\n');
  const json = JSON.stringify(STUDENT_ICD_FIXTURE);
  const parsed = parseStoredIcd10Codes(json, null);
  const ok =
    parsed.length === 2 &&
    parsed[0]?.code === 'F80.0' &&
    parsed[0]?.primary === true &&
    parsed[1]?.code === 'F80.2' &&
    parsed[1]?.description.includes('Mixed receptive');
  console.log(`Fixture: ${json}`);
  console.log(ok ? 'PASS — object array round-trips' : 'FAIL — parse mismatch');
  return ok;
}

function runGoalDomainMapping(): boolean {
  console.log('\n=== 2. inferGoalDomain mapping ===\n');
  let allPass = true;
  for (const { goal, expected } of GOAL_DOMAIN_CASES) {
    const actual = inferGoalDomain(goal);
    const pass = actual === expected;
    if (!pass) allPass = false;
    const label = pass ? 'PASS' : 'FAIL';
    const preview = goal.length > 56 ? `${goal.slice(0, 53)}…` : goal;
    console.log(`${label} | expected=${expected} actual=${actual}`);
    console.log(`       "${preview}"`);
  }
  if (allPass) {
    console.log('\n✓ All goal domain cases passed.');
  } else {
    console.warn('\n⚠ One or more goal domain cases failed.');
  }
  return allPass;
}

function runVariantDistribution(): void {
  console.log('\n=== 3. Variant index distribution ===\n');
  const tally = [0, 0, 0, 0];
  for (const { name, date } of VARIANT_SAMPLES) {
    const variant = maNoteStyleVariantIndex(name, date);
    tally[variant]++;
    console.log(`${name} | ${date} → variant ${variant}`);
  }
  console.log('\nTally:');
  for (let i = 0; i < 4; i++) {
    console.log(`  variant ${i}: ${tally[i]}`);
  }
  const max = Math.max(...tally);
  const maxPct = (max / VARIANT_SAMPLES.length) * 100;
  if (maxPct > 50) {
    console.warn(
      `\n⚠ WARNING: Variant clustering — one variant has ${max}/${VARIANT_SAMPLES.length} (${maxPct.toFixed(0)}%) of samples (>50%).`
    );
  } else {
    console.log('\n✓ Distribution within 50% per-variant threshold.');
  }
}

function runLeakCheck(): void {
  console.log('\n=== 4. postProcessMaActivityLogNote leak check ===\n');
  for (const before of LEAK_SAMPLES) {
    const after = postProcessMaActivityLogNote(before);
    const stripped = strippedLabels(before, after);
    console.log(`BEFORE: "${before}"`);
    console.log(`AFTER:  "${after}"`);
    if (stripped.length > 0) {
      console.log(`Billing codes stripped: ${stripped.join(', ')}`);
    } else if (codesFound(after).length > 0) {
      console.log(`⚠ Codes still present in AFTER: ${codesFound(after).join(', ')}`);
    } else if (before === after) {
      console.log('Clean ✓');
    } else {
      console.log('Clean ✓ (text normalized, no billing codes)');
    }
    console.log('---');
  }

  console.log('\n(stripBillingCodesFromMaNote only — no late-entry wrapper)\n');
  for (const before of LEAK_SAMPLES.slice(0, 3)) {
    const after = stripBillingCodesFromMaNote(before);
    console.log(`  "${before}" → "${after}"`);
  }
}

async function runLiveSample(): Promise<void> {
  console.log('\n=== 5. Sample note preview (live API) ===\n');
  const geminiKey = process.env.GEMINI_API_KEY?.trim() ?? '';
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim() ?? '';
  if (!geminiKey && !anthropicKey) {
    console.log('Skipping live call — no API key in environment.');
    return;
  }

  // Session-log / MA prompt shape: flat code + description arrays from student profile (not object[]).
  const baseSession: SessionNotePromptSession = {
    id: 'harness-emerie-001',
    date: '2026-05-01',
    startTime: '2026-05-01T19:00:00.000Z',
    endTime: '2026-05-01T19:30:00.000Z',
    isGroup: true,
    cptCode: '92508',
    icd10Codes: ['F80.0'],
    icd10Descriptions: ['Phonological disorder'],
    performanceSummary: [
      {
        goalId: 'harness-goal-1',
        goalDescription: '/k/ in word-final position',
        accuracy: 75,
        correctTrials: 15,
        totalTrials: 20,
        cuingLevels: ['Moderate'],
        notes: '',
      },
    ],
    goalsAddressedText: ['/k/ in word-final position'],
    sessionNotes: '',
    clinicalActivitiesBilling: 'sentence-level production tasks, structured elicitation',
    communicationModalityBilling: 'verbal via Zoom',
    addressedGoalsWithDomain: [
      {
        goalId: 'harness-goal-1',
        goalDescription: '/k/ in word-final position',
        domain: inferGoalDomain('/k/ in word-final position'),
      },
    ],
  };

  const enriched = buildSoapNoteGenerationSession('Emerie', '3', '', baseSession, null, 82);
  enriched.isLateEntry = true;
  enriched.serviceDateYmd = '2026-05-01';
  enriched.promptingLevel = 'Moderate';

  const provider = {
    providerName: 'Harness SLP',
    credentials: 'MS, CCC-SLP',
    npiNumber: '',
  };

  try {
    let rawNote: string;
    if (geminiKey) {
      console.log('Calling Gemini…');
      const results = await generateSessionNotesWithGemini(geminiKey, [enriched], provider);
      rawNote = results[0]?.note ?? '';
    } else {
      console.log('Calling Anthropic…');
      const results = await generateSessionNotesWithAnthropic(anthropicKey, [enriched], provider);
      rawNote = results[0]?.note ?? '';
    }

    const processed = postProcessMaActivityLogNote(rawNote, { isLateEntry: true });
    const wordCount = processed.replace(/^LATE ENTRY[^\n]*\n+/i, '').split(/\s+/).filter(Boolean).length;

    console.log('\n--- RAW (model) ---\n');
    console.log(rawNote);
    console.log('\n--- POST-PROCESSED ---\n');
    console.log(processed);
    console.log(`\nWord count (body): ~${wordCount}`);
    const remainingCodes = codesFound(processed);
    if (remainingCodes.length) {
      console.warn(`⚠ Billing codes still in processed note: ${remainingCodes.join(', ')}`);
    } else {
      console.log('✓ No billing codes in processed note.');
    }
  } catch (err) {
    console.error('Live call failed:', err instanceof Error ? err.message : err);
  }
}

async function main(): Promise<void> {
  console.log('MA Note Test Harness');
  console.log('====================');
  const icdOk = runStudentIcdFixture();
  const domainOk = runGoalDomainMapping();
  runVariantDistribution();
  runLeakCheck();
  await runLiveSample();
  console.log('\nDone.');
  if (!icdOk || !domainOk) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
