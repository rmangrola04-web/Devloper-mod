import fs from 'fs';
const file = './src/data/defaultData.ts';
let content = fs.readFileSync(file, 'utf8');

const search = `export const DOCK_CONFIG: Record<string, string[]> = {
  'AHPL': ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4'],
  'AIL': ['Dock 5', 'Dock 6', 'Dock 7', 'Dock 8', 'Dock 9'],
  'BOTH': ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4', 'Dock 5', 'Dock 6', 'Dock 7', 'Dock 8', 'Dock 9'],
  'THERMOCOL': ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4', 'Dock 5', 'Dock 6', 'Dock 7', 'Dock 8', 'Dock 9']
};`;

const replace = `export const DOCK_CONFIG: Record<string, string[]> = {
  'AHPL': ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4'],
  'AIL': ['Dock 7', 'Dock 8', 'Dock 9'],
  'BOTH': ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4', 'Dock 7', 'Dock 8', 'Dock 9']
};`;

content = content.replace(search, replace);
fs.writeFileSync(file, content);
console.log('patched defaultData');
