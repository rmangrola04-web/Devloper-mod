const fs = require('fs');
let content = fs.readFileSync('src/views/PlanView.tsx', 'utf-8');

// 1. Remove milkRouteDestinations state
content = content.replace(
  "const [milkRouteDestinations, setMilkRouteDestinations] = useState<string[]>([]);",
  ""
);

// 2. Update csvContent download sample
const searchCsvContent = `    const csvContent =
      'deliveryNo,code,unit,destination,weight,cft,vType,transporter\\n' +
      'DEL-101,C-01,AHPL,MUMBAI,1250,450,32SXL,DHTC\\n' +
      'DEL-102,C-02,AIL,DELHI,1800,600,32MXL,OPM\\n' +
      'DEL-103,C-03,AHPL,AHMEDABAD,950,320,24-9T,ICRL\\n' +
      'DEL-104,C-04,AIL,PUNE,1400,480,32-15T,VARUNA';`;

const replaceCsvContent = `    const csvContent =
      'deliveryNo,code,unit,destination,weight,cft,vType,transporter,tripId\\n' +
      'DEL-101,C-01,AHPL,MUMBAI,1250,450,32SXL,DHTC,\\n' +
      'DEL-102,C-02,AIL,DELHI,1800,600,32MXL,OPM,TRIP-01\\n' +
      'DEL-103,C-03,AHPL,JAIPUR,950,320,32MXL,OPM,TRIP-01\\n' +
      'DEL-104,C-04,AIL,PUNE,1400,480,32-15T,VARUNA,';`;

content = content.replace(searchCsvContent, replaceCsvContent);

// 3. Update handleFileUpload
const searchHandleUpload = `        const newEntries: PlanEntry[] = rows.map((r, idx) => ({
          id: \`PLAN-\${Date.now()}-\${idx}\`,
          deliveryNo: String(r.deliveryNo || r.DeliveryNo || \`DEL-\${Math.floor(1000 + Math.random() * 9000)}\`),
          code: String(r.code || r.Code || 'C-01'),
          unit: String(r.unit || r.Unit || 'AHPL').toUpperCase(),
          destination: String(r.destination || r.Destination || 'MUMBAI').toUpperCase(),
          weight: Number(r.weight || r.Weight || 1000),
          cft: Number(r.cft || r.CFT || 400),
          vType: String(r.vType || r.VType || '32SXL').toUpperCase(),
          transporter: String(r.transporter || r.Transporter || 'DHTC').toUpperCase(),
          status: 'Pending'
        }));`;

const replaceHandleUpload = `        const newEntries: PlanEntry[] = rows.map((r, idx) => {
          const tripIdRaw = r.tripId || r.TripId || r.TripID || r.Route || r.RouteId || r.Vehicle || r.VehicleNo || '';
          const tripIdStr = String(tripIdRaw).trim().toUpperCase();
          return {
            id: \`PLAN-\${Date.now()}-\${idx}\`,
            deliveryNo: String(r.deliveryNo || r.DeliveryNo || \`DEL-\${Math.floor(1000 + Math.random() * 9000)}\`),
            code: String(r.code || r.Code || 'C-01'),
            unit: String(r.unit || r.Unit || 'AHPL').toUpperCase(),
            destination: String(r.destination || r.Destination || 'MUMBAI').toUpperCase(),
            weight: Number(r.weight || r.Weight || 1000),
            cft: Number(r.cft || r.CFT || 400),
            vType: String(r.vType || r.VType || '32SXL').toUpperCase(),
            transporter: String(r.transporter || r.Transporter || 'DHTC').toUpperCase(),
            status: 'Pending',
            ...(tripIdStr ? { tripId: tripIdStr } : {})
          };
        });`;

content = content.replace(searchHandleUpload, replaceHandleUpload);

// 4. Update handlePhotoScan
const searchPhotoScan = `      const simulatedNewEntries: PlanEntry[] = [
        {
          id: \`PLAN-\${Date.now()}-1\`,
          deliveryNo: \`DEL-\${Math.floor(10000 + Math.random() * 90000)}\`,
          code: 'OCR-01',
          unit: 'AHPL',
          destination: 'MUMBAI',
          weight: 1350,
          cft: 450,
          vType: '32SXL',
          transporter: 'DHTC',
          status: 'Pending'
        },
        {
          id: \`PLAN-\${Date.now()}-2\`,
          deliveryNo: \`DEL-\${Math.floor(10000 + Math.random() * 90000)}\`,
          code: 'OCR-02',
          unit: 'AIL',
          destination: 'DELHI',
          weight: 1950,
          cft: 610,
          vType: '32MXL',
          transporter: 'OPM',
          status: 'Pending'
        }
      ];`;

const replacePhotoScan = `      const simulatedNewEntries: PlanEntry[] = [
        {
          id: \`PLAN-\${Date.now()}-1\`,
          deliveryNo: \`DEL-\${Math.floor(10000 + Math.random() * 90000)}\`,
          code: 'OCR-01',
          unit: 'AHPL',
          destination: 'MUMBAI',
          weight: 1350,
          cft: 450,
          vType: '32SXL',
          transporter: 'DHTC',
          status: 'Pending',
          tripId: 'TRIP-SCAN-01'
        },
        {
          id: \`PLAN-\${Date.now()}-2\`,
          deliveryNo: \`DEL-\${Math.floor(10000 + Math.random() * 90000)}\`,
          code: 'OCR-02',
          unit: 'AIL',
          destination: 'PUNE',
          weight: 1950,
          cft: 610,
          vType: '32SXL',
          transporter: 'DHTC',
          status: 'Pending',
          tripId: 'TRIP-SCAN-01'
        }
      ];`;

