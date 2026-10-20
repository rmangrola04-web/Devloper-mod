const fs = require('fs');

let content = fs.readFileSync('src/views/LiveDocksView.tsx', 'utf8');

const target1 = `            const actives = loadEntries.filter(
              (d) => d.bayNo === dockName && (d.status === 'PENDING' || d.status === 'LOADING IN-PROGRESS' || d.status === 'SHUTTLE TRANSIT' || d.status === 'UNLOADING IN-PROGRESS')
            );`;

const replace1 = `            const actives = loadEntries.filter(
              (d) => (d.bayNo === dockName || (d.shuttleSteps && d.shuttleSteps.some(s => s.bayNo === dockName))) && (d.status === 'PENDING' || d.status === 'LOADING IN-PROGRESS' || d.status === 'SHUTTLE TRANSIT' || d.status === 'UNLOADING IN-PROGRESS')
            );`;

content = content.replace(target1, replace1); // for ahpl
content = content.replace(target1, replace1); // for ail

fs.writeFileSync('src/views/LiveDocksView.tsx', content);
console.log('patched LiveDocksView');
