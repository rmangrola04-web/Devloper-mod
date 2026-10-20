        // --- GLOBAL STATE ---
        let activeOperations = [];
        let auditLogs = [];
        
        const AHPL_DOCKS = ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4'];
        const AIL_DOCKS = ['Dock 7', 'Dock 8', 'Dock 9'];

        // --- INIT ---
        document.addEventListener('DOMContentLoaded', () => {
            switchTab('gate');
            handleRouteTypeChange();
            renderDocks();
            renderAuditLogs();
        });

        // --- TAB LOGIC ---
        function switchTab(tabId) {
            ['gate', 'docks', 'audit'].forEach(id => {
                document.getElementById('view-' + id).classList.add('hidden');
                document.getElementById('tab-' + id).classList.replace('bg-indigo-800', 'bg-transparent');
                document.getElementById('tab-' + id).classList.replace('text-white', 'text-indigo-100');
            });
            document.getElementById('view-' + tabId).classList.remove('hidden');
            document.getElementById('tab-' + tabId).classList.add('bg-indigo-800', 'text-white');
            document.getElementById('tab-' + tabId).classList.remove('bg-transparent', 'text-indigo-100');
            
            if (tabId === 'docks') renderDocks();
            if (tabId === 'audit') renderAuditLogs();
        }

        // --- GATE FORM LOGIC ---
        function handleCompanyChange() {
            const comp = document.getElementById('g-company').value;
            const route = document.getElementById('g-route').value;
            if (comp === 'BOTH' && route !== 'Milk Route') {
                document.getElementById('g-route').value = 'Milk Route';
                handleRouteTypeChange();
            }
        }

        function handleRouteTypeChange() {
            const route = document.getElementById('g-route').value;
            const milkContainer = document.getElementById('milk-route-container');
            const stopsList = document.getElementById('stops-list');
            
            if (route === 'Milk Route') {
                milkContainer.classList.remove('hidden');
                if (stopsList.children.length === 0) {
                    addMilkRouteStop();
                    addMilkRouteStop();
                }
            } else {
                milkContainer.classList.add('hidden');
                stopsList.innerHTML = '';
            }
        }

        function addMilkRouteStop() {
            const stopsList = document.getElementById('stops-list');
            const idx = stopsList.children.length;
            const comp = document.getElementById('g-company').value;
            
            let companySelectHTML = '';
            if (comp === 'BOTH') {
                companySelectHTML = `
                    <select class="stop-company border border-slate-300 rounded p-2 text-xs font-bold w-28 bg-white focus:ring-2 focus:ring-indigo-500">
                        <option value="AHPL">AHPL</option>
                        <option value="AIL">AIL</option>
                    </select>
                `;
            } else {
                companySelectHTML = `
                    <input type="hidden" class="stop-company" value="${comp}">
                    <span class="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-3 py-2 rounded border border-indigo-100 w-28 text-center">${comp}</span>
                `;
            }

            const row = document.createElement('div');
            row.className = 'flex gap-3 items-center bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm';
            row.innerHTML = `
                <span class="text-xs font-extrabold text-slate-400 w-6 text-center">#${idx+1}</span>
                ${companySelectHTML}
                <input type="text" class="stop-location flex-1 border border-slate-300 rounded p-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500" placeholder="Enter Destination Stop..." required>
                <button type="button" onclick="this.parentElement.remove()" class="text-slate-400 hover:text-red-600 px-2 font-bold text-xl transition">&times;</button>
            `;
            stopsList.appendChild(row);
        }

        function handleGateSubmit(e) {
            e.preventDefault();
            
            const vehicle = document.getElementById('g-vehicle').value.trim().toUpperCase();
            if (vehicle.length !== 10) {
                alert('Gate Error: Vehicle Number must be exactly 10 characters (e.g. MP09AB1234)');
                return;
            }

            const vType = document.getElementById('g-vtype').value;
            const company = document.getElementById('g-company').value;
            const route = document.getElementById('g-route').value;
            
            let steps = [];
            
            if (route === 'Milk Route') {
                const stopRows = document.querySelectorAll('#stops-list > div');
                if (stopRows.length === 0) {
                    alert('Gate Error: Please add at least one location stop for the Milk Route.');
                    return;
                }
                
                let ahplCount = 0;
                let ailCount = 0;
                
                stopRows.forEach((row, idx) => {
                    const stepComp = row.querySelector('.stop-company').value;
                    const stepLoc = row.querySelector('.stop-location').value.trim();
                    
                    let assignedDock = '';
                    if (stepComp === 'AHPL') {
                        assignedDock = AHPL_DOCKS[ahplCount % AHPL_DOCKS.length];
                        ahplCount++;
                    } else {
                        assignedDock = AIL_DOCKS[ailCount % AIL_DOCKS.length];
                        ailCount++;
                    }
                    
                    steps.push({
                        id: 'STP-' + Date.now() + '-' + idx,
                        company: stepComp,
                        dock: assignedDock,
                        location: stepLoc,
                        status: 'PENDING',
                        cases: '-',
                        supervisor: '-',
                        timestamp: '-'
                    });
                });
            } else {
                let stepComp = company === 'BOTH' ? 'AHPL' : company;
                let assignedDock = stepComp === 'AHPL' ? AHPL_DOCKS[0] : AIL_DOCKS[0];
                steps.push({
                    id: 'STP-' + Date.now(),
                    company: stepComp,
                    dock: assignedDock,
                    location: 'SINGLE DESTINATION',
                    status: 'PENDING',
                    cases: '-',
                    supervisor: '-',
                    timestamp: '-'
                });
            }

            const newOp = {
                id: 'OP-' + Date.now(),
                vehicle,
                vType,
                company,
                routeType: route,
                steps,
                overallStatus: 'ACTIVE'
            };

            activeOperations.push(newOp);
            
            steps.forEach((step, idx) => {
                auditLogs.push({
                    logId: newOp.id + '-S' + (idx+1),
                    date: new Date().toLocaleString(),
                    vehicle,
                    vType,
                    company: step.company,
                    route,
                    dock: step.dock,
                    location: step.location,
                    status: 'PENDING',
                    cases: step.cases,
                    supervisor: step.supervisor
                });
            });

            e.target.reset();
            document.getElementById('milk-route-container').classList.add('hidden');
            document.getElementById('stops-list').innerHTML = '';
            
            switchTab('docks');
        }

        // --- DOCK RENDERING LOGIC ---
        function renderDocks() {
            const ahplGrid = document.getElementById('ahpl-docks-grid');
            const ailGrid = document.getElementById('ail-docks-grid');
            ahplGrid.innerHTML = '';
            ailGrid.innerHTML = '';

            let dockAssignments = {};
            [...AHPL_DOCKS, ...AIL_DOCKS].forEach(d => dockAssignments[d] = []);

            activeOperations.filter(op => op.overallStatus === 'ACTIVE').forEach(op => {
                op.steps.forEach((step, sIdx) => {
                    if (step.status !== 'COMPLETED' && dockAssignments[step.dock]) {
                        const prevCompleted = sIdx === 0 || op.steps[sIdx-1].status === 'COMPLETED';
                        dockAssignments[step.dock].push({
                            opId: op.id,
                            vehicle: op.vehicle,
                            vType: op.vType,
                            stepIdx: sIdx,
                            stepData: step,
                            isNext: prevCompleted
                        });
                    }
                });
            });

            const createCard = (dockName, assignments, isAHPL) => {
                if (assignments.length === 0) {
                    return `
                    <div class="flex flex-col p-5 rounded-xl border-2 border-dashed border-slate-300 bg-white/40 min-h-[250px] justify-center items-center hover:bg-slate-50 transition">
                        <span class="text-sm font-bold text-slate-400 mb-2">${dockName}</span>
                        <span class="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Available / Idle</span>
                    </div>`;
                }

                const primary = assignments[0];
                const cardColor = isAHPL ? 'bg-blue-50/50 border border-blue-200 border-l-[6px] border-l-blue-500' : 'bg-indigo-50/50 border border-indigo-200 border-l-[6px] border-l-indigo-500';
                
                let stepsHtml = opIdStepsMap(primary.opId);
                
                const opData = activeOperations.find(o => o.id === primary.opId);
                const hasInProgress = opData.steps.some(s => s.status === 'IN-PROGRESS');
                
                const badgeClass = hasInProgress 
                    ? 'bg-amber-100 text-amber-800 border-amber-300' 
                    : 'bg-emerald-100 text-emerald-800 border-emerald-300';
                const badgeText = hasInProgress ? 'LOADING IN-PROGRESS' : 'PENDING START';

                return `
                <div class="flex flex-col p-5 rounded-xl shadow-sm min-h-[250px] transition-all ${cardColor}">
                    <!-- Header -->
                    <div class="flex justify-between items-center font-bold mb-4">
                        <span class="text-sm font-extrabold text-slate-800">${dockName}</span>
                        <span class="w-2.5 h-2.5 rounded-full ${hasInProgress ? 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'bg-emerald-500'}"></span>
                    </div>
                    
                    <!-- Top: Vehicle Number -->
                    <div class="bg-white/80 px-3 py-2.5 rounded-lg border border-slate-200/60 mb-5 shadow-sm">
                         <p class="font-bold text-lg text-slate-800 font-mono text-center tracking-widest">${primary.vehicle}</p>
                    </div>
                    
                    <!-- Middle: Shuttle Steps -->
                    <div class="flex-1 space-y-3">
                        ${stepsHtml}
                    </div>

                    <!-- Bottom: Highlighted Status Box -->
                    <div class="mt-6 pt-4 border-t border-slate-200/60">
                        <div class="w-full py-2.5 px-3 rounded-md text-center font-extrabold uppercase tracking-widest text-[11px] shadow-sm border ${badgeClass}">
                            ${badgeText}
                        </div>
                    </div>
                </div>`;
            };

            function opIdStepsMap(opId) {
                const op = activeOperations.find(o => o.id === opId);
                let html = '';
                op.steps.forEach((step, idx) => {
                    const isPending = step.status === 'PENDING';
                    const isInProgress = step.status === 'IN-PROGRESS';
                    const isCompleted = step.status === 'COMPLETED';
                    
                    const prevCompleted = idx === 0 || op.steps[idx-1].status === 'COMPLETED';
                    const clickable = !isCompleted && prevCompleted;
                    
                    let stepBg = 'bg-slate-100 text-slate-400 border-slate-200 opacity-50'; // Default future locked
                    let pointer = 'cursor-not-allowed';
                    
                    if (isCompleted) {
                        stepBg = 'bg-emerald-50 border-emerald-200 text-emerald-800 opacity-80';
                    } else if (clickable) {
                        pointer = 'cursor-pointer hover:bg-white hover:shadow-md hover:border-blue-300 hover:-translate-y-0.5 transition-all';
                        stepBg = isInProgress 
                            ? 'bg-amber-50 border-amber-300 text-amber-900 border-2 border-dashed shadow-sm'
                            : 'bg-white border-blue-200 shadow-sm text-blue-900';
                    }

                    html += `
                    <div class="p-3 rounded-lg border ${stepBg} ${pointer}" ${clickable ? `onclick="openSupervisorForm('${op.id}', ${idx})"` : ''}>
                        <div class="flex justify-between items-center mb-1.5">
                            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${step.company === 'AHPL' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}">
                                Step ${idx+1} | ${step.company}
                            </span>
                            ${clickable && !isInProgress ? '<span class="text-[9px] font-bold text-blue-600 animate-pulse">CLICK TO OPEN</span>' : ''}
                        </div>
                        <div class="text-[11px] font-extrabold mt-1 mb-1 truncate ${isCompleted ? 'line-through text-emerald-600' : ''}">${step.location}</div>
                        ${isCompleted ? `<div class="text-[10px] font-bold text-emerald-700 mt-1.5 border-t border-emerald-200 pt-1">\u2713 ${step.cases} Cases | ${step.supervisor}</div>` : ''}
                    </div>`;
                });
                return html;
            }

            AHPL_DOCKS.forEach(d => ahplGrid.innerHTML += createCard(d, dockAssignments[d], true));
            AIL_DOCKS.forEach(d => ailGrid.innerHTML += createCard(d, dockAssignments[d], false));
        }

        // --- SUPERVISOR LOGIC ---
        function openSupervisorForm(opId, stepIdx) {
            const op = activeOperations.find(o => o.id === opId);
            const step = op.steps[stepIdx];
            
            if (step.status === 'PENDING') {
                step.status = 'IN-PROGRESS';
                
                const logEntry = auditLogs.find(l => l.logId === (opId + '-S' + (stepIdx+1)));
                if (logEntry) logEntry.status = 'IN-PROGRESS';
                
                renderDocks();
                renderAuditLogs();
            }

            document.getElementById('s-opId').value = opId;
            document.getElementById('s-stepIdx').value = stepIdx;
            document.getElementById('s-vehicle').value = op.vehicle;
            document.getElementById('s-type').value = op.vType;
            document.getElementById('s-location').value = step.location;
            
            const now = new Date();
            document.getElementById('s-time').value = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
            document.getElementById('s-cases').value = '';
            document.getElementById('s-supervisor').value = '';

            document.getElementById('supervisor-modal').classList.remove('hidden');
        }

        function closeSupervisorModal() {
            document.getElementById('supervisor-modal').classList.add('hidden');
        }

        function handleSupervisorSubmit(e) {
            e.preventDefault();
            const opId = document.getElementById('s-opId').value;
            const stepIdx = parseInt(document.getElementById('s-stepIdx').value, 10);
            
            const op = activeOperations.find(o => o.id === opId);
            const step = op.steps[stepIdx];
            
            step.status = 'COMPLETED';
            step.cases = document.getElementById('s-cases').value;
            step.supervisor = document.getElementById('s-supervisor').value;
            step.timestamp = document.getElementById('s-time').value;

            if (op.steps.every(s => s.status === 'COMPLETED')) {
                op.overallStatus = 'COMPLETED';
            }

            const logEntry = auditLogs.find(l => l.logId === (opId + '-S' + (stepIdx+1)));
            if (logEntry) {
                logEntry.status = 'COMPLETED';
                logEntry.cases = step.cases;
                logEntry.supervisor = step.supervisor;
                logEntry.date = step.timestamp;
            }

            closeSupervisorModal();
            renderDocks();
            renderAuditLogs();
        }

        // --- AUDIT LOGS LOGIC ---
        function renderAuditLogs() {
            const tbody = document.getElementById('audit-tbody');
            const search = document.getElementById('audit-search').value.toLowerCase();
            const divFilter = document.getElementById('audit-div-filter').value;
            
            tbody.innerHTML = '';
            
            const filtered = auditLogs.filter(log => {
                const matchesSearch = log.vehicle.toLowerCase().includes(search) || log.location.toLowerCase().includes(search);
                const matchesDiv = divFilter === 'ALL' || log.company === divFilter;
                return matchesSearch && matchesDiv;
            });

            filtered.reverse().forEach((log, i) => {
                let statusColor = 'text-slate-600 bg-slate-100';
                if (log.status === 'COMPLETED') statusColor = 'text-emerald-700 bg-emerald-100 border border-emerald-300';
                else if (log.status === 'IN-PROGRESS') statusColor = 'text-amber-700 bg-amber-100 border border-amber-300';
                
                tbody.innerHTML += `
                    <tr class="hover:bg-slate-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}">
                        <td class="px-4 py-3 font-mono text-[10px] text-slate-500">${log.logId}</td>
                        <td class="px-4 py-3 text-[11px] text-slate-600">${log.date}</td>
                        <td class="px-4 py-3 font-bold font-mono text-slate-800">${log.vehicle}</td>
                        <td class="px-4 py-3 text-slate-600">${log.vType}</td>
                        <td class="px-4 py-3 font-bold ${log.company === 'AHPL' ? 'text-blue-600' : 'text-indigo-600' }">${log.company}</td>
                        <td class="px-4 py-3 text-slate-600">${log.route}</td>
                        <td class="px-4 py-3 font-bold text-slate-700">${log.dock}</td>
                        <td class="px-4 py-3 font-bold text-slate-800">${log.location}</td>
                        <td class="px-4 py-3">
                            <span class="px-2 py-1 rounded text-[10px] font-extrabold uppercase tracking-wider shadow-sm ${statusColor}">${log.status}</span>
                        </td>
                        <td class="px-4 py-3 font-mono font-bold text-slate-800">${log.cases}</td>
                        <td class="px-4 py-3 font-bold text-slate-700">${log.supervisor}</td>
                    </tr>
                `;
            });
        }
