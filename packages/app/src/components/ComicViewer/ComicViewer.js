import {useState, useEffect, useCallback, useRef} from 'react';
import $L from '@enact/i18n/$L';
import {KEYS} from '../../utils/keys';
import {fetchBook, startPage} from '../../utils/books';
import {openComicPages} from '../../utils/comicPages';
import useBookProgress from '../../hooks/useBookProgress';
import css from './ComicViewer.module.less';

// Pages this far from the current one stay ready, the rest are let go.
const KEEP_AROUND = 2;

const ComicViewer = ({item, archive, serverUrl, accessToken, onClose}) => {
	const [count, setCount] = useState(0);
	const [currentPage, setCurrentPage] = useState(0);
	const [urls, setUrls] = useState({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [imageLoaded, setImageLoaded] = useState(false);
	const [showInfo, setShowInfo] = useState(true);
	const infoTimerRef = useRef(null);
	const sourceRef = useRef(null);
	const urlsRef = useRef({});

	useBookProgress(item, currentPage, count);

	useEffect(() => {
		if (!item) return;

		let cancelled = false;
		const open = async () => {
			try {
				const buffer = await fetchBook(item, serverUrl, accessToken);
				const source = await openComicPages(buffer, archive);
				if (cancelled) {
					source.close();
					return;
				}
				sourceRef.current = source;
				setCount(source.names.length);
				setCurrentPage(startPage(item, source.names.length));
				setLoading(false);
			} catch (err) {
				if (!cancelled) {
					setError($L('Failed to open comic'));
					setLoading(false);
				}
			}
		};

		open();
		return () => {
			cancelled = true;
			if (sourceRef.current) sourceRef.current.close();
			sourceRef.current = null;
			Object.keys(urlsRef.current).forEach((key) => {
				if (urlsRef.current[key]) URL.revokeObjectURL(urlsRef.current[key]);
			});
			urlsRef.current = {};
		};
	}, [item, archive, serverUrl, accessToken]);

	useEffect(() => {
		const source = sourceRef.current;
		if (!source || count <= 0) return;

		Object.keys(urlsRef.current).forEach((key) => {
			if (Math.abs(Number(key) - currentPage) <= KEEP_AROUND) return;
			if (urlsRef.current[key]) URL.revokeObjectURL(urlsRef.current[key]);
			delete urlsRef.current[key];
		});

		for (let page = currentPage - 1; page <= currentPage + KEEP_AROUND; page++) {
			if (page < 0 || page >= count || page in urlsRef.current) continue;
			urlsRef.current[page] = null;
			source.load(page).then((blob) => {
				if (sourceRef.current !== source || urlsRef.current[page] !== null) return;
				urlsRef.current[page] = URL.createObjectURL(blob);
				setUrls({...urlsRef.current});
			}, () => {
				if (sourceRef.current === source) setError($L('Failed to open comic'));
			});
		}
		setUrls({...urlsRef.current});
	}, [currentPage, count]);

	const resetInfoTimer = useCallback(() => {
		setShowInfo(true);
		if (infoTimerRef.current) clearTimeout(infoTimerRef.current);
		infoTimerRef.current = setTimeout(() => setShowInfo(false), 4000);
	}, []);

	useEffect(() => {
		resetInfoTimer();
		return () => {
			if (infoTimerRef.current) clearTimeout(infoTimerRef.current);
		};
	}, [currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

	const goNext = useCallback(() => {
		if (count <= 1) return;
		setImageLoaded(false);
		setCurrentPage(prev => Math.min(prev + 1, count - 1));
		resetInfoTimer();
	}, [count, resetInfoTimer]);

	const goPrev = useCallback(() => {
		if (count <= 1) return;
		setImageLoaded(false);
		setCurrentPage(prev => Math.max(prev - 1, 0));
		resetInfoTimer();
	}, [count, resetInfoTimer]);

	useEffect(() => {
		const handleKeyDown = (e) => {
			const key = e.keyCode;
			if (key === KEYS.BACK || key === KEYS.ESCAPE || key === KEYS.BACKSPACE) {
				e.preventDefault();
				e.stopPropagation();
				onClose?.();
			} else if (key === 39 || key === 40) {
				e.preventDefault();
				e.stopPropagation();
				goNext();
			} else if (key === 37 || key === 38) {
				e.preventDefault();
				e.stopPropagation();
				goPrev();
			} else if (key === 13 || key === 32) {
				e.preventDefault();
				setShowInfo(prev => !prev);
			}
		};

		window.addEventListener('keydown', handleKeyDown, true);
		return () => window.removeEventListener('keydown', handleKeyDown, true);
	}, [onClose, goNext, goPrev]);

	const handleImageLoad = useCallback(() => {
		setImageLoaded(true);
	}, []);

	if (loading) {
		return (
			<div className={css.viewer}>
				<div className={css.loadingContainer}>
					<div className={css.spinner} />
					<div className={css.loadingText}>{$L('Opening comic...')}</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className={css.viewer}>
				<div className={css.loadingContainer}>
					<div className={css.errorText}>{error}</div>
					<div className={css.loadingText}>{$L('Press Back to close')}</div>
				</div>
			</div>
		);
	}

	if (count === 0) {
		return (
			<div className={css.viewer}>
				<div className={css.loadingContainer}>
					<div className={css.errorText}>{$L('No pages found.')}</div>
					<div className={css.loadingText}>{$L('Press Back to close')}</div>
				</div>
			</div>
		);
	}

	const url = urls[currentPage];
	return (
		<div className={css.viewer}>
			<div className={css.imageContainer}>
				{url && (
					<img
						key={currentPage}
						src={url}
						alt={$L('Page') + ' ' + (currentPage + 1)}
						className={css.page + (imageLoaded ? ' ' + css.pageLoaded : '')}
						onLoad={handleImageLoad}
					/>
				)}
				{(!url || !imageLoaded) && (
					<div className={css.loading}>
						<div className={css.spinner} />
					</div>
				)}
			</div>

			<div className={css.infoOverlay + (showInfo ? ' ' + css.infoVisible : '')}>
				<div className={css.topBar}>
					<div className={css.title}>{item.Name || $L('Comic')}</div>
				</div>
				<div className={css.bottomBar}>
					<div className={css.pageCounter}>
						{currentPage + 1} / {count}
					</div>
					<div className={css.navHint}>{'◀ ▶ ' + $L('Navigate')} &nbsp; {'OK ' + $L('Toggle info')} &nbsp; {$L('Back') + ' ' + $L('Close')}</div>
				</div>
			</div>
		</div>
	);
};

export default ComicViewer;
