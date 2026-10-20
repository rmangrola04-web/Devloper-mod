with open('src/App.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if "                    <span>Main Dashboard</span>\n" == line and "                  </button>\n" == lines[i+1] and "          {/* Sidebar Bottom Utilities */}\n" == lines[i+2]:
        continue
    if "                  </button>\n" == line and "          {/* Sidebar Bottom Utilities */}\n" == lines[i+1]:
        # we skip this button close too since we skipped the span
        continue
    new_lines.append(line)

with open('src/App.tsx', 'w') as f:
    f.writelines(new_lines)
