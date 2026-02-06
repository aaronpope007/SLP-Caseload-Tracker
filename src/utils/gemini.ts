import { GoogleGenerativeAI } from '@google/generative-ai';
import { logError, logInfo } from './logger';

// Helper function to get available models
async function getAvailableModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await response.json() as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };
    if (data.models) {
      return data.models
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name.replace('models/', ''))
        // Filter out deprecated -latest aliases that will be updated to Gemini 3
        .filter((m) => !m.includes('gemini-pro-latest') && !m.includes('gemini-flash-latest'));
    }
  } catch (e) {
    logError('Error fetching available models', e);
  }
  return [];
}

export const generateTreatmentIdeas = async (
  goalArea: string,
  ageRange: string,
  materials: string[],
  apiKey: string
): Promise<string> => {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  // Initialize with the provided API key each time
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // First, try to get available models
  let availableModels = await getAvailableModels(apiKey);
  
  if (process.env.NODE_ENV === 'development') {
    logInfo('Available models', availableModels);
  }
  
  // Filter out deprecated -latest aliases that will be updated to Gemini 3
  availableModels = availableModels.filter(
    (m) => !m.includes('gemini-pro-latest') && !m.includes('gemini-flash-latest')
  );
  
  // If we couldn't get the list, use default model names to try (prioritize Gemini 3 models)
  if (availableModels.length === 0) {
    availableModels = ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
  }

  const materialsText = materials.length > 0 
    ? `Available materials: ${materials.join(', ')}`
    : 'No specific materials required';

  const prompt = `You are an expert speech-language pathologist. Generate 3 creative, engaging teletherapy activity ideas for the following:

Goal Area: ${goalArea}
Age Range: ${ageRange}
${materialsText}

For each activity, provide:
1. Activity name
2. Brief description
3. Materials needed
4. Step-by-step instructions
5. How it targets the goal area

Format the response in a clear, easy-to-read way. Make the activities fun and appropriate for virtual therapy sessions.`;

  // Try the available models (or fallback to common names)
  let lastError: Error | null = null;

  for (const modelName of availableModels) {
    try {
      if (process.env.NODE_ENV === 'development') {
        logInfo(`Trying model: ${modelName}`);
      }
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      if (process.env.NODE_ENV === 'development') {
        logInfo(`Success with model: ${modelName}`);
      }
      return response.text();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStatus = (error as { status?: number })?.status;
      if (process.env.NODE_ENV === 'development') {
        logInfo(`Model ${modelName} failed`, errorMessage);
      }
      lastError = error instanceof Error ? error : new Error(errorMessage);
      
      // If it's a 404, try the next model
      if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
        continue;
      }
      // For other errors (401, 403, etc.), stop trying
      break;
    }
  }

  // If we get here, all models failed
  logError('All models failed. Last error', lastError);
  
  // Provide helpful error messages
  const errorMessage = lastError?.message || 'Unknown error';
  const errorStatus = (lastError as { status?: number })?.status;
  if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
    throw new Error('No available Gemini models found. Please check your API key permissions in Google AI Studio or try regenerating your API key.');
  } else if (errorStatus === 401 || errorMessage?.includes('401')) {
    throw new Error('Invalid API key. Please check your API key in Settings.');
  } else if (errorStatus === 403 || errorMessage?.includes('403')) {
    throw new Error('API key does not have permission. Please enable Gemini API in Google Cloud Console.');
  } else {
    throw new Error(`Failed to generate ideas: ${errorMessage}`);
  }
};

export interface GoalProgressData {
  goalDescription: string;
  baseline: number;
  target: number;
  current: number;
  sessions: number;
  status: string;
  performanceHistory?: {
    date: string;
    accuracy: number;
    correctTrials?: number;
    incorrectTrials?: number;
    notes?: string;
    cuingLevels?: ('independent' | 'verbal' | 'visual' | 'tactile' | 'physical')[];
  }[];
}

