import $L from '@enact/i18n/$L';

// What this fork's own playback settings have to do with how a file plays, in words, for the Playback
// Info popup. The server's reasons say what stopped a direct play, and these say which setting of the
// fork could change that or already has, which a reason on its own never names.

const STREAM_LIMIT = 32;
// Jellyfin writes a level as the number times 30, so 5.1 is 153 and 5.2 is 156.
const HEVC_LEVEL_51 = 153;
const lower = (value) => String(value || '').toLowerCase();

const codecLabel = (codec) => String(codec || '').toUpperCase();

// Each note is {id, title, text, tone}. A tip is something a setting could change, and info is a setting
// that is already doing its work.
export const buildForkNotes = ({method, source, reasonKeys = [], settings = {}, audioStart = null, tizen = false}) => {
	// These settings, and the limits they lift, are the Samsung player's.
	if (!tizen) return [];
	const streams = Array.isArray(source?.MediaStreams) ? source.MediaStreams : [];
	const video = streams.find((stream) => stream.Type === 'Video');
	const has = (reason) => reasonKeys.indexOf(reason) !== -1;
	const notes = [];

	// The player opens a file on one track, and only a pick in that codec is switched by the player. Any
	// other is built by the server, with the picture copied, so the popup would be wrong to call it a
	// plain direct play.
	if (audioStart?.needsServer) {
		notes.push({
			id: 'audio',
			tone: 'info',
			title: $L('Different audio codec'),
			text: $L('Opens on {first} audio, and the player cannot switch to {picked} dependably, so the server is asked to build your {picked} track with the picture copied. If that needs a re-encode, the file plays as it is instead.')
				.replace('{first}', codecLabel(audioStart.openingCodec))
				.replace(/\{picked\}/g, codecLabel(audioStart.wantedCodec))
		});
	}

	// A set held to 32 streams in a file sends one with more through the server.
	if (settings.allowManyStreams !== true && has('streamcountexceedslimit')) {
		const alone = reasonKeys.length === 1;
		notes.push({
			id: 'streams',
			tone: 'tip',
			title: $L('Allow Files With Many Streams'),
			text: $L('{count} streams, and this TV plays 32 in a file, so the server remuxes it. Turn this setting on to play it as it is.')
				.replace('{count}', streams.length) + (alone ? ` ${$L('Nothing else stops it.')}` : '')
		});
	} else if (settings.allowManyStreams === true && method === 'direct' && streams.length > STREAM_LIMIT) {
		notes.push({
			id: 'streams',
			tone: 'info',
			title: $L('Allow Files With Many Streams'),
			text: $L('{count} streams, over the usual 32. It plays as it is because this setting is on.')
				.replace('{count}', streams.length)
		});
	}

	// AVPlay refuses AV1 inside the HLS the server builds, so a file that cannot be played as it is, DTS
	// audio above all, can only be played with the picture re-encoded.
	if (lower(video?.Codec) === 'av1' && method !== 'direct') {
		notes.push({
			id: 'av1',
			tone: settings.forceCompatibleAv1Transcode === true ? 'info' : 'tip',
			title: $L('Force Compatible AV1 Transcode'),
			text: settings.forceCompatibleAv1Transcode === true
				? $L('This TV refuses AV1 in a server stream, so the picture is re-encoded to HEVC. AV1 with AC3 audio plays as it is from MKV.')
				: $L('This TV refuses AV1 in a server stream, so it cannot be copied. Turn this setting on to re-encode it to HEVC.')
		});
	}

	// A Dolby Vision file with an enhancement layer has an HDR10 base layer a set can play by itself.
	if (/DOVIWithEL/i.test(String(video?.VideoRangeType || ''))) {
		if (settings.dolbyVisionAsHdr10 === true && method === 'direct') {
			notes.push({
				id: 'dolby',
				tone: 'info',
				title: $L('Play Dolby Vision Profile 7 as HDR10'),
				text: $L('Plays as plain HDR10, without its enhancement layer, because this setting is on.')
			});
		} else if (settings.dolbyVisionAsHdr10 !== true && method !== 'direct' && has('videorangetypenotsupported')) {
			notes.push({
				id: 'dolby',
				tone: 'tip',
				title: $L('Play Dolby Vision Profile 7 as HDR10'),
				text: $L('The enhancement layer is why it is not played as it is. Turn this setting on to play it as plain HDR10.')
			});
		}
	}

	// The Tizen profile stops 4K HEVC at level 5.1.
	if (lower(video?.Codec) === 'hevc' && video.Level > HEVC_LEVEL_51 && video.Width > 1920) {
		const level = (video.Level / 30).toFixed(1);
		if (settings.allowHevcLevel52 === true && method === 'direct') {
			notes.push({
				id: 'hevc',
				tone: 'info',
				title: $L('Allow HEVC Level 5.2'),
				text: $L('Level {level}, above the 5.1 this TV is held to. It plays as it is because this setting is on.').replace('{level}', level)
			});
		} else if (settings.allowHevcLevel52 !== true && method !== 'direct' && has('videolevelnotsupported')) {
			notes.push({
				id: 'hevc',
				tone: 'tip',
				title: $L('Allow HEVC Level 5.2'),
				text: $L('Level {level}, above the 5.1 this TV is held to, so it is re-encoded. Turn this setting on to play it as it is.').replace('{level}', level)
			});
		}
	}

	return notes;
};
