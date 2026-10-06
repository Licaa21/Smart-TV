import {useCallback} from 'react';
import $L from '@enact/i18n/$L';

import FilterPopup, {FilterOption} from '../../components/FilterPopup';
import {MUSIC_FOCUS_IDS} from './musicFocus';

const MUSIC_SORT_CHOICES = [
	{key: 'name', label: $L('Name')},
	{key: 'release_year', label: $L('Release Year')},
	{key: 'date_added', label: $L('Date Added to Library')}
];

const MUSIC_ROW_TOGGLES = [
	{key: 'displayAudioLatest', label: $L('Latest')},
	{key: 'displayAudioLastPlayed', label: $L('Last Played')},
	{key: 'displayAudioFavorites', label: $L('Favorites')},
	{key: 'displayAudioPlaylists', label: $L('Playlists')},
	{key: 'displayAudioAlbumArtists', label: $L('Album Artists')},
	{key: 'displayAudioArtists', label: $L('Artists')},
	{key: 'displayAudioAlbums', label: $L('Albums')}
];

const MusicFilterPanel = ({settings, onUpdateSetting, onClose}) => {
	const handleSortSelect = useCallback((e) => {
		const key = e.currentTarget?.dataset?.sortKey;
		if (key) onUpdateSetting('audioSortOption', key);
	}, [onUpdateSetting]);

	const handleToggle = useCallback((e) => {
		const key = e.currentTarget?.dataset?.rowKey;
		if (key) onUpdateSetting(key, !settings[key]);
	}, [onUpdateSetting, settings]);

	const shown = MUSIC_ROW_TOGGLES.filter((row) => settings[row.key]).length;

	return (
		<FilterPopup
			title={$L('Sort & Filter')}
			spotlightId={MUSIC_FOCUS_IDS.panel}
			groups={[
				{
					key: 'sort',
					title: $L('Sort By'),
					summary: MUSIC_SORT_CHOICES.find((option) => option.key === settings.audioSortOption)?.label,
					body: () => MUSIC_SORT_CHOICES.map((option) => (
						<FilterOption
							key={option.key}
							label={option.label}
							selected={settings.audioSortOption === option.key}
							onClick={handleSortSelect}
							data-sort-key={option.key}
						/>
					))
				},
				{
					key: 'show',
					title: $L('Show'),
					summary: `${shown}/${MUSIC_ROW_TOGGLES.length}`,
					body: () => MUSIC_ROW_TOGGLES.map((row) => (
						<FilterOption
							key={row.key}
							multi
							label={row.label}
							selected={Boolean(settings[row.key])}
							onClick={handleToggle}
							data-row-key={row.key}
						/>
					))
				}
			]}
			onClose={onClose}
		/>
	);
};

export default MusicFilterPanel;
