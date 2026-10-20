const fs = require('fs');
let content = fs.readFileSync('src/types.ts', 'utf-8');

if (!content.includes('isCarriedForward?: boolean;')) {
  content = content.replace(
    "status?: string;",
    "status?: string;\n  isCarriedForward?: boolean;"
  );
  fs.writeFileSync('src/types.ts', content);
}
