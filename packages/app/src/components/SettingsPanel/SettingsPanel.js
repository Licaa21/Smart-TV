import {useCallback, useEffect, useRef, useState} from 'react';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Settings from '../../views/Settings';

import css from './SettingsPanel.module.less';

const PanelContainer = SpotlightContainerDecorator({
	enterTo: 'last-focused',
	restrict: 'self-only',
	leaveFor: {left: '', right: '', up: '', down: ''}
}, 'div');

const CLOSE_MS = 220;

const SettingsPanel = ({initialView, onClose, onLibrariesChanged, onRunSetupWizard, onSelectItem}) => {
	const [closing, setClosing] = useState(false);
	const timerRef = useRef(null);

	useEffect(() => () => clearTimeout(timerRef.current), []);

	const handleClose = useCallback(() => {
		if (timerRef.current) return;
		if (document.documentElement.classList.contains('perf-low')) {
			onClose?.();
			return;
		}
		setClosing(true);
		timerRef.current = setTimeout(() => onClose?.(), CLOSE_MS);
	}, [onClose]);

	return (
		<div className={closing ? `${css.overlay} ${css.closing}` : css.overlay}>
			<div className={css.scrim} onClick={handleClose} />
			<PanelContainer className={css.panel} spotlightId="settings-panel-container">
				<Settings
					panelMode
					initialView={initialView}
					onBack={handleClose}
					onLibrariesChanged={onLibrariesChanged}
					onRunSetupWizard={onRunSetupWizard}
					onSelectItem={onSelectItem}
				/>
			</PanelContainer>
		</div>
	);
};

export default SettingsPanel;