export const generateProgressNote = async (
  studentName: string,
  goals: GoalProgressData[],
  apiKey: string,
  additionalContext?: string
): Promise<string> => {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  let availableModels = await getAvailableModels(apiKey);
  // Filter out deprecated -latest aliases that will be updated to Gemini 3
  availableModels = availableModels.filter(
    (m) => !m.includes('gemini-pro-latest') && !m.includes('gemini-flash-latest')
  );
  if (availableModels.length === 0) {
    availableModels = ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
  }

  // Format goals data for the prompt
  const goalsText = goals.map((goal, idx) => {
    let goalInfo = `Goal ${idx + 1}: ${goal.goalDescription}\n`;
    goalInfo += `  Baseline: ${goal.baseline}%\n`;
    goalInfo += `  Current Performance: ${goal.current.toFixed(1)}%\n`;
    goalInfo += `  Target: ${goal.target}%\n`;
    goalInfo += `  Status: ${goal.status}\n`;
    goalInfo += `  Total Sessions: ${goal.sessions}\n`;
    
    if (goal.performanceHistory && goal.performanceHistory.length > 0) {
      goalInfo += `  Recent Performance History:\n`;
      goal.performanceHistory.slice(0, 5).forEach((perf) => {
        goalInfo += `    - ${perf.date}: ${perf.accuracy.toFixed(1)}%`;
        if (perf.correctTrials !== undefined && perf.incorrectTrials !== undefined) {
          goalInfo += ` (${perf.correctTrials} correct, ${perf.incorrectTrials} incorrect)`;
        }
        if (perf.notes) {
          goalInfo += ` - Notes: ${perf.notes}`;
        }
        goalInfo += '\n';
      });
    }
    return goalInfo;
  }).join('\n');

  const contextSection = additionalContext?.trim()
    ? `

Additional context from the clinician (use this to tailor the note when data is limited or circumstances are unusual):
${additionalContext.trim()}
`
    : '';

  // Use placeholder instead of actual student name to protect PHI
  const prompt = `You are a professional speech-language pathologist writing a progress note. Write a comprehensive, professional progress note for the following student and their goals.

Student: student

Goal Information:
${goalsText}${contextSection}

Please write a professional progress note that:
1. Summarizes the student's overall progress
2. Addresses each goal individually with specific performance data
3. Highlights areas of improvement and areas that need continued focus
4. Uses professional SLP terminology
5. Is suitable for inclusion in clinical documentation or progress reports
6. Maintains a professional, objective tone
7. When additional context is provided (e.g. limited sessions, partial data), acknowledge it and write a nuanced note that fits the situation rather than overstating certainty

Format the note in clear paragraphs. If multiple goals are provided, organize the note to address each goal systematically.`;

  let lastError: Error | null = null;

  for (const modelName of availableModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const generatedText = response.text();
      
      // Replace placeholder with actual student name (case-insensitive, whole word only)
      // Use regex to match "student" as a whole word, preserving case of surrounding text
      const replacedText = generatedText.replace(/\bstudent\b/gi, studentName);
      
      return replacedText;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStatus = (error as { status?: number })?.status;
      lastError = error instanceof Error ? error : new Error(errorMessage);
      if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
        continue;
      }
      break;
    }
  }

  const errorMessage = lastError?.message || 'Unknown error';
  const errorStatus = (lastError as { status?: number })?.status;
  if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
    throw new Error('No available Gemini models found. Please check your API key permissions in Google AI Studio or try regenerating your API key.');
  } else if (errorStatus === 401 || errorMessage?.includes('401')) {
    throw new Error('Invalid API key. Please check your API key in Settings.');
  } else if (errorStatus === 403 || errorMessage?.includes('403')) {
    throw new Error('API key does not have permission. Please enable Gemini API in Google Cloud Console.');
  } else {
    throw new Error(`Failed to generate progress note: ${errorMessage}`);
  }
};

// Goal Writing Assistant
export const generateGoalSuggestions = async (
  apiKey: string,
  goalArea: string,
  studentAge: number,
  studentGrade: string,
  concerns: string[]
): Promise<string> => {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  let availableModels = await getAvailableModels(apiKey);
  // Filter out deprecated -latest aliases that will be updated to Gemini 3
  availableModels = availableModels.filter(
    (m) => !m.includes('gemini-pro-latest') && !m.includes('gemini-flash-latest')
  );
  if (availableModels.length === 0) {
    availableModels = ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
  }

  const concernsText = concerns.length > 0 ? concerns.join(', ') : 'Not specified';

  const prompt = `You are an expert speech-language pathologist. Generate 3-5 measurable, appropriate therapy goals for the following:

Goal Area: ${goalArea}
Student Age: ${studentAge}
Grade: ${studentGrade}
Student Concerns: ${concernsText}

For each goal, provide:
1. A complete, measurable goal statement following SMART criteria (Specific, Measurable, Achievable, Relevant, Time-bound)
2. Suggested baseline (initial performance level)
3. Suggested target (desired performance level)
4. Measurement method or criteria for tracking progress

Goals should be:
- Specific and clearly defined
- Measurable with observable outcomes
- Appropriate for the student's age and grade level
- Relevant to the goal area and student concerns
- Time-bound (typically for IEP annual goals)

Format each goal clearly with numbered items. Use professional SLP terminology.`;

  let lastError: Error | null = null;

  for (const modelName of availableModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStatus = (error as { status?: number })?.status;
      lastError = error instanceof Error ? error : new Error(errorMessage);
      if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
        continue;
      }
      break;
    }
  }

  const errorMessage = lastError?.message || 'Unknown error';
  const errorStatus = (lastError as { status?: number })?.status;
  if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
    throw new Error('No available Gemini models found. Please check your API key permissions in Google AI Studio or try regenerating your API key.');
  } else if (errorStatus === 401 || errorMessage?.includes('401')) {
    throw new Error('Invalid API key. Please check your API key in Settings.');
  } else if (errorStatus === 403 || errorMessage?.includes('403')) {
    throw new Error('API key does not have permission. Please enable Gemini API in Google Cloud Console.');
  } else {
    throw new Error(`Failed to generate goal suggestions: ${errorMessage}`);
  }
};

