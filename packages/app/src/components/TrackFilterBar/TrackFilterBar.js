import {useCallback} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import $L from '@enact/i18n/$L';

import {ChipRowContainer} from '../../utils/spotlightContainers';
import SpottableInput from '../SpottableInput/SpottableInput';
import {OTHER_LANGUAGE} from '../../utils/trackFilter';

import css from './TrackFilterBar.module.less';

const SpottableButton = Spottable('button');

// Where Channel Up lands from anywhere in a long list, which is how the actions are reached without scrolling to them.
export const TRACK_FILTER_FOCUS_ID = 'track-filter-all';

// The strip over a long track list: the languages in it as chips, a search field, and the actions that used to sit at the
// bottom of the list (offset, appearance, download, cancel), so none of them is a scroll away.
const TrackFilterBar = ({languages, language, query, onLanguage, onQuery, actions}) => {
	// A chip says which language it is in data-language, '' being All
	const handleChip = useCallback((e) => onLanguage(e.currentTarget.dataset.language), [onLanguage]);
	const handleSearch = useCallback((e) => onQuery(e.target.value), [onQuery]);

	return (
		<ChipRowContainer className={css.bar}>
			<div className={css.chips}>
				<SpottableButton
					className={[css.chip, !language && css.chipOn].filter(Boolean).join(' ')}
					spotlightId={TRACK_FILTER_FOCUS_ID}
					data-language=""
					onClick={handleChip}
				>
					{$L('All')}
				</SpottableButton>
				{languages.map(({code, count}) => {
					const value = code || OTHER_LANGUAGE;
					return (
						<SpottableButton
							key={value}
							className={[css.chip, language === value && css.chipOn].filter(Boolean).join(' ')}
							data-language={value}
							onClick={handleChip}
						>
							{code ? code.toUpperCase() : $L('Other')}
							<span className={css.count}>{count}</span>
						</SpottableButton>
					);
				})}
			</div>
			<SpottableInput
				spotlightId="track-filter-search"
				className={css.search}
				type="text"
				placeholder={$L('Search tracks')}
				value={query}
				onChange={handleSearch}
				maxLength={60}
			/>
			<div className={css.actions}>
				{actions.map((action) => (
					<SpottableButton
						key={action.label}
						className={[css.action, action.dimmed && css.actionDimmed].filter(Boolean).join(' ')}
						spotlightId={action.spotlightId}
						onClick={action.onClick}
					>
						{action.label}
					</SpottableButton>
				))}
			</div>
		</ChipRowContainer>
	);
};

export default TrackFilterBar;
