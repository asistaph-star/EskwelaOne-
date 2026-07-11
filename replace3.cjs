const fs = require('fs');
const path = require('path');

const directoriesToScan = ['src'];
const extensions = ['.tsx', '.ts'];

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

    // LoginScreen.tsx icon
    content = content.replace(/<div style={{\s*width: 38[^<]+<BookMarked[^>]+>\s*<\/div>\s*/g, '');

    // Sidebars icons (E1)
    content = content.replace(/<div style={{\s*width: 34[^<]+<span[^>]+>E1<\/span>\s*<\/div>\s*/g, '');

    // Sidebars icons (BookMarked inside div)
    content = content.replace(/<div style={{\s*width: 34[^<]+<BookMarked[^>]+>\s*<\/div>\s*/g, '');

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
