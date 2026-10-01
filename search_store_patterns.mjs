import fs from 'fs';

const storeContent = fs.readFileSync('lib/store.tsx', 'utf8');
const lines = storeContent.split('\n');

function findPattern(pattern) {
  console.log(`=== Matches in store.tsx for: ${pattern} ===`);
  lines.forEach((line, idx) => {
    if (line.includes(pattern)) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  });
}

findPattern('addCurriculumVideo');
findPattern('updateCurriculumVideo');
findPattern('mapCategoryToDbEnum');
findPattern('mapFitnessCategoryToDbEnum');
