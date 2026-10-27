import {FOLLOWERS, HIDDEN, followerSpot, placeFollower} from './followerPlacement';

const screen = {screenWidth: 1920, screenHeight: 1080, scale: 1};
const rect = (left, top, width, height) => ({left, top, width, height});
// A poster parked at the start of a row, a top bar button and a sidebar item.
const card = {...screen, landing: 'card', rect: rect(120, 400, 240, 360)};
const button = {...screen, landing: 'below', rect: rect(800, 40, 70, 70)};
const item = {...screen, landing: 'right', rect: rect(20, 300, 260, 60), navRight: 300};

describe('FOLLOWERS', () => {
	test('each holiday brings its own follower and the others none', () => {
		expect(FOLLOWERS).toEqual({
			halloween: ['planchette'],
			valentines: ['cupidArrow'],
			fireworks: ['sparkler'],
			christmas: ['sleigh'],
			easter: ['bunnyEars', 'easterEgg'],
			lunar: ['lantern'],
			diwali: ['diya'],
			pride: ['rainbow']
		});
		for (const effect of ['snow', 'confetti', 'leaves', 'petals', 'fireflies', 'none']) {
			expect(FOLLOWERS[effect]).toBeUndefined();
		}
	});
});

describe('followerSpot', () => {
	test('a pointer waits left of the artwork, pointing right with its tip just onto it', () => {
		for (const [style, reach] of [['planchette', 40], ['cupidArrow', 50], ['sparkler', 33.4]]) {
			const spot = followerSpot(style, card);
			expect(spot.y).toBe(580);
			expect(spot.angle).toBeCloseTo(90);
			const tip = spot.x + reach;
			expect(tip - 120).toBeCloseTo(6.7, 0);
		}
	});

	test('a pointer sits under a top bar button pointing up, and right of the sidebar pointing left', () => {
		const below = followerSpot('planchette', button);
		expect(below.x).toBe(835);
		expect(below.y - 40 - 110).toBeCloseTo(10, 0);
		expect(below.angle).toBeCloseTo(0);

		const right = followerSpot('planchette', item);
		expect(right.x).toBeCloseTo(380, 0);
		expect(right.y).toBe(330);
		expect(right.angle).toBeCloseTo(-90);
	});

	test('the sleigh puts its front onto the card, under a button and right of the sidebar', () => {
		const onCard = followerSpot('sleigh', card);
		expect(onCard.x + 53.4 - 120).toBeCloseTo(10, 0);
		expect(onCard.y).toBe(580);
		expect(followerSpot('sleigh', button)).toEqual({x: 835, y: expect.closeTo(152.1, 0)});
		expect(followerSpot('sleigh', item).x - 300).toBeCloseTo(66.8, 0);
	});

	test('bunny ears stand on the top edge of the artwork, toward its right', () => {
		const ears = followerSpot('bunnyEars', card);
		expect(ears.y).toBe(400);
		expect(360 - ears.x).toBeCloseTo(66.8, 0);
		const narrow = followerSpot('bunnyEars', {...card, rect: rect(120, 400, 150, 225)});
		expect(270 - narrow.x).toBeCloseTo(45, 5);
	});

	test('easter keeps the ears on cards and the egg on the nav', () => {
		expect(followerSpot('bunnyEars', button)).toBeNull();
		expect(followerSpot('bunnyEars', item)).toBeNull();
		expect(followerSpot('easterEgg', card)).toBeNull();
		expect(followerSpot('easterEgg', button).x).toBe(835);
		expect(followerSpot('easterEgg', item).x - 300).toBeCloseTo(66.8, 0);
	});

	test('the lantern hangs by its cord beside the artwork, under a button or by the sidebar item', () => {
		const onCard = followerSpot('lantern', card);
		expect(120 - onCard.x).toBeCloseTo(40, 0);
		expect(onCard.y - 400).toBeCloseTo(3.3, 0);
		expect(followerSpot('lantern', button)).toEqual({x: 835, y: expect.closeTo(113.3, 0)});
		expect(followerSpot('lantern', item).y).toBe(300);
	});

	test('the diya rests by the bottom of the artwork', () => {
		const diya = followerSpot('diya', card);
		expect(120 - diya.x).toBeCloseTo(43.4, 0);
		expect(diya.y).toBe(760);
	});

	test('the rainbow underlines what has focus at its width', () => {
		expect(followerSpot('rainbow', card)).toEqual({x: 240, y: expect.closeTo(770, 0), width: 240, thickness: expect.closeTo(10, 0)});
		expect(followerSpot('rainbow', button).width).toBe(70);
	});

	test('fades out for the media bar or anything off screen', () => {
		expect(followerSpot('planchette', {...card, rect: rect(0, 100, 1800, 600)})).toBeNull();
		expect(followerSpot('planchette', {...card, rect: rect(120, 1100, 240, 360)})).toBeNull();
		expect(followerSpot('planchette', {...card, rect: rect(120, 400, 0, 0)})).toBeNull();
		// A wide top bar button isn't the media bar.
		expect(followerSpot('planchette', {...button, rect: rect(0, 40, 1800, 70)})).not.toBeNull();
	});

	test('keeps the whole drawing on screen', () => {
		const spot = followerSpot('planchette', {...card, rect: rect(0, 0, 240, 360)});
		expect(spot.x).toBeGreaterThanOrEqual(46.7);
		const lantern = followerSpot('lantern', {...card, rect: rect(300, 1000, 240, 60)});
		expect(lantern.y + 76.8).toBeLessThanOrEqual(1080);
	});

	test('follows the UI scale', () => {
		const spot = followerSpot('planchette', {...card, scale: 0.5});
		expect(spot.x + 20 - 120).toBeCloseTo(3.3, 0);
	});
});

