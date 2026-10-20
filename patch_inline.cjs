const fs = require('fs');
let content = fs.readFileSync('src/views/PlanView.tsx', 'utf-8');

const searchState = `  const [routeType, setRouteType] = useState<'Single Drop' | 'Milk Route'>('Single Drop');`;
const replaceState = `  const [routeType, setRouteType] = useState<'Single Drop' | 'Milk Route'>('Single Drop');
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditField, setInlineEditField] = useState<'transporter' | 'vType' | 'mode' | null>(null);
  const [inlineEditVal, setInlineEditVal] = useState<string>('');

  const handleInlineClick = (item: PlanEntry, field: 'transporter' | 'vType' | 'mode') => {
    setInlineEditId(item.id);
    setInlineEditField(field);
    setInlineEditVal(item[field] || '');
  };

  const handleInlineSave = (item: PlanEntry) => {
    if (inlineEditField && inlineEditId === item.id) {
      if (item[inlineEditField] !== inlineEditVal) {
        onAddPlanEntries([{ ...item, [inlineEditField]: inlineEditVal }]);
        setStatusMsg(\`Successfully updated \${inlineEditField}\`);
        setTimeout(() => setStatusMsg(null), 3000);
      }
    }
    setInlineEditId(null);
    setInlineEditField(null);
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent, item: PlanEntry) => {
    if (e.key === 'Enter') {
      handleInlineSave(item);
    } else if (e.key === 'Escape') {
      setInlineEditId(null);
      setInlineEditField(null);
    }
  };`;
content = content.replace(searchState, replaceState);

const searchTds = `                      <td className="py-1.5 px-2.5 font-mono text-slate-700 dark:text-slate-300">{item.vType}</td>
                      <td className="py-1.5 px-2.5 text-slate-800 dark:text-slate-200">{item.transporter}</td>`;
const replaceTds = `                      <td 
                        className="py-1.5 px-2.5 font-mono text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 transition border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                        onClick={() => handleInlineClick(item, 'vType')}
                      >
                        {inlineEditId === item.id && inlineEditField === 'vType' ? (
                          <input 
                            autoFocus
                            className="w-full bg-white dark:bg-slate-800 border border-blue-500 rounded px-1 outline-none font-mono text-xs"
                            value={inlineEditVal}
                            onChange={(e) => setInlineEditVal(e.target.value.toUpperCase())}
                            onBlur={() => handleInlineSave(item)}
                            onKeyDown={(e) => handleInlineKeyDown(e, item)}
                          />
                        ) : (
                          item.vType || <span className="text-slate-400 italic">--</span>
                        )}
                      </td>
                      <td 
                        className="py-1.5 px-2.5 text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 transition border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                        onClick={() => handleInlineClick(item, 'transporter')}
                      >
                        {inlineEditId === item.id && inlineEditField === 'transporter' ? (
                          <input 
                            autoFocus
                            className="w-full bg-white dark:bg-slate-800 border border-blue-500 rounded px-1 outline-none text-xs"
                            value={inlineEditVal}
                            onChange={(e) => setInlineEditVal(e.target.value.toUpperCase())}
                            onBlur={() => handleInlineSave(item)}
                            onKeyDown={(e) => handleInlineKeyDown(e, item)}
                          />
                        ) : (
                          item.transporter || <span className="text-slate-400 italic">--</span>
                        )}
                      </td>
                      <td 
                        className="py-1.5 px-2.5 text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 transition border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                        onClick={() => handleInlineClick(item, 'mode')}
                      >
                        {inlineEditId === item.id && inlineEditField === 'mode' ? (
                          <select 
                            autoFocus
                            className="w-full bg-white dark:bg-slate-800 border border-blue-500 rounded px-1 outline-none text-xs"
                            value={inlineEditVal}
                            onChange={(e) => setInlineEditVal(e.target.value)}
                            onBlur={() => handleInlineSave(item)}
                            onKeyDown={(e) => handleInlineKeyDown(e, item)}
                          >
                            <option value="">--</option>
                            <option value="Road">Road</option>
                            <option value="Rail">Rail</option>
                            <option value="Air">Air</option>
                          </select>
                        ) : (
                          item.mode || <span className="text-slate-400 italic">--</span>
                        )}
                      </td>`;
content = content.replace(searchTds, replaceTds);
fs.writeFileSync('src/views/PlanView.tsx', content);
