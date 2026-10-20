const fs = require('fs');

let content = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

// Update Props interface
content = content.replace("  initialGateId?: string | null;", "  initialGateId?: string | null;\n  initialDest?: {location: string, unit?: string} | null;");

// Update Component signature
content = content.replace("  initialGateId,", "  initialGateId,\n  initialDest,");

// Update useEffect
const oldUseEffect = `  React.useEffect(() => {
    if (initialGateId) {
      handleGateSelect(initialGateId);
      if (onClearInitialGateId) {
        onClearInitialGateId();
      }
    }
  }, [initialGateId]);`;
const newUseEffect = `  React.useEffect(() => {
    if (initialGateId) {
      handleGateSelect(initialGateId, initialDest);
      if (onClearInitialGateId) {
        onClearInitialGateId();
      }
    }
  }, [initialGateId, initialDest]);`;
content = content.replace(oldUseEffect, newUseEffect);

// Update handleGateSelect
const oldHandleGateSelectStart = `  const handleGateSelect = (gateId: string) => {`;
const newHandleGateSelectStart = `  const handleGateSelect = (gateId: string, specificDest?: {location: string, unit?: string} | null) => {`;
content = content.replace(oldHandleGateSelectStart, newHandleGateSelectStart);

const oldHandleGateSelectLogic = `    if (gate.purpose === 'Loading') {
      setOpType('LOADING');
      if (gate.unit && gate.unit !== 'BOTH' && gate.unit !== 'SHUTTLE') {
        handleUnitChange(gate.unit);
      }
      setFromLoc('INDORE HUB');
      
      if (gate.routeType === 'Milk Route' && gate.milkRouteDestinations && gate.milkRouteDestinations.length > 0) {
        const combinedDest = gate.milkRouteDestinations.map(m => m.unit ? \`\${m.location} (\${m.unit})\` : m.location).join(' / ');
        setToLoc(combinedDest);
      } else {
        setToLoc(gate.toLoc || '');
      }
    } else {
      setOpType('UNLOADING');
      if (gate.unit && gate.unit !== 'BOTH' && gate.unit !== 'SHUTTLE') {
        handleUnitChange(gate.unit);
      }
      
      if (gate.routeType === 'Milk Route' && gate.milkRouteDestinations && gate.milkRouteDestinations.length > 0) {
        const combinedDest = gate.milkRouteDestinations.map(m => m.unit ? \`\${m.location} (\${m.unit})\` : m.location).join(' / ');
        setFromLoc(combinedDest);
      } else {
        setFromLoc(gate.fromLoc || '');
      }
      setToLoc('INDORE HUB');
    }`;

const newHandleGateSelectLogic = `    if (gate.purpose === 'Loading') {
      setOpType('LOADING');
      setFromLoc('INDORE HUB');
      
      if (specificDest) {
        if (specificDest.unit) handleUnitChange(specificDest.unit);
        setToLoc(specificDest.location);
      } else {
        if (gate.unit && gate.unit !== 'BOTH' && gate.unit !== 'SHUTTLE') {
          handleUnitChange(gate.unit);
        }
        if (gate.routeType === 'Milk Route' && gate.milkRouteDestinations && gate.milkRouteDestinations.length > 0) {
          const combinedDest = gate.milkRouteDestinations.map(m => m.unit ? \`\${m.location} (\${m.unit})\` : m.location).join(' / ');
          setToLoc(combinedDest);
        } else {
          setToLoc(gate.toLoc || '');
        }
      }
    } else {
      setOpType('UNLOADING');
      setToLoc('INDORE HUB');
      
      if (specificDest) {
        if (specificDest.unit) handleUnitChange(specificDest.unit);
        setFromLoc(specificDest.location);
      } else {
        if (gate.unit && gate.unit !== 'BOTH' && gate.unit !== 'SHUTTLE') {
          handleUnitChange(gate.unit);
        }
        if (gate.routeType === 'Milk Route' && gate.milkRouteDestinations && gate.milkRouteDestinations.length > 0) {
          const combinedDest = gate.milkRouteDestinations.map(m => m.unit ? \`\${m.location} (\${m.unit})\` : m.location).join(' / ');
          setFromLoc(combinedDest);
        } else {
          setFromLoc(gate.fromLoc || '');
        }
      }
    }`;
content = content.replace(oldHandleGateSelectLogic, newHandleGateSelectLogic);

fs.writeFileSync('src/views/LoadUnloadView.tsx', content);
console.log('LoadUnloadView.tsx updated');