describe('placeFollower', () => {
	test('appears where it lands, then glides', () => {
		const first = placeFollower('planchette', card, HIDDEN);
		expect(first).toMatchObject({shown: true, glide: false, angle: 90});
		const next = placeFollower('planchette', button, first);
		expect(next).toMatchObject({shown: true, glide: true, x: 835});
	});

	test('keeps the same state when focus rests on the same spot', () => {
		const first = placeFollower('planchette', card, HIDDEN);
		expect(placeFollower('planchette', {...card}, first)).toBe(first);
	});

	test('fades out in place and appears again without gliding', () => {
		const shown = placeFollower('planchette', card, HIDDEN);
		const hidden = placeFollower('planchette', null, shown);
		expect(hidden).toMatchObject({shown: false, x: shown.x, y: shown.y});
		expect(placeFollower('planchette', null, hidden)).toBe(hidden);
		expect(placeFollower('planchette', button, hidden)).toMatchObject({shown: true, glide: false});
	});

	test('turns the short way round', () => {
		const onCard = placeFollower('planchette', card, HIDDEN);
		const onSidebar = placeFollower('planchette', item, onCard);
		// From pointing right to pointing left, through up rather than all the way round.
		expect(Math.abs(onSidebar.angle - onCard.angle)).toBeLessThanOrEqual(180);
		const prev = {...onCard, angle: 350};
		expect(placeFollower('planchette', button, prev).angle).toBeCloseTo(360);
	});

	test('the sleigh faces the card, the sidebar, or the way it flew to a button', () => {
		const onCard = placeFollower('sleigh', card, HIDDEN);
		expect(onCard.facing).toBe(1);
		expect(placeFollower('sleigh', item, onCard).facing).toBe(-1);
		const rightward = placeFollower('sleigh', button, onCard);
		expect(rightward.facing).toBe(1);
		const leftward = placeFollower('sleigh', {...button, rect: rect(300, 40, 70, 70)}, {...rightward});
		expect(leftward.facing).toBe(-1);
		const below = placeFollower('sleigh', {...button, rect: rect(300, 40, 70, 70)}, HIDDEN);
		expect(below.facing).toBe(1);
	});

	test('the sleigh tips its nose up climbing and down diving', () => {
		const low = placeFollower('sleigh', {...card, rect: rect(120, 700, 240, 300)}, HIDDEN);
		const climb = placeFollower('sleigh', card, low);
		expect(climb.swing).toBe('tiltCcw');
		expect(placeFollower('sleigh', {...card, rect: rect(120, 700, 240, 300)}, climb).swing).toBe('tiltCw');
	});

	test('the lantern swings after a move along x, and restarts its swing each time', () => {
		const onCard = placeFollower('lantern', card, HIDDEN);
		expect(onCard.swing).toBe('');
		const moved = placeFollower('lantern', {...card, rect: rect(500, 400, 240, 360)}, onCard);
		expect(moved.swing).toBe('swingCw');
		expect(moved.move).toBe(onCard.move + 1);
		const back = placeFollower('lantern', card, moved);
		expect(back.swing).toBe('swingCcw');
		expect(back.move).toBe(moved.move + 1);
		const down = placeFollower('lantern', {...card, rect: rect(120, 800, 240, 200)}, back);
		expect(down.swing).toBe('');
	});

	test('the egg rocks whenever it lands', () => {
		const first = placeFollower('easterEgg', button, HIDDEN);
		expect(placeFollower('easterEgg', {...button, rect: rect(900, 40, 70, 70)}, first).swing).toBe('rockCcw');
		expect(placeFollower('easterEgg', {...button, rect: rect(700, 40, 70, 70)}, first).swing).toBe('rockCw');
	});

	test('easter hands over between the ears and the egg', () => {
		const ears = placeFollower('bunnyEars', card, HIDDEN);
		const egg = placeFollower('easterEgg', card, HIDDEN);
		expect(ears.shown).toBe(true);
		expect(egg.shown).toBe(false);
		expect(placeFollower('bunnyEars', button, ears).shown).toBe(false);
		expect(placeFollower('easterEgg', button, egg).shown).toBe(true);
	});

	test('the rainbow follows the width of what it underlines', () => {
		const first = placeFollower('rainbow', card, HIDDEN);
		expect(first.width).toBe(240);
		const wider = placeFollower('rainbow', {...card, rect: rect(120, 400, 420, 236)}, first);
		expect(wider).toMatchObject({width: 420, glide: true});
	});
});