// Session Planning
export const generateSessionPlan = async (
  apiKey: string,
  studentName: string,
  studentAge: number,
  goals: Array<{ description: string; baseline: string; target: string }>,
  recentSessions?: Array<{ date: string; activitiesUsed: string[]; notes?: string }>
): Promise<string> => {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  let availableModels = await getAvailableModels(apiKey);
  // Filter out deprecated -latest aliases that will be updated to Gemini 3
  availableModels = availableModels.filter(
    (m) => !m.includes('gemini-pro-latest') && !m.includes('gemini-flash-latest')
  );
  if (availableModels.length === 0) {
    availableModels = ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
  }

  const goalsText = goals.map((g, idx) => 
    `Goal ${idx + 1}: ${g.description}\n  Baseline: ${g.baseline}\n  Target: ${g.target}`
  ).join('\n\n');

  const recentSessionsText = recentSessions && recentSessions.length > 0
    ? '\n\nRecent Session History:\n' + recentSessions.slice(0, 3).map((s, idx) =>
        `Session ${idx + 1} (${s.date}):\n  Activities: ${s.activitiesUsed.join(', ')}\n  ${s.notes ? `Notes: ${s.notes}` : ''}`
      ).join('\n\n')
    : '';

  const prompt = `You are an expert speech-language pathologist creating a detailed session plan. Generate a comprehensive session plan for:

Student: ${studentName} (Age: ${studentAge})

Current Goals:
${goalsText}${recentSessionsText}

Create a session plan that includes:
1. Session objectives (what you'll target in this session)
2. Warm-up activity (brief, engaging activity to start the session)
3. Main activities (2-3 activities that target the goals, with specific instructions)
4. Materials needed (list all materials for each activity)
5. Data collection strategy (how to measure progress during the session)
6. Closing activity or wrap-up (to end the session positively)
7. Homework or carryover suggestions (if applicable)

Make the plan:
- Age-appropriate and engaging
- Directly aligned with the stated goals
- Practical and easy to implement
- Include variety to maintain student engagement
- Consider recent session history to avoid repetition while building on previous work

Format the plan clearly with sections and numbered steps.`;

  let lastError: Error | null = null;

  for (const modelName of availableModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStatus = (error as { status?: number })?.status;
      lastError = error instanceof Error ? error : new Error(errorMessage);
      if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
        continue;
      }
      break;
    }
  }

  const errorMessage = lastError?.message || 'Unknown error';
  const errorStatus = (lastError as { status?: number })?.status;
  if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
    throw new Error('No available Gemini models found. Please check your API key permissions in Google AI Studio or try regenerating your API key.');
  } else if (errorStatus === 401 || errorMessage?.includes('401')) {
    throw new Error('Invalid API key. Please check your API key in Settings.');
  } else if (errorStatus === 403 || errorMessage?.includes('403')) {
    throw new Error('API key does not have permission. Please enable Gemini API in Google Cloud Console.');
  } else {
    throw new Error(`Failed to generate session plan: ${errorMessage}`);
  }
};

