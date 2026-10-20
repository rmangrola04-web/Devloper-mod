import fs from 'fs';
let content = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

const replacement = `  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleNo.trim()) {
      alert('Please enter a vehicle number');
      return;
    }
    
    // Prevent submitting to an occupied dock
    const isDockOccupied = loadEntries.some(d => d.bayNo === bayNo && d.status.includes('IN-PROGRESS'));
    if (isDockOccupied) {
      alert(\`\${bayNo} is currently Occupied by another vehicle. Please select an available dock.\`);
      return;
    }
    
    try {`;

content = content.replace(/  const handleSubmit = async \(e: React\.FormEvent\) => \{\n    e\.preventDefault\(\);\n    if \(\!vehicleNo\.trim\(\)\) \{\n      alert\('Please enter a vehicle number'\);\n      return;\n    \}\n    \n    try \{/, replacement);

fs.writeFileSync('src/views/LoadUnloadView.tsx', content);
