const fs = require('fs');
const path = require('path');

const directoriesToScan = ['src'];
const extensions = ['.tsx'];

function walk(dir, callback) {
    fs.readdir(dir, function(err, list) {
        if (err) return callback(err);
        let pending = list.length;
        if (!pending) return callback(null);
        list.forEach(function(file) {
            file = path.resolve(dir, file);
            fs.stat(file, function(err, stat) {
                if (stat && stat.isDirectory() && !file.includes('node_modules')) {
                    walk(file, function(err) {
                        if (!--pending) callback(null);
                    });
                } else {
                    const ext = path.extname(file);
                    if (extensions.includes(ext)) {
                        replaceInFile(file);
                    }
                    if (!--pending) callback(null);
                }
            });
        });
    });
}

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Use regex to remove the div block containing /school_bg.jpg
    content = content.replace(/\s*\{\/\*.*?decorative background\s*\*\/\}\s*<div style={{\s*position:[^}]*url\(\/school_bg\.jpg\)[^}]*}}\s*\/>/g, '');
    
    // Fallback if comment is slightly different or missing
    content = content.replace(/\s*<div style={{\s*position:[^}]*url\(\/school_bg\.jpg\)[^}]*}}\s*\/>/g, '');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
    }
}

directoriesToScan.forEach(dir => {
    walk(path.resolve(__dirname, dir), (err) => {
        if (err) console.error(err);
    });
});