// Treatment Recommendations
export const generateTreatmentRecommendations = async (
  apiKey: string,
  studentName: string,
  studentAge: number,
  goals: GoalProgressData[],
  recentSessions?: Array<{ date: string; performanceData: Array<{ goalId: string; accuracy?: number; notes?: string }>; notes?: string }>
): Promise<string> => {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  let availableModels = await getAvailableModels(apiKey);
  // Filter out deprecated -latest aliases that will be updated to Gemini 3
  availableModels = availableModels.filter(
    (m) => !m.includes('gemini-pro-latest') && !m.includes('gemini-flash-latest')
  );
  if (availableModels.length === 0) {
    availableModels = ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
  }

  const goalsText = goals.map((goal, idx) => {
    let goalInfo = `Goal ${idx + 1}: ${goal.goalDescription}\n`;
    goalInfo += `  Baseline: ${goal.baseline}%\n`;
    goalInfo += `  Current: ${goal.current.toFixed(1)}%\n`;
    goalInfo += `  Target: ${goal.target}%\n`;
    goalInfo += `  Status: ${goal.status}\n`;
    goalInfo += `  Sessions: ${goal.sessions}`;
    return goalInfo;
  }).join('\n\n');

  const recentSessionsText = recentSessions && recentSessions.length > 0
    ? '\n\nRecent Performance:\n' + recentSessions.slice(0, 5).map(s => 
        `Date: ${s.date}\n  ${s.notes || 'No session notes'}`
      ).join('\n\n')
    : '';

  const prompt = `You are an expert speech-language pathologist providing treatment recommendations. Analyze the following student progress data and provide personalized treatment recommendations:

Student: ${studentName} (Age: ${studentAge})

Goal Progress:
${goalsText}${recentSessionsText}

Provide comprehensive treatment recommendations that include:
1. Overall progress analysis (summarize the student's current status across all goals)
2. Strategies for goals making good progress (what's working well, how to continue)
3. Strategies for goals needing more support (areas of concern, modifications needed)
4. Activity recommendations (specific activities or techniques to try)
5. Modifications or adaptations (if current approach needs adjustment)
6. Next steps (short-term and long-term recommendations)

Make recommendations:
- Evidence-based and appropriate for the student's age
- Specific and actionable
- Based on the progress data provided
- Consider both strengths and areas needing improvement
- Professional and suitable for clinical documentation

Format the recommendations clearly with sections.`;

  let lastError: Error | null = null;

  for (const modelName of availableModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStatus = (error as { status?: number })?.status;
      lastError = error instanceof Error ? error : new Error(errorMessage);
      if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
        continue;
      }
      break;
    }
  }

  const errorMessage = lastError?.message || 'Unknown error';
  const errorStatus = (lastError as { status?: number })?.status;
  if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
    throw new Error('No available Gemini models found. Please check your API key permissions in Google AI Studio or try regenerating your API key.');
  } else if (errorStatus === 401 || errorMessage?.includes('401')) {
    throw new Error('Invalid API key. Please check your API key in Settings.');
  } else if (errorStatus === 403 || errorMessage?.includes('403')) {
    throw new Error('API key does not have permission. Please enable Gemini API in Google Cloud Console.');
  } else {
    throw new Error(`Failed to generate treatment recommendations: ${errorMessage}`);
  }
};

// IEP Goal Suggestions from Assessment Data
export const generateIEPGoals = async (
  apiKey: string,
  studentName: string,
  studentAge: number,
  studentGrade: string,
  assessmentData: string,
  concerns: string[]
): Promise<string> => {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  let availableModels = await getAvailableModels(apiKey);
  // Filter out deprecated -latest aliases that will be updated to Gemini 3
  availableModels = availableModels.filter(
    (m) => !m.includes('gemini-pro-latest') && !m.includes('gemini-flash-latest')
  );
  if (availableModels.length === 0) {
    availableModels = ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
  }

  const concernsText = concerns.length > 0 ? concerns.join(', ') : 'Not specified';

  const prompt = `You are an expert speech-language pathologist creating IEP goals. Based on the following assessment data, generate appropriate annual IEP goals:

Student: ${studentName}
Age: ${studentAge}
Grade: ${studentGrade}
Areas of Concern: ${concernsText}

Assessment Data:
${assessmentData}

Generate 3-5 comprehensive annual IEP goals that:
1. Are measurable and follow SMART criteria
2. Address the identified areas of need from the assessment
3. Are appropriate for the student's age and grade level
4. Include baseline performance levels
5. Include target performance levels with clear criteria
6. Specify measurement methods and frequency
7. Are aligned with educational standards and functional outcomes
8. Include conditions (when/where the goal will be measured)

For each goal, provide:
- Complete goal statement (measurable annual goal)
- Baseline (current performance level)
- Target (expected performance level by end of IEP period)
- Measurement criteria (how progress will be measured)
- Service delivery considerations (if applicable)

Format each goal clearly. Use professional IEP language and terminology.`;

  let lastError: Error | null = null;

  for (const modelName of availableModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStatus = (error as { status?: number })?.status;
      lastError = error instanceof Error ? error : new Error(errorMessage);
      if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
        continue;
      }
      break;
    }
  }

  const errorMessage = lastError?.message || 'Unknown error';
  const errorStatus = (lastError as { status?: number })?.status;
  if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
    throw new Error('No available Gemini models found. Please check your API key permissions in Google AI Studio or try regenerating your API key.');
  } else if (errorStatus === 401 || errorMessage?.includes('401')) {
    throw new Error('Invalid API key. Please check your API key in Settings.');
  } else if (errorStatus === 403 || errorMessage?.includes('403')) {
    throw new Error('API key does not have permission. Please enable Gemini API in Google Cloud Console.');
  } else {
    throw new Error(`Failed to generate IEP goals: ${errorMessage}`);
  }
};

