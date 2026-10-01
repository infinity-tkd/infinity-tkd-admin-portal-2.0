const fs = require('fs');
const path = require('path');

function fix(file, replacements) {
    let p = path.join(__dirname, 'components', file);
    if (!fs.existsSync(p)) return;
    let content = fs.readFileSync(p, 'utf8');
    for (let [find, replace] of replacements) {
        content = content.replace(find, replace);
    }
    fs.writeFileSync(p, content, 'utf8');
}

fix('AttendanceView.tsx', [
    [/onChange="\{\(e\)"\s*=>/g, 'onChange={(e) =>']
]);

fix('DirectoryView.tsx', [
    [/onClick="\{\(\)"\s*=>/g, 'onClick={() =>']
]);

fix('FinancialsView.tsx', [
    [/<option value=\{currentActualYear\}\s*-\s*1\}>/g, '<option value={currentActualYear - 1}>'],
    [/<option value=\{currentActualYear\}\s*-\s*2\}>/g, '<option value={currentActualYear - 2}>']
]);

fix('LmsView.tsx', [
    [/onClick="\{\(\)"\s*=>/g, 'onClick={() =>']
]);

fix('ScheduleView.tsx', [
    [/onClick="\{\(\)"\s*=>/g, 'onClick={() =>']
]);

console.log("Fixed remaining syntax errors.");
