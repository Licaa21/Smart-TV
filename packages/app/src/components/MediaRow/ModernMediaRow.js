import {useCallback, useRef, useEffect, useState, memo} from 'react';
import {initialRowCount, grownRowCount, rememberedRowCount, rememberRowCount} from '../../utils/rowCap';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import Spotlight from '@enact/spotlight';
import ModernMediaCard from '../MediaCard/ModernMediaCard';
import {KEYS} from '../../utils/keys';
import {sameCardUserData} from '../../utils/playedState';
import {useSettings} from '../../context/SettingsContext';
import {getPlatform} from '../../platform';
import {MODERN_CAPTION_ROOM, modernCardMetrics} from '../MediaCard/modernCardLayout';
import PlaceholderRow from './PlaceholderRow';
import {useWarmRow, cardPosition} from './warmWindow';
import CalendarSeeAllCard from './CalendarSeeAllCard';
import CarouselPanel from './CarouselPanel';
import {nearRowEnd} from '../../views/Browse/rowPaging';

import css from './ModernMediaRow.module.less';

// The See all card keeps a poster's size, since it doesn't grow on focus like the title cards.
const seeAllSize = (posterSize) => {
	const {cardWidth, imageHeight} = modernCardMetrics({posterSize});
	return {width: cardWidth, height: imageHeight};
};

const RowContainer = SpotlightContainerDecorator({
	enterTo: 'last-focused'
}, 'div');

