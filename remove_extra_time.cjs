const fs = require('fs');
let code = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');
code = code.replace(/      handlePickCurrentTime1\(\);\n/g, '');
code = code.replace(/      handlePickCurrentTime2\(\);\n/g, '');
fs.writeFileSync('src/views/LoadUnloadView.tsx', code);
