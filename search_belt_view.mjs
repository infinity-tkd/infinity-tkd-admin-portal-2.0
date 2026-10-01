import fs from 'fs';

const filePath = 'components/DirectoryView.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log(`=== Matches in ${filePath} ===`);
lines.forEach((line, idx) => {
  if (line.includes('beltTechniques') || line.includes('belt_techniques') || line.includes('syllabus') || line.includes('Syllabus')) {
    console.log(`  Line ${idx+1}: ${line.trim()}`);
  }
});
