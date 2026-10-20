const fs = require('fs');
let content = fs.readFileSync('src/views/MainDashboardView.tsx', 'utf8');
console.log(content.includes('Waiting for Loading'));
