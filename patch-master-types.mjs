import fs from 'fs';
const file = './src/data/defaultData.ts';
let content = fs.readFileSync(file, 'utf8');

const search = `export const DEFAULT_VEHICLE_TYPES: string[] = [
  '32SXL',
  '32MXL',
  '32-15T',
  '32-18T',
  '24-9T',
  '20FT',
  '14FT',
  'PTL',
  'LCL',
  'OTH'
];`;

const replace = `export const DEFAULT_VEHICLE_TYPES: string[] = [
  '32SXL',
  '32MXL',
  '32-15T',
  '32-18T',
  '24-9T',
  '20FT',
  '14FT',
  'PTL',
  'LCL',
  'OTH',
  '24 फीट व्हीकल',
  '32 फीट मल्टी एक्सेल',
  'सिंगल एक्सेल',
  'मिल्की',
  '32 फीट'
];`;

content = content.replace(search, replace);
fs.writeFileSync(file, content);
console.log('Master types patched');
