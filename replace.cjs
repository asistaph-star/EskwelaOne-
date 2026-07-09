const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      results.push(file);
    }
  });
  return results;
}
const files = walk('./src').filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  let changed = false;
  
  // Replace section hyphens (e.g. 8-Rizal -> 8 Rizal)
  const regex = /\b(7|8|9|10)-([A-Za-z]+)\b/g;
  const newC = c.replace(regex, '$1 $2').replace(/—/g, '-');
  
  if (c !== newC) {
    fs.writeFileSync(f, newC);
  }
});
console.log('Done!');