content = content.replace(searchPhotoScan, replacePhotoScan);

// 5. Update consolidatedGroups
const searchConsolidated = `  // Consolidated Group Summary (grouped by Destination + Transporter + Vehicle Type)
  const consolidatedGroups = React.useMemo(() => {
    const map = new Map<string, { dest: string; transporter: string; vType: string; count: number; totalWeight: number; totalCft: number; status: string; entryIds: string[] }>();
    activePlanEntries.forEach((p) => {
      const isMilkRouteMatch = routeType === 'Milk Route' && milkRouteDestinations.includes(p.destination);
      const key = isMilkRouteMatch ? 'MILK_ROUTE' : \`\${p.destination}_\${p.transporter}_\${p.vType}\`;
      
      if (!map.has(key)) {
        map.set(key, {
          dest: isMilkRouteMatch ? \`Milk Route: \${milkRouteDestinations.join(' + ')}\` : p.destination,
          transporter: isMilkRouteMatch ? p.transporter : p.transporter,
          vType: isMilkRouteMatch ? p.vType : p.vType,
          count: 0,
          totalWeight: 0,
          totalCft: 0,
          status: 'Pending',
          entryIds: []
        });
      }
      
      const item = map.get(key)!;
      item.count += 1;
      item.totalWeight += p.weight || 0;
      item.totalCft += p.cft || 0;
      item.entryIds.push(p.id);
      
      // Update group status to match items (prioritize Confirmed Plan, then Planned, then Pending)
      if (!item.status || item.status === 'Pending') {
         item.status = p.status || 'Pending';
      } else if (item.status === 'Planned' && p.status === 'Confirmed Plan') {
         item.status = 'Confirmed Plan';
      }
    });
    return Array.from(map.values());
  }, [activePlanEntries, routeType, milkRouteDestinations]);`;

const replaceConsolidated = `  // Consolidated Group Summary
  const consolidatedGroups = React.useMemo(() => {
    const map = new Map<string, { dest: string; transporter: string; vType: string; count: number; totalWeight: number; totalCft: number; status: string; entryIds: string[]; isMilkRoute: boolean }>();
    activePlanEntries.forEach((p) => {
      let key = \`\${p.destination}_\${p.transporter}_\${p.vType}\`;
      let isGroupedMilkRoute = false;
      
      if (routeType === 'Milk Route' && p.tripId) {
         key = \`TRIP_\${p.tripId}\`;
         isGroupedMilkRoute = true;
      }
      
      if (!map.has(key)) {
        map.set(key, {
          dest: p.destination,
          transporter: p.transporter,
          vType: p.vType,
          count: 0,
          totalWeight: 0,
          totalCft: 0,
          status: 'Pending',
          entryIds: [],
          isMilkRoute: isGroupedMilkRoute
        });
      } else if (isGroupedMilkRoute) {
        // Concatenate destinations if different
        const item = map.get(key)!;
        const dests = item.dest.split(' + ');
        if (!dests.includes(p.destination)) {
          item.dest = \`\${item.dest} + \${p.destination}\`;
        }
      }
      
      const item = map.get(key)!;
      item.count += 1;
      item.totalWeight += p.weight || 0;
      item.totalCft += p.cft || 0;
      item.entryIds.push(p.id);
      
      if (!item.status || item.status === 'Pending') {
         item.status = p.status || 'Pending';
      } else if (item.status === 'Planned' && p.status === 'Confirmed Plan') {
         item.status = 'Confirmed Plan';
      }
    });
    return Array.from(map.values());
  }, [activePlanEntries, routeType]);`;

content = content.replace(searchConsolidated, replaceConsolidated);

// 6. Remove Milk Route Destination selection UI
const searchUI = `          {routeType === 'Milk Route' && (
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-lg p-3 mt-2">
              <label className="block text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-2">
                Select Destinations to Combine for Milk Route
              </label>
              <div className="flex flex-wrap gap-2">
                {uniqueDestinations.map(dest => {
                  const isChecked = milkRouteDestinations.includes(dest);
                  return (
                    <label 
                      key={dest} 
                      className={\`flex items-center gap-1.5 px-2.5 py-1.5 rounded border cursor-pointer transition-colors \${isChecked ? 'bg-emerald-100 dark:bg-emerald-900/60 border-emerald-400 dark:border-emerald-600 text-emerald-800 dark:text-emerald-300 font-bold' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'}\`}
                    >
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setMilkRouteDestinations(prev => [...prev, dest]);
                          } else {
                            setMilkRouteDestinations(prev => prev.filter(d => d !== dest));
                          }
                        }}
                        className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                      />
                      <span className="text-xs">{dest}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}`;

content = content.replace(searchUI, "");

fs.writeFileSync('src/views/PlanView.tsx', content);
