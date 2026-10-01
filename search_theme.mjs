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

console.log("=== Searching for theme / dark mode initialization ===");
walkDir('.', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.toLowerCase().includes('dark') || content.toLowerCase().includes('theme') || content.toLowerCase().includes('light')) {
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('theme') || line.includes('darkMode') || line.includes('dark-mode') || line.includes('classList.add(\'dark\'') || line.includes('localStorage.getItem(\'theme\'')) {
          console.log(`${filePath}:${idx+1}: ${line.trim()}`);
        }
      });
    }
  }
});
