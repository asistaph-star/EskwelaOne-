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

    // Replace school name
    content = content.replace(/SINDALAN NATIONAL HIGH SCHOOL/g, 'INFORMATION AND COMMUNICATION TECHNOLOGY HIGH SCHOOL');
    content = content.replace(/Sindalan National High School/g, 'Information and Communication Technology High School');

    // Replace DigiSkwela+
    content = content.replace(/DigiSkwela<sup[^>]*>\+<\/sup>/g, 'DigiSkwela');

    // Replace LoginScreen icon
    content = content.replace(/<div style={{ width: 38, height: 38, borderRadius: 8, background: [^<]+<BookMarked[^>]+><\/div>\s*/g, '');
    
    // Replace sidebars icon (E1 inside div)
    content = content.replace(/<div style={{\s*width: 34, height: 34, borderRadius: 8,\s*background:[^}]+}}>\s*<span[^>]+>E1<\/span>\s*<\/div>\s*/g, '');

    // Replace sidebars icon (BookMarked inside div if they exist)
    content = content.replace(/<div style={{\s*width: 34, height: 34, borderRadius: 8,\s*background:[^}]+}}>\s*<BookMarked[^>]+>\s*<\/div>\s*/g, '');

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
