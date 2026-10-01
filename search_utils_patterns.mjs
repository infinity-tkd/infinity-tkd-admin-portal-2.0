import fs from 'fs';

const utilsContent = fs.readFileSync('lib/utils.ts', 'utf8');
const lines = utilsContent.split('\n');

function findPattern(pattern) {
  console.log(`=== Matches in utils.ts for: ${pattern} ===`);
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes(pattern.toLowerCase())) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  });
}

findPattern('category');
findPattern('translate');
