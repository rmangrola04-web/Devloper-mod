const fs = require('fs');
let content = fs.readFileSync('src/views/PlanView.tsx', 'utf-8');

const searchConsol = `          status: 'Pending',
          entryIds: [],
          isMilkRoute: isGroupedMilkRoute
        });`;

const replaceConsol = `          status: 'Pending',
          entryIds: [],
          isMilkRoute: isGroupedMilkRoute,
          hasCarriedForward: false
        });`;

content = content.replace(searchConsol, replaceConsol);

const searchConsolUpdate = `      item.count += 1;
      item.totalWeight += p.weight || 0;
      item.totalCft += p.cft || 0;
      item.entryIds.push(p.id);`;

const replaceConsolUpdate = `      item.count += 1;
      item.totalWeight += p.weight || 0;
      item.totalCft += p.cft || 0;
      item.entryIds.push(p.id);
      if (p.isCarriedForward) item.hasCarriedForward = true;`;

content = content.replace(searchConsolUpdate, replaceConsolUpdate);

const searchConsolRender = `                      <td className="py-1.5 px-3 font-bold text-blue-600 dark:text-blue-400">{g.dest}</td>`;
const replaceConsolRender = `                      <td className="py-1.5 px-3 font-bold text-blue-600 dark:text-blue-400">
                        <div className="flex items-center gap-2">
                          {g.dest}
                          {g.hasCarriedForward && (
                            <span className="bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400 text-[8px] px-1 py-0.5 rounded border border-amber-300 dark:border-amber-700 font-medium whitespace-nowrap tracking-wide">
                              CARRIED FORWARD
                            </span>
                          )}
                        </div>
                      </td>`;
content = content.replace(searchConsolRender, replaceConsolRender);

const searchDetailedRender = `                      <td className="py-1.5 px-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">{item.deliveryNo}</td>`;
const replaceDetailedRender = `                      <td className="py-1.5 px-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                        <div className="flex items-center gap-2">
                          {item.deliveryNo}
                          {item.isCarriedForward && (
                            <span className="bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400 text-[8px] px-1 py-0.5 rounded border border-amber-300 dark:border-amber-700 font-medium whitespace-nowrap tracking-wide">
                              CARRIED FORWARD
                            </span>
                          )}
                        </div>
                      </td>`;
content = content.replace(searchDetailedRender, replaceDetailedRender);

fs.writeFileSync('src/views/PlanView.tsx', content);
