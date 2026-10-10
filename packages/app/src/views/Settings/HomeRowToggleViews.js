/* eslint-disable react/jsx-no-bind */
import $L from '@enact/i18n/$L';

import {getSeerrHomeRowConfigs, SEERR_CONFIG_TO_SECTION} from '../../utils/seerrHomeRows';
import {renderToggle} from './settingsIcons';
import {SpottableDiv} from './settingsSpottables';
import SettingsView from './SettingsView';

import css from './Settings.module.less';

// Two lists of rows that are switched on and off one at a time, with no ordering to do.

export const SeerrHomeRowsView = ({seerrLabel, enabledMap, onToggleRow}) => (
	<SettingsView spotlightId='seerr-home-rows-view' title={`${seerrLabel} ${$L('Home Rows')}`} clean>
		<div className={css.viewDescription}>
			{$L('Choose which Seerr discover rows appear on the home screen.')}
		</div>
		{getSeerrHomeRowConfigs().map((cfg) => (
			<SpottableDiv
				key={cfg.id}
				className={css.listItem}
				onClick={() => onToggleRow(cfg.id)}
				spotlightId={`seerrrow-${cfg.id}`}
			>
				<div className={css.listItemBody}>
					<div className={css.listItemHeading}>{cfg.title}</div>
				</div>
				<div className={css.listItemTrailing}>{renderToggle(enabledMap.get(SEERR_CONFIG_TO_SECTION[cfg.id]) === true)}</div>
			</SpottableDiv>
		))}
	</SettingsView>
);

// Each list is stored twice, as its own setting and as a home row, so switching one writes
// both and the row appears in Home Sections straight away.
const IMDB_LISTS = [
	{ id: 'imdbTop250MoviesEnabled', rowId: 'imdb-top250-movies', title: () => $L('IMDb Top 250 Movies') },
	{ id: 'imdbTop250TvShowsEnabled', rowId: 'imdb-top250-tv', title: () => $L('IMDb Top 250 TV Shows') },
	{ id: 'imdbMostPopularMoviesEnabled', rowId: 'imdb-popular-movies', title: () => $L('IMDb Most Popular Movies') },
	{ id: 'imdbMostPopularTvShowsEnabled', rowId: 'imdb-popular-tv', title: () => $L('IMDb Most Popular TV Shows') },
	{ id: 'imdbLowestRatedMoviesEnabled', rowId: 'imdb-lowest-rated', title: () => $L('IMDb Lowest Rated Movies') },
	{ id: 'imdbTopEnglishMoviesEnabled', rowId: 'imdb-top-english', title: () => $L('IMDb Top Rated English Movies') }
];

export const ImdbListsView = ({settings, onUpdateSettings}) => {
	const toggleImdbList = (settingKey, rowId) => {
		const nextValue = !settings[settingKey];
		const updatedHomeRows = (settings.homeRows || []).map((row) =>
			row.id === rowId ? { ...row, enabled: nextValue } : row
		);
		onUpdateSettings({
			[settingKey]: nextValue,
			homeRows: updatedHomeRows
		});
	};

	return (
		<SettingsView spotlightId='imdb-lists-view' title={$L('IMDb Lists')} clean>
			<div className={css.viewDescription}>
				{$L('Choose which IMDb lists are active. Activating a list adds it to your Home Sections.')}
			</div>
			{IMDB_LISTS.map((cfg) => (
				<SpottableDiv
					key={cfg.id}
					className={css.listItem}
					onClick={() => toggleImdbList(cfg.id, cfg.rowId)}
					spotlightId={`imdblist-${cfg.id}`}
				>
					<div className={css.listItemBody}>
						<div className={css.listItemHeading}>{cfg.title()}</div>
					</div>
					<div className={css.listItemTrailing}>{renderToggle(settings[cfg.id] === true)}</div>
				</SpottableDiv>
			))}
		</SettingsView>
	);
};
