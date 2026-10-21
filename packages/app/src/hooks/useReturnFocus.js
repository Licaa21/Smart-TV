import {useEffect} from 'react';
import Spotlight from '@enact/spotlight';

// A dialog that closes takes its focused button with it, so focus goes back to whatever held it
// when the dialog opened, or to the nav when that's gone, instead of being left for Spotlight to
// guess at.
const useReturnFocus = (open) => {
	useEffect(() => {
		if (!open) return undefined;
		const returnTo = Spotlight.getCurrent();
		return () => {
			if (!(returnTo && document.body.contains(returnTo) && Spotlight.focus(returnTo))) Spotlight.focus('navbar');
		};
	}, [open]);
};

export default useReturnFocus;
