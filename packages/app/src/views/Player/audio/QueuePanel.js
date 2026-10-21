import {useCallback, useEffect, useRef, useState} from 'react';
import $L from '@enact/i18n/$L';
import {getImageUrl} from '../../../utils/helpers';
import {pointerHover} from '../../../utils/focusScroll';
import LoopMarquee from '../../../components/LoopMarquee';
import {SpottableDiv} from '../PlayerConstants';

import css from './QueuePanel.module.less';

const IconEqualizer = () => (
	<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
		<path d="M4 20h3V10H4v10zm6 0h3V4h-3v16zm6 0h3v-7h-3v7z" />
	</svg>
);

const artistOf = (track) => track?.AlbumArtist || track?.Artists?.[0] || track?.Album || '';

const QueueRow = ({track, isCurrent, serverUrl, focusDisabled, onSelect, onFocusRow}) => {
	const artId = track.AlbumId || track.Id;
	const artUrl = artId ? getImageUrl(track._serverUrl || serverUrl, artId, 'Primary', {maxHeight: 96}) : null;

	const [focused, setFocused] = useState(false);
	const handleClick = useCallback(() => onSelect(track), [onSelect, track]);
	const handleFocus = useCallback((e) => {
		setFocused(true);
		onFocusRow(e.currentTarget);
	}, [onFocusRow]);
	const handleBlur = useCallback(() => setFocused(false), []);

	return (
		<SpottableDiv
			className={`${css.row} ${isCurrent ? css.rowCurrent : ''}`}
			data-panel-entry={isCurrent ? 'true' : undefined}
			spotlightDisabled={focusDisabled}
			onClick={handleClick}
			onFocus={handleFocus}
			onBlur={handleBlur}
		>
			<div className={css.thumb}>
				{artUrl
					? <img className={css.thumbImg} src={artUrl} alt="" loading="lazy" />
					: <div className={css.thumbPlaceholder} />}
			</div>
			<div className={css.rowText}>
				<LoopMarquee className={css.rowTitle} text={track.Name} active={focused} />
				<div className={css.rowArtist}>{artistOf(track)}</div>
			</div>
			{isCurrent && <div className={css.rowIcon}><IconEqualizer /></div>}
		</SpottableDiv>
	);
};

// Sets scrollTop by hand, since webOS 2 and old WebKit don't take scrollIntoView options.
const scrollRowToTop = (container, el) => {
	if (container && el) container.scrollTop = el.offsetTop;
};

// The whole queue, played tracks included. Rows are focusable so the remote's
// 5-way walks them, and whichever row has focus sits at the top of the list.
const QueuePanel = ({items, currentId, serverUrl, focusDisabled, onSelectTrack, scrollerRef}) => {
	const handleFocusRow = useCallback((el) => {
		if (!pointerHover()) scrollRowToTop(scrollerRef?.current, el);
	}, [scrollerRef]);

	// It opens on the playing track and follows playback, except while the
	// remote is inside, where the focused row stays put.
	const focusDisabledRef = useRef(focusDisabled);
	focusDisabledRef.current = focusDisabled;
	useEffect(() => {
		const container = scrollerRef?.current;
		if (focusDisabledRef.current) scrollRowToTop(container, container?.querySelector('[data-panel-entry]'));
	}, [currentId, items, scrollerRef]);

	if (!items || items.length === 0) {
		return <div className={css.empty}>{$L('Queue is empty')}</div>;
	}

	return (
		<div className={css.list} ref={scrollerRef}>
			{items.map((track) => (
				<QueueRow
					key={track.Id}
					track={track}
					isCurrent={track.Id === currentId}
					serverUrl={serverUrl}
					focusDisabled={focusDisabled}
					onSelect={onSelectTrack}
					onFocusRow={handleFocusRow}
				/>
			))}
		</div>
	);
};

export default QueuePanel;
