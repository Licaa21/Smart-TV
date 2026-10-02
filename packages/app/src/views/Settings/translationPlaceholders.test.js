/* global __dirname */

import fs from 'fs';
import path from 'path';

// The app fills a translated string by replacing its {placeholder} text, so a translation that
// drops one, renames it or turns it into an ICU plural shows the raw braces on screen.

const RESOURCES = path.resolve(__dirname, '../../../resources');
const PLACEHOLDER = /\{[A-Za-z0-9_]+\}/g;

const locales = fs.readdirSync(RESOURCES, {withFileTypes: true})
	.filter((entry) => entry.isDirectory() && fs.existsSync(path.join(RESOURCES, entry.name, 'strings.json')))
	.map((entry) => entry.name);

describe('translations', () => {
	test.each(locales)('%s keeps every placeholder of the English string', (locale) => {
		const strings = JSON.parse(fs.readFileSync(path.join(RESOURCES, locale, 'strings.json'), 'utf8'));
		const broken = Object.entries(strings)
			.filter(([, text]) => typeof text === 'string' && text.trim())
			.filter(([source, text]) => (source.match(PLACEHOLDER) || []).some((token) => !text.includes(token)))
			.map(([source, text]) => `${source} => ${text}`);
		expect(broken).toEqual([]);
	});
});
