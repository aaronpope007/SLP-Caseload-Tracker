import { Router } from 'express';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { asyncHandler } from '../middleware/asyncHandler';

export const documentParserRouter = Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept PDF and Word documents
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'));
    }
  },
});

interface ExtractedPerson {
  name: string;
  email?: string;
  phoneNumber?: string;
  grade?: string;
  role?: string;
  type: 'teacher' | 'case-manager' | 'staff';
}

interface ParsedDocument {
  schoolName?: string;
  people: ExtractedPerson[];
}

// Helper function to get available models (same as rest of app)
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
    console.warn('Error fetching available models:', e);
  }
  return [];
}

// Extract text from Word document (for sending to Gemini)
async function extractTextFromWord(buffer: Buffer): Promise<string> {
  try {
    const mammothLib = await import('mammoth');
    const result = await mammothLib.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    throw new Error(`Failed to extract text from Word document: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Use Gemini AI to parse document and extract teacher/staff information
async function parseDocumentWithGemini(
  buffer: Buffer,
  mimeType: string,
  apiKey: string,
  schoolName?: string
): Promise<ParsedDocument> {
  if (!apiKey) {
    throw new Error('Gemini API key is required for document parsing');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Get available models (same pattern as rest of app)
  let availableModels = await getAvailableModels(apiKey);
  
  // Filter out deprecated -latest aliases that will be updated to Gemini 3
  availableModels = availableModels.filter(
    (m) => !m.includes('gemini-pro-latest') && !m.includes('gemini-flash-latest')
  );
  
  if (availableModels.length === 0) {
    availableModels = ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
  }

  const schoolContext = schoolName 
    ? `The school name is: ${schoolName}. All staff members should be associated with this school.`
    : 'Try to identify the school name from the document. If found, include it in the response.';

  const prompt = `You are parsing a school staff directory document. Extract all teacher and staff member information from this document.

${schoolContext}

Extract the following information for each person:
- Name (required)
- Email address (if available)
- Phone number (if available)
- Grade level or subject (for teachers)
- Role or title (e.g., "Teacher", "Principal", "SPED Teacher", "Case Manager", "SLP", "OT", "PT", etc.)

For each person, determine their type:
- "teacher" if they are a classroom teacher or subject teacher
- "case-manager" if they are a special education case manager, SLP, OT, PT, or similar support staff
- "staff" for other school staff (principal, secretary, etc.)

Return your response as a JSON object with this exact structure:
{
  "schoolName": "School Name Here (or null if not found)",
  "people": [
    {
      "name": "Full Name",
      "email": "email@example.com (or null if not found)",
      "phoneNumber": "1234567890 (digits only, no formatting, or null if not found)",
      "grade": "Grade or Subject (or null if not applicable)",
      "role": "Role/Title (or null if not specified)",
      "type": "teacher" | "case-manager" | "staff"
    }
  ]
}

IMPORTANT:
- Only include people who have names
- Extract phone numbers as digits only (remove all formatting like parentheses, dashes, spaces)
- If email or phone is not found, use null (not empty string)
- Be thorough - extract ALL staff members mentioned in the document
- If you cannot determine the type, default to "teacher" for classroom teachers and "case-manager" for support staff`;

  let lastError: Error | null = null;

  // Try each available model
  for (const modelName of availableModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      
      let result;
      
      // For PDFs, send directly as file
      if (mimeType === 'application/pdf') {
        const base64Data = buffer.toString('base64');
        result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: base64Data,
              mimeType: 'application/pdf',
            },
          },
        ]);
      } else {
        // For Word docs, extract text first, then send to Gemini
        const text = await extractTextFromWord(buffer);
        if (!text || text.trim().length === 0) {
          throw new Error('Could not extract text from Word document');
        }
        result = await model.generateContent(`${prompt}\n\nDocument text:\n${text}`);
      }
      
      const response = await result.response;
      const responseText = response.text();
      
      // Try to extract JSON from the response
      let jsonText = responseText.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
      }
      
      // Try to parse the JSON
      const parsed = JSON.parse(jsonText) as ParsedDocument;
      
      // Validate and clean up the data
      if (parsed.people && Array.isArray(parsed.people)) {
        parsed.people = parsed.people.filter((person) => person.name && person.name.trim());
        // Clean phone numbers - ensure they're digits only
        parsed.people = parsed.people.map((person) => {
          if (person.phoneNumber) {
            person.phoneNumber = person.phoneNumber.replace(/\D/g, '');
            if (person.phoneNumber.length === 0) {
              person.phoneNumber = undefined;
            }
          }
          return person;
        });
      }
      
      console.log(`✅ Successfully extracted ${parsed.people?.length || 0} people using model: ${modelName}`);
      return parsed;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      lastError = error instanceof Error ? error : new Error(errorMessage);
      
      // If it's a 404, try the next model
      const errorStatus = (error as { status?: number })?.status;
      if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
        console.warn(`Model ${modelName} not found, trying next...`);
        continue;
      }
      // For other errors, stop trying
      break;
    }
  }

  // If we get here, all models failed
  const errorMessage = lastError?.message || 'Unknown error';
  const errorStatus = (lastError as { status?: number })?.status;
  
  if (errorStatus === 404 || errorMessage?.includes('404') || errorMessage?.includes('not found')) {
    throw new Error('No available Gemini models found. Please check your API key permissions.');
  } else if (errorStatus === 401 || errorMessage?.includes('401')) {
    throw new Error('Invalid API key. Please check your API key in Settings.');
  } else if (errorStatus === 403 || errorMessage?.includes('403')) {
    throw new Error('API key does not have permission. Please enable Gemini API in Google Cloud Console.');
  } else {
    throw new Error(`Failed to parse document: ${errorMessage}`);
  }
}

// Handle OPTIONS preflight for CORS
documentParserRouter.options('/parse', (_req, res) => {
  res.status(200).end();
});

// POST /api/document-parser/parse
// Upload a document and parse it to extract teacher/staff information
documentParserRouter.post(
  '/parse',
  upload.single('document'),
  asyncHandler(async (req, res) => {
    console.log('\n========================================');
    console.log('📄 DOCUMENT PARSER ENDPOINT HIT');
    console.log('========================================');
    console.log('File:', req.file ? `${req.file.originalname} (${req.file.size} bytes, ${req.file.mimetype})` : 'none');
    console.log('School:', req.body?.schoolName || 'not provided');
    // Note: API key is intentionally not logged for security
    
    if (!req.file) {
      console.error('❌ No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { apiKey, schoolName } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'Gemini API key is required' });
    }
    
    // Sanitize API key for any error logging (only show first 4 and last 4 chars)
    const sanitizeApiKey = (key: string): string => {
      if (key.length <= 8) return '***';
      return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
    };

    try {
      const parsed = await parseDocumentWithGemini(
        req.file.buffer,
        req.file.mimetype,
        apiKey,
        schoolName || undefined
      );

      console.log(`✅ Successfully parsed document: ${parsed.people?.length || 0} people found`);
      console.log('========================================\n');

      res.json(parsed);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Sanitize error messages to avoid exposing API key
      const sanitizedError = errorMessage.includes(apiKey) 
        ? errorMessage.replace(new RegExp(apiKey, 'g'), sanitizeApiKey(apiKey))
        : errorMessage;
      console.error('❌ Error parsing document:', sanitizedError);
      // Don't expose API key details in response
      const safeErrorMessage = errorMessage.includes('API key') 
        ? 'API key error. Please check your API key in Settings.'
        : errorMessage;
      res.status(500).json({ error: safeErrorMessage });
    }
  })
);
