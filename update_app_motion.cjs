const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

if (!content.includes("import { motion, AnimatePresence } from 'motion/react'")) {
    content = content.replace("import React, { useState, useEffect, useMemo } from 'react';", "import React, { useState, useEffect, useMemo } from 'react';\nimport { motion, AnimatePresence } from 'motion/react';");
}


const oldRenderMainContentStart = `            ) : (
              <>
                {activeView === 'dashboardView' && (`;

const newRenderMainContentStart = `            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeView}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full"
                >
                {activeView === 'dashboardView' && (`;

content = content.replace(oldRenderMainContentStart, newRenderMainContentStart);

const oldRenderMainContentEnd = `                {activeView === 'analyticsView' && (
                  <AnalyticsView
                    planEntries={planEntries}
                    loadEntries={loadEntries}
                    securityLogs={securityLogs}
                    trackingRecords={trackingRecords}
                  />
                )}
              </>
            )}
          </main>`;

const newRenderMainContentEnd = `                {activeView === 'analyticsView' && (
                  <AnalyticsView
                    planEntries={planEntries}
                    loadEntries={loadEntries}
                    securityLogs={securityLogs}
                    trackingRecords={trackingRecords}
                  />
                )}
                </motion.div>
              </AnimatePresence>
            )}
          </main>`;

content = content.replace(oldRenderMainContentEnd, newRenderMainContentEnd);

fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx updated to use motion');
