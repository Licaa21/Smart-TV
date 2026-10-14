import {neighbourButton} from './controlRowFocus';

const rowOf = (...html) => {
	const row = document.createElement('div');
	row.innerHTML = html.join('');
	return row;
};

describe('neighbourButton', () => {
	it('is the next or previous button in the row', () => {
		const row = rowOf('<button class="spottable" id="a"></button>', '<div><button class="spottable" id="b"></button></div>', '<button class="spottable" id="c"></button>');
		const [a, b, c] = ['a', 'b', 'c'].map((id) => row.querySelector('#' + id));
		expect(neighbourButton(row, b, 1)).toBe(c);
		expect(neighbourButton(row, b, -1)).toBe(a);
	});

	it('leaves the ends to the caller', () => {
		const row = rowOf('<button class="spottable" id="a"></button>', '<button class="spottable" id="b"></button>');
		expect(neighbourButton(row, row.querySelector('#a'), -1)).toBeNull();
		expect(neighbourButton(row, row.querySelector('#b'), 1)).toBeNull();
	});

	it('steps over a button that cannot take focus', () => {
		const row = rowOf('<button class="spottable" id="a"></button>', '<button class="spottable" id="b" disabled></button>', '<button class="spottable" id="c"></button>');
		expect(neighbourButton(row, row.querySelector('#a'), 1)).toBe(row.querySelector('#c'));
	});

	it('knows nothing of a button from another row', () => {
		const row = rowOf('<button class="spottable"></button>');
		const other = rowOf('<button class="spottable"></button>');
		expect(neighbourButton(row, other.firstChild, 1)).toBeNull();
	});
});
