import {useEffect, useRef} from 'react';

// A track that fails behind the other screens has nobody to see its error, so the queue moves
// on. The same track failing again, like every track failing in turn, stops the music instead.
const useSkipFailedTrack = ({error, background, item, hasNextTrack, handleNextTrack, handleBack}) => {
	const failedRef = useRef(new Set());
	const handledRef = useRef(false);
	useEffect(() => {
		if (!error) {
			handledRef.current = false;
			return;
		}
		if (!background || handledRef.current) return;
		handledRef.current = true;
		const failed = failedRef.current;
		if (hasNextTrack && !failed.has(item.Id)) {
			failed.add(item.Id);
			handleNextTrack();
		} else {
			failed.clear();
			handleBack();
		}
	}, [error, background, item, hasNextTrack, handleNextTrack, handleBack]);
};

export default useSkipFailedTrack;
