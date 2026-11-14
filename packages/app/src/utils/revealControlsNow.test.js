import {concealControlsNow, revealControlsNow} from './revealControlsNow';

describe('revealControlsNow', () => {
	afterEach(() => { document.body.innerHTML = ''; });

	it('puts the visible class on the controls at once', () => {
		document.body.innerHTML = '<div data-player-controls="video" class="controls"></div>';
		expect(revealControlsNow('visible')).toBe(true);
		expect(document.querySelector('[data-player-controls]').classList.contains('visible')).toBe(true);
	});

	it('leaves controls that are already up alone', () => {
		document.body.innerHTML = '<div data-player-controls="video" class="controls visible"></div>';
		expect(revealControlsNow('visible')).toBe(false);
	});

	it('does nothing when there are no controls on screen or no class is given', () => {
		expect(revealControlsNow('visible')).toBe(false);
		document.body.innerHTML = '<div data-player-controls="video"></div>';
		expect(revealControlsNow('')).toBe(false);
		expect(revealControlsNow(undefined)).toBe(false);
	});
});

describe('revealControlsNow and the other controls on the page', () => {
	afterEach(() => { document.body.innerHTML = ''; });

	it('leaves the music player controls and dimmed controls alone', () => {
		document.body.innerHTML = '<div data-player-controls="audio" id="a"></div><div data-player-controls="dimmed" id="d"></div>';
		expect(revealControlsNow('visible')).toBe(false);
		expect(document.getElementById('a').className).toBe('');
		expect(document.getElementById('d').className).toBe('');
	});

	it('takes the class off again when the state says the controls are not shown', () => {
		document.body.innerHTML = '<div data-player-controls="video" class="controls visible"></div>';
		expect(concealControlsNow('visible', true)).toBe(false);
		expect(concealControlsNow('visible', false)).toBe(true);
		expect(document.querySelector('[data-player-controls]').classList.contains('visible')).toBe(false);
		expect(concealControlsNow('visible', false)).toBe(false);
	});
});
