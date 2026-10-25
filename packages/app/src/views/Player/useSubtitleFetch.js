import {useCallback, useRef, useState} from 'react';

// Whether the subtitle picked last is still on its way. Each load takes over from the one
// before it, so a slow answer for a track the viewer already moved off can't keep it showing.
const useSubtitleFetch = () => {
	const [loading, setLoading] = useState(false);
	const tokenRef = useRef(0);

	const track = useCallback((promise) => {
		const token = ++tokenRef.current;
		setLoading(true);
		const done = () => {
			if (token === tokenRef.current) setLoading(false);
		};
		promise.then(done, done);
		return promise;
	}, []);

	const clear = useCallback(() => {
		tokenRef.current++;
		setLoading(false);
	}, []);

	return {loading, track, clear};
};

export default useSubtitleFetch;
