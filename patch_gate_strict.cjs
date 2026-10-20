const fs = require('fs');
let code = fs.readFileSync('src/views/GateSecurityView.tsx', 'utf8');

code = code.replace(
    /<option value="AIL">AIL \(Docks 7-9\)<\/option>/g,
    '<option value="AIL">AIL</option>'
);

code = code.replace(
    /<option value="AHPL">AHPL \(Docks 1-4\)<\/option>/g,
    '<option value="AHPL">AHPL</option>'
);

code = code.replace(
    /<option value="BOTH">BOTH \(Split Multi-Stop\)<\/option>/g,
    '<option value="BOTH">BOTH</option>'
);

fs.writeFileSync('src/views/GateSecurityView.tsx', code);
console.log('Patched gate security strict dropdown options!');
