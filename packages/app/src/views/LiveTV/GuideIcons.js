export const GUIDE_ICONS = {
	chevronLeft: 'M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z',
	chevronRight: 'M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
	sort: 'M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z',
	calendar: 'M20 3h-1V1h-2v2H7V1H5v2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13z',
	dvr: 'M17.5 10.5h2v1h-2v-1zm-13 0h2v3h-2v-3zM21 3H3c-1.11 0-2 .89-2 2v14c0 1.1.89 2 2 2h18c1.11 0 2-.9 2-2V5c0-1.11-.89-2-2-2zM8 13.5c0 .85-.65 1.5-1.5 1.5H3V9h3.5c.85 0 1.5.65 1.5 1.5v3zm4.62 1.5h-1.5L9.37 9h1.5l1 3.43 1-3.43h1.5l-1.75 6zM21 11.5c0 .6-.4 1.15-.9 1.4L21 15h-1.5l-.85-2H17.5v2H16V9h3.5c.85 0 1.5.65 1.5 1.5v1z',
	tv: 'M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z',
	record: 'M12 4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8z',
	seriesRecord: 'M0.98 12C0.98 7.59 4.59 3.98 9 3.98C13.41 3.98 17.02 7.59 17.02 12C17.02 16.41 13.41 20.02 9 20.02C4.59 20.02 0.98 16.41 0.98 12ZM17.02 4.27V6.33C19.31 7.17 21 9.38 21 12C21 14.62 19.31 16.83 17.02 17.67V19.73C20.44 18.84 23.02 15.75 23.02 12C23.02 8.25 20.44 5.16 17.02 4.27Z',
	continuesFrom: 'M17.59 18 19 16.59 14.42 12 19 7.41 17.59 6l-6 6zM11 18l1.41-1.41L7.83 12l4.58-4.59L11 6l-6 6z',
	check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
	favorite: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
};

export const MARK_SKIPPED_GREY = '#9e9e9e';

// The icon recordingMark asks for, the series one whenever a rule covers the showing, grey when that
// rule skips it.
export const RecordingMark = ({mark, className}) => (
	<svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={mark === 'skipped' ? {fill: MARK_SKIPPED_GREY} : undefined}>
		<path d={mark === 'record' ? GUIDE_ICONS.record : GUIDE_ICONS.seriesRecord} />
	</svg>
);

export const GuideIcon = ({path, className}) => (
	<svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
		<path d={path} />
	</svg>
);
