import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {getRommAccount, startRommLink, unlinkRomm} from '../../services/gamesApi';

const NONE = {available: false, linked: false};

// The user's RomM link on this server. While a code waits to be approved, each read also asks
// RomM, so it's read again on RomM's interval until the link settles.
const useRommAccount = ({serverUrl, accessToken}) => {
	const [account, setAccount] = useState(NONE);
	const [failed, setFailed] = useState(false);
	const polling = useRef(false);

	useEffect(() => {
		setAccount(NONE);
		if (!serverUrl || !accessToken) return undefined;
		let cancelled = false;
		getRommAccount()
			.then((next) => { if (!cancelled && next) setAccount(next); })
			.catch(() => {});
		return () => { cancelled = true; };
	}, [serverUrl, accessToken]);

	const userCode = account.pending ? account.pending.userCode : null;
	const intervalSeconds = account.pending ? account.pending.intervalSeconds : null;
	useEffect(() => {
		if (!userCode) return undefined;
		let cancelled = false;
		const timer = setInterval(async () => {
			if (polling.current) return;
			polling.current = true;
			try {
				const next = await getRommAccount();
				if (!cancelled && next) setAccount(next);
			} catch (e) {
				// The next tick tries again.
			} finally {
				polling.current = false;
			}
		}, Math.max(intervalSeconds || 5, 2) * 1000);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [userCode, intervalSeconds]);

	// Buttons stay enabled so the remote's focus never lands on a disabled one, and a second
	// press while a request is out is dropped here instead.
	const busyRef = useRef(false);
	const run = useCallback(async (request) => {
		if (busyRef.current) return;
		busyRef.current = true;
		setFailed(false);
		try {
			const next = await request();
			if (next) setAccount(next);
		} catch (e) {
			setFailed(true);
		} finally {
			busyRef.current = false;
		}
	}, []);

	const link = useCallback(() => run(startRommLink), [run]);
	const unlink = useCallback(() => run(unlinkRomm), [run]);

	return useMemo(() => ({...account, failed, link, unlink}), [account, failed, link, unlink]);
};

export default useRommAccount;
