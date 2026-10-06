import {useCallback} from 'react';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Settings from '../../views/Settings';

import css from './SettingsPanel.module.less';

const PanelContainer = SpotlightContainerDecorator({
	enterTo: 'last-focused',
	restrict: 'self-only',
	leaveFor: {left: '', right: '', up: '', down: ''}
}, 'div');

const SettingsPanel = ({initialView, onClose, onLibrariesChanged, onRunSetupWizard, onSelectItem}) => {
	const handleScrimClick = useCallback(() => {
		onClose?.();
	}, [onClose]);

	return (
		<div className={css.overlay}>
			<div className={css.scrim} onClick={handleScrimClick} />
			<PanelContainer className={css.panel} spotlightId="settings-panel-container">
				<Settings
					panelMode
					initialView={initialView}
					onBack={onClose}
					onLibrariesChanged={onLibrariesChanged}
					onRunSetupWizard={onRunSetupWizard}
					onSelectItem={onSelectItem}
				/>
			</PanelContainer>
		</div>
	);
};

export default SettingsPanel;
