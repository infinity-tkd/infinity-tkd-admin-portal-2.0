const fs = require('fs');
const path = require('path');

function fixDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            fixDirectory(fullPath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;

            // Fix onClick="{()" =>
            content = content.replace(/onClick="\{\(\)"\s*=>/g, 'onClick={() =>');
            content = content.replace(/onClose="\{\(\)"\s*=>/g, 'onClose={() =>');

            // Fix initial="{{" ... }}"
            content = content.replace(/initial="\{\{(.*?)\}\}"/g, 'initial={{$1}}');
            content = content.replace(/animate="\{\{(.*?)\}\}"/g, 'animate={{$1}}');
            content = content.replace(/exit="\{\{(.*?)\}\}"/g, 'exit={{$1}}');
            content = content.replace(/transition="\{\{(.*?)\}\}"/g, 'transition={{$1}}');

            // Fix ManageStudentPanel responsive props
            content = content.replace(/initial="\{isMobile"\s*\?\s*\{(.*?)\}\s*:\s*\{(.*?)\}\}/g, 'initial={isMobile ? {$1} : {$2}}');
            content = content.replace(/animate="\{isMobile"\s*\?\s*\{(.*?)\}\s*:\s*\{(.*?)\}\}/g, 'animate={isMobile ? {$1} : {$2}}');
            content = content.replace(/exit="\{isMobile"\s*\?\s*\{(.*?)\}\s*:\s*\{(.*?)\}\}/g, 'exit={isMobile ? {$1} : {$2}}');

            // SettingsView specific
            content = content.replace(/onClick="\{\(\)"\s*=>\s*setActiveTab\('members'\)\}/g, "onClick={() => setActiveTab('members')}");

            if (content !== original) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Fixed', fullPath);
            }
        }
    }
}

fixDirectory(path.join(__dirname, 'components'));
console.log("Done");
