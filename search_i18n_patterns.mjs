import fs from 'fs';

const i18nContent = fs.readFileSync('lib/i18n.ts', 'utf8');
const lines = i18nContent.split('\n');

function findPattern(pattern) {
  console.log(`=== Matches in i18n.ts for: ${pattern} ===`);
  lines.forEach((line, idx) => {
    if (line.includes(pattern)) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  });
}

findPattern('type TranslationKey');
findPattern('TranslationKey =');