/**
 * Options for IEP content generation. The AI receives previous (old) IEP notes and goals,
 * additional notes, and session data (from the app), and returns updated present levels and suggested goals.
 */
export interface GenerateIEPCommentUpdateOptions {
  apiKey: string;
  studentName: string;
  /** Previous IEP Communication note (old present levels—used as context only; do not repeat). */
  previousIEPNote?: string;
  /** Previous IEP goals as pasted by the user (old—used to suggest updated goals). */
  previousIEPGoals?: string;
  /** Additional notes / summary context. */
  additionalNotes?: string;
  goalsData: GoalProgressData[];
  recentSessionsSummary?: string;
}

/**
 * Generate IEP content. The AI takes: (1) previous IEP notes, (2) previous IEP goals (pasted),
 * (3) additional notes, plus session performance data from the app. It returns:
 * - Updated present levels of academic achievement and functional performance (reflecting current progress and cuing from sessions).
 * - Suggested goals based on recent performance (comparing previous goals to session data).
 * The output must be NEW/updated language—not a copy or paraphrase of the previous notes.
 * Strips student-identifying info before sending to the API; re-inserts student name in the output.
 */
export const generateIEPCommentUpdate = async (
  options: GenerateIEPCommentUpdateOptions
): Promise<string> => {
  const {
    apiKey,
    studentName,
    previousIEPNote = '',
    previousIEPGoals = '',
    additionalNotes = '',
    goalsData,
    recentSessionsSummary,
  } = options;

  if (!apiKey) {
    throw new Error('API key is required');
  }

  const hasPreviousNote = previousIEPNote.trim().length > 0;
  const hasPastedGoals = previousIEPGoals.trim().length > 0;
  const hasAdditionalNotes = additionalNotes.trim().length > 0;
  const hasAppGoals = goalsData.length > 0;

  if (!hasPreviousNote && !hasPastedGoals && !hasAdditionalNotes && !hasAppGoals) {
    throw new Error(
      'Provide at least one of: Previous IEP notes, Previous IEP goals, Additional notes, or ensure the student has goals in the app.'
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  let availableModels = await getAvailableModels(apiKey);
  availableModels = availableModels.filter(
    (m) => !m.includes('gemini-pro-latest') && !m.includes('gemini-flash-latest')
  );
  if (availableModels.length === 0) {
    availableModels = ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
  }

  const sanitize = (text: string) =>
    studentName && text.trim()
      ? text.trim().replace(new RegExp(escapeRegex(studentName), 'gi'), 'Student')
      : text.trim();

  const sanitizedPreviousNote = sanitize(previousIEPNote);
  const sanitizedGoals = sanitize(previousIEPGoals);
  const sanitizedAdditional = sanitize(additionalNotes);

  const goalsText = hasAppGoals
    ? goalsData.map((goal, idx) => {
        let info = `Goal ${idx + 1}: ${goal.goalDescription}\n`;
        info += `  Baseline: ${goal.baseline}%\n`;
        info += `  Current: ${goal.current.toFixed(1)}%\n`;
        info += `  Target: ${goal.target}%\n`;
        info += `  Status: ${goal.status}\n`;
        info += `  Sessions: ${goal.sessions}`;
        if (goal.performanceHistory && goal.performanceHistory.length > 0) {
          info += `\n  Recent Performance:`;
          goal.performanceHistory.slice(0, 5).forEach((p) => {
            info += `\n    - ${p.date}: ${p.accuracy.toFixed(1)}%`;
            if (p.cuingLevels && p.cuingLevels.length > 0) {
              info += ` | Cuing: ${p.cuingLevels.join(', ')}`;
            }
            if (p.notes) info += ` - ${p.notes}`;
          });
        }
        return info;
      }).join('\n\n')
    : '';

  const recentSessionsSection = recentSessionsSummary
    ? `\n\nRecent Session Summary (use this for performance and cuing in the summary):\n${recentSessionsSummary}`
    : '';

  const outputInstruction = `Generate the following, in order, with clear section headers (e.g. "## Current Summary", "## Suggested Goals") so the user can copy each part:

1. CURRENT SUMMARY (Updated Present Levels): Write NEW, updated present levels of academic achievement and functional performance. Base this on the recent speech session data (performance, accuracy, cuing levels). Do NOT copy or paraphrase the previous IEP notes—that text is OLD. Your output must reflect current progress and current cuing (independent, verbal, visual, tactile, physical) from the session data. Use "Student" as the placeholder for the child's name.

2. SUGGESTED GOALS: Based on the previous IEP goals (pasted by the user) and the recent session performance data, suggest updated or new goals—e.g., revised targets, new baselines, or modified goal language. Be concrete and reference the progress and cuing data.`;

  let contextBlocks = '';
  if (hasPreviousNote) {
    contextBlocks += `
Previous IEP Notes (Communication / present levels—OLD data; use as context only; do not repeat):
---
${sanitizedPreviousNote}
---
`;
  }
  if (hasPastedGoals) {
    contextBlocks += `
Previous IEP Goals (as pasted—OLD; use to suggest updated goals):
---
${sanitizedGoals}
---
`;
  }
  if (hasAdditionalNotes) {
    contextBlocks += `
Additional notes / summary context:
---
${sanitizedAdditional}
---
`;
  }
  if (hasAppGoals || recentSessionsSummary) {
    contextBlocks += `
Session data (performance and cuing from the app—use this to write the updated present levels):
${goalsText}${recentSessionsSection}
`;
  }

  const prompt = `You are an expert speech-language pathologist supporting IEP updates for a speech student.

You will be given:
${hasPreviousNote ? '- Previous IEP notes (Communication/present levels)—this is OLD data; use as context only. Do NOT return it verbatim or paraphrased.\n' : ''}${hasPastedGoals ? '- Previous IEP goals (pasted)—OLD; use to suggest updated goals.\n' : ''}${hasAdditionalNotes ? '- Additional notes or summary context\n' : ''}- Session data: goal progress, recent session summary (including performance and cuing levels when present)—use this to write the UPDATED present levels.

Instructions:
- Use "Student" as the placeholder for the child's name throughout.
- Use whole-number percentages only (e.g., 69% or 57%, never 69.0% or 57.0%).
- Your output must be NEW/updated language. The previous IEP notes and goals are OLD—do not repeat or paraphrase them. Write updated present levels that reflect current progress and cuing from the session data.
- For SUGGESTED GOALS: Compare the previous goals to recent session performance and suggest specific, measurable changes (revised targets, baselines, or new goal ideas) with clear rationale.

${outputInstruction}
${contextBlocks}`;

  let lastError: Error | null = null;

  for (const modelName of availableModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const generatedText = response.text();
      const firstName = studentName.trim().split(/\s+/)[0] || studentName;
      let replacedText = generatedText.replace(/\bStudent\b/g, firstName);
      replacedText = replacedText.replace(/\b(\d+)\.(\d+)%\b/g, (_, intPart, decPart) =>
        String(Math.round(Number(`${intPart}.${decPart}`))) + '%'
      );
      return replacedText;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStatus = (error as { status?: number })?.status;
      lastError = error instanceof Error ? error : new Error(errorMessage);
      if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
        continue;
      }
      break;
    }
  }

  const errorMessage = lastError?.message || 'Unknown error';
  const errorStatus = (lastError as { status?: number })?.status;
  if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
    throw new Error('No available Gemini models found. Please check your API key permissions in Google AI Studio or try regenerating your API key.');
  } else if (errorStatus === 401 || errorMessage?.includes('401')) {
    throw new Error('Invalid API key. Please check your API key in Settings.');
  } else if (errorStatus === 403 || errorMessage?.includes('403')) {
    throw new Error('API key does not have permission. Please enable Gemini API in Google Cloud Console.');
  } else {
    throw new Error(`Failed to generate IEP content: ${errorMessage}`);
  }
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Documentation Templates
export const generateDocumentationTemplate = async (
  apiKey: string,
  templateType: 'evaluation' | 'progress-note' | 'discharge-summary' | 'treatment-plan' | 'soap-note',
  studentName: string,
  studentAge: number,
  studentGrade: string,
  additionalContext?: string
): Promise<string> => {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  let availableModels = await getAvailableModels(apiKey);
  // Filter out deprecated -latest aliases that will be updated to Gemini 3
  availableModels = availableModels.filter(
    (m) => !m.includes('gemini-pro-latest') && !m.includes('gemini-flash-latest')
  );
  if (availableModels.length === 0) {
    availableModels = ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
  }

  const templateDescriptions: Record<string, string> = {
    'evaluation': 'comprehensive speech-language evaluation report',
    'progress-note': 'progress note for ongoing therapy',
    'discharge-summary': 'discharge summary report',
    'treatment-plan': 'treatment plan document',
    'soap-note': 'SOAP (Subjective, Objective, Assessment, Plan) note format'
  };

  const templateDescription = templateDescriptions[templateType] || 'documentation template';

  const contextText = additionalContext ? `\n\nAdditional Context:\n${additionalContext}` : '';

  const prompt = `You are an expert speech-language pathologist. Generate a professional ${templateDescription} template for:

Student: ${studentName}
Age: ${studentAge}
Grade: ${studentGrade}${contextText}

Create a comprehensive template that includes:
${templateType === 'evaluation' 
  ? '- Background information section\n- Assessment procedures\n- Assessment results\n- Analysis and interpretation\n- Recommendations\n- Conclusion'
  : templateType === 'progress-note'
  ? '- Session date and duration\n- Goals addressed\n- Activities completed\n- Performance data\n- Progress summary\n- Plan for next session'
  : templateType === 'discharge-summary'
  ? '- Admission date and discharge date\n- Initial assessment summary\n- Treatment provided\n- Progress made\n- Current status\n- Recommendations for follow-up'
  : templateType === 'treatment-plan'
  ? '- Present level of performance\n- Long-term goals\n- Short-term objectives\n- Treatment approaches\n- Frequency and duration\n- Discharge criteria'
  : templateType === 'soap-note'
  ? '- Subjective (client report, parent/teacher input)\n- Objective (observable data, test results)\n- Assessment (clinical interpretation)\n- Plan (next steps, modifications)'
  : '- All relevant sections for this document type'
}

The template should:
- Use professional SLP terminology
- Include section headers and clear structure
- Have placeholders or guidance text indicating what information to include
- Be comprehensive and suitable for clinical documentation
- Follow standard documentation practices in speech-language pathology

Format the template clearly with sections, subsections, and appropriate structure. Include brief guidance or examples where helpful.`;

  let lastError: Error | null = null;

  for (const modelName of availableModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStatus = (error as { status?: number })?.status;
      lastError = error instanceof Error ? error : new Error(errorMessage);
      if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
        continue;
      }
      break;
    }
  }

  const errorMessage = lastError?.message || 'Unknown error';
  const errorStatus = (lastError as { status?: number })?.status;
  if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
    throw new Error('No available Gemini models found. Please check your API key permissions in Google AI Studio or try regenerating your API key.');
  } else if (errorStatus === 401 || errorMessage?.includes('401')) {
    throw new Error('Invalid API key. Please check your API key in Settings.');
  } else if (errorStatus === 403 || errorMessage?.includes('403')) {
    throw new Error('API key does not have permission. Please enable Gemini API in Google Cloud Console.');
  } else {
    throw new Error(`Failed to generate documentation template: ${errorMessage}`);
  }
};

