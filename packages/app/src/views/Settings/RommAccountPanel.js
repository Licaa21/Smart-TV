import {useEffect, useRef} from 'react';
import $L from '@enact/i18n/$L';
import Spotlight from '@enact/spotlight';

import {drawQrCode} from '../../utils/qrCanvas';
import {SpottableButton} from './settingsSpottables';
import {InfoRow} from './settingsRows';

import css from './Settings.module.less';

const BUTTONS = {idle: 'romm-link', pending: 'romm-cancel', linked: 'romm-unlink'};

const errorText = (romm) => {
	if (romm.failed) return $L("Couldn't reach the server. Try again.");
	if (romm.error === 'expired') return $L('The code expired. Link again to get a new one.');
	if (romm.error === 'denied') return $L('The link was turned down in RomM.');
	if (romm.error === 'unreachable') return $L("Couldn't reach the RomM server. Try again in a moment.");
	return null;
};

// Linking runs on the user's phone, since a TV has no good way to sign in to RomM. The TV shows
// a code and a QR code, and the server picks up the approval while it waits.
const RommAccountPanel = ({romm}) => {
	const canvasRef = useRef(null);
	const pending = romm.linked ? null : romm.pending;
	const mode = romm.linked ? 'linked' : pending ? 'pending' : 'idle';
	const qrUrl = pending ? pending.verificationUrlComplete || pending.verificationUrl : null;

	useEffect(() => {
		if (qrUrl) drawQrCode(canvasRef.current, qrUrl);
	}, [qrUrl]);

	// The button that had focus goes away when the link changes state, so focus moves to the new one.
	const shownMode = useRef(mode);
	useEffect(() => {
		if (shownMode.current === mode) return;
		shownMode.current = mode;
		Spotlight.focus(BUTTONS[mode]);
	}, [mode]);

	const error = errorText(romm);

	return (
		<>
			{mode === 'idle' && (
				<>
					<div className={css.viewDescription}>
						{$L('Link your RomM account so you see the games it has and your saves go to RomM.')}
					</div>
					<div className={css.actionBarInline}>
						<SpottableButton className={css.actionButton} onClick={romm.link} spotlightId={BUTTONS.idle}>
							{$L('Link Account')}
						</SpottableButton>
					</div>
				</>
			)}
			{mode === 'pending' && (
				<>
					<div className={css.viewDescription}>
						{$L('Scan the QR code with your phone, or open the address below and enter the code. Then approve Moonfin in RomM.')}
					</div>
					<div className={css.rommCode}>{pending.userCode}</div>
					<div className={css.qrContainer}>
						<canvas ref={canvasRef} className={css.qrCanvas} />
					</div>
					<div className={css.viewDescription}>{pending.verificationUrl}</div>
					<div className={css.actionBarInline}>
						<SpottableButton className={css.actionButton} onClick={romm.unlink} spotlightId={BUTTONS.pending}>
							{$L('Cancel')}
						</SpottableButton>
					</div>
				</>
			)}
			{mode === 'linked' && (
				<>
					<InfoRow id='rommUser' label={$L('Status')} value={$L('Linked as {username}').replace('{username}', romm.username || 'RomM')} />
					<div className={css.authHint}>
						{$L('Unlinking makes Moonfin forget its RomM key. You can also remove the key in RomM under your API tokens.')}
					</div>
					<div className={css.actionBarInline}>
						<SpottableButton className={`${css.actionButton} ${css.dangerButton}`} onClick={romm.unlink} spotlightId={BUTTONS.linked}>
							{$L('Unlink')}
						</SpottableButton>
					</div>
				</>
			)}
			{error && <div className={`${css.statusMessage} ${css.statusError}`}>{error}</div>}
		</>
	);
};

export default RommAccountPanel;
