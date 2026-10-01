import fs from 'fs';

const content = fs.readFileSync('components/LibraryView.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('editAsset.category') && line.includes('onChange')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
