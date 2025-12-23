import type { GoalTemplate } from '../types';

// Goal templates library organized by domain
export const goalTemplates: GoalTemplate[] = [
  // Articulation Templates
  {
    id: 'art-1',
    title: 'Produce /r/ in words',
    description: 'Student will produce /r/ sound accurately in words in 8/10 opportunities across 3 sessions.',
    domain: 'Articulation',
    suggestedBaseline: '0% accuracy',
    suggestedTarget: '80% accuracy',
    ageRange: '5-12',
    keywords: ['r', 'articulation', 'phoneme', 'speech sound'],
  },
  {
    id: 'art-2',
    title: 'Produce /s/ and /z/ in sentences',
    description: 'Student will produce /s/ and /z/ sounds accurately in sentences in 9/10 opportunities across 3 sessions.',
    domain: 'Articulation',
    suggestedBaseline: '20% accuracy',
    suggestedTarget: '90% accuracy',
    ageRange: '4-10',
    keywords: ['s', 'z', 'articulation', 'phoneme', 'speech sound'],
  },
  {
    id: 'art-3',
    title: 'Reduce cluster reduction',
    description: 'Student will produce consonant clusters accurately in words in 8/10 opportunities across 3 sessions.',
    domain: 'Articulation',
    suggestedBaseline: '30% accuracy',
    suggestedTarget: '80% accuracy',
    ageRange: '3-8',
    keywords: ['cluster', 'consonant', 'articulation', 'phonological'],
  },
  {
    id: 'art-4',
    title: 'Improve final consonant deletion',
    description: 'Student will produce final consonants in words in 9/10 opportunities across 3 sessions.',
    domain: 'Articulation',
    suggestedBaseline: '40% accuracy',
    suggestedTarget: '90% accuracy',
    ageRange: '3-7',
    keywords: ['final consonant', 'deletion', 'articulation', 'phonological'],
  },
  
  // Phonology Templates
  {
    id: 'phon-1',
    title: 'Reduce fronting',
    description: 'Student will produce velar sounds (/k/, /g/) in place of alveolar sounds (/t/, /d/) in words in 8/10 opportunities across 3 sessions.',
    domain: 'Phonology',
    suggestedBaseline: '30% accuracy',
    suggestedTarget: '80% accuracy',
    ageRange: '3-6',
    keywords: ['fronting', 'phonology', 'phonological process', 'velar'],
  },
  {
    id: 'phon-2',
    title: 'Reduce backing',
    description: 'Student will produce alveolar sounds (/t/, /d/) in place of velar sounds (/k/, /g/) in words in 8/10 opportunities across 3 sessions.',
    domain: 'Phonology',
    suggestedBaseline: '40% accuracy',
    suggestedTarget: '80% accuracy',
    ageRange: '3-6',
    keywords: ['backing', 'phonology', 'phonological process', 'alveolar'],
  },
  {
    id: 'phon-3',
    title: 'Reduce stopping',
    description: 'Student will produce fricative sounds (/f/, /v/, /s/, /z/) in place of stops in words in 8/10 opportunities across 3 sessions.',
    domain: 'Phonology',
    suggestedBaseline: '35% accuracy',
    suggestedTarget: '80% accuracy',
    ageRange: '3-6',
    keywords: ['stopping', 'phonology', 'phonological process', 'fricative'],
  },
  {
    id: 'phon-4',
    title: 'Reduce gliding',
    description: 'Student will produce /r/ and /l/ sounds in place of /w/ and /j/ in words in 8/10 opportunities across 3 sessions.',
    domain: 'Phonology',
    suggestedBaseline: '30% accuracy',
    suggestedTarget: '80% accuracy',
    ageRange: '3-7',
    keywords: ['gliding', 'phonology', 'phonological process', 'liquid'],
  },
  {
    id: 'phon-5',
    title: 'Reduce syllable reduction',
    description: 'Student will produce multisyllabic words with all syllables in 8/10 opportunities across 3 sessions.',
    domain: 'Phonology',
    suggestedBaseline: '40% accuracy',
    suggestedTarget: '80% accuracy',
    ageRange: '3-6',
    keywords: ['syllable reduction', 'phonology', 'phonological process', 'multisyllabic'],
  },
  
  // Language Templates
  {
    id: 'lang-1',
    title: 'Use past tense verbs',
    description: 'Student will use regular and irregular past tense verbs accurately in 8/10 opportunities across 3 sessions.',
    domain: 'Language',
    suggestedBaseline: '30% accuracy',
    suggestedTarget: '80% accuracy',
    ageRange: '4-10',
    keywords: ['past tense', 'verbs', 'grammar', 'morphology'],
  },
  {
    id: 'lang-2',
    title: 'Answer WH questions',
    description: 'Student will accurately answer WH questions (who, what, where, when, why) in 8/10 opportunities across 3 sessions.',
    domain: 'Language',
    suggestedBaseline: '40% accuracy',
    suggestedTarget: '80% accuracy',
    ageRange: '4-12',
    keywords: ['wh questions', 'comprehension', 'language', 'questions'],
  },
  {
    id: 'lang-3',
    title: 'Use pronouns correctly',
    description: 'Student will use subjective, objective, and possessive pronouns accurately in 9/10 opportunities across 3 sessions.',
    domain: 'Language',
    suggestedBaseline: '50% accuracy',
    suggestedTarget: '90% accuracy',
    ageRange: '3-8',
    keywords: ['pronouns', 'grammar', 'morphology', 'language'],
  },
  {
    id: 'lang-4',
    title: 'Increase vocabulary',
    description: 'Student will identify and use 10 new vocabulary words in context accurately in 8/10 opportunities across 3 sessions.',
    domain: 'Language',
    suggestedBaseline: '0 new words',
    suggestedTarget: '10 new words',
    ageRange: '3-12',
    keywords: ['vocabulary', 'semantics', 'language'],
  },
  {
    id: 'lang-5',
    title: 'Follow multi-step directions',
    description: 'Student will follow 2-3 step directions accurately in 8/10 opportunities across 3 sessions.',
    domain: 'Language',
    suggestedBaseline: '50% accuracy',
    suggestedTarget: '80% accuracy',
    ageRange: '4-10',
    keywords: ['following directions', 'comprehension', 'language', 'receptive'],
  },
  {
    id: 'lang-6',
    title: 'Use compound sentences',
    description: 'Student will produce compound sentences using conjunctions (and, but, so) accurately in 8/10 opportunities across 3 sessions.',
    domain: 'Language',
    suggestedBaseline: '30% accuracy',
    suggestedTarget: '80% accuracy',
    ageRange: '6-12',
    keywords: ['compound sentences', 'syntax', 'grammar', 'language'],
  },
  
  // Pragmatics Templates
  {
    id: 'prag-1',
    title: 'Initiate conversations',
    description: 'Student will initiate conversations with peers and adults appropriately in 8/10 opportunities across 3 sessions.',
    domain: 'Pragmatics',
    suggestedBaseline: '40% accuracy',
    suggestedTarget: '80% accuracy',
    ageRange: '5-12',
    keywords: ['conversation', 'pragmatics', 'social', 'initiation'],
  },
  {
    id: 'prag-2',
    title: 'Maintain topic of conversation',
    description: 'Student will maintain the topic of conversation for 3-4 turns in 8/10 opportunities across 3 sessions.',
    domain: 'Pragmatics',
    suggestedBaseline: '2 turns',
    suggestedTarget: '3-4 turns',
    ageRange: '5-12',
    keywords: ['conversation', 'pragmatics', 'social', 'topic maintenance'],
  },
  {
    id: 'prag-3',
    title: 'Use appropriate eye contact',
    description: 'Student will maintain appropriate eye contact during conversations in 8/10 opportunities across 3 sessions.',
    domain: 'Pragmatics',
    suggestedBaseline: '30% accuracy',
    suggestedTarget: '80% accuracy',
    ageRange: '4-12',
    keywords: ['eye contact', 'pragmatics', 'social', 'nonverbal'],
  },
  {
    id: 'prag-4',
    title: 'Interpret nonverbal cues',
    description: 'Student will accurately interpret facial expressions and body language in 8/10 opportunities across 3 sessions.',
    domain: 'Pragmatics',
    suggestedBaseline: '40% accuracy',
    suggestedTarget: '80% accuracy',
    ageRange: '5-12',
    keywords: ['nonverbal', 'pragmatics', 'social', 'facial expressions'],
  },
  
  // Fluency Templates
  {
    id: 'flu-1',
    title: 'Reduce stuttering frequency',
    description: 'Student will reduce stuttering frequency to less than 3% of syllables spoken across 3 sessions.',
    domain: 'Fluency',
    suggestedBaseline: '8% stuttering',
    suggestedTarget: '3% stuttering',
    ageRange: '4-18',
    keywords: ['stuttering', 'fluency', 'disfluency'],
  },
  {
    id: 'flu-2',
    title: 'Use fluency techniques',
    description: 'Student will use easy onset and light contact techniques in 8/10 opportunities across 3 sessions.',
    domain: 'Fluency',
    suggestedBaseline: '30% accuracy',
    suggestedTarget: '80% accuracy',
    ageRange: '6-18',
    keywords: ['fluency', 'stuttering', 'techniques', 'easy onset'],
  },
  
  // Voice Templates
  {
    id: 'voice-1',
    title: 'Improve vocal hygiene',
    description: 'Student will demonstrate appropriate vocal hygiene strategies (hydration, voice rest) in 9/10 opportunities across 3 sessions.',
    domain: 'Voice',
    suggestedBaseline: '50% accuracy',
    suggestedTarget: '90% accuracy',
    ageRange: '6-18',
    keywords: ['voice', 'vocal hygiene', 'health'],
  },
  {
    id: 'voice-2',
    title: 'Reduce vocal abuse',
    description: 'Student will reduce vocal abuse behaviors (screaming, excessive talking) in 8/10 opportunities across 3 sessions.',
    domain: 'Voice',
    suggestedBaseline: 'Frequent abuse',
    suggestedTarget: 'Minimal abuse',
    ageRange: '6-18',
    keywords: ['voice', 'vocal abuse', 'health'],
  },
  
  // AAC Templates
  {
    id: 'aac-1',
    title: 'Increase AAC device use',
    description: 'Student will use AAC device to communicate wants and needs in 8/10 opportunities across 3 sessions.',
    domain: 'AAC',
    suggestedBaseline: '30% accuracy',
    suggestedTarget: '80% accuracy',
    ageRange: '3-18',
    keywords: ['aac', 'communication device', 'augmentative'],
  },
  {
    id: 'aac-2',
    title: 'Navigate AAC system',
    description: 'Student will navigate AAC system to find target vocabulary in 8/10 opportunities across 3 sessions.',
    domain: 'AAC',
    suggestedBaseline: '40% accuracy',
    suggestedTarget: '80% accuracy',
    ageRange: '5-18',
    keywords: ['aac', 'navigation', 'vocabulary'],
  },
];

export const getGoalTemplatesByDomain = (domain?: string): GoalTemplate[] => {
  if (!domain) return goalTemplates;
  return goalTemplates.filter(t => t.domain === domain);
};

export const getGoalTemplatesByKeywords = (keywords: string[]): GoalTemplate[] => {
  if (keywords.length === 0) return goalTemplates;
  const lowerKeywords = keywords.map(k => k.toLowerCase());
  return goalTemplates.filter(template => 
    template.keywords?.some(keyword => 
      lowerKeywords.some(k => keyword.toLowerCase().includes(k))
    )
  );
};

export const getUniqueDomains = (): string[] => {
  const domains = new Set(goalTemplates.map(t => t.domain));
  return Array.from(domains).sort();
};

