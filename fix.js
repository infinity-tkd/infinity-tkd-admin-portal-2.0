const fs = require('fs');
const path = require('path');

function fixJSX(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Tag name case fixes
    const tags = [
        ['animatepresence', 'AnimatePresence'],
        ['portal', 'Portal'],
        ['usercircle', 'UserCircle'],
        ['lock', 'Lock'],
        ['mappin', 'MapPin'],
        ['enrollmentmodal', 'EnrollmentModal'],
        ['loginview', 'LoginView'],
        ['authenticatedapp', 'AuthenticatedApp'],
        ['appprovider', 'AppProvider'],
        ['mainrouter', 'MainRouter'],
        ['motion.div', 'motion.div']
    ];

    tags.forEach(([lower, correct]) => {
        const regexOpen = new RegExp(`<${lower}(\\s|>)`, 'g');
        const regexClose = new RegExp(`</${lower}>`, 'g');
        content = content.replace(regexOpen, `<${correct}$1`);
        content = content.replace(regexClose, `</${correct}>`);
    });
    
    content = content.replace(/<x(\s|>)/g, '<X$1');
    content = content.replace(/<\/x>/g, '</X>');

    // 2. Attribute casing fixes
    content = content.replace(/classname=/g, 'className=');
    content = content.replace(/onclick=/g, 'onClick=');
    content = content.replace(/onchange=/g, 'onChange=');
    content = content.replace(/onsubmit=/g, 'onSubmit=');
    content = content.replace(/autofocus(?:="")?/g, 'autoFocus');
    content = content.replace(/suppresshydrationwarning(?:="")?/g, 'suppressHydrationWarning');
    content = content.replace(/classid=/g, 'classId=');
    content = content.replace(/onclose=/g, 'onClose=');

    // 3. Arrow function fixes
    // onClick="{()" ==""> func()}" -> onClick={() => func()}
    content = content.replace(/onClick="\{\(\)"\s*=""\s*>\s*/g, 'onClick={() => ');
    content = content.replace(/onClick="\{\(\)\s*=""\s*>\s*/g, 'onClick={() => ');
    content = content.replace(/onChange="\{e"\s*=""\s*>\s*/g, 'onChange={(e) => ');
    content = content.replace(/onSubmit="\{e"\s*=""\s*>\s*/g, 'onSubmit={(e) => ');
    
    // General arrow func inside strings
    content = content.replace(/"\{\(\)\s*=""\s*>\s*(.*?)\}"/g, '{() => $1}');

    // 4. Bracket unwrapping for props (value="{foo}" -> value={foo})
    // For specific known props:
    const propsToUnwrap = ['className', 'value', 'onChange', 'onClick', 'onSubmit', 'checked', 'classId', 'onClose', 'key'];
    propsToUnwrap.forEach(prop => {
        const regex = new RegExp(`${prop}="\\{([^"]+)\\}"`, 'g');
        content = content.replace(regex, `${prop}={$1}`);
    });

    // Strip ALL `=""` that appear outside of valid HTML attributes
    // Actually, `=""` is just plain invalid in JSX almost always. Let's globally replace `=""` with `` where it's clearly an artifact.
    content = content.replace(/=""/g, '');

    // Fix arrow functions that lost their inner quotes but are still wrapped in string
    content = content.replace(/onClick="\{\(\) => /g, 'onClick={() => ');
    content = content.replace(/onChange="\{e => /g, 'onChange={(e) => ');
    content = content.replace(/onSubmit="\{e => /g, 'onSubmit={(e) => ');
    
    // Fix string-wrapped double curlies for motion.div
    // e.g. initial="{{" opacity: 0 }}
    content = content.replace(/="\{\{(.*?)\}\}"/g, '={{$1}}');
    
    // Any single curly wrapped in string that might be left:
    // e.g. className="{cn(...)}"
    content = content.replace(/="\{([^}]+)\}"/g, '={$1}');

    content = content.replace(/initial="\{\{\s*opacity:\s*=""\s*0,\s*=""\s*scale:\s*=""\s*0.95\s*=""\s*\}\}\s*=""/g, 'initial={{ opacity: 0, scale: 0.95 }}');
    content = content.replace(/animate="\{\{\s*opacity:\s*=""\s*1,\s*=""\s*scale:\s*=""\s*1\s*=""\s*\}\}\s*=""/g, 'animate={{ opacity: 1, scale: 1 }}');
    content = content.replace(/exit="\{\{\s*opacity:\s*=""\s*0,\s*=""\s*scale:\s*=""\s*0.95\s*=""\s*\}\}\s*=""/g, 'exit={{ opacity: 0, scale: 0.95 }}');

    content = content.replace(/initial="\{isMobile\s*\?\s*=""\s*\{\s*=""\s*y:\s*=""\s*'100%'\s*=""\s*\}\s*=""\s*:\s*=""\s*\{\s*=""\s*x:\s*=""\s*'100%'\s*=""\s*\}\}\s*=""/g, "initial={isMobile ? { y: '100%' } : { x: '100%' }}");
    content = content.replace(/animate="\{isMobile\s*\?\s*=""\s*\{\s*=""\s*y:\s*=""\s*0\s*=""\s*\}\s*=""\s*:\s*=""\s*\{\s*=""\s*x:\s*=""\s*0\s*=""\s*\}\}\s*=""/g, "animate={isMobile ? { y: 0 } : { x: 0 }}");
    content = content.replace(/exit="\{isMobile\s*\?\s*=""\s*\{\s*=""\s*y:\s*=""\s*'100%'\s*=""\s*\}\s*=""\s*:\s*=""\s*\{\s*=""\s*x:\s*=""\s*'100%'\s*=""\s*\}\}\s*=""/g, "exit={isMobile ? { y: '100%' } : { x: '100%' }}");
    
    // Fix remaining onChange arrow functions
    content = content.replace(/onChange="\{e"\s*=>/g, 'onChange={(e) =>');
    content = content.replace(/onChange="\{e"\s*=\s*>/g, 'onChange={(e) =>');
    
    // Fix remaining value="{...}" strings
    content = content.replace(/value="\{([^"]+)"/g, 'value={$1}');
    
    // Fix className="{cn(" " -> className={cn("
    content = content.replace(/className="\{cn\("\s*"/g, 'className={cn("');
    
    // Fix messed up ternary background colors in cn()
    content = content.replace(/bg-red-500 20/g, 'bg-red-500/20');
    content = content.replace(/bg-yellow-500 20/g, 'bg-yellow-500/20');
    content = content.replace(/bg-green-500 20/g, 'bg-green-500/20');
    content = content.replace(/bg-blue-500 10/g, 'bg-blue-500/10');
    content = content.replace(/bg-orange-500 10/g, 'bg-orange-500/10');
    content = content.replace(/text-\[\#ef2f38\] border-red-500 50/g, 'text-[#ef2f38] border-red-500/50');
    content = content.replace(/border-orange-500 20/g, 'border-orange-500/20');
    content = content.replace(/border-blue-500 20/g, 'border-blue-500/20');
    content = content.replace(/bg-white 10/g, 'bg-white/10');
    content = content.replace(/border-white 20/g, 'border-white/20');
    content = content.replace(/bg-\[\#8b4513\] 10/g, 'bg-[#8b4513]/10');
    content = content.replace(/border-\[\#8b4513\] 20/g, 'border-[#8b4513]/20');
    
    // Fix remaining ` )}>` to ` )}`
    content = content.replace(/ \)\}>/g, ' )}');
    
    // Fix == in props
    content = content.replace(/student.currentbelt="=="/g, 'student.currentBelt ===');
    content = content.replace(/u.role="=="/g, 'u.role ===');
    content = content.replace(/staff.role="=="/g, 'staff.role ===');
    content = content.replace(/activebranchid="=="/g, 'activeBranchId ===');
    
    // Fix nested curlies in ManageStudentPanel
    content = content.replace(/value="\{editForm\.([a-zA-Z]+)"\s*\|\|\s*''\}/g, 'value={editForm.$1 || \'\'}');
    content = content.replace(/value="\{editForm\.gender"\s*\|\|\s*'male'\}/g, 'value={editForm.gender || \'male\'}');
    
    fs.writeFileSync(filePath, content, 'utf8');
}

const dir = './components';
fs.readdirSync(dir).forEach(file => {
    if (file.endsWith('.tsx')) {
        fixJSX(path.join(dir, file));
    }
});

// Also fix app/page.tsx just in case
if (fs.existsSync('./app/page.tsx')) {
    fixJSX('./app/page.tsx');
}
if (fs.existsSync('./app/layout.tsx')) {
    fixJSX('./app/layout.tsx');
}

console.log("Fixes applied.");
