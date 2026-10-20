import fs from 'fs';

let content = fs.readFileSync('src/views/GateSecurityView.tsx', 'utf8');

const targetLogic = `    // Helper to find free dock based on unit
    let ahplCount = 0;
    let ailCount = 0;
    const getDockByUnitSeq = (unit: string) => {
        if (unit === 'AHPL') {
            const allowedDocks = ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4'];
            const dock = allowedDocks[ahplCount % allowedDocks.length];
            ahplCount++;
            return dock;
        } else {
            const allowedDocks = ['Dock 7', 'Dock 8', 'Dock 9'];
            const dock = allowedDocks[ailCount % allowedDocks.length];
            ailCount++;
            return dock;
        }
    };`;

const replacementLogic = `    // Helper to find least utilized dock based on active operations
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
    };`;

content = content.replace(targetLogic, replacementLogic);

fs.writeFileSync('src/views/GateSecurityView.tsx', content);
console.log('patched logic');
