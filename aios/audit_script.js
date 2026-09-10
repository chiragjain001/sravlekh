const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const frontendDir = path.join(__dirname, 'apps', 'web', 'src');
const files = walk(frontendDir);

const findings = [];

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    
    let fileFindings = [];
    
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        
        // Mock data patterns
        if (line.includes('const ') && (line.includes('Mock') || line.includes('mock') || line.includes('MOCK'))) {
            fileFindings.push({ type: 'Mock Data', line: lineNum, content: line.trim() });
        }
        if (line.includes('Array.from') || line.includes('Array(')) {
            fileFindings.push({ type: 'Hardcoded Array', line: lineNum, content: line.trim() });
        }
        if (line.match(/const\s+\w+\s*=\s*\[.*{.*}.*\]/)) {
            fileFindings.push({ type: 'Static Array Objects', line: lineNum, content: line.trim() });
        }
        
        // Unimplemented handlers
        if (line.match(/onClick=\{\(\)\s*=>\s*\{?\s*\}?\}/) || line.includes('onClick={() => {}}') || line.includes('onClick={() => null}')) {
            fileFindings.push({ type: 'Empty onClick', line: lineNum, content: line.trim() });
        }
        
        // Toasts used as placeholders
        if (line.includes('toast(') || line.includes('toast.success(')) {
            if (content.substring(Math.max(0, content.indexOf(line) - 100), content.indexOf(line) + 100).includes('Not implemented') || 
                content.substring(Math.max(0, content.indexOf(line) - 100), content.indexOf(line) + 100).includes('Mock')) {
                fileFindings.push({ type: 'Placeholder Toast', line: lineNum, content: line.trim() });
            }
        }
        
        if (line.includes('Math.random()')) {
            fileFindings.push({ type: 'Fake Metric', line: lineNum, content: line.trim() });
        }
        
        if (line.includes('TODO:') || line.includes('FIXME:')) {
            fileFindings.push({ type: 'TODO/FIXME', line: lineNum, content: line.trim() });
        }

        if (line.includes('console.log(')) {
            fileFindings.push({ type: 'Console Log', line: lineNum, content: line.trim() });
        }
    });
    
    if (fileFindings.length > 0) {
        findings.push({
            file: file.replace(__dirname, ''),
            issues: fileFindings
        });
    }
});

fs.writeFileSync(path.join(__dirname, 'audit_raw.json'), JSON.stringify(findings, null, 2));
console.log('Done auditing ' + files.length + ' files.');
