const fs = require('fs');

let content = fs.readFileSync('src/views/MainDashboardView.tsx', 'utf8');

// Update Props interface
content = content.replace("  onSelectVehicle?: (gateId: string) => void;", "  onSelectVehicle?: (gateId: string, dest?: {location: string, unit?: string}) => void;");

// Find the block to replace
const oldRender = `                  <div 
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
                            ? veh.milkRouteDestinations.map(m => m.unit ? \`\${m.location} (\${m.unit})\` : m.location).join(' / ')
                            : (isLoad ? veh.toLoc : veh.fromLoc)}
                      </span>
                    </div>
                  </div>`;

const newRender = `                  <div 
                    key={veh.id}
                    onClick={() => !(veh.routeType === 'Milk Route' && veh.milkRouteDestinations && veh.milkRouteDestinations.length > 0) && onSelectVehicle && onSelectVehicle(veh.id)}
                    className={\`group bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 transition-all relative overflow-hidden \${(veh.routeType === 'Milk Route' && veh.milkRouteDestinations && veh.milkRouteDestinations.length > 0) ? '' : 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm'}\`}
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
                    {veh.routeType === 'Milk Route' && veh.milkRouteDestinations && veh.milkRouteDestinations.length > 0 ? (
                      <div className="mt-2 space-y-1.5">
                        <span className="text-[9px] text-slate-400 uppercase tracking-widest block mb-0.5 font-bold">Select Destination</span>
                        {veh.milkRouteDestinations.map((dest, idx) => (
                          <div 
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectVehicle && onSelectVehicle(veh.id, dest);
                            }}
                            className="flex items-center justify-between p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                          >
                            <span className="font-bold text-[10px] text-slate-700 dark:text-slate-300">{dest.location}</span>
                            {dest.unit && (
                              <span className="text-[8px] font-extrabold uppercase px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-600">
                                {dest.unit}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-slate-900/50 p-1.5 rounded border border-slate-100 dark:border-slate-700">
                        <span className="text-[9px] text-slate-400 uppercase tracking-widest block mb-0.5 font-bold">Destinations / Route</span>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 break-words">
                          {isLoad ? veh.toLoc : veh.fromLoc}
                        </span>
                      </div>
                    )}
                  </div>`;
content = content.replace(oldRender, newRender);

fs.writeFileSync('src/views/MainDashboardView.tsx', content);
console.log('MainDashboardView updated');
