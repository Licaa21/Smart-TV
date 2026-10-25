import {useCallback, useEffect, useState} from 'react';
import $L from '@enact/i18n/$L';
import Spotlight from '@enact/spotlight';
import {createPortal} from 'react-dom';

import {fetchVideoDetails} from '../../services/youtubeTrailer';
import {getBackdropId, getImageUrl} from '../../utils/helpers';
import {formatPlaybackDuration} from '../../utils/playbackTimeLabels';
import {OverlayContainer} from '../../utils/spotlightContainers';
import {DETAIL_ICON_PATHS} from './detailIcons';
import {SpottableDiv} from './detailsSpottables';

import css from './TrailerPicker.module.less';

const TICKS_PER_SECOND = 10000000;
const THUMB_PARAMS = {maxWidth: 320, quality: 90};

const Icon = ({path, className}) => (
	<svg className={className} viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d={path} /></svg>
);

// The side panel the trailer button opens when there's more than one trailer. YouTube rows learn
// their length and channel once the panel is up, and a row that never hears back goes without.
const TrailerPicker = ({choices, item, serverUrl, onPick, onClose}) => {
	const [details, setDetails] = useState({});

	useEffect(() => {
		if (!choices) return undefined;
		let cancelled = false;
		setDetails({});
		window.requestAnimationFrame(() => Spotlight.focus('trailer-picker-row-0'));
		choices.forEach(({videoId}) => {
			if (!videoId) return;
			fetchVideoDetails(videoId).then((found) => {
				if (!cancelled && found) setDetails((prev) => ({...prev, [videoId]: found}));
			}).catch(() => {});
		});
		return () => { cancelled = true; };
	}, [choices]);

	const handleRowClick = useCallback((e) => {
		const choice = choices?.[Number(e.currentTarget.dataset.index)];
		if (choice) onPick(choice);
	}, [choices, onPick]);

	const stopPropagation = useCallback((e) => e.stopPropagation(), []);

	if (!choices) return null;

	const backdropId = getBackdropId(item);
	const backdropThumb = backdropId ? getImageUrl(serverUrl, backdropId, 'Backdrop', THUMB_PARAMS) : null;

	const content = (
		<div className={css.scrim} onClick={onClose}>
			<OverlayContainer className={css.panel} spotlightId="trailer-picker" onClick={stopPropagation}>
				<div className={css.header}>
					<Icon className={css.headerIcon} path={DETAIL_ICON_PATHS.trailer} />
					<div className={css.headerText}>
						<div className={css.title}>{$L('Trailers')}</div>
						{item?.Name && <div className={css.itemName}>{item.Name}</div>}
					</div>
					<div className={css.count}>{$L('{count} trailers').replace('{count}', String(choices.length))}</div>
				</div>
				<div className={css.rows}>
					{choices.map((choice, index) => {
						const {local, videoId, title, subtitled} = choice;
						const found = videoId ? details[videoId] : null;
						const seconds = local ? (local.RunTimeTicks || 0) / TICKS_PER_SECOND : (found?.lengthSeconds || 0);
						let thumb = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
						if (local) {
							thumb = local.ImageTags?.Primary
								? getImageUrl(serverUrl, local.Id, 'Primary', {...THUMB_PARAMS, tag: local.ImageTags.Primary})
								: backdropThumb;
						}
						return (
							<SpottableDiv
								key={choice.key}
								className={css.row}
								data-index={index}
								onClick={handleRowClick}
								spotlightId={`trailer-picker-row-${index}`}
							>
								<div className={css.thumb}>
									{thumb && <img className={css.thumbImage} src={thumb} alt="" />}
									{seconds > 0 && <span className={css.duration}>{formatPlaybackDuration(seconds)}</span>}
								</div>
								<div className={css.text}>
									<div className={css.rowTitle}>{title || $L('Trailer')}</div>
									{found?.author && <div className={css.meta}>{found.author}</div>}
									{subtitled && (
										<span className={css.pill}>
											<Icon className={css.pillIcon} path={DETAIL_ICON_PATHS.subtitle} />
											{$L('Subtitled')}
										</span>
									)}
								</div>
							</SpottableDiv>
						);
					})}
				</div>
			</OverlayContainer>
		</div>
	);

	if (typeof document !== 'undefined' && document.body) {
		return createPortal(content, document.body);
	}
	return content;
};

export default TrailerPicker;
