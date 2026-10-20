import fs from 'fs';
const file = './src/types.ts';
let content = fs.readFileSync(file, 'utf8');

const search = `  endTime?: string;
  operator?: string;
}`;

const replace = `  endTime?: string;
  operator?: string;
  remarks?: string;
}`;

content = content.replace(search, replace);
fs.writeFileSync(file, content);
console.log('patched types');
