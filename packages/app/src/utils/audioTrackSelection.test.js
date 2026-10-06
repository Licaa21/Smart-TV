import {selectPreferredAudioStream, isCommentaryAudioStream, isAudioDescriptionAudioStream} from './audioTrackSelection';

const track = (index, language, extra) => ({index, language, channels: 2, ...extra});

describe('selectPreferredAudioStream', () => {
	test('takes the preferred language over a louder track in another one', () => {
		const list = [track(1, 'fre', {channels: 6, isDefault: true}), track(2, 'ger')];
		expect(selectPreferredAudioStream(list, {audioLanguage: 'deu'})).toBe(list[1]);
	});

	test('matches German however the file spells it', () => {
		for (const tag of ['de', 'deu', 'ger', 'de-DE']) {
			const list = [track(1, 'fra', {channels: 6}), track(2, tag)];
			expect(selectPreferredAudioStream(list, {audioLanguage: 'deu'})).toBe(list[1]);
		}
	});

	test('falls to the second language, then English, then the best of the rest', () => {
		const ger = track(2, 'ger');
		const eng = track(3, 'eng');
		const fre = track(4, 'fre', {channels: 6});
		expect(selectPreferredAudioStream([fre, ger, eng], {audioLanguage: 'jpn', fallbackAudioLanguage: 'deu'})).toBe(ger);
		expect(selectPreferredAudioStream([fre, eng], {audioLanguage: 'jpn', fallbackAudioLanguage: 'kor'})).toBe(eng);
		expect(selectPreferredAudioStream([track(1, 'ita'), fre], {audioLanguage: 'jpn'})).toBe(fre);
	});

	test('with no preference at all the loudest track wins, which is the old complaint', () => {
		const list = [track(1, 'fre', {channels: 6}), track(2, 'ger')];
		expect(selectPreferredAudioStream(list, {})).toBe(list[0]);
	});

	test('surround beats stereo inside the chosen language', () => {
		const list = [track(1, 'ger', {channels: 2}), track(2, 'ger', {channels: 6})];
		expect(selectPreferredAudioStream(list, {audioLanguage: 'deu'})).toBe(list[1]);
	});

	test('commentary is skipped unless it is all there is', () => {
		const commentary = track(1, 'eng', {displayTitle: 'English Director Commentary', channels: 6});
		const plain = track(2, 'eng');
		expect(selectPreferredAudioStream([commentary, plain], {audioLanguage: 'eng'})).toBe(plain);
		expect(selectPreferredAudioStream([commentary], {audioLanguage: 'eng'})).toBe(commentary);
	});

	test('audio description is skipped unless it is asked for', () => {
		const described = track(1, 'eng', {isAudioDescription: true, channels: 6});
		const plain = track(2, 'eng');
		expect(selectPreferredAudioStream([described, plain], {audioLanguage: 'eng'})).toBe(plain);
		expect(selectPreferredAudioStream([described, plain], {audioLanguage: 'eng', preferAudioDescription: true})).toBe(described);
	});

	test('the default track shortcut wins over the language match', () => {
		const list = [track(1, 'fre', {isDefault: true}), track(2, 'ger')];
		expect(selectPreferredAudioStream(list, {audioLanguage: 'deu', preferDefaultAudioTrack: true})).toBe(list[0]);
	});

	test('the default flag only breaks a tie when default tracks are not preferred', () => {
		const list = [track(1, 'ger', {channels: 2, isDefault: true}), track(2, 'ger', {channels: 6})];
		expect(selectPreferredAudioStream(list, {audioLanguage: 'deu'})).toBe(list[1]);
	});

	test('an explicit pick wins over everything', () => {
		const list = [track(1, 'ger'), track(2, 'fre')];
		expect(selectPreferredAudioStream(list, {audioLanguage: 'deu', explicitAudioIndex: 2})).toBe(list[1]);
	});

	test('an explicit pick that is gone falls back to the language match', () => {
		const list = [track(1, 'ger'), track(2, 'fre')];
		expect(selectPreferredAudioStream(list, {audioLanguage: 'deu', explicitAudioIndex: 99})).toBe(list[0]);
	});

	test('the last hand picked track is kept inside its language, by index then by name', () => {
		const list = [track(1, 'ger', {channels: 6}), track(2, 'ger', {title: 'Kommentar'})];
		expect(selectPreferredAudioStream(list, {audioLanguage: 'deu', lastExplicitAudioIndex: 2})).toBe(list[1]);
		expect(selectPreferredAudioStream(list, {audioLanguage: 'deu', lastExplicitAudioTitle: 'Kommentar'})).toBe(list[1]);
	});

	test('nothing to choose from has no answer', () => {
		expect(selectPreferredAudioStream([], {})).toBeNull();
		expect(selectPreferredAudioStream(null, {})).toBeNull();
	});
});

