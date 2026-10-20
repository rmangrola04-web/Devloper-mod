const fs = require('fs');
let content = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

// 1. Remove state variables for Shuttle
content = content.replace(/  \/\/ Shuttle Sequence States[\s\S]*?handlePickCurrentTime2 = \(\) => {[\s\S]*?};\n/g, '');

// 2. Remove Dual Loading States & Effects
content = content.replace(/  \/\/ Dual Loading State[\s\S]*?\}\n  \}, \[loadLocations\]\);\n/g, '');

// 3. Remove BOTH and SHUTTLE options from Company / Unit
content = content.replace(/                  <option value="BOTH">BOTH \(AHPL \& AIL - Dock 1 to 9\)<\/option>\n/g, '');
content = content.replace(/                  <option value="SHUTTLE">SHUTTLE ROUTE \(Multi-Dock\)<\/option>\n/g, '');

// 4. Clean up Dock dropdown
content = content.replace(/                  disabled=\{unit === 'BOTH' \|\| unit === 'SHUTTLE'\}\n/g, '');
content = content.replace(/                  className=\{`w-full border rounded p-1.5 text-xs font-bold \$\{unit === 'BOTH' \|\| unit === 'SHUTTLE' \? 'bg-slate-200 dark:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-emerald-600 dark:text-emerald-400'\}`\}\n/g, '                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400"\n');
content = content.replace(/                  \{unit === 'BOTH' \|\| unit === 'SHUTTLE' \? \(\n                     <option value=\{bayNo\}>-- See Block Configuration Below --<\/option>\n                  \) : dockList\.map\(\(dock\) => \{/g, '                  {dockList.map((dock) => {');
content = content.replace(/                      <\/option>\n                    \);\n                  \}\)\}\n                <\/select>/g, '                      </option>\n                    );\n                  })}\n                </select>');

// 5. Clean up Supervisor Incharge
content = content.replace(/            \{\!\(opType === 'LOADING' \&\& unit === 'BOTH'\) \&\& unit \!\=\= 'SHUTTLE' \&\& \(\n/g, '');
content = content.replace(/                  \}\)\}\n                <\/select>\n              <\/div>\n            \)\}/g, '                  })}\n                </select>\n              </div>'); // Removes closing brace of the condition

// 6. Clean up Operation Start Time
content = content.replace(/            \{\!\(opType === 'LOADING' \&\& unit === 'BOTH'\) \&\& \(\n/g, '');
content = content.replace(/                \/>\n              <\/div>\n            \)\}/g, '                />\n              </div>');

// 7. Remove all the middle blocks: SHUTTLE ROUTE BUILDER, LOADING: Cases Loaded, DUAL LOADING SECTION, UNLOADING: Total Cases
const middleBlocksTarget = `            {/* SHUTTLE ROUTE BUILDER */}
            {unit === 'SHUTTLE' && (`;
const submitTarget = `            <button
              type="submit"`;
// Using regex to remove everything from SHUTTLE ROUTE BUILDER up to right before <button type="submit"
content = content.replace(/            \{\/\* SHUTTLE ROUTE BUILDER \*\/\}[\s\S]*?(?=            <button\n              type="submit")/g, '');

