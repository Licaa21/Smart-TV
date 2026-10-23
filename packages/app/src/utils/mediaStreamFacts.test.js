import {
	audioChannelsName, audioCodecName, channelLayout, formatBitrate, getBitDepth, getFrameRate, getHdrType,
	getResolution, getVideoCodec, videoCodecName
} from './mediaStreamFacts';

describe('formatBitrate', () => {
	it('steps down through the units', () => {
		expect(formatBitrate(5000000)).toBe('5.0 Mbps');
		expect(formatBitrate(128000)).toBe('128 Kbps');
		expect(formatBitrate(500)).toBe('500 bps');
	});

	it('says so when the server gave no rate', () => {
		expect(formatBitrate(0)).toBe('Unknown');
		expect(formatBitrate(undefined)).toBe('Unknown');
	});
});

describe('getHdrType', () => {
	it('names the format rather than just saying HDR', () => {
		expect(getHdrType({VideoRangeType: 'DOVI'})).toBe('Dolby Vision');
		expect(getHdrType({VideoRangeType: 'HDR10Plus'})).toBe('HDR10+');
		expect(getHdrType({VideoRangeType: 'HDR10'})).toBe('HDR10');
	});

	it('names the base layer when the panel cant decode Dolby Vision', () => {
		expect(getHdrType({VideoRangeType: 'DOVIWithELHDR10Plus'}, false)).toBe('HDR10+');
		expect(getHdrType({VideoRangeType: 'DOVIWithHDR10'}, false)).toBe('HDR10');
		expect(getHdrType({VideoRangeType: 'DOVI'}, false)).toBe('Dolby Vision');
		expect(getHdrType({VideoRangeType: 'DOVIWithELHDR10Plus'}, true)).toBe('Dolby Vision');
		expect(getHdrType({VideoRangeType: 'HDR10Plus'}, false)).toBe('HDR10+');
	});

	it('falls back to the coarse field, and to SDR when there is nothing', () => {
		expect(getHdrType({VideoRange: 'HDR'})).toBe('HDR');
		expect(getHdrType({VideoRangeType: 'SDR'})).toBe('SDR');
		expect(getHdrType({})).toBe('SDR');
		expect(getHdrType(null)).toBe('SDR');
	});
});

describe('codecs and channels', () => {
	it('names a video codec with its profile', () => {
		expect(getVideoCodec({Codec: 'hevc', Profile: 'Main 10', Level: 150})).toBe('HEVC Main 10');
		expect(getVideoCodec({Codec: 'h264', Profile: 'High'})).toBe('H.264 High');
		expect(getVideoCodec({Codec: 'av1', Profile: 'Main'})).toBe('AV1 Main');
		expect(getVideoCodec({Codec: 'mpeg2video'})).toBe('MPEG-2');
		expect(getVideoCodec({})).toBeNull();
		expect(getVideoCodec({Codec: 'hevc', Profile: '0'})).toBe('HEVC');
		expect(getVideoCodec({Codec: 'hevc', Profile: 0})).toBe('HEVC');
		expect(getVideoCodec({Codec: 'hevc', Profile: ' '})).toBe('HEVC');
		expect(videoCodecName('h265')).toBe('HEVC');
		expect(videoCodecName('avc')).toBe('H.264');
		expect(videoCodecName('prores')).toBe('PRORES');
	});

	it('names an audio codec the way a receiver does', () => {
		expect(audioCodecName('truehd', 'Dolby TrueHD + Dolby Atmos')).toBe('Dolby TrueHD with Atmos');
		expect(audioCodecName('eac3', 'Dolby Digital Plus + Dolby Atmos')).toBe('Dolby Digital Plus with Atmos');
		expect(audioCodecName('ac3')).toBe('Dolby Digital');
		expect(audioCodecName('dts', 'DTS-HD MA + DTS:X')).toBe('DTS:X');
		expect(audioCodecName('dts', 'DTS-HD MA')).toBe('DTS-HD Master Audio');
		expect(audioCodecName('dts', 'DTS-HD HRA')).toBe('DTS-HD High Resolution');
		expect(audioCodecName('dts', 'DTS')).toBe('DTS');
		expect(audioCodecName('dca')).toBe('DTS');
		expect(audioCodecName('dca', 'DTS-HD MA')).toBe('DTS-HD Master Audio');
		expect(audioCodecName('pcm_s24le')).toBe('PCM');
		expect(audioCodecName('opus')).toBe('Opus');
		expect(audioCodecName('wmapro')).toBe('WMAPRO');
		expect(audioCodecName('')).toBeNull();
	});

	it('says channel counts the way a viewer would', () => {
		expect(audioChannelsName(8)).toBe('7.1 surround');
		expect(audioChannelsName(6)).toBe('5.1 surround');
		expect(audioChannelsName(2)).toBe('Stereo');
		expect(audioChannelsName(1)).toBe('Mono');
		expect(audioChannelsName(3)).toBe('3 channels');
		expect(audioChannelsName(0)).toBeNull();
		expect(channelLayout(8)).toBe('7.1');
		expect(channelLayout(6)).toBe('5.1');
		expect(channelLayout(2)).toBe('Stereo');
	});
});

// The footer leaves a line out entirely rather than printing a placeholder, so these give back
// nothing when the server was silent.
describe('the lines only the details footer reads', () => {
	it('reads what the server gave', () => {
		expect(getResolution({Width: 1920, Height: 1080})).toBe('1920 × 1080');
		expect(getFrameRate({RealFrameRate: 23.976})).toBe('23.976 fps');
		expect(getBitDepth({BitDepth: 10})).toBe('10-bit');
	});

	it('prefers the real frame rate over the average', () => {
		expect(getFrameRate({RealFrameRate: 25, AverageFrameRate: 24})).toBe('25.000 fps');
		expect(getFrameRate({AverageFrameRate: 24})).toBe('24.000 fps');
	});

	it('gives back nothing when it was not told', () => {
		expect(getResolution({Width: 1920})).toBeNull();
		expect(getFrameRate({})).toBeNull();
		expect(getBitDepth({})).toBeNull();
	});
});
