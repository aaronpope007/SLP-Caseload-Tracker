/**
 * Script to format scheduled sessions JSON file for import
 * Usage: node format-scheduled-sessions.js <input-file> <output-file>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = process.argv[2] || path.join(process.env.USERPROFILE || process.env.HOME, 'Downloads', 'scheduled-sessions-2025-12-29.json');
const outputFile = process.argv[3] || path.join(__dirname, 'scheduled-sessions-to-import.json');

try {
  console.log(`📖 Reading: ${inputFile}`);
  let content = fs.readFileSync(inputFile, 'utf-8');
  
  // Remove BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  
  const sessions = JSON.parse(content);
  
  if (!Array.isArray(sessions)) {
    throw new Error('Input file must contain a JSON array of scheduled sessions');
  }
  
  const formatted = {
    scheduledSessions: sessions
  };
  
  console.log(`✓ Found ${sessions.length} scheduled sessions`);
  console.log(`💾 Writing to: ${outputFile}`);
  
  fs.writeFileSync(outputFile, JSON.stringify(formatted, null, 2), 'utf-8');
  
  console.log('✅ File formatted successfully!');
  console.log(`\nNow run: npm run import-scheduled-sessions -- scheduled-sessions-to-import.json`);
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

