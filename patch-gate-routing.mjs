import fs from 'fs';
const file = './src/views/GateSecurityView.tsx';
let content = fs.readFileSync(file, 'utf8');

const searchLogic = `      // Helper to find free dock based on unit and route index
      const getDockByIndex = (unit: string, routeIndex: number) => {
          const allowedDocks = (unit === 'AHPL') ? ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4'] : ['Dock 7', 'Dock 8', 'Dock 9'];
          return allowedDocks[routeIndex % allowedDocks.length];
      };
      
      let shuttleSteps: any[] = [];
      
      if (routeType === 'Milk Route' && milkRouteDestinations.length > 0) {
          shuttleSteps = milkRouteDestinations.map((dest, idx) => {
              const stepUnit = dest.unit;
              const assignedDock = getDockByIndex(stepUnit, idx);
              return {
                  id: \`STEP-\${Date.now()}-\${idx}\`,
                  unit: stepUnit,
                  bayNo: assignedDock,
                  assignedDock: assignedDock,
                  destination: dest.location,
                  cases: 0,
                  status: 'PENDING'
              };
          });
      } else {
          const stepUnit = loadDivision === 'BOTH' ? 'AIL' : loadDivision;
          const assignedDock = getDockByIndex(stepUnit, 0);
          shuttleSteps = [{
              id: \`STEP-\${Date.now()}-0\`,
              unit: stepUnit,
              bayNo: assignedDock,
              assignedDock: assignedDock,
              destination: toLoc,
              cases: 0,
              status: 'PENDING'
          }];
      }`;

const replaceLogic = `      let ahplCount = 0;
      let ailCount = 0;

      // Helper to find free dock based on unit and sequential count
      const getDockByUnitSeq = (unit: string) => {
          if (unit === 'AHPL') {
              const allowedDocks = ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4'];
              const dock = allowedDocks[ahplCount % allowedDocks.length];
              ahplCount++;
              return dock;
          } else {
              const allowedDocks = ['Dock 7', 'Dock 8', 'Dock 9'];
              const dock = allowedDocks[ailCount % allowedDocks.length];
              ailCount++;
              return dock;
          }
      };
      
      let shuttleSteps: any[] = [];
      
      if (routeType === 'Milk Route' && milkRouteDestinations.length > 0) {
          shuttleSteps = milkRouteDestinations.map((dest, idx) => {
              const stepUnit = dest.unit;
              const assignedDock = getDockByUnitSeq(stepUnit);
              return {
                  id: \`STEP-\${Date.now()}-\${idx}\`,
                  unit: stepUnit,
                  bayNo: assignedDock,
                  assignedDock: assignedDock,
                  destination: dest.location,
                  cases: 0,
                  status: 'PENDING'
              };
          });
      } else {
          const stepUnit = loadDivision === 'BOTH' ? 'AIL' : loadDivision;
          const assignedDock = getDockByUnitSeq(stepUnit);
          shuttleSteps = [{
              id: \`STEP-\${Date.now()}-0\`,
              unit: stepUnit,
              bayNo: assignedDock,
              assignedDock: assignedDock,
              destination: toLoc,
              cases: 0,
              status: 'PENDING'
          }];
      }`;

content = content.replace(searchLogic, replaceLogic);
fs.writeFileSync(file, content);
console.log('patched gate routing');
