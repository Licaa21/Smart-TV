import $L from '@enact/i18n/$L';

import {spotlightRuntimeLabel} from './spotlightCards';
import {DETAIL_METADATA, arrange} from '../../../utils/detailMetadataLayout';

// The facts line under the title. Each piece carries its kind so the status can draw as a
// coloured pill and the runtime can lead with a clock, arranged according to the user's preferences.
export const spotlightMetaPieces = ({
	item = {}, year, officialRating, seasonCount, episodeCount, genres = [],
	upcomingEpisodeText, hasSeerrPills, settings = {}
}) => {
	const orderedItems = arrange(DETAIL_METADATA, {
		order: settings.detailMetadataOrderTv,
		hidden: settings.hiddenDetailMetadataTv
	});

	const pieceFor = (id) => {
		switch (id) {
			case 'year':
				return year ? [{kind: 'text', text: String(year)}] : [];
			case 'parentalRating':
				return officialRating ? [{kind: 'text', text: officialRating}] : [];
			// An episode shows its runtime as well as its season and episode number, not instead
			// of it. Only a series has no runtime of its own worth showing.
			case 'runtimeAndSeasons': {
				const pieces = [];
				if (item.Type === 'Series' && seasonCount) {
					pieces.push({kind: 'text', text: $L('{count} Seasons').replace('{count}', seasonCount)});
				}
				if (item.Type === 'Season' && episodeCount) {
					pieces.push({kind: 'text', text: $L('{count} Episodes').replace('{count}', episodeCount)});
				}
				if (item.Type === 'Episode' && item.ParentIndexNumber != null && item.IndexNumber != null) {
					pieces.push({kind: 'text', text: `S${item.ParentIndexNumber}:E${item.IndexNumber}`});
				}
				if (item.RunTimeTicks && item.Type !== 'Series') {
					pieces.push({kind: 'runtime', text: spotlightRuntimeLabel(item.RunTimeTicks)});
				}
				return pieces;
			}
			// Whatever the server calls it. Only ended is worth colouring as a warning, and any
			// other wording still belongs on screen rather than being dropped for not being one
			// of the two this has its own words for.
			case 'status': {
				if (item.Type !== 'Series' || !item.Status) return [];
				if (item.Status.toLowerCase() === 'ended') return [{kind: 'status', text: $L('Ended'), ended: true}];
				const text = item.Status === 'Continuing' ? $L('Continuing') : item.Status;
				return [{kind: 'status', text, ended: false}];
			}
			case 'upcomingEpisodeDate':
				return upcomingEpisodeText ? [{kind: 'upcoming', text: upcomingEpisodeText}] : [];
			case 'genres':
				return genres.length ? [{kind: 'text', text: genres.slice(0, 3).join(' · ')}] : [];
			case 'seerrAvailability':
				return hasSeerrPills ? [{kind: 'seerr'}] : [];
			default:
				return [];
		}
	};

	const all = orderedItems.flatMap((itemDef) => pieceFor(itemDef.id));
	// Whether the show is still running and what Seerr says of it close the line, side by side, in that order, wherever the
	// order puts them, so the two markers are not split up by the facts between.
	const closing = ['status', 'seerr'].flatMap((kind) => all.filter((piece) => piece.kind === kind));
	return [...all.filter((piece) => piece.kind !== 'status' && piece.kind !== 'seerr'), ...closing];
};
