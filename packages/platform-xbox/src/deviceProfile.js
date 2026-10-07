// What WebView2 on Xbox can play, and the Jellyfin profile that says so.
//
// A format is offered only when both the WebView and the console say they take
// it: canPlayType answers for the WebView, and the host reports what the
// hardware decodes and what the display shows. Without the host's word the
// profile stays at 1080p H.264, which every console plays.
//
// What is offered beyond that follows what was played on an Xbox One S, where the
// WebView's answers for sound proved true: AC-3, E-AC-3, Opus and Vorbis played
// where it said so, and DTS, which it said no to, played the picture in silence, as
// TrueHD did. HDR, VP9 and AV1 arent offered, since only light test clips of those
// have been played, which dont say how a real file fares.
//
// The WebView is given no hardware decoder there, so H.264 is decoded by the
// processor and stays at 1080p. HEVC goes through the console's own decoder, and is
// the only codec offered in 4K.
//
// On the Series consoles the WebView says yes to HEVC every way it can be asked and
// then turns the decoder away, so a console whose decoder has refused two different
// files is taken at its word and offered H.264 from then on.
//
// With the console's own player none of the WebView's answers matter: HEVC goes by
// the host's word alone, HDR10 by the display's, every common sound format is decoded
// by the player itself, and WebM and MPEG-TS files are read as they are.
import {bootData} from './bridge';
import {modelName} from './deviceInfo';
import {isNativePlayerEnabled} from './nativeVideo';

const HEVC_REFUSALS_KEY = 'moonfin:xboxHevcRefusals';
const HEVC_REFUSAL_LIMIT = 2;

// Dolby Vision over an HDR10 base layer plays as HDR10, the player decodes the base and
// leaves the Dolby Vision data alone. Profile 5 has no such base and stays a transcode.
const HDR10_RANGE_TYPES = 'SDR|HDR10|HDR10Plus|DOVIWithHDR10|DOVIWithHDR10Plus|DOVIWithEL|DOVIWithELHDR10Plus|DOVIInvalid';

let cachedCapabilities = null;
let cachedForNativePlayer = null;
let probeElement = null;

const canPlay = (type) => {
	if (!probeElement) probeElement = document.createElement('video');
	return !!probeElement.canPlayType(type).replace(/no/, '');
};

const hevcRefusals = () => {
	try {
		const kept = JSON.parse(window.localStorage.getItem(HEVC_REFUSALS_KEY));
		return Array.isArray(kept) ? kept : [];
	} catch (e) {
		return [];
	}
};

export const clearCapabilitiesCache = () => {
	cachedCapabilities = null;
};

export const noteHevcRefusal = (sourceId) => {
	const refused = hevcRefusals();
	if (!sourceId || refused.includes(sourceId)) return;
	refused.push(sourceId);
	try {
		window.localStorage.setItem(HEVC_REFUSALS_KEY, JSON.stringify(refused));
	} catch (e) {
		// Without storage the console just doesnt remember
	}
	if (refused.length >= HEVC_REFUSAL_LIMIT) clearCapabilitiesCache();
};

export const detectXboxVersion = () => bootData()?.os?.version || '';

