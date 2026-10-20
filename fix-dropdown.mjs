import fs from 'fs';
let content = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

const regex = /\{dockList\.map\(\(dock\) => \(\s*<option key=\{dock\} value=\{dock\}>\s*\{dock\} \(\{unit\}\)\s*<\/option>\s*\)\)\}/;
const replacement = `{dockList.map((dock) => {
  const isOccupied = loadEntries.some(d => d.bayNo === dock && d.status.includes('IN-PROGRESS'));
  return (
    <option key={dock} value={dock} disabled={isOccupied}>
      {dock} {isOccupied ? '(Occupied)' : \`(\${unit})\`}
    </option>
  );
})}`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/views/LoadUnloadView.tsx', content);
