import {useState, useEffect} from 'react';

// The screensaver draws over Home instead of leaving it, so anything on Home
// that keeps itself busy has to pause for it.
export function useScreensaverActive() {
	const [active, setActive] = useState(false);

	useEffect(() => {
		const handle = (e) => setActive(!!e.detail?.active);
		window.addEventListener('moonfin:screensaver', handle);
		return () => window.removeEventListener('moonfin:screensaver', handle);
	}, []);

	return active;
}
