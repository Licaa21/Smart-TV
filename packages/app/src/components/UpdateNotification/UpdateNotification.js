/**
 * UpdateNotification component
 * Shows a popup when a new version is available
 */

import {useCallback, useEffect, useRef, useMemo} from 'react';
import Popup from '@enact/sandstone/Popup';
import Button from '@enact/sandstone/Button';
import Heading from '@enact/sandstone/Heading';
import Scroller from '@enact/sandstone/Scroller';
import Spotlight from '@enact/spotlight';
import $L from '@enact/i18n/$L';

import {KEYS} from '../../utils/keys';
import {renderReleaseNotes} from '../../utils/releaseNotes';

import css from './UpdateNotification.module.less';

const OK_BUTTON_ID = 'update-ok-btn';

const UpdateNotification = ({updateInfo, formattedNotes, onDismiss}) => {
	const panelRef = useRef(null);

	const handleDismiss = useCallback(() => {
		if (onDismiss) {
			onDismiss();
		}
	}, [onDismiss]);

	const htmlNotes = useMemo(() => renderReleaseNotes(formattedNotes), [formattedNotes]);

	const holdsFocus = useCallback(() => {
		const current = Spotlight.getCurrent();
		return Boolean(current && panelRef.current && panelRef.current.contains(current));
	}, []);

	// Asked for by id because Button does not forward a ref, so there is no
	// element to hand Spotlight. The panel animates in, so the first ask can
	// land before there is anything to take it.
	useEffect(() => {
		if (!updateInfo) return;

		let timer = null;
		let attempts = 0;
		const focusOk = () => {
			Spotlight.focus(OK_BUTTON_ID);
			attempts += 1;
			if (attempts < 5 && !holdsFocus()) {
				timer = setTimeout(focusOk, 150);
			}
		};

		timer = setTimeout(focusOk, 100);
		return () => clearTimeout(timer);
	}, [updateInfo, holdsFocus]);

	// The screen behind keeps loading after the panel opens (Home's media bar takes focus when its slides arrive), and the
	// ask above gives up after a second. So whatever takes focus outside the panel while it is up hands it straight back.
	useEffect(() => {
		if (!updateInfo) return;

		// By where the focus landed, since Spotlight has not caught up with it yet when this runs
		const handleFocusIn = (e) => {
			if (!panelRef.current || !panelRef.current.contains(e.target)) Spotlight.focus(OK_BUTTON_ID);
		};

		document.addEventListener('focusin', handleFocusIn);
		return () => document.removeEventListener('focusin', handleFocusIn);
	}, [updateInfo]);

	// Spotlight only fences off moves that start inside the panel, so focus can
	// still be taken by the screen behind. Every press after that drives the
	// screen instead of the panel.
	useEffect(() => {
		if (!updateInfo) return;

		const handleKey = (e) => {
			const code = e.keyCode || e.which;
			if (code !== KEYS.UP && code !== KEYS.DOWN && code !== KEYS.LEFT && code !== KEYS.RIGHT) return;
			if (holdsFocus()) return;
			e.preventDefault();
			e.stopPropagation();
			Spotlight.focus(OK_BUTTON_ID);
		};

		window.addEventListener('keydown', handleKey, true);
		return () => window.removeEventListener('keydown', handleKey, true);
	}, [updateInfo, holdsFocus]);

	if (!updateInfo) {
		return null;
	}

	return (
		<Popup
			open
			onClose={handleDismiss}
			position="center"
			noAutoDismiss
			scrimType="translucent"
			spotlightRestrict="self-only"
		>
			<div className={css.overlay}>
				<div
					ref={panelRef}
					className={css.modal}
					style={{
						width: '1400px',
						minWidth: '1200px'
					}}
				>
					<Heading size="small" className={css.title}>
						{$L('Update available')}
					</Heading>

					<div className={css.versionInfo}>
						<span className={css.newVersion}>{$L('Version')} {updateInfo.latestVersion}</span>
						<span className={css.currentVersion}>
							{$L('Current:')} {updateInfo.currentVersion}
						</span>
					</div>

					<Scroller
						className={css.notesScroller}
						direction="vertical"
						focusableScrollbar
					>
						<div
							className={css.notes}
							ref={(el) => { if (el) el.innerHTML = htmlNotes; }}
						/>
					</Scroller>

					<div className={css.buttons}>
						<Button
							spotlightId={OK_BUTTON_ID}
							size="small"
							onClick={handleDismiss}
						>
							{$L('OK')}
						</Button>
					</div>
				</div>
			</div>
		</Popup>
	);
};

export default UpdateNotification;
export {UpdateNotification};
