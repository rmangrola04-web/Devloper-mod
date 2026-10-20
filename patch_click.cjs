const fs = require('fs');
const file = 'src/views/LoadUnloadView.tsx';
let content = fs.readFileSync(file, 'utf8');

const handleRowClickStr = `
  // Populate form on the left from clicking a row in the Active Dock Log
  const handleRowClick = (item: LoadUnloadEntry) => {
    setOpType(item.opType);
    setUnit(item.unit || 'AHPL');
    setBayNo(item.bayNo);
    setVehicleNo(item.vehicleNo);
    setIsVehicleLocked(true);
    setFromLoc(item.fromLoc || '');
    setToLoc(item.toLoc || '');
    setTransporter(item.transporter || transporters[0] || '');
    setOperator(item.operator || supervisors[0] || '');
    setStartTime(item.startTime || new Date().toTimeString().substring(0, 5));
    
    if (item.opType === 'LOADING') {
      setTotalCasesLoad(item.totalCases?.toString() || '');
    } else {
      setTotalCasesUnload(item.totalCases?.toString() || '');
      setDamagedCases(item.damagedCases?.toString() || '');
      setDamagedValue(item.damagedValue?.toString() || '');
      setUnloadingPodStatus(item.podStatus || 'POD Clean');
    }
  };
`;

content = content.replace('const handleGateSelect = (gateId: string) => {', handleRowClickStr + '\n  const handleGateSelect = (gateId: string) => {');

const trTarget = '<tr key={item.id} className="hover:bg-blue-50/50 dark:hover:bg-slate-700/40 transition-colors">';
const trReplacement = '<tr key={item.id} className="hover:bg-blue-50/50 dark:hover:bg-slate-700/40 transition-colors cursor-pointer" onClick={() => handleRowClick(item)} onDoubleClick={() => onEditOperation(item)}>';

content = content.replace(trTarget, trReplacement);
fs.writeFileSync(file, content);
