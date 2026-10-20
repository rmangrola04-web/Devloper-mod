import fs from 'fs';
let content = fs.readFileSync('src/services/firestoreService.ts', 'utf8');

const regex2 = /  const cleanData: Record<string, any> = \{\s*\.\.\.entry,\s*updatedAt: new Date\(\)\.toISOString\(\)\s*\};/g;

content = content.replace(regex2, `  const cleanData: Record<string, any> = {
    ...entry,
    updatedAt: new Date().toISOString()
  };
  Object.keys(cleanData).forEach(key => {
    if (cleanData[key] === undefined) delete cleanData[key];
  });`);

fs.writeFileSync('src/services/firestoreService.ts', content);
