import {useEffect, useState} from 'react';

// The server's libraries, for a screen that takes its layout from one of them. Null until they are in.
const useStyleLibraries = (api, enabled = true) => {
	const [libraries, setLibraries] = useState(null);
	useEffect(() => {
		if (!enabled) return undefined;
		let cancelled = false;
		api.getLibraries().then(
			(views) => !cancelled && setLibraries(views?.Items || []),
			() => !cancelled && setLibraries([])
		);
		return () => { cancelled = true; };
	}, [api, enabled]);
	return libraries;
};

export default useStyleLibraries;
