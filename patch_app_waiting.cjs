const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const t1 = `import { AnalyticsView } from './views/AnalyticsView';
import { MainDashboardView } from "./views/MainDashboardView";

export default function App() {`;

const r1 = `import { AnalyticsView } from './views/AnalyticsView';
import { MainDashboardView } from "./views/MainDashboardView";
import { WaitingQueueView } from './views/WaitingQueueView';

export default function App() {`;

content = content.replace(t1, r1);

const t2 = `  const [activeView, setActiveView] = useState<
    | 'dashboardView'
    | 'mainDashboardView'
    | 'analyticsView'
    | 'planView'
    | 'loadUnloadView'
    | 'liveDocksView'
    | 'gateSecView'
    | 'reportsView'
    | 'trackingView'
  >('mainDashboardView');`;

const r2 = `  const [activeView, setActiveView] = useState<
    | 'dashboardView'
    | 'mainDashboardView'
    | 'analyticsView'
    | 'planView'
    | 'loadUnloadView'
    | 'liveDocksView'
    | 'gateSecView'
    | 'reportsView'
    | 'trackingView'
    | 'waitingQueueView'
  >('mainDashboardView');

  const [preselectedGateId, setPreselectedGateId] = useState<string | null>(null);`;

content = content.replace(t2, r2);

const t3 = `                  <button
                    onClick={() => handleSwitchView('gateSecView')}
                    className={\`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs font-medium transition-colors \${
                      activeView === 'gateSecView'
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }\`}
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Gate Register</span>
                  </button>

                  <button
                    onClick={() => handleSwitchView('loadUnloadView')}
                    className={\`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs font-medium transition-colors \${
                      activeView === 'loadUnloadView'
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }\`}
                  >
                    <ArrowLeftRight className="w-4 h-4 text-blue-400" />
                    <span>Operations Entry</span>
                  </button>`;

const r3 = `                  <button
                    onClick={() => handleSwitchView('gateSecView')}
                    className={\`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs font-medium transition-colors \${
                      activeView === 'gateSecView'
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }\`}
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Gate Register</span>
                  </button>
                  
                  <button
                    onClick={() => handleSwitchView('waitingQueueView')}
                    className={\`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs font-medium transition-colors \${
                      activeView === 'waitingQueueView'
                        ? 'bg-amber-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }\`}
                  >
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Waiting for Loading / Unloading</span>
                  </button>

                  <button
                    onClick={() => handleSwitchView('loadUnloadView')}
                    className={\`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs font-medium transition-colors \${
                      activeView === 'loadUnloadView'
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }\`}
                  >
                    <ArrowLeftRight className="w-4 h-4 text-blue-400" />
                    <span>Operations Entry</span>
                  </button>`;

content = content.replace(t3, r3);

const t4 = `                {activeView === 'loadUnloadView' && (
                  <LoadUnloadView
                    loadEntries={loadEntries}
                    securityLogs={securityLogs}
                    supervisors={supervisors}
                    transporters={transporters}
                    loadLocations={loadLocations}
                    unloadLocations={unloadLocations}
                    onAddOperation={async (op) => { await saveOperationToFirestore(op); }}
                    onEditOperation={(entry) => setEditingOperation(entry)}
                    onDeleteOperation={handleDeleteOperation}
                    onFinishLoadModalOpen={(entry) => setFinishingLoadEntry(entry)}
                    onFinishUnloadDirect={handleFinishUnloadDirect}
                  />
                )}`;

const r4 = `                {activeView === 'waitingQueueView' && (
                  <WaitingQueueView
                    loadEntries={loadEntries}
                    securityLogs={securityLogs}
                    onSelectVehicle={(gateId) => {
                      setPreselectedGateId(gateId);
                      handleSwitchView('loadUnloadView');
                    }}
                  />
                )}

                {activeView === 'loadUnloadView' && (
                  <LoadUnloadView
                    initialGateId={preselectedGateId}
                    onClearInitialGateId={() => setPreselectedGateId(null)}
                    loadEntries={loadEntries}
                    securityLogs={securityLogs}
                    supervisors={supervisors}
                    transporters={transporters}
                    loadLocations={loadLocations}
                    unloadLocations={unloadLocations}
                    onAddOperation={async (op) => { await saveOperationToFirestore(op); }}
                    onEditOperation={(entry) => setEditingOperation(entry)}
                    onDeleteOperation={handleDeleteOperation}
                    onFinishLoadModalOpen={(entry) => setFinishingLoadEntry(entry)}
                    onFinishUnloadDirect={handleFinishUnloadDirect}
                  />
                )}`;

content = content.replace(t4, r4);

const t5 = `            <button
              onClick={() => handleSwitchView('loadUnloadView')}
              className={\`shrink-0 min-w-[2.75rem] px-1 flex flex-col items-center p-1.5 rounded-2xl transition-all duration-200 text-[10px] \${
                activeView === 'loadUnloadView' ? 'bg-gradient-to-b from-[#2563eb] to-[#1d4ed8] text-white shadow-[0_4px_10px_rgba(37,99,235,0.4)] scale-110' : 'text-slate-400 hover:text-slate-200'
              }\`}
            >
              <ArrowLeftRight className="w-5 h-5 mb-0.5" />
              <span className="font-medium tracking-wide">Ops</span>
            </button>`;

const r5 = `            <button
              onClick={() => handleSwitchView('waitingQueueView')}
              className={\`shrink-0 min-w-[2.75rem] px-1 flex flex-col items-center p-1.5 rounded-2xl transition-all duration-200 text-[10px] \${
                activeView === 'waitingQueueView' ? 'bg-gradient-to-b from-[#d97706] to-[#b45309] text-white shadow-[0_4px_10px_rgba(217,119,6,0.4)] scale-110' : 'text-slate-400 hover:text-slate-200'
              }\`}
            >
              <Clock className="w-5 h-5 mb-0.5" />
              <span className="font-medium tracking-wide">Wait</span>
            </button>
            <button
              onClick={() => handleSwitchView('loadUnloadView')}
              className={\`shrink-0 min-w-[2.75rem] px-1 flex flex-col items-center p-1.5 rounded-2xl transition-all duration-200 text-[10px] \${
                activeView === 'loadUnloadView' ? 'bg-gradient-to-b from-[#2563eb] to-[#1d4ed8] text-white shadow-[0_4px_10px_rgba(37,99,235,0.4)] scale-110' : 'text-slate-400 hover:text-slate-200'
              }\`}
            >
              <ArrowLeftRight className="w-5 h-5 mb-0.5" />
              <span className="font-medium tracking-wide">Ops</span>
            </button>`;

content = content.replace(t5, r5);

fs.writeFileSync('src/App.tsx', content);
console.log('patched App.tsx for WaitingQueueView');
