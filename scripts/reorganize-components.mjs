/**
 * Component Reorganization Script
 * 
 * Reorganizes components into feature-based folders and updates all imports.
 */

import { readdirSync, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const srcDir = join(rootDir, 'src');
const componentsDir = join(srcDir, 'components');

// Component mapping: component name -> target folder
const componentMapping = {
  // Session components
  'SessionCard': 'session',
  'SessionFormDialog': 'session',
  'SessionsList': 'session',
  'SessionTimeItem': 'session',
  'SessionPlanDialog': 'session',
  'ServiceTypeSelector': 'session',
  'TrialCounter': 'session',
  'PerformanceDataForm': 'session',
  'GroupSessionAccordion': 'session',
  
  // Goal components
  'GoalCard': 'goal',
  'GoalFormDialog': 'goal',
  'GoalsList': 'goal',
  'GoalProgressChip': 'goal',
  'GoalActionButtons': 'goal',
  'GoalActionsBar': 'goal',
  'GoalDateInfo': 'goal',
  'GoalHierarchy': 'goal',
  'GoalMatrixView': 'goal',
  'GoalSearchBar': 'goal',
  'GoalSuggestionsDialog': 'goal',
  'GoalTemplateDialog': 'goal',
  'QuickAccessGoalsBar': 'goal',
  'QuickGoalsDialog': 'goal',
  'SubGoalList': 'goal',
  'CopySubtreeDialog': 'goal',
  'IEPGoalsDialog': 'goal',
  'ActiveGoalsTrackingPanel': 'goal',
  
  // Student components
  'StudentInfoCard': 'student',
  'StudentAccordionCard': 'student',
  'StudentSelector': 'student',
  
  // Common components
  'ErrorBoundary': 'common',
  'RouteErrorBoundary': 'common',
  'LoadingSkeletons': 'common',
  'ResponsiveDialog': 'common',
  'SearchBar': 'common',
  'StatusChip': 'common',
  'PriorityChip': 'common',
  'AccordionExpandIcon': 'common',
  
  // Settings components
  'SettingsDialog': 'settings',
  'BackupManager': 'settings',
  'ExportDialog': 'settings',
};

// Recursively get all TypeScript files
function getAllTsFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat.isDirectory() && !filePath.includes('node_modules')) {
      getAllTsFiles(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

// Create feature folders
const folders = ['session', 'goal', 'student', 'common', 'settings'];
folders.forEach(folder => {
  const folderPath = join(componentsDir, folder);
  if (!existsSync(folderPath)) {
    mkdirSync(folderPath, { recursive: true });
    console.log(`✓ Created folder: ${folder}/`);
  }
});

// Get all source files
const sourceFiles = getAllTsFiles(srcDir);

console.log(`\nFound ${sourceFiles.length} source files to process\n`);

// Track files to move
const filesToMove = [];

// First pass: collect files to move
readdirSync(componentsDir).forEach(file => {
  if ((file.endsWith('.tsx') || file.endsWith('.ts')) && !file.includes('index')) {
    const componentName = file.replace(/\.(tsx|ts)$/, '');
    const targetFolder = componentMapping[componentName];
    
    if (targetFolder) {
      filesToMove.push({
        oldPath: join(componentsDir, file),
        newPath: join(componentsDir, targetFolder, file),
        componentName,
        targetFolder,
      });
    }
  }
});

console.log(`Files to move: ${filesToMove.length}`);
filesToMove.forEach(({ componentName, targetFolder }) => {
  console.log(`  ${componentName} → ${targetFolder}/`);
});

// Helper to calculate relative path
function getRelativePath(from, to) {
  let rel = relative(dirname(from), to).replace(/\\/g, '/');
  if (!rel.startsWith('.')) {
    rel = './' + rel;
  }
  // Remove .tsx extension
  rel = rel.replace(/\.tsx?$/, '');
  return rel;
}

// Second pass: update imports in all source files (before moving)
let importUpdates = 0;

sourceFiles.forEach(filePath => {
  // Skip files that will be moved
  const willBeMoved = filesToMove.some(f => f.oldPath === filePath);
  if (willBeMoved) return;
  
  let content = readFileSync(filePath, 'utf-8');
  let changed = false;
  
  // Update import statements
  // Pattern: from '../components/ComponentName' or from './components/ComponentName'
  const importPattern = /from\s+['"](\.\.?\/components\/)(\w+)(?:\.tsx?)?['"]/g;
  
  content = content.replace(importPattern, (match, prefix, componentName) => {
    const targetFolder = componentMapping[componentName];
    if (targetFolder) {
      const newPath = getRelativePath(filePath, join(componentsDir, targetFolder, `${componentName}.tsx`));
      changed = true;
      importUpdates++;
      return `from '${newPath}'`;
    }
    return match;
  });
  
  if (changed) {
    writeFileSync(filePath, content, 'utf-8');
  }
});

console.log(`\n✓ Updated ${importUpdates} import statements`);

// Third pass: move files and update their internal imports
console.log('\nMoving files...');
filesToMove.forEach(({ oldPath, newPath, componentName, targetFolder }) => {
  if (existsSync(oldPath)) {
    let content = readFileSync(oldPath, 'utf-8');
    
    // Update relative imports within the moved file
    // Update imports from other components
    Object.entries(componentMapping).forEach(([name, folder]) => {
      // Pattern: from '../components/ComponentName'
      const pattern = /from\s+['"]\.\.\/components\/(\w+)(?:\.tsx?)?['"]/g;
      content = content.replace(pattern, (match, compName) => {
        if (compName === name) {
          const compFolder = componentMapping[compName];
          if (compFolder === targetFolder) {
            return `from './${compName}'`;
          } else {
            return `from '../${compFolder}/${compName}'`;
          }
        }
        return match;
      });
    });
    
    writeFileSync(newPath, content, 'utf-8');
    unlinkSync(oldPath);
    console.log(`  ✓ Moved ${componentName}`);
  }
});

// Create index files for each folder
console.log('\nCreating index files...');
folders.forEach(folder => {
  const folderPath = join(componentsDir, folder);
  const files = readdirSync(folderPath)
    .filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.includes('index'))
    .map(f => f.replace(/\.(tsx|ts)$/, ''));
  
  if (files.length > 0) {
    const exports = files.map(name => {
      const filePath = join(folderPath, `${name}.tsx`);
      if (existsSync(filePath)) {
        const fileContent = readFileSync(filePath, 'utf-8');
        // Try to find export name
        const defaultExportMatch = fileContent.match(/export\s+default\s+(\w+)/);
        const namedExportMatch = fileContent.match(/export\s+(?:const|function|class|type|interface)\s+(\w+)/);
        const exportName = defaultExportMatch?.[1] || namedExportMatch?.[1] || name;
        
        return `export { ${exportName} } from './${name}';`;
      }
      return `export { ${name} } from './${name}';`;
    }).join('\n');
    
    const folderName = folder.charAt(0).toUpperCase() + folder.slice(1);
    const indexContent = `// ${folderName}-related components\n${exports}\n`;
    writeFileSync(join(folderPath, 'index.ts'), indexContent, 'utf-8');
    console.log(`  ✓ Created ${folder}/index.ts`);
  }
});

console.log('\n✅ Component reorganization complete!');
console.log('\nNext steps:');
console.log('1. Review the changes');
console.log('2. Run: npm run build');
console.log('3. Test the application');
