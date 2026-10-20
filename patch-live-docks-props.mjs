import fs from 'fs';
const file = './src/views/LiveDocksView.tsx';
let content = fs.readFileSync(file, 'utf8');

const searchProps = `interface LiveDocksViewProps {
  loadEntries: LoadUnloadEntry[];
  onUpdateOperation: (updatedEntry: LoadUnloadEntry) => void;
}`;

const replaceProps = `interface LiveDocksViewProps {
  loadEntries: LoadUnloadEntry[];
  onUpdateOperation: (updatedEntry: LoadUnloadEntry) => void;
  onEditOperation: (entry: LoadUnloadEntry) => void;
}`;

content = content.replace(searchProps, replaceProps);

const searchFC = `export const LiveDocksView: React.FC<LiveDocksViewProps> = ({ loadEntries, onUpdateOperation }) => {`;
const replaceFC = `export const LiveDocksView: React.FC<LiveDocksViewProps> = ({ loadEntries, onUpdateOperation, onEditOperation }) => {`;
content = content.replace(searchFC, replaceFC);

const searchLegacyClick = `                  onClick={() => onUpdateOperation(record)} // In a real app this could open EditOperationModal`;
const replaceLegacyClick = `                  onClick={() => onEditOperation(record)}`;
content = content.replace(searchLegacyClick, replaceLegacyClick);

fs.writeFileSync(file, content);
console.log('patched LiveDocksView props');
