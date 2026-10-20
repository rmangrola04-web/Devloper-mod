const fs = require('fs');

let content = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

const targetStr = `              </select>
            </div>
            
            <button
              type="submit"`;

const replacementStr = `              </select>
            </div>
            
            {/* Dock & Supervisor */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Assigned Dock *
                </label>
                <select
                  value={bayNo}
                  onChange={(e) => setBayNo(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1.5 text-xs font-medium text-slate-800 dark:text-slate-100"
                >
                  <option value="Dock 1">Dock 1</option>
                  <option value="Dock 2">Dock 2</option>
                  <option value="Dock 3">Dock 3</option>
                  <option value="Dock 4">Dock 4</option>
                  <option value="Dock 5">Dock 5</option>
                  <option value="Dock 6">Dock 6</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Supervisor *
                </label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1.5 text-xs font-medium text-slate-800 dark:text-slate-100"
                >
                  {supervisors.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cases & Seal */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Total Cases (Est.)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  min="0"
                  value={totalCasesLoad}
                  onChange={(e) => setTotalCasesLoad(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1.5 text-xs font-medium text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Seal Number
                </label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={sealNumber}
                  onChange={(e) => setSealNumber(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 uppercase"
                />
              </div>
            </div>
            
            {/* Start Time */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Start Time *
              </label>
              <div className="flex gap-2">
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1.5 text-xs font-medium text-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setStartTime(new Date().toTimeString().substring(0, 5))}
                  className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 px-3 rounded border border-slate-300 dark:border-slate-600 text-[10px] font-bold uppercase tracking-wider transition-colors"
                >
                  Current
                </button>
              </div>
            </div>

            <button
              type="submit"`;

content = content.replace(targetStr, replacementStr);

fs.writeFileSync('src/views/LoadUnloadView.tsx', content);
console.log('LoadUnloadView form fields added');
