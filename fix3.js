const fs = require('fs');
const path = require('path');

function fix(file, replacements) {
    let p = path.join(__dirname, 'components', file);
    let content = fs.readFileSync(p, 'utf8');
    for (let [find, replace] of replacements) {
        content = content.replace(find, replace);
    }
    fs.writeFileSync(p, content, 'utf8');
}

fix('AttendanceView.tsx', [
    [/"bg-red-500\/20 text-red-500" \)\}/g, '"bg-red-500/20 text-red-500" )}>']
]);

fix('DirectoryView.tsx', [
    [/"bg-yellow-500 10 text-yellow-500 border-yellow-500 20" \)\}/g, '"bg-yellow-500 10 text-yellow-500 border-yellow-500 20" )}>']
]);

fix('FinancialsView.tsx', [
    [/"bg-red-500\/20 text-red-500"\) \)\}/g, '"bg-red-500/20 text-red-500") )}>']
]);

fix('ManageStudentPanel.tsx', [
    [/hover:text-\[\#E4E4E4\]"\)\}>?Profile/g, 'hover:text-[#E4E4E4]")}>Profile'],
    [/hover:text-\[\#E4E4E4\]"\)\}>?Belt Log/g, 'hover:text-[#E4E4E4]")}>Belt Log'],
    [/hover:text-\[\#E4E4E4\]"\)\}>?Achievements/g, 'hover:text-[#E4E4E4]")}>Achievements'],
    [/onClick="\{\(\)"\s*=>\s*/g, 'onClick={() => ']
]);

fix('ScheduleView.tsx', [
    [/"bg-yellow-500\/20 text-yellow-500" \)\}/g, '"bg-yellow-500/20 text-yellow-500" )}>']
]);

fix('SettingsView.tsx', [
    [/"bg-\[\#262626\] text-\[\#999\] border-transparent" \)\}/g, '"bg-[#262626] text-[#999] border-transparent" )}>']
]);

fix('StaffView.tsx', [
    [/"bg-\[\#262626\] text-\[\#999\] border-transparent" \)\}/g, '"bg-[#262626] text-[#999] border-transparent" )}>']
]);

console.log("Fixed missing tags");