// Articulation Screening Report
export const generateArticulationScreeningReport = async (
  apiKey: string,
  studentName: string,
  studentAge: number,
  studentGrade: string,
  disorderedPhonemes: Array<{ phoneme: string; note?: string }>,
  slpName: string = 'Aaron Pope'
): Promise<string> => {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  let availableModels = await getAvailableModels(apiKey);
  // Filter out deprecated -latest aliases that will be updated to Gemini 3
  availableModels = availableModels.filter(
    (m) => !m.includes('gemini-pro-latest') && !m.includes('gemini-flash-latest')
  );
  if (availableModels.length === 0) {
    availableModels = ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
  }

  // Format disordered phonemes data with proper markdown formatting
  const phonemesList = disorderedPhonemes.map(dp => {
    let entry = `- **Phoneme: /${dp.phoneme}/**`;
    if (dp.note) {
      entry += `\n  - ${dp.note}`;
    }
    return entry;
  }).join('\n');

  const phonemesText = disorderedPhonemes.length > 0 
    ? phonemesList 
    : 'None identified';

  const prompt = `You are an expert speech-language pathologist creating an articulation screening report. Based on the following screening data, generate a comprehensive, professional screening report:

Student Name: ${studentName}
Student Age: ${studentAge}
Grade: ${studentGrade}
Speech-Language Pathologist: ${slpName}

Disordered Phonemes Identified:
${phonemesText}

Generate a professional articulation screening report that includes:
1. **Summary** - Brief overview of the screening findings
2. **Disordered Phonemes** - List and organize the identified disordered phonemes. For each phoneme, use this format:
   - **Phoneme: /phoneme/**
     - **Place:** [Place of articulation]
     - **Manner:** [Manner of articulation]
     - **Voicing:** [Voiced/Voiceless]
     - **Error Observed:** [Description of the error]
   Organize by:
   - Place of articulation (Bilabial, Labiodental, Dental, Alveolar, Post-alveolar, Palatal, Velar, Glottal)
   - Manner of articulation (Stop, Fricative, Affricate, Nasal, Liquid, Glide)
   - Voicing (Voiced/Voiceless)
3. **Error Patterns** - Identify common phonological processes or error patterns observed (e.g., fronting, stopping, cluster reduction, etc.)
4. **Severity Analysis** - Provide an assessment of severity level (mild, moderate, moderate-severe, severe) based on the number and types of disordered phonemes
5. **Impact on Speech Intelligibility** - Discuss how the identified errors may affect overall speech clarity
6. **Age-Appropriateness** - Note which phonemes are typically acquired by the student's age vs. those that may still be developing
7. **Recommendations** - Provide specific, actionable recommendations including:
   - Need for comprehensive evaluation (if indicated)
   - Suggested treatment targets and priorities
   - Expected prognosis
   - Suggested goals for therapy (if treatment is recommended)
8. **Conclusion** - Summary statement about next steps

Format the report in clear sections with professional SLP terminology. Use objective language and base recommendations on evidence-based practice. Be specific about phoneme characteristics and error patterns observed. Include the student's name and your name (${slpName}) as the SLP in the report header or signature section.`;

  let lastError: Error | null = null;

  for (const modelName of availableModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStatus = (error as { status?: number })?.status;
      lastError = error instanceof Error ? error : new Error(errorMessage);
      if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
        continue;
      }
      break;
    }
  }

  const errorMessage = lastError?.message || 'Unknown error';
  const errorStatus = (lastError as { status?: number })?.status;
  if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
    throw new Error('No available Gemini models found. Please check your API key permissions in Google AI Studio or try regenerating your API key.');
  } else if (errorStatus === 401 || errorMessage?.includes('401')) {
    throw new Error('Invalid API key. Please check your API key in Settings.');
  } else if (errorStatus === 403 || errorMessage?.includes('403')) {
    throw new Error('API key does not have permission. Please enable Gemini API in Google Cloud Console.');
  } else {
    throw new Error(`Failed to generate articulation screening report: ${errorMessage}`);
  }
};

