const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const searchBtns = `{isSecurity ? (
          <button
            onClick={() => handleSwitchView('gateSecView')}
            className="shrink-0 min-w-[3.5rem] flex flex-col items-center p-1 rounded text-[10px] text-blue-400 font-bold"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Security Gate</span>
          </button>
        ) : isSupervisor ? (
          <button
            onClick={() => handleSwitchView('loadUnloadView')}
            className="shrink-0 min-w-[3.5rem] flex flex-col items-center p-1 rounded text-[10px] text-blue-400 font-bold"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Loading / Unloading</span>
          </button>
        ) : (`;

const replaceBtns = `{isSecurity ? (
          <button
            onClick={() => handleSwitchView('gateSecView')}
            className="shrink-0 min-w-[3rem] flex flex-col items-center p-1.5 rounded-2xl transition-all duration-200 text-[10px] bg-gradient-to-b from-[#2563eb] to-[#1d4ed8] text-white shadow-[0_4px_10px_rgba(37,99,235,0.4)] scale-110"
          >
            <ShieldCheck className="w-5 h-5 mb-0.5" />
            <span className="font-medium tracking-wide">Gate</span>
          </button>
        ) : isSupervisor ? (
          <button
            onClick={() => handleSwitchView('loadUnloadView')}
            className="shrink-0 min-w-[3rem] flex flex-col items-center p-1.5 rounded-2xl transition-all duration-200 text-[10px] bg-gradient-to-b from-[#2563eb] to-[#1d4ed8] text-white shadow-[0_4px_10px_rgba(37,99,235,0.4)] scale-110"
          >
            <ArrowLeftRight className="w-5 h-5 mb-0.5" />
            <span className="font-medium tracking-wide">Ops</span>
          </button>
        ) : (`;

content = content.replace(searchBtns, replaceBtns);
fs.writeFileSync('src/App.tsx', content);
