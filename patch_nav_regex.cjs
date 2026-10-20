const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const target = `<HelpCircle className="w-5 h-5 mb-0.5" />
              <span className="font-medium tracking-wide">Help</span>
            </button>
          </>`;

const replacement = `<button
              onClick={() => handleSwitchView('reportsView')}
              className={\`shrink-0 min-w-[3rem] flex flex-col items-center p-1.5 rounded-2xl transition-all duration-200 text-[10px] \${
                activeView === 'reportsView' ? 'bg-gradient-to-b from-[#2563eb] to-[#1d4ed8] text-white shadow-[0_4px_10px_rgba(37,99,235,0.4)] scale-110' : 'text-slate-400 hover:text-slate-200'
              }\`}
            >
              <FileSpreadsheet className="w-5 h-5 mb-0.5" />
              <span className="font-medium tracking-wide">Reports</span>
            </button>
            <HelpCircle className="w-5 h-5 mb-0.5" />
              <span className="font-medium tracking-wide">Help</span>
            </button>
          </>`;

content = content.replace(target, replacement);
fs.writeFileSync('src/App.tsx', content);
