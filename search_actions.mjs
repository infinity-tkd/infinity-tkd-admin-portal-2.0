import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.next' && f !== '.git') {
        walkDir(dirPath, callback);
      }
    } else {
      callback(dirPath);
    }
  });
}

console.log("=== Searching for syllabus actions ===");
walkDir('.', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('deleteBeltTechnique') || content.includes('addBeltTechnique') || content.includes('updateBeltTechnique') || content.includes('Syllabus') || content.includes('syllabus')) {
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('deleteBeltTechnique') || line.includes('addBeltTechnique') || line.includes('updateBeltTechnique') || line.includes('syllabus') || line.includes('Syllabus')) {
          console.log(`${filePath}:${idx+1}: ${line.trim()}`);
        }
      });
    }
  }
});
