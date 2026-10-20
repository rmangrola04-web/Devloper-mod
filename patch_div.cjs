const fs = require('fs');
let content = fs.readFileSync('src/views/DashboardView.tsx', 'utf-8');

content = content.replace(
  /            <\/p>\r?\n          <\/div>\r?\n          <\/div>\r?\n        <\/div>\r?\n      <\/div>/,
  '            </p>\n          </div>\n        </div>\n      </div>'
);

fs.writeFileSync('src/views/DashboardView.tsx', content);
