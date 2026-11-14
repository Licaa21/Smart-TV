import {useCallback, useState, useRef, useEffect, memo} from 'react';
import {initialRowCount, grownRowCount, rememberedRowCount, rememberRowCount} from '../../utils/rowCap';
import {layoutRectOf} from '../../utils/slideScroll';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import MediaCard from '../MediaCard';
import {classicCardSize} from '../MediaCard/MediaCard';
import PlaceholderRow from './PlaceholderRow';
import CalendarSeeAllCard from './CalendarSeeAllCard';
import {KEYS} from '../../utils/keys';
import {sameCardUserData} from '../../utils/playedState';
import {useSettings} from '../../context/SettingsContext';
import {nearRowEnd} from '../../views/Browse/rowPaging';
import {classicShape} from '../../views/Browse/rowPeek';

import css from './MediaRow.module.less';

const SpottableDiv = Spottable('div');

const RowContainer = SpotlightContainerDecorator({
	enterTo: 'last-focused',
	// Entering a row for the first time should land on a card, not on the See All
	// tile that sits ahead of them.
	defaultElement: '[data-media-card]'
}, 'div');

const MediaRow = ({
	title,
	items,
	serverUrl,
	cardType = 'portrait',
	rowImageType = 'poster',
	onSelectItem,
	onFocus,
	onFocusItem,
	rowIndex,
	rowId,
	onNavigateUp,
	onNavigateDown,
	showServerBadge = false,
	subtitle,
	rowSpacing,
	className,
	registerRowRef,
	onSeeAll,
	seeAllLabel,
	onCalendarSeeAll,
	seeAllIcon,
	spotlightId: rowSpotlightId,
	menuOptions,
	loading,
	titleWidth,
	deferImages = false,
	homeText = false,
	posterLabels = false,
	hideWatchProgress = false,
	hideUnwatchedCount = false,
	onLoadMore,
	loadMoreAhead
}) => {
	const {settings} = useSettings();
	const scrollerRef = useRef(null);
	const scrollerRectRef = useRef(null);
	const scrollTimeoutRef = useRef(null);
	const rowElementRef = useRef(null);
	// How many of the cards are drawn. Everything, except on the older sets, where the row starts short.
	const [shownCount, setShownCount] = useState(() => (rowId ? rememberedRowCount(rowId) : null));
	const limit = items ? Math.min(items.length, shownCount === null ? initialRowCount(items.length) : shownCount) : 0;
	// The See All card ends the lane, so it waits until the cards before it have all been drawn.
	const seeAllShown = Boolean(onCalendarSeeAll) && limit === (items ? items.length : 0);
	useEffect(() => {
		if (rowId && shownCount !== null) rememberRowCount(rowId, shownCount);
	}, [shownCount, rowId]);

	const keyPrefix = rowId || title || rowIndex || '';

	useEffect(() => {
		const el = rowElementRef.current;
		registerRowRef?.(rowIndex, el);
		return () => registerRowRef?.(rowIndex, null);
	}, [rowIndex, registerRowRef, loading]);

	useEffect(() => {
		scrollerRectRef.current = null;
		const invalidate = () => {
			scrollerRectRef.current = null;
		};
		window.addEventListener('resize', invalidate);
		return () => window.removeEventListener('resize', invalidate);
	}, [settings.navbarPosition]);

	const handleSelect = useCallback((item) => {
		onSelectItem?.(item);
	}, [onSelectItem]);

	const itemCount = items?.length || 0;

	const handleFocus = useCallback((e) => {
		onFocus?.(rowIndex);
		// The next cards are drawn as focus nears the end of those that are.
		const grownCard = e.target.closest('.spottable');
		if (grownCard && grownCard.parentNode && items && items.length > 0) {
			const focusedIndex = Array.prototype.indexOf.call(grownCard.parentNode.children, grownCard);
			setShownCount((current) => {
				const count = Math.min(items.length, current === null ? initialRowCount(items.length) : current);
				const grown = grownRowCount(count, focusedIndex, items.length);
				return grown === count ? current : grown;
			});
		}

		// A row that pages asks for more once focus is among its last few cards, early enough that
		// the next page is usually in before the end is reached.
		const focused = e.target.closest('[data-media-card]');
		if (onLoadMore && focused && focused.parentNode) {
			const cards = focused.parentNode.querySelectorAll('[data-media-card]');
			const index = Array.prototype.indexOf.call(cards, focused);
			if (nearRowEnd(index, itemCount, loadMoreAhead)) onLoadMore(rowId);
		}

		// A hovered card already sits under the cursor, so nudging the lane
		// would only slide it away from the pointer.
		if (Spotlight.getPointerMode()) return;

		const card = e.target.closest('.spottable');
		const scroller = scrollerRef.current;
		if (card && scroller) {
			if (scrollTimeoutRef.current) {
				window.cancelAnimationFrame(scrollTimeoutRef.current);
			}
			scrollTimeoutRef.current = window.requestAnimationFrame(() => {
				const cardRect = layoutRectOf(card);
				if (!scrollerRectRef.current) {
					scrollerRectRef.current = scroller.getBoundingClientRect();
				}
				const scrollerRect = scrollerRectRef.current;
				if (cardRect.left < scrollerRect.left) {
					scroller.scrollLeft -= (scrollerRect.left - cardRect.left + 50);
				} else if (cardRect.right > scrollerRect.right) {
					scroller.scrollLeft += (cardRect.right - scrollerRect.right + 50);
				}
			});
		}
	}, [onFocus, rowIndex, items, onLoadMore, loadMoreAhead, itemCount, rowId]);

	const handleKeyDown = useCallback((e) => {
		if (e.keyCode === KEYS.UP && onNavigateUp) {
			e.preventDefault();
			e.stopPropagation();
			onNavigateUp(rowIndex);
		} else if (e.keyCode === KEYS.DOWN && onNavigateDown) {
			e.preventDefault();
			e.stopPropagation();
			onNavigateDown(rowIndex);
		}
	}, [rowIndex, onNavigateUp, onNavigateDown]);

	const handleWrapLeft = useCallback((e) => {
		e.preventDefault();
		e.stopPropagation();
		if (settings.navbarPosition === 'left') {
			if (!Spotlight.focus('navbar')) {
				Spotlight.move('left');
			}
		} else {
			Spotlight.focus(seeAllShown ? `media-${keyPrefix}-calendar-see-all` : `media-${keyPrefix}-${items[limit - 1].Id}`);
		}
	}, [items, limit, keyPrefix, settings.navbarPosition, seeAllShown]);

	const handleWrapRight = useCallback((e) => {
		e.preventDefault();
		e.stopPropagation();
		Spotlight.focus(`media-${keyPrefix}-${items[0].Id}`);
	}, [items, keyPrefix]);

	const handleCalendarSeeAll = useCallback(() => onCalendarSeeAll(rowId), [onCalendarSeeAll, rowId]);

	const rowClassName = [
		css.row,
		className || '',
		settings.fullScreenRows === true ? css.fullScreenRows : '',
		settings.fullScreenRows === true && settings.homeRowOverlay !== false ? css.withOverlay : ''
	].filter(Boolean).join(' ');
	// The padding slider owns the space below each row. Custom properties do not
	// survive the build for the older sets, so it arrives as an inline style.
	const rowStyle = typeof rowSpacing === 'number' ? {marginBottom: rowSpacing + 'px'} : undefined;

	if (loading) {
		const cardSize = classicCardSize(cardType === 'square' ? 'square' : 'portrait', settings.homeRowsPosterSize);
		return (
			<PlaceholderRow
				classes={css}
				className={rowClassName}
				style={rowStyle}
				title={title}
				titleWidth={titleWidth}
				subtitle={subtitle}
				cardWidth={cardSize.width}
				imageHeight={cardSize.height}
			/>
		);
	}

	if (!items || items.length === 0) return null;

	return (
		<RowContainer
			ref={rowElementRef}
			className={rowClassName}
			spotlightId={rowSpotlightId || `row-${rowIndex}`}
			data-row-index={rowIndex}
			onKeyDown={handleKeyDown}
			style={rowStyle}
		>
			<h2 className={css.title}>{title}</h2>
			{subtitle && <div className={css.subtitle}>{subtitle}</div>}
			<div className={css.scroller} ref={scrollerRef} onFocus={handleFocus} data-slide-scroll="x">
				<div className={css.items}>
						{onSeeAll && (
							<SpottableDiv
								className={css.seeAll}
								data-row-id={rowId}
								onClick={onSeeAll}
								onSpotlightLeft={handleWrapLeft}
							>
								<span className={css.seeAllChevron}>{'\u203A'}</span>
								<span className={css.seeAllLabel}>{seeAllLabel}</span>
							</SpottableDiv>
						)}
						{items.slice(0, limit).map((item, index) => {
							const spotlightId = `media-${keyPrefix}-${item.Id}`;
							const isFirst = index === 0;
							const isLast = index === limit - 1 && !seeAllShown;

							return (
								<MediaCard
									key={`${keyPrefix}-${item.Id}-${index}`}
									item={item}
									serverUrl={serverUrl}
									cardType={cardType}
									rowImageType={rowImageType}
									onSelect={handleSelect}
									onFocusItem={onFocusItem}
									showServerBadge={showServerBadge}
									eagerLoad={rowIndex === 0}
									deferImage={deferImages}
									spotlightId={spotlightId}
									onSpotlightLeft={isFirst && !onSeeAll ? handleWrapLeft : null}
									onSpotlightRight={isLast ? handleWrapRight : null}
									menuOptions={menuOptions}
									homeText={homeText}
									posterLabels={posterLabels}
									hideWatchProgress={hideWatchProgress}
									hideUnwatchedCount={hideUnwatchedCount}
								/>
							);
						})}
						{seeAllShown && (
							<CalendarSeeAllCard
								{...classicCardSize(classicShape(cardType, rowImageType), settings.homeRowsPosterSize)}
								spotlightId={`media-${keyPrefix}-calendar-see-all`}
								onClick={handleCalendarSeeAll}
								onSpotlightRight={handleWrapRight}
								icon={seeAllIcon}
							/>
						)}
				</div>
			</div>
		</RowContainer>
	);
};

