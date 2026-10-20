const fs = require('fs');
let content = fs.readFileSync('src/types.ts', 'utf-8');

if (!content.includes('mode?: string;')) {
  content = content.replace(
    "vType: string;\n  transporter: string;",
    "vType: string;\n  transporter: string;\n  mode?: string;"
  );
  fs.writeFileSync('src/types.ts', content);
}
