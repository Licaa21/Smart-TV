import {useCallback, useEffect, useRef, useState} from 'react';

import {fetchDetailPlaybackInfo} from './detailPlaybackInfo';

// Whether the server would hand this file over as it is, or rework it on the way. The answer is
// worth waiting for rather than guessing, so the state says it's still asking rather than showing
// nothing, and carries a way to ask again when the request falls over.
const useDetailPlaybackInfo = ({api, item, itemId, serverType, mediaSourceId, audioStreamIndex, subtitleStreamIndex, maxBitrate}) => {
	const [state, setState] = useState({status: 'loading', result: null});
	const [attempt, setAttempt] = useState(0);
	// The title only says which server to ask, so a new object for the same one is no reason to ask again.
	const itemRef = useRef(item);
	itemRef.current = item;

	const retry = useCallback(() => {
		setState({status: 'loading', result: null});
		setAttempt((n) => n + 1);
	}, []);

	useEffect(() => {
		let cancelled = false;
		setState({status: 'loading', result: null});

		fetchDetailPlaybackInfo(api, {
			item: itemRef.current, itemId, serverType, mediaSourceId, audioStreamIndex, subtitleStreamIndex, maxBitrate
		})
			.then((result) => {
				if (cancelled) return;
				setState(result
					? {status: 'ready', result}
					// Nothing came back to report on, so there's nothing honest to say.
					: {status: 'empty', result: null});
			})
			.catch(() => {
				if (!cancelled) setState({status: 'failed', result: null});
			});

		return () => {
			cancelled = true;
		};
	}, [api, itemId, serverType, mediaSourceId, audioStreamIndex, subtitleStreamIndex, maxBitrate, attempt]);

	return {...state, retry};
};

export default useDetailPlaybackInfo;