// 8. Simplify handleSubmit
// We replace the entire `if (opType === 'LOADING' && unit === 'BOTH') { ... } else if (unit === 'SHUTTLE') { ... } else { ... }` with just the `else` block content.
const submitBlock = `if (opType === 'LOADING' && unit === 'BOTH') {
        const c1A = Number(cases1A) || 0;
        const c1B = Number(cases1B) || 0;
        const totalC1 = c1A + c1B;
        
        const c2A = Number(cases2A) || 0;
        const c2B = Number(cases2B) || 0;
        const totalC2 = c2A + c2B;
        
        const formatToLoc = (dA, cA, dB, cB) => {
          let str = \`\${dA} (\${cA})\`;
          if (dB && cB > 0) {
            str += \` + \${dB} (\${cB})\`;
          }
          return str;
        };
        const op1: LoadUnloadEntry = {
          gateId: selectedGateId,
          id: \`OP-\${Date.now()}-1\`,
          opType,
          unit: company1,
          bayNo: bayNo1,
          vehicleNo: vehicleNo.trim().toUpperCase(),
          fromLoc: fromLoc.trim().toUpperCase(),
          toLoc: formatToLoc(dest1A || toLoc, c1A, dest1B, c1B).toUpperCase(),
          dest1: dest1A || toLoc,
          cases1: c1A,
          dest2: (dest1B && c1B > 0) ? dest1B : undefined,
          cases2: (dest1B && c1B > 0) ? c1B : undefined,
          transporter,
          operator: supervisor1.trim(),
          startTime: startTime1 || new Date().toTimeString().substring(0, 5),
          endTime: '',
          duration: '-- In Progress --',
          status: 'LOADING IN-PROGRESS',
          totalCases: totalC1,
          damagedCases: 0,
          damagedValue: 0,
          podStatus: 'N/A',
          grNo: opGrNo,
          remarks: \`Dual Load - Split 1 (Partner: \${company2})\`
        };
        const op2: LoadUnloadEntry = {
          gateId: selectedGateId,
          id: \`OP-\${Date.now()}-2\`,
          opType,
          unit: company2,
          bayNo: bayNo2,
          vehicleNo: vehicleNo.trim().toUpperCase(),
          fromLoc: fromLoc.trim().toUpperCase(),
          toLoc: formatToLoc(dest2A || toLoc, c2A, dest2B, c2B).toUpperCase(),
          dest1: dest2A || toLoc,
          cases1: c2A,
          dest2: (dest2B && c2B > 0) ? dest2B : undefined,
          cases2: (dest2B && c2B > 0) ? c2B : undefined,
          transporter,
          operator: supervisor2.trim(),
          startTime: startTime2 || new Date().toTimeString().substring(0, 5),
          endTime: '',
          duration: '-- In Progress --',
          status: 'LOADING IN-PROGRESS',
          totalCases: totalC2,
          damagedCases: 0,
          damagedValue: 0,
          podStatus: 'N/A',
          grNo: opGrNo,
          remarks: \`Dual Load - Split 2 (Partner: \${company1})\`
        };
        await onAddOperation(op1);
        await onAddOperation(op2);
      } else if (unit === 'SHUTTLE') {
        const shuttleOp: LoadUnloadEntry = {
          gateId: selectedGateId,
          id: \`OP-\${Date.now()}\`,
          opType,
          unit,
          bayNo: 'Multi-Dock',
          vehicleNo: vehicleNo.trim().toUpperCase(),
          fromLoc: fromLoc.trim().toUpperCase(),
          toLoc: shuttleSteps.length > 0 ? shuttleSteps[shuttleSteps.length-1].destination : toLoc.trim().toUpperCase(),
          transporter,
          operator: operator.trim(),
          startTime: startTime || new Date().toTimeString().substring(0, 5),
          endTime: '',
          duration: '-- In Progress --',
          status: 'SHUTTLE TRANSIT',
          totalCases: 0,
          damagedCases: 0,
          damagedValue: 0,
          podStatus: 'N/A',
          grNo: opGrNo,
          remarks: 'Sequence-Based Shuttle Logistics',
          shuttleSteps: shuttleSteps,
          currentStepIndex: 0
        };
        await onAddOperation(shuttleOp);
      } else {
        const newOp: LoadUnloadEntry = {
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
          totalCases: totalCasesVal,
          damagedCases: isUnloading && damagedCases !== '' ? Number(damagedCases) : 0,
          damagedValue: isUnloading && damagedValue !== '' ? Number(damagedValue) : 0,
          podStatus: isUnloading ? unloadingPodStatus : 'N/A',
          grNo: opGrNo,
          remarks: ''
        };
        await onAddOperation(newOp);
      }`;
      
const simplifiedSubmit = `        const newOp: LoadUnloadEntry = {
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
          totalCases: 0,
          damagedCases: 0,
          damagedValue: 0,
          podStatus: 'N/A',
          grNo: opGrNo,
          remarks: ''
        };
        await onAddOperation(newOp);`;
        
content = content.replace(submitBlock, simplifiedSubmit);

// Wait, I should also remove the `totalCasesVal` definition because we are not keeping totalCasesLoad/totalCasesUnload in the start form.
content = content.replace(/      const totalCasesVal = isUnloading[\s\S]*?\: \(totalCasesLoad \!\=\= '' \? Number\(totalCasesLoad\) \: 0\);\n/g, '');

// Also remove `const isUnloading = opType === 'UNLOADING';` since it's not strictly necessary, or I can leave it.

// Also need to remove the gate select waiting shuttles map
content = content.replace(/                \{waitingShuttles\.map\(s => \([\s\S]*?                  <\/option>\n                \)\)\}\n/g, '');

fs.writeFileSync('src/views/LoadUnloadView.tsx', content);
console.log('patched successfully');
