const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const results = [];

walkDir('src/app/teacher', function(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;

  const content = fs.readFileSync(filePath, 'utf8');
  
  let isMock = false;
  let mockSource = [];
  let isReal = false;
  let realSource = [];
  let noData = true;

  if (content.includes('shared/constants/seedData')) {
    isMock = true;
    noData = false;
    mockSource.push('seedData.ts');
  }

  // Check for hardcoded arrays/objects assigned to constants usually ALL_CAPS or ending in _DATA
  if (content.match(/(const|let) [A-Z_]+_DATA\s*=\s*\[/)) {
    isMock = true;
    noData = false;
    mockSource.push('Local hardcoded array');
  }

  if (content.includes('apiClient.') || content.includes('academicApi.') || content.includes('gradebookApi.')) {
    isReal = true;
    noData = false;
    realSource.push('apiClient/academicApi/gradebookApi');
  }
  
  if (content.includes('fetch(') || content.includes('axios.')) {
    isReal = true;
    noData = false;
    realSource.push('fetch/axios');
  }

  let status = "Purely presentational (no data)";
  if (isMock && isReal) status = "Partially wired";
  else if (isMock) status = "Fully mock";
  else if (isReal) status = "Fully real";

  let sourceStr = [];
  if (mockSource.length) sourceStr.push(`Mock: ${mockSource.join(', ')}`);
  if (realSource.length) sourceStr.push(`Real: ${realSource.join(', ')}`);

  results.push({
    component: path.basename(filePath),
    filePath: filePath.replace(/\\/g, '/'),
    status: status,
    source: sourceStr.length > 0 ? sourceStr.join(' | ') : "N/A"
  });
});

console.log(JSON.stringify(results, null, 2));
