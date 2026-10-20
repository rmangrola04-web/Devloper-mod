import fs from 'fs';

let content = fs.readFileSync('src/services/firestoreService.ts', 'utf8');

// We need to clean undefined values from cleanData before saving
const replaceStr = `  const cleanData: Record<string, any> = {
    ...op,
    totalCases: op.totalCases !== undefined && op.totalCases !== ('' as any) ? Number(op.totalCases) : 0,
    damagedCases: op.damagedCases !== undefined && op.damagedCases !== ('' as any) ? Number(op.damagedCases) : 0,
    damagedValue: op.damagedValue !== undefined && op.damagedValue !== ('' as any) ? Number(op.damagedValue) : 0,
    updatedAt: new Date().toISOString()
  };

  // Remove undefined values
  Object.keys(cleanData).forEach(key => {
    if (cleanData[key] === undefined) {
      delete cleanData[key];
    }
  });`;

content = content.replace(/  const cleanData: Record<string, any> = \{\s*\.\.\.op,\s*totalCases:.*?,\s*damagedCases:.*?,\s*damagedValue:.*?,\s*updatedAt: new Date\(\)\.toISOString\(\)\s*\};/s, replaceStr);

fs.writeFileSync('src/services/firestoreService.ts', content);
