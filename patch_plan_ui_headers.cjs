const fs = require('fs');
let content = fs.readFileSync('src/views/PlanView.tsx', 'utf-8');

const searchHeaders = `                  <th className="py-2 px-2.5">Vehicle Type</th>
                  <th className="py-2 px-2.5">Transporter</th>`;
const replaceHeaders = `                  <th className="py-2 px-2.5">Vehicle Type</th>
                  <th className="py-2 px-2.5">Transporter</th>
                  <th className="py-2 px-2.5">Mode</th>`;
content = content.replace(searchHeaders, replaceHeaders);

const searchColspan = `                    <td colSpan={10} className="text-center py-6 text-slate-400">`;
const replaceColspan = `                    <td colSpan={11} className="text-center py-6 text-slate-400">`;
content = content.replace(searchColspan, replaceColspan);

fs.writeFileSync('src/views/PlanView.tsx', content);
