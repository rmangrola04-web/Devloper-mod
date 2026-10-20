const fs = require('fs');

let content = fs.readFileSync('src/views/GateSecurityView.tsx', 'utf8');

// The bottom part originally had:
content = content.replace("setRemarks('');", "");

fs.writeFileSync('src/views/GateSecurityView.tsx', content);
console.log('fixed remarks');