const areRowPropsEqual = (prev, next) => {
	if (prev.rowId !== next.rowId) return false;
	// Presence only, since a caller's inline arrow would defeat the comparator.
	if (!prev.onLoadMore !== !next.onLoadMore) return false;
	if (prev.title !== next.title) return false;
	if (prev.cardType !== next.cardType) return false;
	if (prev.rowImageType !== next.rowImageType) return false;
	if (prev.serverUrl !== next.serverUrl) return false;
	if (prev.rowIndex !== next.rowIndex) return false;
	if (prev.showServerBadge !== next.showServerBadge) return false;
	if (prev.subtitle !== next.subtitle) return false;
	if (prev.rowSpacing !== next.rowSpacing) return false;
	if (prev.className !== next.className) return false;
	if (prev.seeAllLabel !== next.seeAllLabel) return false;
	if (prev.menuOptions !== next.menuOptions) return false;
	if (prev.spotlightId !== next.spotlightId) return false;
	if (prev.loading !== next.loading || prev.titleWidth !== next.titleWidth) return false;
	if (prev.deferImages !== next.deferImages || prev.posterLabels !== next.posterLabels) return false;
	if (prev.hideWatchProgress !== next.hideWatchProgress || prev.hideUnwatchedCount !== next.hideUnwatchedCount) return false;
	// Compare presence, not identity: an inline arrow from a caller would defeat
	// the whole comparator.
	if (!prev.onSeeAll !== !next.onSeeAll) return false;
	if (!prev.onCalendarSeeAll !== !next.onCalendarSeeAll) return false;
	if (prev.items === next.items) return true;
	if (prev.items?.length !== next.items?.length) return false;
	for (let i = 0; i < prev.items.length; i++) {
		if (prev.items[i].Id !== next.items[i].Id) return false;
		if (!sameCardUserData(prev.items[i], next.items[i])) return false;
	}
	return true;
};

export default memo(MediaRow, areRowPropsEqual);
