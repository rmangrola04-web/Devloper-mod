const fs = require('fs');

let content = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

const oldSubmitOp = /        const newOp: LoadUnloadEntry = \{[\s\S]*?remarks: ''\n        \};/;
const newSubmitOp = `        const newOp: LoadUnloadEntry = {
          gateId: selectedGateId,
          id: \`OP-\${Date.now()}\`,
          opType,
          unit,
          bayNo,
          vehicleNo: vehicleNo.trim().toUpperCase(),
          fromLoc: fromLoc.trim().toUpperCase(),
          toLoc: toLoc.trim().toUpperCase(),
          transporter,
          operator: operator.trim(),
          startTime: startTime || new Date().toTimeString().substring(0, 5),
          endTime: '',
          duration: '-- In Progress --',
          status: opType === 'LOADING' ? 'LOADING IN-PROGRESS' : 'UNLOADING IN-PROGRESS',
          totalCases: totalCasesLoad ? Number(totalCasesLoad) : 0,
          damagedCases: 0,
          damagedValue: 0,
          podStatus: 'N/A',
          grNo: opGrNo,
          sealNo: sealNumber.trim() || undefined,
          remarks: ''
        };`;
content = content.replace(oldSubmitOp, newSubmitOp);

// Clear sealNumber on reset
content = content.replace(/      setTotalCasesLoad\(''\);\n/, "      setTotalCasesLoad('');\n      setSealNumber('');\n");

fs.writeFileSync('src/views/LoadUnloadView.tsx', content);
console.log('Fixed submit object');
