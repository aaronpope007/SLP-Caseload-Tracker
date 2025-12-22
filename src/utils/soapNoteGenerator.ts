import type { Session, Student, Goal } from '../types';
import { formatDateTime } from './helpers';

/**
 * Common subjective statements for SOAP notes
 */
export const COMMON_SUBJECTIVE_STATEMENTS = [
  'Student arrived on time and was ready to work',
  'Student appeared engaged and motivated',
  'Student required redirection to maintain attention',
  'Parent/teacher reported progress at home/school',
  'Student demonstrated carryover from previous session',
  'Student was tired or less engaged today',
  'Student required behavior support during session',
  'Student worked independently with minimal cuing',
  'Student needed frequent breaks',
  'Student showed enthusiasm for activities',
  'Parent/teacher concerns were discussed',
  'Student demonstrated improved confidence',
];

/**
 * Generate a SOAP note from session data
 */
export const generateSOAPNote = (
  session: Session,
  student: Student,
  goals: Goal[],
  selectedSubjectiveStatements: string[] = [],
  customSubjective: string = ''
): { subjective: string; objective: string; assessment: string; plan: string } => {
  // SUBJECTIVE
  const subjectiveParts: string[] = [];
  
  // Add selected common statements
  if (selectedSubjectiveStatements.length > 0) {
    subjectiveParts.push(...selectedSubjectiveStatements);
  }
  
  // Add custom subjective notes
  if (customSubjective.trim()) {
    subjectiveParts.push(customSubjective.trim());
  }
  
  // Add session notes if available
  if (session.notes && session.notes.trim()) {
    subjectiveParts.push(`Session notes: ${session.notes.trim()}`);
  }
  
  const subjective = subjectiveParts.length > 0 
    ? subjectiveParts.join('. ') + '.'
    : 'No subjective information provided.';

  // OBJECTIVE
  const objectiveParts: string[] = [];
  
  // Session duration
  if (session.endTime) {
    const startTime = new Date(session.date);
    const endTime = new Date(session.endTime);
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
    objectiveParts.push(`Session duration: ${durationMinutes} minutes`);
  }
  
  // Goals targeted
  if (session.goalsTargeted.length > 0) {
    const goalDescriptions = session.goalsTargeted
      .map(goalId => {
        const goal = goals.find(g => g.id === goalId);
        return goal ? goal.description : null;
      })
      .filter((desc): desc is string => desc !== null);
    
    if (goalDescriptions.length > 0) {
      objectiveParts.push(`Goals targeted: ${goalDescriptions.join('; ')}`);
    }
  }
  
  // Activities used
  if (session.activitiesUsed.length > 0) {
    objectiveParts.push(`Activities: ${session.activitiesUsed.join(', ')}`);
  }
  
  // Performance data
  if (session.performanceData.length > 0) {
    const performanceParts: string[] = [];
    session.performanceData.forEach(perf => {
      const goal = goals.find(g => g.id === perf.goalId);
      if (goal) {
        const perfParts: string[] = [];
        
        if (perf.accuracy !== undefined) {
          perfParts.push(`${perf.accuracy}% accuracy`);
        }
        
        if (perf.correctTrials !== undefined && perf.incorrectTrials !== undefined) {
          const total = perf.correctTrials + perf.incorrectTrials;
          perfParts.push(`${perf.correctTrials}/${total} trials correct`);
        }
        
        if (perf.cuingLevels && perf.cuingLevels.length > 0) {
          const cuingLabels: Record<string, string> = {
            independent: 'Independent',
            verbal: 'Verbal cuing',
            visual: 'Visual cuing',
            tactile: 'Tactile cuing',
            physical: 'Physical cuing',
          };
          const cuingText = perf.cuingLevels.map(c => cuingLabels[c] || c).join(', ');
          perfParts.push(`Cuing levels: ${cuingText}`);
        }
        
        if (perf.notes && perf.notes.trim()) {
          perfParts.push(`Notes: ${perf.notes.trim()}`);
        }
        
        if (perfParts.length > 0) {
          performanceParts.push(`${goal.description}: ${perfParts.join('; ')}`);
        }
      }
    });
    
    if (performanceParts.length > 0) {
      objectiveParts.push(`Performance data: ${performanceParts.join('. ')}`);
    }
  }
  
  const objective = objectiveParts.length > 0
    ? objectiveParts.join('. ') + '.'
    : 'No objective data recorded.';

  // ASSESSMENT
  const assessmentParts: string[] = [];
  
  if (session.performanceData.length > 0) {
    session.performanceData.forEach(perf => {
      const goal = goals.find(g => g.id === perf.goalId);
      if (goal && perf.accuracy !== undefined) {
        if (perf.accuracy >= 80) {
          assessmentParts.push(`${goal.description}: Student demonstrated strong performance (${perf.accuracy}% accuracy).`);
        } else if (perf.accuracy >= 60) {
          assessmentParts.push(`${goal.description}: Student demonstrated moderate progress (${perf.accuracy}% accuracy).`);
        } else {
          assessmentParts.push(`${goal.description}: Student demonstrated emerging skills (${perf.accuracy}% accuracy). Continued support needed.`);
        }
      } else if (goal) {
        assessmentParts.push(`${goal.description}: Progress observed during session.`);
      }
    });
  } else if (session.goalsTargeted.length > 0) {
    const goalDescriptions = session.goalsTargeted
      .map(goalId => {
        const goal = goals.find(g => g.id === goalId);
        return goal ? goal.description : null;
      })
      .filter((desc): desc is string => desc !== null);
    
    if (goalDescriptions.length > 0) {
      assessmentParts.push(`Goals addressed: ${goalDescriptions.join('; ')}. Student participated in therapy activities.`);
    }
  }
  
  const assessment = assessmentParts.length > 0
    ? assessmentParts.join(' ')
    : 'Student participated in therapy session.';

  // PLAN
  const planParts: string[] = [];
  
  if (session.goalsTargeted.length > 0) {
    planParts.push('Continue targeting current goals in next session.');
    
    // Add specific recommendations based on performance
    session.performanceData.forEach(perf => {
      const goal = goals.find(g => g.id === perf.goalId);
      if (goal && perf.accuracy !== undefined) {
        if (perf.accuracy < 60) {
          planParts.push(`Modify approach for ${goal.description} to increase support and scaffolding.`);
        } else if (perf.cuingLevels && perf.cuingLevels.length > 0 && !perf.cuingLevels.includes('independent')) {
          planParts.push(`Gradually reduce cuing for ${goal.description} to promote independence.`);
        }
      }
    });
  } else {
    planParts.push('Continue therapy services as indicated.');
  }
  
  if (session.activitiesUsed.length > 0) {
    planParts.push(`Consider continuing with similar activities: ${session.activitiesUsed.slice(0, 2).join(', ')}.`);
  }
  
  const plan = planParts.length > 0
    ? planParts.join(' ')
    : 'Continue therapy services as indicated.';

  return {
    subjective,
    objective,
    assessment,
    plan,
  };
};

