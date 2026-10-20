import sys

with open("src/App.tsx", "r") as f:
    lines = f.readlines()

new_btn = """
                  <button
                    onClick={() => handleSwitchView('mainDashboardView')}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs font-medium transition-colors ${
                      activeView === 'mainDashboardView'
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                    <span>Main Dashboard</span>
                  </button>
"""

# find index of <span>Graphic Analytics</span>
idx = -1
for i, line in enumerate(lines):
    if "<span>Graphic Analytics</span>" in line:
        idx = i
        break

if idx != -1:
    # the button closes on idx + 1
    lines.insert(idx + 2, new_btn)
else:
    print("Not found Graphic Analytics")
    sys.exit(1)

# Now, add it for mobile sidebar too.
# There should be another "Graphic Analytics" in the mobile drawer.
for i in range(idx + 5, len(lines)):
    if "<span>Graphic Analytics</span>" in line:
        idx2 = i
        break
else:
    idx2 = -1

if idx2 != -1:
    lines.insert(idx2 + 2, new_btn)

# Now add the view renderer
# search for {activeView === 'analyticsView' && (
render_idx = -1
for i, line in enumerate(lines):
    if "{activeView === 'analyticsView' && (" in line:
        render_idx = i
        break

if render_idx != -1:
    render_block = """
                {activeView === 'mainDashboardView' && (
                  <MainDashboardView />
                )}
"""
    lines.insert(render_idx, render_block)

with open("src/App.tsx", "w") as f:
    f.writelines(lines)

