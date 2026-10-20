import fs from 'fs';
const file = './src/views/LiveDocksView.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldClick = `                  onClick={() => {
                    if (isActive) {
                      if (isPending) setStartingStep({ entry: record, index });
                      else if (step.status === 'IN-PROGRESS') setFinishingStep({ entry: record, index });
                    }
                  }}`;

const newClick = `                  onClick={() => {
                    if (isActive) {
                      if (isPending) setStartingStep({ entry: record, index });
                      else if (step.status === 'IN-PROGRESS') setFinishingStep({ entry: record, index });
                    } else if (isCompleted) {
                      setFinishingStep({ entry: record, index });
                    }
                  }}`;

content = content.replace(oldClick, newClick);

fs.writeFileSync(file, content);
console.log('patched LiveDocksView onClick');