/**
 * Helper functions for handling thought signatures with Gemini 3 models
 * These are required when using function calling with gemini-3-pro-preview or gemini-3-flash-preview
 * 
 * Note: The Google Generative AI SDK (v0.24.1+) should handle thought signatures automatically
 * when using chat history. These helpers are provided for advanced use cases or manual handling.
 */

/**
 * Extracts thought signatures from a Gemini API response
 * Thought signatures are required for function calling with Gemini 3 models
 */
export function extractThoughtSignatures(response: { candidates?: Array<{ content?: { parts?: unknown[] } }> }): Map<string, string> {
  const signatures = new Map<string, string>();
  
  if (!response.candidates?.[0]?.content?.parts) {
    return signatures;
  }

  const parts = response.candidates[0].content.parts as Array<{ functionCall?: { name?: string }; thoughtSignature?: string }>;
  
  for (const part of parts) {
    if (part.functionCall?.name && part.thoughtSignature) {
      signatures.set(part.functionCall.name, part.thoughtSignature);
    }
  }
  
  return signatures;
}

/**
 * Validates that thought signatures are present for function calls
 * Throws an error if signatures are missing (required for Gemini 3 models)
 */
export function validateThoughtSignatures(
  response: { candidates?: Array<{ content?: { parts?: unknown[] } }> },
  modelName: string
): void {
  // Only validate for Gemini 3 models
  if (!modelName.includes('gemini-3')) {
    return;
  }

  if (!response.candidates?.[0]?.content?.parts) {
    return;
  }

  const parts = response.candidates[0].content.parts as Array<{ functionCall?: { name?: string }; thoughtSignature?: string }>;
  const functionCalls = parts.filter((p) => p.functionCall);
  
  if (functionCalls.length === 0) {
    return; // No function calls, no validation needed
  }

  // For parallel function calls, only the first one needs a signature
  const firstFunctionCall = functionCalls[0];
  if (!firstFunctionCall.thoughtSignature) {
    throw new Error(
      `Thought signature is required for function calling with Gemini 3 models. ` +
      `Missing signature for function: ${firstFunctionCall.functionCall?.name || 'unknown'}. ` +
      `Please ensure you're using @google/generative-ai SDK v0.24.1+ and passing chat history correctly.`
    );
  }
}

/**
 * Creates a function response part with the associated thought signature
 * This is used when responding to function calls from Gemini 3 models
 */
export function createFunctionResponsePart(
  functionName: string,
  functionResponse: unknown,
  thoughtSignature?: string
): { functionResponse: { name: string; response: unknown }; thoughtSignature?: string } {
  const part: { functionResponse: { name: string; response: unknown }; thoughtSignature?: string } = {
    functionResponse: {
      name: functionName,
      response: functionResponse,
    },
  };
  
  // Include thought signature if provided (required for Gemini 3 models)
  if (thoughtSignature) {
    part.thoughtSignature = thoughtSignature;
  }
  
  return part;
}

