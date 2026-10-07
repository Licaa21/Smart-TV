import {audioChannelCap, audioPickCap} from './audioChannelCap';

describe('audioPickCap', () => {
	test('prefers stereo on its own without capping the profile', () => {
		expect(audioPickCap({preferStereoAudio: true})).toBe(2);
		expect(audioChannelCap({preferStereoAudio: true})).toBeNull();
	});

	test('follows the cap when there is one', () => {
		expect(audioPickCap({maxAudioChannels: 6, preferStereoAudio: true})).toBe(6);
		expect(audioPickCap({downmixToStereo: true})).toBe(2);
		expect(audioPickCap({})).toBeNull();
	});
});

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
