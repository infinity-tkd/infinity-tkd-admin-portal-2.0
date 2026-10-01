import fs from 'fs';

const filePath = 'Infinity TKD Student Portal Techstack Development Document.md';
const content = fs.readFileSync(filePath, 'utf8');

// Find CREATE TABLE public.curriculum or similar block
const lines = content.split('\n');
let found = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].toLowerCase().includes('create table public.curriculum') || lines[i].toLowerCase().includes('create table curriculum')) {
    found = true;
    console.log(`=== Found CREATE TABLE curriculum at line ${i + 1} ===`);
    for (let j = i; j < i + 30; j++) {
      console.log(lines[j]);
    }
    break;
  }
}

if (!found) {
  console.log("CREATE TABLE curriculum not found. Searching for 'chk_curriculum_category'...");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('chk_curriculum_category') || lines[i].includes('category')) {
      console.log(`${i+1}: ${lines[i]}`);
    }
  }
}
