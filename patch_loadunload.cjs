const fs = require('fs');
let code = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

// 1. Remove state variables
code = code.replace(/  const \[startTime1, setStartTime1\].*?\n/g, '');
code = code.replace(/  const \[startTime2, setStartTime2\].*?\n/g, '');
code = code.replace(/  const \[shuttleSteps, setShuttleSteps\].*?\n/g, '');
code = code.replace(/  const \[shuttleUnit, setShuttleUnit\].*?\n/g, '');
code = code.replace(/  const \[shuttleDock, setShuttleDock\].*?\n/g, '');
code = code.replace(/  const \[shuttleDest, setShuttleDest\].*?\n/g, '');

const regexBlockStates = /  \/\/ --- DUAL LOADING STATE ---[\s\S]*?\/\/ --- UNLOADING EXTENDED STATE ---/;
code = code.replace(regexBlockStates, '  // --- UNLOADING EXTENDED STATE ---');

// Wait, I can just replace the block of states using string replacement if I check what's actually there.
