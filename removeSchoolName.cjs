const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(dirPath);
  });
}

walk('src', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let newContent = content
      .replace(/INFORMATION AND COMMUNICATION TECHNOLOGY HIGH SCHOOL/g, '')
      .replace(/Information and Communication Technology High School/g, '');
    
    // Also remove any stray dash like " - Information and Communication..."
    newContent = newContent
      .replace(/ - \s*$/gm, '')
      .replace(/-\s*$/gm, '');

    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent);
      console.log('Updated ' + filePath);
    }
  }
});
console.log('Done.');