export const getDeviceCapabilities = async () => {
	const nativePlayer = isNativePlayerEnabled();
	if (cachedCapabilities && cachedForNativePlayer === nativePlayer) return cachedCapabilities;

	const protection = bootData()?.protection || {};
	const display = bootData()?.display || {};
	const version = detectXboxVersion();
	const hevc = nativePlayer
		? protection.hevc === true
		: protection.hevc === true && canPlay('video/mp4; codecs="hvc1.1.6.L120.90"') && hevcRefusals().length < HEVC_REFUSAL_LIMIT;

	cachedForNativePlayer = nativePlayer;
	cachedCapabilities = {
		modelName: modelName() || 'Xbox',
		xboxVersionDisplay: version ? `Xbox OS ${version}` : 'Xbox OS',
		nativePlayer,

		// The page is laid out at 1080p whatever the display, so 4K is the host's to report
		uhd: hevc && protection.uhd === true,
		uhd8K: false,

		hdr10: nativePlayer && Array.isArray(display.hdr) && display.hdr.includes('hdr10'),
		hdr10Plus: false,
		hlg: false,
		dolbyVision: false,

		hevc,
		av1: false,
		vp9: false,

		ac3: nativePlayer || canPlay('audio/mp4; codecs="ac-3"'),
		eac3: nativePlayer || canPlay('audio/mp4; codecs="ec-3"'),
		// The WebView plays a file with DTS or TrueHD in it without a sound, whatever it is asked
		dts: nativePlayer,
		flac: true,
		opus: nativePlayer || canPlay('audio/webm; codecs="opus"'),
		vorbis: nativePlayer || canPlay('audio/webm; codecs="vorbis"'),

		mkv: true,
		webm: nativePlayer,
		ts: nativePlayer,

		nativeHls: nativePlayer || canPlay('application/vnd.apple.mpegurl'),

		// A console is often on a wireless link that carries a fraction of what it plays
		fitsBitrateToLink: true,
		// The WebView's HEVC decoder shows some files with a quarter of their frames missing
		watchesDroppedFrames: !nativePlayer
	};

	return cachedCapabilities;
};

const buildVideoCodecs = (caps) => (caps.hevc ? ['h264', 'hevc'] : ['h264']);

const buildAudioCodecs = (caps) => {
	const codecs = ['aac', 'mp3', 'flac'];
	if (caps.ac3) codecs.push('ac3');
	if (caps.eac3) codecs.push('eac3');
	if (caps.opus) codecs.push('opus');
	if (caps.dts) codecs.push('dts', 'truehd');
	return codecs;
};

const buildDirectPlayProfiles = (caps) => {
	const videoCodecs = buildVideoCodecs(caps).join(',');
	const audioCodecs = buildAudioCodecs(caps).join(',');

	// Matroska also carries Vorbis and plain PCM, which MP4 doesnt
	const mkvAudioCodecs = audioCodecs + (caps.vorbis ? ',vorbis' : '') + ',pcm_s16le,pcm_s24le';

	const profiles = [
		{Container: 'mp4,m4v', Type: 'Video', VideoCodec: videoCodecs, AudioCodec: audioCodecs},
		{Container: 'mkv', Type: 'Video', VideoCodec: videoCodecs, AudioCodec: mkvAudioCodecs},
		{Container: 'mov', Type: 'Video', VideoCodec: videoCodecs, AudioCodec: 'aac'},
		...(caps.webm ? [{Container: 'webm', Type: 'Video', VideoCodec: videoCodecs, AudioCodec: 'opus,vorbis'}] : []),
		...(caps.ts ? [{Container: 'ts', Type: 'Video', VideoCodec: videoCodecs, AudioCodec: audioCodecs}] : []),
		{Container: 'mp3', Type: 'Audio'},
		{Container: 'flac', Type: 'Audio'},
		{Container: 'aac', Type: 'Audio'},
		{Container: 'wav', Type: 'Audio'},
		...(caps.vorbis || caps.opus ? [{Container: 'ogg', Type: 'Audio'}] : []),
		{Container: 'm4a', AudioCodec: 'aac', Type: 'Audio'},
		{Container: 'm4b', AudioCodec: 'aac', Type: 'Audio'}
	];
	if (caps.nativeHls) {
		profiles.push({Container: 'hls', Type: 'Video', VideoCodec: 'h264', AudioCodec: 'aac,mp3'});
	}
	return profiles;
};

