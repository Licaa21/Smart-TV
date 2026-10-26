import {useCallback} from 'react';
import $L from '@enact/i18n/$L';

import TrackOptionRow, {TrackDivider} from '../../components/TrackOptionRow';
import {useSettings} from '../../context/SettingsContext';
import NouveauSortDialog from './nouveau/sections/NouveauSortDialog';

import css from './nouveau/sections/NouveauSections.module.less';

// How a person's credits are ordered, and whether a title they worked on in several roles shows once.
const PersonDisplayDialog = ({onClose}) => {
	const {settings, updateSetting} = useSettings();
	const grouped = Boolean(settings.personPageGroupItems);

	const handleSort = useCallback((option) => updateSetting('personPageSortOption', option), [updateSetting]);
	const handleGroup = useCallback(() => updateSetting('personPageGroupItems', !grouped), [updateSetting, grouped]);

	return (
		<NouveauSortDialog
			title={$L('Display Options')}
			heading={$L('Sort By')}
			options={[
				{id: 'alphabetical', label: $L('Alphabetical')},
				{id: 'releaseDateAsc', label: $L('Release Date (Ascending)')},
				{id: 'releaseDateDesc', label: $L('Release Date (Descending)')}
			]}
			active={settings.personPageSortOption || 'alphabetical'}
			onSelect={handleSort}
			onClose={onClose}
		>
			<TrackDivider />
			<div className={css.sortHeading}>{$L('Group Contributions')}</div>
			<TrackOptionRow label={$L('Group multiple roles')} selected={grouped} onClick={handleGroup} />
		</NouveauSortDialog>
	);
};

export default PersonDisplayDialog;
