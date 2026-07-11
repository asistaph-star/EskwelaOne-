const fs = require('fs');
const path = require('path');

const directoriesToScan = ['src', '.'];
const extensions = ['.ts', '.tsx', '.html', '.css', '.md'];

function walk(dir, callback) {
    fs.readdir(dir, function(err, list) {
        if (err) return callback(err);
        let pending = list.length;
        if (!pending) return callback(null);
        list.forEach(function(file) {
            file = path.resolve(dir, file);
            fs.stat(file, function(err, stat) {
                if (stat && stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
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

    content = content.replace(/EskwelaOne\+/g, 'DigiSkwela');
    content = content.replace(/EskwelaOne⁺/g, 'DigiSkwela');
    content = content.replace(/EskwelaOne/g, 'DigiSkwela');

    content = content.replace(/rgba\(61,8,8/g, 'rgba(10,25,47');
    content = content.replace(/rgba\(26,2,2/g, 'rgba(2,6,23');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
    }
}

directoriesToScan.forEach(dir => {
    if (dir === '.') {
        replaceInFile(path.resolve(__dirname, 'index.html'));
    } else {
        walk(path.resolve(__dirname, dir), (err) => {
            if (err) console.error(err);
        });
    }
});
