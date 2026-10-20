const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

// replace SecurityGateEntry
const target = `export interface SecurityGateEntry {
  id: string;
  purpose: 'Loading' | 'Unloading' | 'Parking / Transit';
  vehicle: string;
  vType: string;
  mobile: string;
  transporter: string;
  fromLoc: string;
  toLoc: string;
  dateTime: string;
  remarks: string;
  unit?: string;
  grNo?: string;
}`;
const replacement = `export interface SecurityGateEntry {
  id: string;
  purpose: 'Loading' | 'Unloading' | 'Parking / Transit';
  vehicle: string;
  vType: string;
  mobile: string;
  transporter: string;
  fromLoc: string;
  toLoc: string;
  dateTime: string;
  remarks: string;
  unit?: string;
  grNo?: string;
  routeType?: string;
  milkRouteDestinations?: {location: string, unit: string}[];
  assignedDock?: string;
  loadingStartInTime?: string;
  loadingExitTime?: string;
  totalCases?: number | string;
  supervisorNameRemarks?: string;
}`;

code = code.replace(target, replacement);
fs.writeFileSync('src/types.ts', code);
console.log('patched types');
