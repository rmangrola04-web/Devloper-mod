import fs from 'fs';

let content = fs.readFileSync('src/views/GateSecurityView.tsx', 'utf8');

const formStartStr = `            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5">`;
const formEndStr = `            </form>`;

const newForm = `            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
              
              {/* 1. Purpose */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Purpose *
                </label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value as 'Loading' | 'Unloading')}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold focus:outline-none"
                >
                  <option value="Loading">Loading</option>
                  <option value="Unloading">Unloading</option>
                </select>
              </div>

              {/* 2 & 3. Vehicle Number & Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Vehicle Number (Strict 10) *
                  </label>
                  <input
                    type="text"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                    maxLength={10}
                    placeholder="e.g. MH12AB1234"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Master Vehicle Type *
                  </label>
                  <select
                    value={vType}
                    onChange={(e) => setVType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold focus:outline-none"
                  >
                    <option value="24 FT Vehicle">24 FT Vehicle</option>
                    <option value="32 FT Multi Axle">32 FT Multi Axle</option>
                    <option value="Single Axle">Single Axle</option>
                    <option value="Milk Tanker">Milk Tanker</option>
                    <option value="32 FT Standard">32 FT Standard</option>
                  </select>
                </div>
              </div>

              {/* 4 & 5. Company Division & Route Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Company Division *
                  </label>
                  <select
                    value={loadDivision}
                    onChange={(e) => setLoadDivision(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold focus:outline-none"
                  >
                    <option value="AIL">AIL</option>
                    <option value="AHPL">AHPL</option>
                    <option value="BOTH">BOTH</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Route Type *
                  </label>
                  <select
                    value={routeType}
                    onChange={(e) => setRouteType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold focus:outline-none"
                  >
                    <option value="Single Drop">Single Drop</option>
                    <option value="Milk Route">Milk Route</option>
                  </select>
                </div>
              </div>

              {/* 6. Gate Entry Timestamp */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Gate Entry Timestamp *
                  </label>
                  <button
                    type="button"
                    onClick={() => setDateTime(getCurrentFormattedDateTime())}
                    className="text-[10px] text-blue-600 font-bold hover:underline"
                  >
                    Auto Pick Current
                  </button>
                </div>
                <input
                  type="text"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  placeholder="DD/MM/YYYY, HH:MM:SS"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-mono font-bold focus:outline-none"
                />
              </div>

              {/* 7. Target Drop Location / Destinations */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Target Drop Location / Destination Stops *
                </label>
                {routeType === 'Milk Route' ? (
                  <div className="space-y-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <div className="flex gap-2">
                      {loadDivision === 'BOTH' && (
                        <select
                          value={selectedMilkUnit}
                          onChange={(e) => setSelectedMilkUnit(e.target.value)}
                          className="w-1/3 bg-white border border-blue-300 rounded-lg p-2 text-xs font-bold"
                        >
                          <option value="AIL">AIL</option>
                          <option value="AHPL">AHPL</option>
                        </select>
                      )}
                      <select
                        value={selectedMilkLocation}
                        onChange={(e) => setSelectedMilkLocation(e.target.value)}
                        className="flex-1 bg-white border border-blue-300 rounded-lg p-2 text-xs font-bold"
                      >
                        {loadLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={addMilkDestination}
                        className="px-3 bg-blue-600 text-white font-bold rounded-lg text-xs"
                      >
                        Add
                      </button>
                    </div>
                    {milkRouteDestinations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {milkRouteDestinations.map(dest => (
                          <div key={dest.location} className="flex items-center gap-1 bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-bold">
                            {dest.location} ({dest.unit})
                            <button type="button" onClick={() => removeMilkDestination(dest.location)}><X className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <select
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold focus:outline-none"
                  >
                    {loadLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
                )}
              </div>

              {/* 8. Assigned Dedicated Dock (Read-Only) */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Dedicated Dock
                </label>
                <input
                  type="text"
                  value="Auto-Assigned on Submit based on Division"
                  disabled
                  className="w-full bg-slate-100 border border-slate-300 text-slate-500 rounded-lg p-2.5 text-xs font-bold cursor-not-allowed"
                />
              </div>

              {/* 9 & 10. Loading Start / Exit Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Loading Start In-Time
                  </label>
                  <input
                    type="time"
                    value={loadingStartInTime}
                    onChange={(e) => setLoadingStartInTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Loading Exit-Time
                  </label>
                  <input
                    type="time"
                    value={loadingExitTime}
                    onChange={(e) => setLoadingExitTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold focus:outline-none"
                  />
                </div>
              </div>

              {/* 11 & 12. Total Cases & Supervisor Remarks */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Total Cases / Cartons
                  </label>
                  <input
                    type="number"
                    value={totalCases}
                    onChange={(e) => setTotalCases(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Supervisor Name & Remarks
                  </label>
                  <input
                    type="text"
                    value={supervisorNameRemarks}
                    onChange={(e) => setSupervisorNameRemarks(e.target.value)}
                    placeholder="Remarks / Sign off..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-sm transition flex items-center justify-center gap-2 mt-2"
              >
                <CheckCircle className="w-4 h-4" />
                Submit Gate Entry
              </button>
            </form>
`;

let beforeForm = content.substring(0, content.indexOf(formStartStr));
let afterForm = content.substring(content.indexOf(formEndStr) + formEndStr.length);

content = beforeForm + newForm + afterForm;

fs.writeFileSync('src/views/GateSecurityView.tsx', content);
console.log('patched UI');
