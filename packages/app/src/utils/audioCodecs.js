// The audio codecs the priority editor in Settings lets the viewer rank, in the default order
// (best first). Labels are plain English and translated where shown, with $L(codec.label).
// Moonfin Core has no such setting, so this one stays on the device and never syncs.

export const AUDIO_CODEC_ORDER_KEY = 'audioCodecOrder';

export const AUDIO_CODECS = [
	{id: 'truehd', label: 'Dolby TrueHD', subtitle: 'Lossless, including Atmos'},
	{id: 'dtshd', label: 'DTS-HD', subtitle: 'Master Audio, High Resolution, DTS:X'},
	{id: 'dts', label: 'DTS', subtitle: 'Core track'},
	{id: 'eac3', label: 'Dolby Digital Plus', subtitle: 'E-AC-3, including Atmos streaming'},
	{id: 'ac3', label: 'Dolby Digital', subtitle: 'AC-3'},
	{id: 'flac', label: 'FLAC', subtitle: 'Lossless'},
	{id: 'pcm', label: 'PCM', subtitle: 'Uncompressed'},
	{id: 'opus', label: 'Opus'},
	{id: 'aac', label: 'AAC'},
	{id: 'vorbis', label: 'Vorbis'},
	{id: 'mp3', label: 'MP3'}
];

// Servers spell one codec several ways (ac-3, e-ac-3, dca), and DTS-HD only shows in the profile.
export const audioCodecKey = (stream) => {
	const key = String(stream?.codec || '').toLowerCase().replace(/[^a-z0-9]/g, '');
	if (key === 'dca' || key === 'dts') {
		return /\bhd\b|dts-?hd|dts:?x|\bma\b/i.test(String(stream?.profile || '')) ? 'dtshd' : 'dts';
	}
	if (key === 'dtshd') return 'dtshd';
	if (key === 'mlp') return 'truehd';
	return key.startsWith('pcm') ? 'pcm' : key;
};
