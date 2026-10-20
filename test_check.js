const fs = require('fs');
let code = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');
if (code.includes('SHUTTLE ROUTE BUILDER') || code.includes('DUAL LOADING')) {
  console.log("Still has dual/shuttle");
} else {
  console.log("Cleaned up successfully");
}
