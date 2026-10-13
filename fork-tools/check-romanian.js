// Checks that every string the app shows has a Romanian one. Run it from the repository root:
//   node fork-tools/check-romanian.js
// It lists the strings the code asks for with $L('...') that are not in resources/strings.json (so no language has
// them), and the strings in resources/strings.json that are not in resources/ro/strings.json. It exits with 1 when
// either list is not empty. Run it after every merge from upstream and after adding any string.
const fs = require('fs');
const path = require('path');

const app = path.join(__dirname, '..', 'packages', 'app');
const english = JSON.parse(fs.readFileSync(path.join(app, 'resources', 'strings.json'), 'utf8'));
const romanian = JSON.parse(fs.readFileSync(path.join(app, 'resources', 'ro', 'strings.json'), 'utf8'));

const literal = /\$L\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
const unescape = (text) => text.replace(/\\(['"\\])/g, '$1');

const sources = [];
const walk = (dir) => {
	fs.readdirSync(dir, {withFileTypes: true}).forEach((entry) => {
		const file = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(file);
		else if (/\.js$/.test(entry.name) && !/\.test\.js$/.test(entry.name)) sources.push(file);
	});
};
walk(path.join(app, 'src'));

const used = new Map();
sources.forEach((file) => {
	const text = fs.readFileSync(file, 'utf8');
	let match;
	literal.lastIndex = 0;
	while ((match = literal.exec(text)) !== null) {
		const key = unescape(match[1] !== undefined ? match[1] : match[2]);
		if (!used.has(key)) used.set(key, path.relative(app, file).replace(/\\/g, '/'));
	}
});

const notListed = [...used].filter(([key]) => !(key in english));
const notTranslated = Object.keys(english).filter((key) => !(key in romanian));

if (notListed.length) {
	console.log('Used in the code but not in resources/strings.json:');
	notListed.forEach(([key, file]) => console.log(`  ${JSON.stringify(key)}  (${file})`));
}
if (notTranslated.length) {
	console.log('In resources/strings.json but not in resources/ro/strings.json:');
	notTranslated.forEach((key) => console.log(`  ${JSON.stringify(key)}`));
}
if (!notListed.length && !notTranslated.length) console.log('Every string has a Romanian one.');
process.exit(notListed.length || notTranslated.length ? 1 : 0);
