import fs from 'fs';

const appPath = './src/App.tsx';
let appContent = fs.readFileSync(appPath, 'utf8');

appContent = appContent.replace(
  '<GateSecurityView\n                securityLogs={securityLogs}',
  '<GateSecurityView\n                activeOperations={loadEntries}\n                onAddOperation={async (op) => { await saveOperationToFirestore(op); }}\n                securityLogs={securityLogs}'
);

appContent = appContent.replace(
  '<GateSecurityView\n                    securityLogs={securityLogs}',
  '<GateSecurityView\n                    activeOperations={loadEntries}\n                    onAddOperation={async (op) => { await saveOperationToFirestore(op); }}\n                    securityLogs={securityLogs}'
);

fs.writeFileSync(appPath, appContent);

const gatePath = './src/views/GateSecurityView.tsx';
let gateContent = fs.readFileSync(gatePath, 'utf8');

gateContent = gateContent.replace(
  'import { SecurityGateEntry } from \'../types\';',
  'import { SecurityGateEntry, LoadUnloadEntry, ShuttleStep } from \'../types\';\nimport { DOCK_CONFIG } from \'../data/defaultData\';'
);

gateContent = gateContent.replace(
  'interface GateSecurityViewProps {\n  securityLogs: SecurityGateEntry[];',
  'interface GateSecurityViewProps {\n  activeOperations: LoadUnloadEntry[];\n  onAddOperation: (op: LoadUnloadEntry) => void;\n  securityLogs: SecurityGateEntry[];'
);

gateContent = gateContent.replace(
  '  securityLogs,\n  transporters,',
  '  activeOperations,\n  onAddOperation,\n  securityLogs,\n  transporters,'
);

fs.writeFileSync(gatePath, gateContent);
console.log('Props updated');
