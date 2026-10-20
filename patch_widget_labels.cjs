const fs = require('fs');
let content = fs.readFileSync('src/components/DashboardWidget.tsx', 'utf-8');

// Update pendingPlans label from Total Plans to Plans Pending
content = content.replace(
  /Total<br\/>Plans/,
  'Plans<br/>Pending'
);

fs.writeFileSync('src/components/DashboardWidget.tsx', content);
