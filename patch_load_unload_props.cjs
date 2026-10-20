const fs = require('fs');
let content = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

const t1 = `interface LoadUnloadViewProps {
  loadEntries: LoadUnloadEntry[];
  securityLogs: SecurityGateEntry[];
  supervisors: string[];
  transporters: string[];
  loadLocations: string[];
  unloadLocations: string[];
  onAddOperation: (newOp: LoadUnloadEntry) => Promise<void> | void;
  onEditOperation: (entry: LoadUnloadEntry) => void;
  onDeleteOperation: (id: string) => void;
  onFinishLoadModalOpen: (entry: LoadUnloadEntry) => void;
  onFinishUnloadDirect: (id: string) => void;
}`;

const r1 = `interface LoadUnloadViewProps {
  initialGateId?: string | null;
  onClearInitialGateId?: () => void;
  loadEntries: LoadUnloadEntry[];
  securityLogs: SecurityGateEntry[];
  supervisors: string[];
  transporters: string[];
  loadLocations: string[];
  unloadLocations: string[];
  onAddOperation: (newOp: LoadUnloadEntry) => Promise<void> | void;
  onEditOperation: (entry: LoadUnloadEntry) => void;
  onDeleteOperation: (id: string) => void;
  onFinishLoadModalOpen: (entry: LoadUnloadEntry) => void;
  onFinishUnloadDirect: (id: string) => void;
}`;

content = content.replace(t1, r1);

const t2 = `export const LoadUnloadView: React.FC<LoadUnloadViewProps> = ({
  loadEntries,
  securityLogs,
  supervisors,
  transporters,
  loadLocations,
  unloadLocations,
  onAddOperation,
  onEditOperation,
  onDeleteOperation,
  onFinishLoadModalOpen,
  onFinishUnloadDirect
}) => {`;

const r2 = `export const LoadUnloadView: React.FC<LoadUnloadViewProps> = ({
  initialGateId,
  onClearInitialGateId,
  loadEntries,
  securityLogs,
  supervisors,
  transporters,
  loadLocations,
  unloadLocations,
  onAddOperation,
  onEditOperation,
  onDeleteOperation,
  onFinishLoadModalOpen,
  onFinishUnloadDirect
}) => {`;

content = content.replace(t2, r2);

const t3 = `  const [selectedGateId, setSelectedGateId] = useState('');`;
const r3 = `  const [selectedGateId, setSelectedGateId] = useState(initialGateId || '');
  
  React.useEffect(() => {
    if (initialGateId) {
      handleGateSelect(initialGateId);
      if (onClearInitialGateId) {
        onClearInitialGateId();
      }
    }
  }, [initialGateId]);`;

content = content.replace(t3, r3);


// we also remove the queue we added at the top of LoadUnloadView since we have a dedicated view now.
const t4 = `      {pendingGateLogs.length > 0 && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-200 dark:border-slate-700 pb-3">
            <Clock className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-slate-800 dark:text-slate-100">Waiting for Loading</h2>
            <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 py-0.5 px-2.5 rounded-full text-[10px] font-bold">
              {pendingGateLogs.length} in Queue
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pendingGateLogs.map(veh => {
              const targetDest = veh.routeType === 'Milk Route' && veh.milkRouteDestinations 
                ? veh.milkRouteDestinations.map(m => m.location).join(', ') 
                : (veh.purpose === 'Loading' ? veh.toLoc : veh.fromLoc);
                
              return (
                <div 
                  key={veh.id}
                  onClick={() => handleGateSelect(veh.id)}
                  className="group p-4 rounded-xl border border-amber-300 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-900/10 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all shadow-sm relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-mono font-black text-lg text-slate-800 dark:text-slate-100 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">{veh.vehicle}</span>
                    <span className="text-[9px] font-extrabold uppercase px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{veh.unit}</span>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <Truck className="w-3.5 h-3.5" />
                      <span className="font-semibold">{veh.routeType || 'Single Drop'}</span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="font-semibold truncate" title={targetDest}>{targetDest}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex justify-center">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-700/50 shadow-sm group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-600 transition-colors">
                      Click to Assign Dock
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}`;

content = content.replace(t4, '');

fs.writeFileSync('src/views/LoadUnloadView.tsx', content);
console.log('patched LoadUnloadView props and effect');