describe('track labelling', () => {
	test('commentary is read from any of the three title fields and the flag', () => {
		expect(isCommentaryAudioStream({displayTitle: 'Commentary'})).toBe(true);
		expect(isCommentaryAudioStream({title: 'Director Commentary'})).toBe(true);
		expect(isCommentaryAudioStream({name: 'Commentaries'})).toBe(true);
		expect(isCommentaryAudioStream({isCommentary: true})).toBe(true);
		expect(isCommentaryAudioStream({displayTitle: 'English 5.1'})).toBe(false);
	});

	test('audio description is read the same way', () => {
		expect(isAudioDescriptionAudioStream({title: 'Audio Description'})).toBe(true);
		expect(isAudioDescriptionAudioStream({isAudioDescription: true})).toBe(true);
		expect(isAudioDescriptionAudioStream({displayTitle: 'German'})).toBe(false);
	});
});

describe('audioCodecOrder', () => {
	const truehd = track(1, 'eng', {codec: 'truehd', channels: 8});
	const eac3 = track(2, 'eng', {codec: 'eac3', channels: 6});
	const ac3 = track(3, 'eng', {codec: 'ac-3', channels: 6});
	const aac = track(4, 'eng', {codec: 'aac', channels: 2});
	const quality = ['truehd', 'dtshd', 'dts', 'eac3', 'ac3', 'flac', 'pcm', 'opus', 'aac', 'vorbis', 'mp3'];
	const english = {audioLanguage: 'eng', audioCodecOrder: quality};

	test('ranks tied tracks by the viewer codec order before channel count', () => {
		expect(selectPreferredAudioStream([aac, ac3, eac3, truehd], english)).toBe(truehd);
		expect(selectPreferredAudioStream([truehd, eac3, aac], {audioLanguage: 'eng', audioCodecOrder: ['aac', 'eac3', 'truehd']})).toBe(aac);
		expect(selectPreferredAudioStream([truehd, ac3, eac3], {audioLanguage: 'eng', audioCodecOrder: ['ac3', 'eac3', 'truehd']})).toBe(ac3);
	});

	test('a codec the order leaves out ranks last, and spellings of one codec rank together', () => {
		const dca = track(5, 'eng', {codec: 'dca', channels: 6});
		const odd = track(6, 'eng', {codec: 'wmapro', channels: 8});
		expect(selectPreferredAudioStream([odd, ac3, dca], english)).toBe(dca);
		expect(selectPreferredAudioStream([odd, aac], english)).toBe(aac);
	});

	test('DTS-HD is told apart from the DTS core by its profile', () => {
		const core = track(7, 'eng', {codec: 'dts', profile: 'DTS', channels: 6});
		const hd = track(8, 'eng', {codec: 'dts', profile: 'DTS-HD MA', channels: 6});
		expect(selectPreferredAudioStream([core, hd], english)).toBe(hd);
		expect(selectPreferredAudioStream([hd, core], {audioLanguage: 'eng', audioCodecOrder: ['dts', 'dtshd']})).toBe(core);
	});

	test('the preferred language always beats the codec order', () => {
		const ger = track(9, 'ger', {codec: 'aac'});
		expect(selectPreferredAudioStream([truehd, ger], {...english, audioLanguage: 'deu'})).toBe(ger);
		const gerTruehd = track(10, 'ger', {codec: 'truehd'});
		expect(selectPreferredAudioStream([gerTruehd, ger, truehd], {...english, audioLanguage: 'deu'})).toBe(gerTruehd);
	});

	test('without an order the channel count decides, as before', () => {
		expect(selectPreferredAudioStream([aac, eac3, truehd], {audioLanguage: 'eng'})).toBe(truehd);
		expect(selectPreferredAudioStream([aac, ac3, eac3], {audioLanguage: 'eng'})).toBe(eac3);
	});
});

