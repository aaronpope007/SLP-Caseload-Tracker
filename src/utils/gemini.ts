import { GoogleGenerativeAI } from '@google/generative-ai';

// Helper function to get available models
async function getAvailableModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await response.json();
    if (data.models) {
      return data.models
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name.replace('models/', ''));
    }
  } catch (e) {
    console.error('Error fetching available models:', e);
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
  console.log('Available models:', availableModels);
  
  // If we couldn't get the list, use default model names to try
  if (availableModels.length === 0) {
    availableModels = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
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
  let lastError: any = null;

  for (const modelName of availableModels) {
    try {
      console.log(`Trying model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      console.log(`Success with model: ${modelName}`);
      return response.text();
    } catch (error: any) {
      console.log(`Model ${modelName} failed:`, error?.message);
      lastError = error;
      
      // If it's a 404, try the next model
      if (error?.status === 404 || error?.message?.includes('404') || error?.message?.includes('not found')) {
        continue;
      }
      // For other errors (401, 403, etc.), stop trying
      break;
    }
  }

  // If we get here, all models failed
  console.error('All models failed. Last error:', lastError);
  
  // Provide helpful error messages
  if (lastError?.status === 404 || lastError?.message?.includes('404') || lastError?.message?.includes('not found')) {
    throw new Error('No available Gemini models found. Please check your API key permissions in Google AI Studio or try regenerating your API key.');
  } else if (lastError?.status === 401 || lastError?.message?.includes('401')) {
    throw new Error('Invalid API key. Please check your API key in Settings.');
  } else if (lastError?.status === 403 || lastError?.message?.includes('403')) {
    throw new Error('API key does not have permission. Please enable Gemini API in Google Cloud Console.');
  } else {
    throw new Error(`Failed to generate ideas: ${lastError?.message || 'Unknown error'}`);
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
  }[];
}

export const generateProgressNote = async (
  studentName: string,
  goals: GoalProgressData[],
  apiKey: string
): Promise<string> => {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  let availableModels = await getAvailableModels(apiKey);
  if (availableModels.length === 0) {
    availableModels = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
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

  const prompt = `You are a professional speech-language pathologist writing a progress note. Write a comprehensive, professional progress note for the following student and their goals.

Student: ${studentName}

Goal Information:
${goalsText}

Please write a professional progress note that:
1. Summarizes the student's overall progress
2. Addresses each goal individually with specific performance data
3. Highlights areas of improvement and areas that need continued focus
4. Uses professional SLP terminology
5. Is suitable for inclusion in clinical documentation or progress reports
6. Maintains a professional, objective tone

Format the note in clear paragraphs. If multiple goals are provided, organize the note to address each goal systematically.`;

  let lastError: any = null;

  for (const modelName of availableModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      lastError = error;
      if (error?.status === 404 || error?.message?.includes('404') || error?.message?.includes('not found')) {
        continue;
      }
      break;
    }
  }

  if (lastError?.status === 404 || lastError?.message?.includes('404') || lastError?.message?.includes('not found')) {
    throw new Error('No available Gemini models found. Please check your API key permissions in Google AI Studio or try regenerating your API key.');
  } else if (lastError?.status === 401 || lastError?.message?.includes('401')) {
    throw new Error('Invalid API key. Please check your API key in Settings.');
  } else if (lastError?.status === 403 || lastError?.message?.includes('403')) {
    throw new Error('API key does not have permission. Please enable Gemini API in Google Cloud Console.');
  } else {
    throw new Error(`Failed to generate progress note: ${lastError?.message || 'Unknown error'}`);
  }
};

