const fs = require('fs');

let content = fs.readFileSync('src/components/FinishStepModal.tsx', 'utf8');

const t1 = `    const isLastStep = stepIndex === entry.shuttleSteps!.length - 1;

    let updatedEntry: LoadUnloadEntry = {
      ...entry,
      shuttleSteps: updatedSteps,
    };

    if (isLastStep) {
      updatedEntry.status = 'LOADED';
      updatedEntry.endTime = endTime; // Complete entire operation
      updatedEntry.totalCases = updatedSteps.reduce((acc, s) => acc + (Number(s.cases) || 0), 0);
    } else {
      updatedEntry.status = 'SHUTTLE TRANSIT'; // Ready for next step
      updatedEntry.currentStepIndex = stepIndex + 1;
      updatedEntry.bayNo = updatedSteps[stepIndex + 1].bayNo; // Move the vehicle to the next dock
    }`;

const r1 = `    const allCompleted = updatedSteps.every(s => s.status === 'COMPLETED');

    let updatedEntry: LoadUnloadEntry = {
      ...entry,
      shuttleSteps: updatedSteps,
    };

    if (allCompleted) {
      updatedEntry.status = 'LOADED';
      updatedEntry.endTime = endTime; // Complete entire operation
      updatedEntry.totalCases = updatedSteps.reduce((acc, s) => acc + (Number(s.cases) || 0), 0);
    } else {
      updatedEntry.status = 'SHUTTLE TRANSIT'; // Ready for next step
      // Only advance currentStepIndex sequentially if it hasn't exceeded
      const nextPending = updatedSteps.findIndex(s => s.status !== 'COMPLETED');
      updatedEntry.currentStepIndex = nextPending !== -1 ? nextPending : entry.currentStepIndex;
      if (nextPending !== -1) {
          updatedEntry.bayNo = updatedSteps[nextPending].bayNo; // Move the vehicle to the next dock
      }
    }`;

content = content.replace(t1, r1);

fs.writeFileSync('src/components/FinishStepModal.tsx', content);
console.log('patched FinishStepModal out of order completion logic');
