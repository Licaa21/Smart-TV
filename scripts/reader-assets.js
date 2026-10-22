const fs = require('fs');
const path = require('path');

const modules = path.resolve(__dirname, '..', 'node_modules');
const from = (...parts) => path.join(modules, ...parts);

// The book readers load these next to the page when a book opens, so the
// libraries stay out of the startup bundle.
const READER_ASSETS = [
	{src: from('epubjs', 'dist', 'epub.legacy.min.js'), name: 'reader/epub.legacy.min.js'},
	{src: from('epubjs', 'license'), name: 'reader/epubjs-LICENSE.txt'},
	{src: from('pdfjs-dist', 'es5', 'build', 'pdf.min.js'), name: 'reader/pdf.min.js'},
	{src: from('pdfjs-dist', 'es5', 'build', 'pdf.worker.min.js'), name: 'reader/pdf.worker.min.js'},
	{src: from('pdfjs-dist', 'LICENSE'), name: 'reader/pdfjs-LICENSE.txt'},
	{src: from('libarchive.js', 'dist', 'worker-bundle.js'), name: 'reader/libarchive-worker.js'},
	{src: from('libarchive.js', 'dist', 'wasm-gen', 'libarchive.wasm'), name: 'reader/wasm-gen/libarchive.wasm'},
	{src: from('libarchive.js', 'LICENSE'), name: 'reader/libarchive-LICENSE.txt'}
];

const copyReaderAssets = (destDir, log) => {
	for (const {src, name} of READER_ASSETS) {
		if (!fs.existsSync(src)) throw new Error(`Book reader asset missing: ${src}. Run npm install.`);
		const dest = path.join(destDir, name);
		fs.mkdirSync(path.dirname(dest), {recursive: true});
		fs.copyFileSync(src, dest);
	}
	log(`Copied ${READER_ASSETS.length} book reader assets`);
};

module.exports = {READER_ASSETS, copyReaderAssets};
