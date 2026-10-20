const fs = require('fs');

let content = fs.readFileSync('src/views/GateSecurityView.tsx', 'utf8');

const t1 = `  const addMilkDestination = () => {
    if (selectedMilkLocation && !milkRouteDestinations.find(m => m.location === selectedMilkLocation)) {
      const unit = loadDivision === 'BOTH' ? selectedMilkUnit : loadDivision;
      setMilkRouteDestinations([...milkRouteDestinations, { location: selectedMilkLocation, unit }]);
    }
  };`;

const r1 = `  const addMilkDestination = () => {
    if (selectedMilkLocation && !milkRouteDestinations.find(m => m.location === selectedMilkLocation)) {
      setMilkRouteDestinations([...milkRouteDestinations, { location: selectedMilkLocation, unit: selectedMilkUnit }]);
    }
  };`;

content = content.replace(t1, r1);

const t2 = `                      {loadDivision === 'BOTH' && (
                        <select
                          value={selectedMilkUnit}
                          onChange={(e) => setSelectedMilkUnit(e.target.value)}
                          className="w-1/3 bg-white dark:bg-slate-800 border border-blue-300 dark:border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                        >
                          <option value="AIL">AIL</option>
                          <option value="AHPL">AHPL</option>
                          <option value="BOTH">BOTH</option>
                        </select>
                      )}`;

const r2 = `                      <select
                        value={selectedMilkUnit}
                        onChange={(e) => setSelectedMilkUnit(e.target.value)}
                        className="w-1/3 bg-white dark:bg-slate-800 border border-blue-300 dark:border-slate-700 rounded-lg p-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                      >
                        <option value="AHPL">AHPL</option>
                        <option value="AIL">AIL</option>
                        <option value="BOTH">BOTH</option>
                      </select>`;

content = content.replace(t2, r2);

fs.writeFileSync('src/views/GateSecurityView.tsx', content);
console.log('patched dropdown visibility and logic');
