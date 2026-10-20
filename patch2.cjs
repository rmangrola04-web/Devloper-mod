const fs = require('fs');
const file = './src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetFunction = `
    const updated: LoadUnloadEntry = {
      ...target,
      totalCases,
      sealNo,
      endTime: now,
      duration,
      status: 'LOADED'
    };`;

const replacedFunction = `
    let updated: LoadUnloadEntry = {
      ...target,
      totalCases,
      sealNo,
      endTime: now,
      duration,
      status: 'LOADED'
    };

    if (target.shuttleSteps && target.currentStepIndex !== undefined) {
      const updatedSteps = [...target.shuttleSteps];
      updatedSteps[target.currentStepIndex] = {
        ...updatedSteps[target.currentStepIndex],
        cases: totalCases,
        endTime: now,
        status: 'COMPLETED'
      };
      
      if (target.currentStepIndex < target.shuttleSteps.length - 1) {
        // Advance to next step
        const nextIndex = target.currentStepIndex + 1;
        const nextStep = updatedSteps[nextIndex];
        updated = {
          ...target,
          shuttleSteps: updatedSteps,
          currentStepIndex: nextIndex,
          status: 'SHUTTLE TRANSIT',
          bayNo: nextStep.bayNo,
          unit: nextStep.unit,
          toLoc: nextStep.destination,
          endTime: '', // clear for next step
          startTime: '', // clear for next step
          operator: nextStep.operator || '',
          totalCases: 0
        };
      } else {
        // Last step finished
        updated = {
          ...updated,
          shuttleSteps: updatedSteps
        };
      }
    }
`;

content = content.replace(targetFunction, replacedFunction);

fs.writeFileSync(file, content);
console.log('Done patch 2');
