// The most channels the viewer lets audio carry: stereo when downmixing, else the Max Audio Channels
// setting, else none. Auto Detect is no cap, since the set cannot tell what its speakers are.
export const audioChannelCap = (settings) => {
	if (settings?.downmixToStereo === true) return 2;
	return typeof settings?.maxAudioChannels === 'number' && settings.maxAudioChannels > 0 ? settings.maxAudioChannels : null;
};
