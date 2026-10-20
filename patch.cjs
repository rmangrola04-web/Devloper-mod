const fs = require('fs');
let content = fs.readFileSync('src/views/PlanView.tsx', 'utf-8');

const replacement = `            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Automated Multi-Block Parser & CSV Importer</p>
          </div>

          {/* Desktop/Laptop Mode CSV Import Block */}
          <div className="hidden md:flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadSample}
              className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 transition"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" /> Plan Sample CSV
            </button>

            <label className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 cursor-pointer transition">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Import Plan CSV
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {isScanning && (
              <div className="text-xs text-blue-600 font-semibold flex items-center gap-1.5 animate-pulse bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 rounded border border-blue-200 dark:border-blue-800">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> Scanning Plan Rows...
              </div>
            )}
          </div>
        </div>`;

content = content.replace(/<p className="text-\[11px\] text-slate-500 dark:text-slate-400 mt-0\.5">Automated Multi-Block Parser & CSV Importer<\/p>\s*<\/div>\s*<\/div>/g, replacement);

fs.writeFileSync('src/views/PlanView.tsx', content);
