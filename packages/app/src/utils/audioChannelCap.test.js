import {audioChannelCap} from './audioChannelCap';

describe('audioChannelCap', () => {
	test('downmix means stereo whatever the cap says', () => {
		expect(audioChannelCap({downmixToStereo: true, maxAudioChannels: 6})).toBe(2);
	});

	test('the Max Audio Channels number stands, and Auto Detect is no cap', () => {
		expect(audioChannelCap({maxAudioChannels: 2})).toBe(2);
		expect(audioChannelCap({maxAudioChannels: 'auto'})).toBeNull();
		expect(audioChannelCap({maxAudioChannels: 0})).toBeNull();
		expect(audioChannelCap({})).toBeNull();
		expect(audioChannelCap(null)).toBeNull();
	});
});
