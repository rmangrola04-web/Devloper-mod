const fs = require('fs');
let content = fs.readFileSync('src/views/GateSecurityView.tsx', 'utf8');

const target = `    // 1.5 Auto-create Operational Entry
    const activeOps = activeOperations.filter(op => op.status !== 'LOADED' && op.status !== 'UNLOADED');
    
    // Helper to find least utilized dock based on active operations
    const dockLoadCounts: Record<string, number> = {};
    activeOps.forEach(op => {
      dockLoadCounts[op.bayNo] = (dockLoadCounts[op.bayNo] || 0) + 1;
    });

    const getDockByUnitSeq = (unit: string) => {
        const allowedDocks = unit === 'AHPL' ? ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4'] : ['Dock 7', 'Dock 8', 'Dock 9'];
        
        let leastDock = allowedDocks[0];
        let minCount = Infinity;
        
        for (const dock of allowedDocks) {
            const count = dockLoadCounts[dock] || 0;
            if (count < minCount) {
                minCount = count;
                leastDock = dock;
            }
        }
        
        // Optimistically increment so multi-step milk routes distribute properly
        dockLoadCounts[leastDock] = (dockLoadCounts[leastDock] || 0) + 1;
        
        return leastDock;
    };
    
    let shuttleSteps: any[] = [];
    
    if (routeType === 'Milk Route' && milkRouteDestinations.length > 0) {
        shuttleSteps = milkRouteDestinations.flatMap((dest, idx) => {
            if (dest.unit === 'BOTH') {
                const dock1 = getDockByUnitSeq('AHPL');
                const dock2 = getDockByUnitSeq('AIL');
                return [
                    {
                        id: \`STEP-\${Date.now()}-\${idx}-AHPL\`,
                        unit: 'AHPL',
                        bayNo: dock1,
                        assignedDock: dock1,
                        destination: dest.location,
                        cases: 0,
                        status: 'PENDING'
                    },
                    {
                        id: \`STEP-\${Date.now()}-\${idx}-AIL\`,
                        unit: 'AIL',
                        bayNo: dock2,
                        assignedDock: dock2,
                        destination: dest.location,
                        cases: 0,
                        status: 'PENDING'
                    }
                ];
            } else {
                const autoDock = getDockByUnitSeq(dest.unit);
                return [{
                    id: \`STEP-\${Date.now()}-\${idx}\`,
                    unit: dest.unit,
                    bayNo: autoDock,
                    assignedDock: autoDock,
                    destination: dest.location,
                    cases: 0,
                    status: 'PENDING'
                }];
            }
        });
    } else {
        if (loadDivision === 'BOTH') {
            const dock1 = getDockByUnitSeq('AHPL');
            const dock2 = getDockByUnitSeq('AIL');
            shuttleSteps = [
                {
                    id: \`STEP-\${Date.now()}-0-AHPL\`,
                    unit: 'AHPL',
                    bayNo: dock1,
                    assignedDock: dock1,
                    destination: purpose === 'Loading' ? destination : 'WAREHOUSE',
                    cases: 0,
                    status: 'PENDING'
                },
                {
                    id: \`STEP-\${Date.now()}-0-AIL\`,
                    unit: 'AIL',
                    bayNo: dock2,
                    assignedDock: dock2,
                    destination: purpose === 'Loading' ? destination : 'WAREHOUSE',
                    cases: 0,
                    status: 'PENDING'
                }
            ];
        } else {
            const autoDock = getDockByUnitSeq(loadDivision);
            shuttleSteps = [{
                id: \`STEP-\${Date.now()}-0\`,
                unit: loadDivision,
                bayNo: autoDock,
                assignedDock: autoDock,
                destination: purpose === 'Loading' ? destination : 'WAREHOUSE',
                cases: 0,
                status: 'PENDING'
            }];
        }
    }

    const initialDock = shuttleSteps[0].bayNo;

    const newOp: LoadUnloadEntry = {
        id: \`OP-\${Date.now()}\`,
        opType: purpose === 'Loading' ? 'LOADING' : 'UNLOADING',
        unit: loadDivision,
        bayNo: initialDock,
        vehicleNo: cleanVehicle,
        vType: vType,
        fromLoc: purpose === 'Unloading' ? destination : 'WAREHOUSE',
        toLoc: purpose === 'Loading' ? destination : 'WAREHOUSE',
        transporter: 'N/A',
        operator: supervisorNameRemarks,
        startTime: loadingStartInTime,
        endTime: loadingExitTime,
        duration: '-- In Progress --',
        status: 'PENDING',
        totalCases: Number(totalCases) || 0,
        damagedCases: 0,
        damagedValue: 0,
        podStatus: 'N/A',
        grNo: '',
        remarks: supervisorNameRemarks,
        shuttleSteps: shuttleSteps as any,
        currentStepIndex: 0
    };
    
    onAddOperation(newOp as any);`;

content = content.replace(target, '');
fs.writeFileSync('src/views/GateSecurityView.tsx', content);
console.log('patched GateSecurityView removal');
