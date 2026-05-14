// Maps ICD-10 codes to the clinical language the SOAP note should use
// to justify medical necessity for that specific code.

export interface Icd10NarrativeContext {
  diagnosisLabel: string;
  deficitDescription: string;
  skillTargeted: string;
  academicImpact: string;
  medicalNecessityRationale: string;
}

export const icd10NarrativeMap: Record<string, Icd10NarrativeContext> = {
  'F80.0': {
    diagnosisLabel: 'Phonological Disorder',
    deficitDescription:
      'phonological processing deficits affecting speech sound production accuracy',
    skillTargeted:
      'accurate production of target phonemes across word positions and phonological contrasts',
    academicImpact:
      'reduced speech intelligibility impacting classroom communication and peer interaction',
    medicalNecessityRationale:
      'Skilled SLP intervention is required to remediate phonological rule deficits that cannot be addressed through general education supports alone.',
  },
  'F80.1': {
    diagnosisLabel: 'Expressive Language Disorder',
    deficitDescription:
      'expressive language deficits affecting vocabulary, sentence formulation, and verbal output',
    skillTargeted:
      'accurate and age-appropriate expressive language production including syntax, morphology, and word retrieval',
    academicImpact:
      'difficulty expressing ideas verbally and in writing, impacting academic participation and task completion',
    medicalNecessityRationale:
      'Skilled SLP intervention is required to build expressive language structures that impact curriculum access and communication with peers and teachers.',
  },
  'F80.2': {
    diagnosisLabel: 'Mixed Receptive-Expressive Language Disorder',
    deficitDescription:
      'receptive and expressive language deficits affecting comprehension and verbal output',
    skillTargeted:
      'following multi-step directions, processing academic language, and formulating grammatically complete responses',
    academicImpact:
      'difficulty understanding instructions and expressing knowledge verbally, broadly impacting academic performance',
    medicalNecessityRationale:
      "Skilled SLP intervention is required to address both processing and production deficits that affect the student's ability to access and demonstrate learning across content areas.",
  },
  'F80.82': {
    diagnosisLabel: 'Social Pragmatic Communication Disorder',
    deficitDescription:
      'pragmatic language deficits affecting social communication, perspective-taking, and conversational skills',
    skillTargeted:
      'appropriate use of language in social contexts including turn-taking, topic maintenance, and inferencing',
    academicImpact:
      'difficulty navigating peer interactions, group work, and teacher-directed communication in the school setting',
    medicalNecessityRationale:
      'Skilled SLP intervention is required to develop functional social communication skills that cannot be adequately addressed through behavioral or general education supports.',
  },
  'F80.89': {
    diagnosisLabel: 'Other Developmental Disorders of Speech and Language',
    deficitDescription:
      'speech and language deficits not fully captured by a single categorical diagnosis',
    skillTargeted:
      'functional communication skills across targeted speech and language domains per IEP goals',
    academicImpact:
      'communication deficits impacting academic engagement and the ability to demonstrate learning',
    medicalNecessityRationale:
      "Skilled SLP intervention is required to address complex communication needs impacting educational participation.",
  },
  'F98.5': {
    diagnosisLabel: 'Childhood-Onset Fluency Disorder (Stuttering)',
    deficitDescription:
      'fluency deficits including repetitions, prolongations, and blocks affecting communication confidence and output',
    skillTargeted:
      'fluency-enhancing strategies, stuttering modification techniques, and communication confidence',
    academicImpact:
      'reluctance to participate verbally, impacting oral reading, class discussion, and peer communication',
    medicalNecessityRationale:
      'Skilled SLP intervention is required to address both the physical and psychological dimensions of fluency disorder that affect academic and social participation.',
  },
};

function normalizeIcd10LookupKey(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/** Insert standard dot after category (e.g. F801 → F80.1) when map uses dotted form. */
function tryDottedCategoryKey(normalized: string): string | null {
  const m = normalized.match(/^([A-Z])(\d{2})(\d[\dA-Z]*)$/);
  if (!m) return null;
  return `${m[1]}${m[2]}.${m[3]}`;
}

export function getNarrativeContext(icd10Code: string): Icd10NarrativeContext | null {
  const raw = icd10Code.trim();
  if (!raw) return null;
  if (icd10NarrativeMap[raw]) return icd10NarrativeMap[raw];
  const upper = normalizeIcd10LookupKey(raw);
  if (icd10NarrativeMap[upper]) return icd10NarrativeMap[upper];
  const dotted = tryDottedCategoryKey(upper);
  if (dotted && icd10NarrativeMap[dotted]) return icd10NarrativeMap[dotted];
  return null;
}
