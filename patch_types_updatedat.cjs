const fs = require('fs');
let content = fs.readFileSync('src/types.ts', 'utf-8');

if (!content.includes('updatedAt?: string;')) {
  content = content.replace(
    "isCarriedForward?: boolean;",
    "isCarriedForward?: boolean;\n  updatedAt?: string;"
  );
  fs.writeFileSync('src/types.ts', content);
}
