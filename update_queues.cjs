const fs = require('fs');

function updateQueue(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    /veh\.milkRouteDestinations\.map\(m => m\.location\)\.join\('(\s*\/?\s*|, )'\)/g,
    "veh.milkRouteDestinations.map(m => m.unit ? `${m.location} (${m.unit})` : m.location).join(' / ')"
  );
  fs.writeFileSync(file, content);
}

updateQueue('src/views/MainDashboardView.tsx');
updateQueue('src/views/WaitingQueueView.tsx');
console.log('Updated queues');
