const fs = require('fs');

let content = fs.readFileSync('src/views/GateSecurityView.tsx', 'utf8');

// The bottom part originally had:
//       </div>
//     </section>
//   );
// };

// We want to replace `</section>` with `</div>` near the end of the file.
content = content.replace('</section>', '</div>');

fs.writeFileSync('src/views/GateSecurityView.tsx', content);
console.log('fixed tags');