const ModernMediaRow = ({
	title,
	items,
	serverUrl,
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
	loading,
	titleWidth,
	cardType,
	rowImageType,
	spotlightId: rowSpotlightId,
	onLoadMore,
	menuOptions,
	deferImages = false,
	ratingsSurface,
	hideOverview = false,
	coreLook = false,
	posterLabels = false,
	hideWatchProgress = false,
	hideUnwatchedCount = false,
	leadingInset = 0,
	onCalendarSeeAll,
	seeAllIcon,
	carousel = false
}) => {
	const {settings} = useSettings();
	const lastFocusedIdRef = useRef(null);
	const scrollerRef = useRef(null);
	const scrollerLayoutRef = useRef(null);
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
	const [focusedItemId, setFocusedItemId] = useState(null);
	const [details, setDetails] = useState(null);
	const platform = useRef(getPlatform()).current;
	const {noteFocus, noteBlur, rankOf} = useWarmRow(rowIndex, settings.rememberRowCard);

	const keyPrefix = rowId || title || rowIndex || '';
	const itemCount = items?.length || 0;

	useEffect(() => {
		const el = document.querySelector(`[data-row-index="${rowIndex}"]`) || rowElementRef.current;
		registerRowRef?.(rowIndex, el);
		return () => registerRowRef?.(rowIndex, null);
	}, [rowIndex, registerRowRef, loading]);

	useEffect(() => {
		scrollerLayoutRef.current = null;
		const invalidate = () => {
			scrollerLayoutRef.current = null;
		};
		window.addEventListener('resize', invalidate);
		return () => window.removeEventListener('resize', invalidate);
	}, [settings.navbarPosition]);

	useEffect(() => {
		if (!focusedItemId) return;
		const hasFocusedItem = items?.some((item) => item.Id === focusedItemId);
		if (!hasFocusedItem) {
			setFocusedItemId(null);
		}
	}, [items, focusedItemId]);

	useEffect(() => {
		return () => {
			if (scrollTimeoutRef.current) {
				window.cancelAnimationFrame(scrollTimeoutRef.current);
			}
		};
	}, []);

	const handleSelect = useCallback((item) => {
		onSelectItem?.(item);
	}, [onSelectItem]);

	const handleFocus = useCallback((e) => {
		onFocus?.(rowIndex);
		// The next cards are drawn as focus nears the end of those that are.
		const grownCard = e.target.closest('.spottable');
		// Some cards come with a hidden helper node beside them, so the position is among the cards only
		const grownIndex = cardPosition(grownCard);
		noteFocus(grownIndex);
		if (grownIndex >= 0 && items && items.length > 0) {
			setShownCount((current) => {
				const count = Math.min(items.length, current === null ? initialRowCount(items.length) : current);
				const grown = grownRowCount(count, grownIndex, items.length);
				return grown === count ? current : grown;
			});
		}

		// A row that pages asks for more once focus is among its last few cards.
		if (onLoadMore && grownIndex >= 0 && nearRowEnd(grownIndex, itemCount)) onLoadMore(rowId);

		// A hovered card already sits under the cursor, so nudging the lane
		// would only slide it away from the pointer.
		if (Spotlight.getPointerMode()) {
			setDetails(null);
			return;
		}

		const scroller = scrollerRef.current;
		if (grownCard && scroller) {
			if (scrollTimeoutRef.current) {
				window.cancelAnimationFrame(scrollTimeoutRef.current);
			}
			// The focused card parks at the leading edge, so the ratings and overview
			// under it get the rest of the row. The last cards can't scroll that far
			// and keep what's left.
			scrollTimeoutRef.current = window.requestAnimationFrame(() => {
				const cards = Array.prototype.filter.call(grownCard.parentNode.children, (el) => el.classList.contains('spottable'));
				if (!scrollerLayoutRef.current) {
					const style = window.getComputedStyle(scroller);
					scrollerLayoutRef.current = {
						width: scroller.clientWidth,
						paddingLeft: parseFloat(style.paddingLeft) || 0,
						paddingRight: parseFloat(style.paddingRight) || 0
					};
				}
				const layout = scrollerLayoutRef.current;
				if (layout.gap === undefined && cards.length > 1) {
					layout.gap = parseFloat(window.getComputedStyle(cards[1]).marginLeft) || 0;
				}
				// Widths come from the cards' styles rather than their boxes, since the
				// card that just lost focus is still shrinking back.
				let cardStart = 0;
				for (let i = 0; i < cards.length && cards[i] !== grownCard; i++) {
					cardStart += parseFloat(cards[i].style.width) + layout.gap;
				}
				scroller.scrollLeft = cardStart;
				// Carousel cards leave their details to the panel, so there's no width to hand them.
				if (carousel) return;
				const cardLeft = layout.paddingLeft + cardStart - scroller.scrollLeft;
				setDetails({
					spotlightId: grownCard.getAttribute('data-spotlight-id'),
					width: layout.width - layout.paddingRight - cardLeft
				});
			});
		}
	}, [onFocus, rowIndex, items, onLoadMore, itemCount, rowId, noteFocus, carousel]);

	const handleBlur = useCallback((e) => {
		const nextTarget = e.relatedTarget;
		const rowNode = document.querySelector(`[data-row-index="${rowIndex}"]`) || rowElementRef.current;
		if (rowNode && nextTarget && typeof rowNode.contains === 'function' && rowNode.contains(nextTarget)) return;
		noteBlur();
		setFocusedItemId(null);
	}, [rowIndex, noteBlur]);

	const handleFocusedChange = useCallback((itemId) => {
		setFocusedItemId(itemId || null);
	}, []);
	// The See all card isn't a title, so the card before it folds back up.
	const handleSeeAllFocus = useCallback(() => setFocusedItemId(null), []);

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
		platform === 'webos' ? css.platformWebos : '',
		platform === 'tizen' ? css.platformTizen : '',
		settings.fullScreenRows === true ? css.fullScreenRows : '',
		coreLook ? css.coreLook : '',
		carousel ? css.carousel : '',
		typeof document !== 'undefined' && document.documentElement.classList.contains('legacy') ? css.platformLegacy : ''
	].filter(Boolean).join(' ');
	const rowStyle = typeof rowSpacing === 'number' ? {marginBottom: rowSpacing + 'px'} : undefined;

	if (loading) {
		const {cardWidth, imageHeight} = modernCardMetrics({
			posterSize: settings.homeRowsPosterSize,
			platform,
			isSquareItem: cardType === 'square',
			// a row of wide artwork holds its cards at the wide width, so the placeholders do too
			isStatic: Boolean(rowImageType) && rowImageType !== 'poster' && cardType !== 'square'
		});
		return (
			<PlaceholderRow
				classes={css}
				className={rowClassName}
				style={rowStyle}
				title={title}
				titleWidth={titleWidth}
				subtitle={subtitle}
				cardWidth={cardWidth}
				imageHeight={imageHeight}
				isModern
			>
				{carousel && <CarouselPanel />}
			</PlaceholderRow>
		);
	}

	if (!items || items.length === 0) return null;

	const focusedIndex = focusedItemId ? items.findIndex((item) => item.Id === focusedItemId) : -1;
	// The Carousel panel shows the card focus last stood on while the row has none
	if (focusedIndex >= 0) lastFocusedIdRef.current = focusedItemId;
	const landingIndex = Math.max(0, items.findIndex((item) => item.Id === lastFocusedIdRef.current));
	// Every row keeps room for three caption lines, so the next row never sits on a card's text.
	// Carousel cards have no captions, so the panel sits right under them.
	const captionFloor = carousel ? 0 : modernCardMetrics({posterSize: settings.homeRowsPosterSize}).imageHeight + MODERN_CAPTION_ROOM;

	return (
		<RowContainer
			ref={rowElementRef}
			className={rowClassName}
			spotlightId={rowSpotlightId || `row-${rowIndex}`}
			data-row-index={rowIndex}
			onKeyDown={handleKeyDown}
			onBlur={handleBlur}
			style={rowStyle}
		>
			<h2 className={css.title} style={coreLook ? {paddingLeft: `${leadingInset}px`} : undefined}>{title}</h2>
			{subtitle && <div className={css.subtitle}>{subtitle}</div>}
			{/* Core starts the cards a little in from the title, 20 points against its 16. */}
			<div className={css.scroller} ref={scrollerRef} onFocus={handleFocus} style={coreLook ? {paddingLeft: `${leadingInset + 6}px`} : undefined} data-slide-scroll="x">
				<div className={css.items} style={{minHeight: `${captionFloor}px`}}>
					{items.slice(0, limit).map((item, index) => {
						const spotlightId = `media-${keyPrefix}-${item.Id}`;
						const isFirst = index === 0;
						const isLast = index === limit - 1 && !seeAllShown;
						return (
							<ModernMediaCard
								key={`${keyPrefix}-${item.Id}-${index}`}
								item={item}
								serverUrl={serverUrl}
								onSelect={handleSelect}
								onFocusItem={onFocusItem}
								onFocused={handleFocusedChange}
								showServerBadge={showServerBadge}
								eagerLoad={rowIndex === 0}
								deferImage={deferImages}
								spotlightId={spotlightId}
								onSpotlightLeft={isFirst ? handleWrapLeft : null}
								onSpotlightRight={isLast ? handleWrapRight : null}
								isFocused={focusedItemId === item.Id}
								detailsWidth={details?.spotlightId === spotlightId ? details.width : undefined}
								isLibraryRow={rowId === 'library-tiles'}
								rowImageType={rowImageType}
								warmRank={rankOf(index, focusedIndex)}
								menuOptions={menuOptions}
								ratingsSurface={ratingsSurface}
								hideOverview={hideOverview}
								coreLook={coreLook}
								posterLabels={posterLabels}
								hideWatchProgress={hideWatchProgress}
								hideUnwatchedCount={hideUnwatchedCount}
								carousel={carousel}
							/>
						);
					})}
					{seeAllShown && (
						<CalendarSeeAllCard
							{...seeAllSize(settings.homeRowsPosterSize)}
							spotlightId={`media-${keyPrefix}-calendar-see-all`}
							onClick={handleCalendarSeeAll}
							onFocus={handleSeeAllFocus}
							onSpotlightRight={handleWrapRight}
							icon={seeAllIcon}
						/>
					)}
				</div>
			</div>
			{carousel && <CarouselPanel item={items[focusedIndex >= 0 ? focusedIndex : landingIndex]} serverUrl={serverUrl} hideOverview={hideOverview} rowFocused={focusedIndex >= 0} deferImage={deferImages} />}
		</RowContainer>
	);
};