const SUBTITLE_PROFILES = [
	{Format: 'vtt', Method: 'External'},
	{Format: 'srt', Method: 'External'},
	{Format: 'ass', Method: 'External'},
	{Format: 'ssa', Method: 'External'},
	{Format: 'sub', Method: 'Encode'},
	{Format: 'smi', Method: 'Encode'},
	{Format: 'ttml', Method: 'External'},
	{Format: 'pgssub', Method: 'External'},
	{Format: 'dvdsub', Method: 'Encode'},
	{Format: 'dvbsub', Method: 'Encode'}
];

// Every transcode is H.264 and AAC in TS segments, which hls.js plays wherever
// the WebView has no HLS player of its own.
const TRANSCODING_PROFILES = [
	{Container: 'ts', Type: 'Video', AudioCodec: 'aac', VideoCodec: 'h264', Context: 'Streaming', Protocol: 'hls', MaxAudioChannels: '2', MinSegments: '1', BreakOnNonKeyFrames: false},
	{Container: 'mp4', Type: 'Video', AudioCodec: 'aac', VideoCodec: 'h264', Context: 'Static'},
	{Container: 'mp3', Type: 'Audio', AudioCodec: 'mp3', Context: 'Streaming', Protocol: 'http'},
	{Container: 'aac', Type: 'Audio', AudioCodec: 'aac', Context: 'Streaming', Protocol: 'http'}
];

export const getJellyfinDeviceProfile = async () => {
	const caps = await getDeviceCapabilities();

	const codecProfiles = [
		{
			Type: 'Video',
			Codec: 'h264',
			Conditions: [
				{Condition: 'EqualsAny', Property: 'VideoProfile', Value: 'high|main|baseline|constrained baseline', IsRequired: false},
				{Condition: 'EqualsAny', Property: 'VideoRangeType', Value: 'SDR', IsRequired: false},
				{Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '42', IsRequired: false}
			]
		},
		{
			Type: 'Video',
			Codec: 'hevc',
			Conditions: [
				{Condition: 'EqualsAny', Property: 'VideoProfile', Value: 'main|main 10', IsRequired: false},
				{Condition: 'EqualsAny', Property: 'VideoRangeType', Value: caps.hdr10 ? HDR10_RANGE_TYPES : 'SDR', IsRequired: false},
				{Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '153', IsRequired: false},
				// A 1080p file is often marked with a 4K level, so the size is held by itself
				...(caps.uhd ? [] : [{Condition: 'LessThanEqual', Property: 'Width', Value: '1920', IsRequired: false}])
			]
		},
		{
			Type: 'VideoAudio',
			Codec: 'flac',
			Conditions: [
				{Condition: 'LessThanEqual', Property: 'AudioChannels', Value: '8', IsRequired: false}
			]
		}
	];

	return {
		Name: 'Moonfin Xbox',
		MaxStreamingBitrate: 120_000_000,
		MaxStaticBitrate: 120_000_000,
		MaxStaticMusicBitrate: 40_000_000,
		MusicStreamingTranscodingBitrate: 384_000,
		DirectPlayProfiles: buildDirectPlayProfiles(caps),
		TranscodingProfiles: TRANSCODING_PROFILES,
		CodecProfiles: codecProfiles,
		SubtitleProfiles: SUBTITLE_PROFILES,
		ResponseProfiles: [
			{Type: 'Video', Container: 'm4v', MimeType: 'video/mp4'},
			{Type: 'Video', Container: 'mkv', MimeType: 'video/x-matroska'}
		]
	};
};

// The transcodes are already H.264 and stereo AAC, so the retry after a failed
// transcode asks for the same thing.
export const getH264FallbackProfile = () => getJellyfinDeviceProfile();

export const getDeviceId = () => {
	let deviceId = localStorage.getItem('moonfin_device_id');
	if (!deviceId) {
		deviceId = 'moonfin_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
		localStorage.setItem('moonfin_device_id', deviceId);
	}
	return deviceId;
};

export const getDeviceName = async () => {
	const caps = await getDeviceCapabilities();
	return caps.modelName;
};
