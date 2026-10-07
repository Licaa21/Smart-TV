// The most channels the viewer lets audio carry: stereo when downmixing, else the Max Audio Channels
// setting, else none. Auto Detect is no cap, since the set cannot tell what its speakers are.
export const audioChannelCap = (settings) => {
	if (settings?.downmixToStereo === true) return 2;
	return typeof settings?.maxAudioChannels === 'number' && settings.maxAudioChannels > 0 ? settings.maxAudioChannels : null;
};

// The cap track picking goes by: the one above, or stereo for a viewer with stereo speakers who left the cap on
// Auto. It only ranks tracks, so a 5.1 track a stereo pick passes over still direct plays when it is chosen.
export const audioPickCap = (settings) => audioChannelCap(settings) || (settings?.preferStereoAudio === true ? 2 : null);
