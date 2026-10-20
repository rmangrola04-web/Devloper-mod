import fs from 'fs';
const file = './src/views/LiveDocksView.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import { DOCK_CONFIG, DEFAULT_SUPERVISORS } from '../data/defaultData';",
  "import { DOCK_CONFIG, DEFAULT_SUPERVISORS, DEFAULT_VEHICLE_TYPES } from '../data/defaultData';"
);

content = content.replace(
  'supervisors={DEFAULT_SUPERVISORS}',
  'supervisors={DEFAULT_SUPERVISORS}\n          vehicleTypes={DEFAULT_VEHICLE_TYPES}'
);

fs.writeFileSync(file, content);
console.log('LiveDocks patched for modal');