describe('without a saved codec order', () => {
	test('tracks rank by channel count alone, as before the setting existed', () => {
		const tracks = [
			{index: 0, language: 'eng', codec: 'ac3', channels: 6},
			{index: 1, language: 'eng', codec: 'truehd', channels: 6}
		];
		expect(selectPreferredAudioStream(tracks, {audioLanguage: 'eng'})).toBe(tracks[0]);
	});
});

describe('codec order edge cases', () => {
	const make = (index, language, codec, channels = 6) => ({index, language, codec, channels});

	test('a codec left out of the saved order ranks after every one named', () => {
		const ac3 = make(0, 'eng', 'ac3');
		const aac = make(1, 'eng', 'aac');
		expect(selectPreferredAudioStream([ac3, aac], {audioLanguage: 'eng', audioCodecOrder: ['truehd', 'aac']})).toBe(aac);
	});

	test('an empty saved order is no order', () => {
		const first = make(0, 'eng', 'ac3');
		const second = make(1, 'eng', 'truehd');
		expect(selectPreferredAudioStream([first, second], {audioLanguage: 'eng', audioCodecOrder: []})).toBe(first);
	});

	test('with no track in a named language the codec order does not pick the language', () => {
		const german = make(0, 'ger', 'ac3');
		const french = make(1, 'fre', 'truehd');
		expect(selectPreferredAudioStream([german, french], {audioLanguage: 'jpn', audioCodecOrder: ['truehd', 'ac3']})).toBe(german);
	});

	test('preferring the default track does not let the codec order choose between languages', () => {
		const german = {index: 0, language: 'ger', codec: 'ac3', channels: 6, isDefault: true};
		const french = {index: 1, language: 'fre', codec: 'truehd', channels: 6, isDefault: true};
		expect(selectPreferredAudioStream([german, french], {preferDefaultAudioTrack: true, audioCodecOrder: ['truehd', 'ac3']})).toBe(german);
	});
});

describe('selectPreferredAudioStream with a channel cap', () => {
	const ac3Surround = {index: 3, language: 'eng', codec: 'ac3', channels: 6};
	const ac3Stereo = {index: 4, language: 'eng', codec: 'ac3', channels: 2};
	const truehd = {index: 2, language: 'eng', codec: 'truehd', channels: 8};

	test('stereo cap takes the track that fits over the surround one of the same codec', () => {
		expect(selectPreferredAudioStream([ac3Surround, ac3Stereo], {audioLanguage: 'eng', maxAudioChannels: 2})).toBe(ac3Stereo);
		expect(selectPreferredAudioStream([ac3Surround, ac3Stereo], {audioLanguage: 'eng', downmixToStereo: true})).toBe(ac3Stereo);
	});

	test('with no cap the surround track still wins', () => {
		expect(selectPreferredAudioStream([ac3Surround, ac3Stereo], {audioLanguage: 'eng'})).toBe(ac3Surround);
		expect(selectPreferredAudioStream([ac3Surround, ac3Stereo], {audioLanguage: 'eng', maxAudioChannels: 'auto'})).toBe(ac3Surround);
	});

	test('the codec order still comes first', () => {
		const flacStereo = {index: 5, language: 'eng', codec: 'flac', channels: 2};
		expect(selectPreferredAudioStream([ac3Stereo, truehd, flacStereo], {audioLanguage: 'eng', maxAudioChannels: 2, audioCodecOrder: ['truehd', 'flac', 'ac3']})).toBe(truehd);
	});

	test('when nothing fits the nearest track goes first', () => {
		const eac3 = {index: 6, language: 'eng', codec: 'ac3', channels: 8};
		expect(selectPreferredAudioStream([eac3, ac3Surround], {audioLanguage: 'eng', maxAudioChannels: 2})).toBe(ac3Surround);
	});
});

