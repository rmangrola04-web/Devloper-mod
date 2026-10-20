import fs from 'fs';
const file = './src/views/LiveDocksView.tsx';
let content = fs.readFileSync(file, 'utf8');

const importSearch = `import { Layers } from 'lucide-react';`;
const importReplace = `import { Layers, Search } from 'lucide-react';`;
content = content.replace(importSearch, importReplace);

const stateSearch = `  const [finishingStep, setFinishingStep] = useState<{ entry: LoadUnloadEntry; index: number } | null>(null);`;
const stateReplace = `  const [finishingStep, setFinishingStep] = useState<{ entry: LoadUnloadEntry; index: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');`;
content = content.replace(stateSearch, stateReplace);

const returnSearch = `  return (
    <section className="space-y-6">`;
const returnReplace = `  return (
    <section className="space-y-6">
      {/* Search Bar */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-all focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400">
        <Search className="w-5 h-5 text-slate-400" />
        <input 
          type="text" 
          placeholder="Filter docks by Vehicle Number or Destination Location..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent border-none text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
        />
      </div>`;
content = content.replace(returnSearch, returnReplace);

const filterAhplSearch = `          {ahplDocks.map((dockName) => {
            const actives = loadEntries.filter(
              (d) => d.bayNo === dockName && (d.status === 'PENDING' || d.status === 'LOADING IN-PROGRESS' || d.status === 'SHUTTLE TRANSIT' || d.status === 'UNLOADING IN-PROGRESS')
            );
            return renderDockCard(dockName, actives);
          })}`;

const filterAhplReplace = `          {ahplDocks.map((dockName) => {
            const actives = loadEntries.filter(
              (d) => d.bayNo === dockName && (d.status === 'PENDING' || d.status === 'LOADING IN-PROGRESS' || d.status === 'SHUTTLE TRANSIT' || d.status === 'UNLOADING IN-PROGRESS')
            );
            
            if (searchTerm.trim() !== '') {
               if (actives.length === 0) return null;
               const term = searchTerm.toLowerCase();
               const matches = actives.some(record => {
                  const matchVehicle = record.vehicleNo?.toLowerCase().includes(term);
                  const matchDest = record.toLoc?.toLowerCase().includes(term) || record.shuttleSteps?.some(s => s.destination?.toLowerCase().includes(term));
                  return matchVehicle || matchDest;
               });
               if (!matches) return null;
            }

            return renderDockCard(dockName, actives);
          })}`;

content = content.replace(filterAhplSearch, filterAhplReplace);

const filterAilSearch = `          {ailDocks.map((dockName) => {
            const actives = loadEntries.filter(
              (d) => d.bayNo === dockName && (d.status === 'PENDING' || d.status === 'LOADING IN-PROGRESS' || d.status === 'SHUTTLE TRANSIT' || d.status === 'UNLOADING IN-PROGRESS')
            );
            return renderDockCard(dockName, actives);
          })}`;

const filterAilReplace = `          {ailDocks.map((dockName) => {
            const actives = loadEntries.filter(
              (d) => d.bayNo === dockName && (d.status === 'PENDING' || d.status === 'LOADING IN-PROGRESS' || d.status === 'SHUTTLE TRANSIT' || d.status === 'UNLOADING IN-PROGRESS')
            );
            
            if (searchTerm.trim() !== '') {
               if (actives.length === 0) return null;
               const term = searchTerm.toLowerCase();
               const matches = actives.some(record => {
                  const matchVehicle = record.vehicleNo?.toLowerCase().includes(term);
                  const matchDest = record.toLoc?.toLowerCase().includes(term) || record.shuttleSteps?.some(s => s.destination?.toLowerCase().includes(term));
                  return matchVehicle || matchDest;
               });
               if (!matches) return null;
            }

            return renderDockCard(dockName, actives);
          })}`;

content = content.replace(filterAilSearch, filterAilReplace);

fs.writeFileSync(file, content);
console.log('patched LiveDocksView search');
