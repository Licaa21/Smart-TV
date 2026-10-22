import {useState, useEffect, useCallback, useRef} from 'react';
import $L from '@enact/i18n/$L';
import {isBackKey, KEYS} from '../../utils/keys';
import {epubTicks, fetchBook, newerServerEpubFraction} from '../../utils/books';
import {loadEpubJs, openEpub} from '../../utils/epubEngine';
import {getFromStorage, saveToStorage} from '../../services/storage';
import {getApiForItem} from '../../services/connectionPool';
import {api as activeApi, getServerType} from '../../services/jellyfinApi';
import viewerCss from '../ComicViewer/ComicViewer.module.less';
import css from './EpubReader.module.less';

const STYLE = {font: 'Georgia, \'Times New Roman\', serif', lineHeight: 1.5, fg: '#e6e6e6', link: '#8ab4f8'};

const placeKey = (item) => `epub_place_${item.ServerId || ''}_${item.Id}`;

const EpubReader = ({item, serverUrl, accessToken, onClose}) => {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [place, setPlace] = useState(null);
	const [showInfo, setShowInfo] = useState(true);
	const readerRef = useRef(null);
	const engineRef = useRef(null);
	const infoTimerRef = useRef(null);
	const saveTimerRef = useRef(null);
	const keyRef = useRef(null);

	const resetInfoTimer = useCallback(() => {
		setShowInfo(true);
		if (infoTimerRef.current) clearTimeout(infoTimerRef.current);
		infoTimerRef.current = setTimeout(() => setShowInfo(false), 4000);
	}, []);

	const handleKey = useCallback((e) => {
		const engine = engineRef.current;
		const key = e.keyCode;
		if (isBackKey(e)) {
			e.preventDefault();
			e.stopPropagation();
			onClose?.();
		} else if (key === KEYS.LEFT || key === KEYS.RIGHT) {
			e.preventDefault();
			e.stopPropagation();
			if (engine) engine.turnToward(key === KEYS.RIGHT ? 1 : -1);
		} else if (key === KEYS.UP || key === KEYS.DOWN) {
			e.preventDefault();
			e.stopPropagation();
			if (engine) engine[key === KEYS.DOWN ? 'next' : 'prev']();
		} else if (key === KEYS.ENTER || key === KEYS.SPACE) {
			e.preventDefault();
			setShowInfo(prev => !prev);
		}
	}, [onClose]);
	keyRef.current = handleKey;

	useEffect(() => {
		window.addEventListener('keydown', handleKey, true);
		return () => window.removeEventListener('keydown', handleKey, true);
	}, [handleKey]);

	useEffect(() => {
		if (!item) return;
		let cancelled = false;
		// Jellyfin's EPUB position is the percentage jellyfin-web reads. Emby has no
		// such contract, so it only gets this TV's own exact place.
		const reportsProgress = (item._serverType || getServerType()) !== 'emby';
		let latest = null;
		let reportedTicks = null;
		let bytes = 0;

		const save = () => {
			clearTimeout(saveTimerRef.current);
			saveTimerRef.current = null;
			const at = latest;
			if (!at) return;
			const savedAt = Date.now();
			const record = (reported) => ({cfi: at.cfi, ticks: reported, bytes, savedAt});
			saveToStorage(placeKey(item), record(reportedTicks)).catch(() => {});
			if (!reportsProgress || at.percentage == null) return;
			const ticks = epubTicks(at.percentage);
			if (ticks === reportedTicks) return;
			const api = getApiForItem(item) || activeApi;
			// The ticks kept with the place are the last the server took, which is how
			// the next open knows the server position is this one.
			api.setPlaybackPosition(item.Id, ticks).then(() => {
				reportedTicks = ticks;
				saveToStorage(placeKey(item), record(ticks)).catch(() => {});
				if (at.atEnd) return api.setWatched(item.Id, true);
			}).catch(() => {});
		};

		const open = async () => {
			try {
				const [ePub, buffer, stored] = await Promise.all([
					loadEpubJs(),
					fetchBook(item, serverUrl, accessToken),
					getFromStorage(placeKey(item)).catch(() => null)
				]);
				if (cancelled) return;
				bytes = buffer.byteLength;
				// A different file size means the server has another copy of the book,
				// where the saved spot may point anywhere.
				const local = stored && stored.cfi && stored.bytes === bytes ? stored : null;
				reportedTicks = local ? local.ticks : null;
				const fraction = reportsProgress ? newerServerEpubFraction(item, local) : null;
				const engine = await openEpub({
					ePub,
					element: readerRef.current,
					buffer,
					cfi: fraction == null && local ? local.cfi : null,
					fraction,
					style: {...STYLE, size: Math.round(window.innerHeight / 30)},
					onKey: (e) => keyRef.current(e),
					onRelocated: (at) => {
						latest = at;
						setPlace(at);
						clearTimeout(saveTimerRef.current);
						saveTimerRef.current = setTimeout(save, 2000);
					}
				});
				if (cancelled) {
					engine.destroy();
					return;
				}
				engineRef.current = engine;
				setLoading(false);
				resetInfoTimer();
			} catch (err) {
				if (!cancelled) {
					setError($L('Failed to open book'));
					setLoading(false);
				}
			}
		};

		open();
		return () => {
			cancelled = true;
			if (saveTimerRef.current) save();
			if (engineRef.current) engineRef.current.destroy();
			engineRef.current = null;
		};
	}, [item, serverUrl, accessToken, resetInfoTimer]);

	useEffect(() => () => {
		if (infoTimerRef.current) clearTimeout(infoTimerRef.current);
	}, []);

	useEffect(() => {
		if (place) resetInfoTimer();
	}, [place && place.cfi]); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<div className={viewerCss.viewer + ' ' + css.reader}>
			<div className={css.frame}>
				<div ref={readerRef} className={css.pages} />
			</div>
			{loading && (
				<div className={css.cover}>
					<div className={viewerCss.loadingContainer}>
						<div className={viewerCss.spinner} />
						<div className={viewerCss.loadingText}>{$L('Opening book...')}</div>
					</div>
				</div>
			)}
			{error && (
				<div className={css.cover}>
					<div className={viewerCss.loadingContainer}>
						<div className={viewerCss.errorText}>{error}</div>
						<div className={viewerCss.loadingText}>{$L('Press Back to close')}</div>
					</div>
				</div>
			)}
			{!loading && !error && (
				<div className={viewerCss.infoOverlay + (showInfo ? ' ' + viewerCss.infoVisible : '')}>
					<div className={viewerCss.topBar}>
						<div className={viewerCss.title}>{item.Name || $L('Book')}</div>
					</div>
					<div className={viewerCss.bottomBar}>
						<div className={viewerCss.pageCounter}>
							{place && place.percentage != null ? Math.round(place.percentage * 100) + '%' : ''}
							{place && place.minutesLeft ? ' · ' + $L('{minutes} min left in chapter').replace('{minutes}', place.minutesLeft) : ''}
						</div>
						<div className={viewerCss.navHint}>{'◀ ▶ ' + $L('Navigate')} &nbsp; {'OK ' + $L('Toggle info')} &nbsp; {$L('Back') + ' ' + $L('Close')}</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default EpubReader;
