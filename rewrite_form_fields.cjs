const fs = require('fs');

let content = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

// I will find `<div>\n              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">\n                Operation Activity *\n              </label>`
// and insert the missing fields after the select.

const targetRegex = /<\/select>\n            <\/div>\n\n            <button\n              type="submit"/;

const newFields = `</select>
            </div>
            
            {/* Origin & Destination */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">From (Origin)</label>
                <input
                  type="text"
                  value={fromLoc}
                  onChange={(e) => setFromLoc(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs uppercase font-semibold text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">To (Destination)</label>
                <input
                  type="text"
                  value={toLoc}
                  onChange={(e) => setToLoc(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs uppercase font-semibold text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            {/* Unit & Dock */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Company / Unit</label>
                <select
                  value={unit}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-bold text-blue-600 dark:text-blue-400"
                >
                  <option value="AHPL">AHPL (Dock 1 to 4)</option>
                  <option value="AIL">AIL (Dock 5 to 9)</option>
                  <option value="THERMOCOL">THERMOCOL (All Docks)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Assigned Dock No.</label>
                <select
                  value={bayNo}
                  onChange={(e) => setBayNo(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                >
                  {dockList.map((dock) => {
                    const isOccupied = loadEntries.some(d => d.bayNo === dock && d.status?.includes('IN-PROGRESS'));
                    return (
                      <option key={dock} value={dock} disabled={isOccupied}>
                        {dock} {isOccupied ? '(Occupied)' : \`(\${unit})\`}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Vehicle Number & Transporter */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Vehicle Number *</label>
                <input
                  type="text"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                  readOnly={isVehicleLocked}
                  placeholder="MP-09-AB-1234"
                  required
                  className={\`w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs uppercase font-bold text-blue-600 dark:text-blue-400 \${
                    isVehicleLocked ? 'bg-slate-100 dark:bg-slate-900/50' : ''
                  }\`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Transporter</label>
                <select
                  value={transporter}
                  onChange={(e) => setTransporter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  {transporters.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Supervisor & Total Cases */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Supervisor Incharge *</label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  {supervisors.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Cases / Cartons</label>
                <input
                  type="number"
                  min="0"
                  value={totalCasesLoad}
                  onChange={(e) => setTotalCasesLoad(e.target.value)}
                  placeholder="Optional"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-bold text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            {/* Seal Number & Operation Start Time */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Seal Number</label>
                <input
                  type="text"
                  value={sealNumber}
                  onChange={(e) => setSealNumber(e.target.value.toUpperCase())}
                  placeholder="Optional"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-bold text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Start In-Time *</label>
                  <button
                    type="button"
                    onClick={handlePickCurrentTime}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
                  >
                    ⚡ Pick Current
                  </button>
                </div>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <button
              type="submit"`;

content = content.replace(targetRegex, newFields);
fs.writeFileSync('src/views/LoadUnloadView.tsx', content);
console.log('Restored fields successfully!');
