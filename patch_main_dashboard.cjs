const fs = require('fs');
let content = fs.readFileSync('src/views/MainDashboardView.tsx', 'utf8');

const propsTarget = `interface MainDashboardViewProps {
  archivedPlanEntries?: PlanEntry[];
  planEntries: PlanEntry[];
  loadEntries: LoadUnloadEntry[];
  securityLogs: SecurityGateEntry[];
  trackingRecords: TrackingRecord[];
}`;

const propsReplace = `interface MainDashboardViewProps {
  archivedPlanEntries?: PlanEntry[];
  planEntries: PlanEntry[];
  loadEntries: LoadUnloadEntry[];
  securityLogs: SecurityGateEntry[];
  trackingRecords: TrackingRecord[];
  onSelectVehicle?: (gateId: string) => void;
}`;

content = content.replace(propsTarget, propsReplace);

const exportTarget = `export const MainDashboardView: React.FC<MainDashboardViewProps> = ({
  archivedPlanEntries = [],
  planEntries,
  loadEntries,
  securityLogs,
  trackingRecords
}) => {`;

const exportReplace = `export const MainDashboardView: React.FC<MainDashboardViewProps> = ({
  archivedPlanEntries = [],
  planEntries,
  loadEntries,
  securityLogs,
  trackingRecords,
  onSelectVehicle
}) => {
  // Pending gate arrivals
  const usedGateIds = new Set(loadEntries.map((l) => l.gateId).filter(Boolean));
  const activeOps = loadEntries.filter(l => l.status !== 'LOADED' && l.status !== 'UNLOADED');
  const activeVehicleNos = new Set(activeOps.map((l) => l.vehicleNo));
  const allUsedVehicleNos = new Set(loadEntries.map((l) => l.vehicleNo));
  const pendingGateLogs = securityLogs.filter((veh) => {
    if (veh.purpose === 'Parking / Transit') return false;
    if (usedGateIds.has(veh.id)) return false;
    if (activeVehicleNos.has(veh.vehicle)) return false;
    const isLegacy = veh.id.startsWith('GATE-') ? parseInt(veh.id.replace('GATE-', '')) < 1788600000000 : false;
    if (isLegacy && allUsedVehicleNos.has(veh.vehicle)) return false;
    return true;
  });`;

content = content.replace(exportTarget, exportReplace);

const renderTarget = `      <DashboardWidget planEntries={planEntries} archivedPlanEntries={archivedPlanEntries} loadEntries={loadEntries} securityLogs={securityLogs} />`;

const renderReplace = `      <DashboardWidget planEntries={planEntries} archivedPlanEntries={archivedPlanEntries} loadEntries={loadEntries} securityLogs={securityLogs} />

      {/* Waiting for Loading Queue */}
      <div className="bg-white dark:bg-[#1e293b] rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden">
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-slate-200 dark:border-slate-700/80 p-4 flex justify-between items-center">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Waiting for Loading
            </h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Click any vehicle to instantly open the supervisor form & assign dock.</p>
          </div>
          <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 py-1 px-3 rounded text-[10px] font-bold">
            {pendingGateLogs.length} Waiting
          </span>
        </div>
        <div className="p-4">
          {pendingGateLogs.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs font-semibold text-slate-400">Queue is Empty</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingGateLogs.map(veh => {
                const isLoad = veh.purpose === 'Loading';
                const purposeColor = isLoad ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800';
                return (
                  <div 
                    key={veh.id}
                    onClick={() => onSelectVehicle && onSelectVehicle(veh.id)}
                    className="group bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm transition-all relative overflow-hidden"
                  >
                    <div className={\`absolute top-0 left-0 w-1 h-full \${isLoad ? 'bg-amber-400' : 'bg-emerald-400'}\`}></div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{veh.vehicle}</span>
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-white text-slate-700 dark:bg-slate-700 dark:text-slate-300 shadow-sm border border-slate-100 dark:border-slate-600">{veh.unit}</span>
                    </div>
                    <div className="space-y-1.5 mb-2">
                      <div className={\`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border inline-block \${purposeColor}\`}>
                        {veh.purpose}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <Truck className="w-3 h-3 text-slate-400" />
                        <span className="font-semibold">{veh.routeType || 'Single Drop'}</span>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900/50 p-1.5 rounded border border-slate-100 dark:border-slate-700">
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest block mb-0.5 font-bold">Destinations / Route</span>
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 break-words">
                        {veh.routeType === 'Milk Route' && veh.milkRouteDestinations 
                           ? veh.milkRouteDestinations.map(m => m.location).join(' / ') 
                           : (isLoad ? veh.toLoc : veh.fromLoc)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>`;

content = content.replace(renderTarget, renderReplace);
fs.writeFileSync('src/views/MainDashboardView.tsx', content);
console.log('patched MainDashboardView');