const areRowPropsEqual = (prev, next) => {
	if (prev.rowId !== next.rowId) return false;
	if (prev.rowImageType !== next.rowImageType) return false;
	if (prev.title !== next.title) return false;
	if (prev.serverUrl !== next.serverUrl) return false;
	if (prev.rowIndex !== next.rowIndex) return false;
	if (prev.showServerBadge !== next.showServerBadge) return false;
	if (prev.subtitle !== next.subtitle) return false;
	if (prev.rowSpacing !== next.rowSpacing) return false;
	if (prev.className !== next.className) return false;
	if (prev.spotlightId !== next.spotlightId) return false;
	if (prev.menuOptions !== next.menuOptions) return false;
	// Presence only, since a caller's inline arrow would defeat the comparator.
	if (!prev.onLoadMore !== !next.onLoadMore) return false;
	if (prev.loading !== next.loading || prev.titleWidth !== next.titleWidth || prev.cardType !== next.cardType) return false;
	if (prev.deferImages !== next.deferImages || prev.ratingsSurface !== next.ratingsSurface || prev.hideOverview !== next.hideOverview) return false;
	if (prev.coreLook !== next.coreLook || prev.leadingInset !== next.leadingInset || prev.posterLabels !== next.posterLabels) return false;
	if (prev.hideWatchProgress !== next.hideWatchProgress || prev.hideUnwatchedCount !== next.hideUnwatchedCount) return false;
	if (!prev.onCalendarSeeAll !== !next.onCalendarSeeAll || prev.carousel !== next.carousel) return false;
	if (prev.items === next.items) return true;
	if (prev.items?.length !== next.items?.length) return false;
	for (let i = 0; i < prev.items.length; i++) {
		if (prev.items[i].Id !== next.items[i].Id) return false;
		if (!sameCardUserData(prev.items[i], next.items[i])) return false;
	}
	return true;
};

export default memo(ModernMediaRow, areRowPropsEqual);
