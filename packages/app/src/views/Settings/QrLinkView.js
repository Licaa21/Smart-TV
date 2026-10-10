import {useEffect, useRef} from 'react';
import $L from '@enact/i18n/$L';

import {drawQrCode} from '../../utils/qrCanvas';
import {SpottableDiv} from './settingsSpottables';
import SettingsView from './SettingsView';

import css from './Settings.module.less';

const QrLinkView = ({title, url, onClose}) => {
	const canvasRef = useRef(null);

	useEffect(() => {
		drawQrCode(canvasRef.current, url);
	}, [url]);

	return (
		<SettingsView spotlightId='qr-link-view' title={title}>
			<div className={css.viewDescription}>{$L('Scan with your phone to open this link')}</div>
			<div className={css.qrContainer}>
				<canvas ref={canvasRef} className={css.qrCanvas} />
			</div>
			<div className={css.viewDescription}>{url}</div>
			<SpottableDiv className={css.listItem} onClick={onClose} spotlightId='qr-link-close'>
				<div className={css.listItemBody}>
					<div className={css.listItemHeading}>{$L('Close')}</div>
				</div>
			</SpottableDiv>
		</SettingsView>
	);
};

export default QrLinkView;
