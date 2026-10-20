const fs = require('fs');

let content = fs.readFileSync('src/views/WaitingQueueView.tsx', 'utf8');

// Update Props interface
content = content.replace("  onSelectVehicle: (gateId: string) => void;", "  onSelectVehicle: (gateId: string, dest?: {location: string, unit?: string}) => void;");

// Update rendering of cards
const oldRender = `                <div className="space-y-3 mb-6">
                  <div className={\`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border inline-block \${purposeColor}\`}>
                    {veh.purpose}
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Truck className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold">{veh.routeType || 'Single Drop'}</span>
                  </div>
                  
                  <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span className="font-semibold line-clamp-2" title={targetDest}>{targetDest || '-'}</span>
                  </div>
                </div>
                
                <button className="w-full text-[11px] font-bold text-white uppercase tracking-widest bg-slate-800 dark:bg-slate-700 hover:bg-blue-600 dark:hover:bg-blue-600 py-2.5 rounded-xl transition-colors shadow-sm">
                  Assign Dock
                </button>
              </div>`;

const newRender = `                <div className="space-y-3 mb-6 flex-1">
                  <div className={\`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border inline-block \${purposeColor}\`}>
                    {veh.purpose}
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Truck className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold">{veh.routeType || 'Single Drop'}</span>
                  </div>
                  
                  {veh.routeType === 'Milk Route' && veh.milkRouteDestinations && veh.milkRouteDestinations.length > 0 ? (
                    <div className="space-y-2 mt-2">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Select Destination</span>
                      <div className="space-y-2">
                        {veh.milkRouteDestinations.map((dest, idx) => (
                          <div 
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectVehicle(veh.id, dest);
                            }}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-blue-900/30 border border-slate-100 hover:border-blue-200 dark:border-slate-700 dark:hover:border-blue-800 transition-colors cursor-pointer group/dest"
                          >
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 group-hover/dest:text-blue-500" />
                              <span className="font-bold text-sm text-slate-700 dark:text-slate-300 group-hover/dest:text-blue-700 dark:group-hover/dest:text-blue-400">{dest.location}</span>
                            </div>
                            {dest.unit && (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
                                {dest.unit}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400 mt-2">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <span className="font-semibold line-clamp-2" title={targetDest}>{targetDest || '-'}</span>
                    </div>
                  )}
                </div>
                
                {!(veh.routeType === 'Milk Route' && veh.milkRouteDestinations && veh.milkRouteDestinations.length > 0) && (
                  <button className="w-full text-[11px] font-bold text-white uppercase tracking-widest bg-slate-800 dark:bg-slate-700 hover:bg-blue-600 dark:hover:bg-blue-600 py-2.5 rounded-xl transition-colors shadow-sm">
                    Assign Dock
                  </button>
                )}
              </div>`;
content = content.replace(oldRender, newRender);

fs.writeFileSync('src/views/WaitingQueueView.tsx', content);
console.log('WaitingQueueView updated');
