import {useEffect, useRef} from 'react';
import {isKidsMode} from '../../../utils/kidsMode';

import {AnimeItemPills} from '../../../components/AnimeMarkerPills';
import ModernActionButtons from '../ModernActionButtons';
import SpotlightDetailContent from '../spotlight/SpotlightDetailContent';
import MinimalistEpisodes, {EPISODES_ID} from './MinimalistEpisodes';
import {
	drawsMinimalist, minimalistBranding, minimalistScrimAlpha, minimalistStillUrl, showsEpisodes
} from './minimalistRules';

import css from './MinimalistDetailContent.module.less';

// The smallest detail screen: artwork, the title, one row of buttons and the episodes. No cast, no
// chapters, no collection, no recommendations.
//
// Kids Mode always shows this one. Outside Kids Mode it is an ordinary style, for anyone who wants
// the screen to get out of the way.

// The widest the still is ever drawn, which is the cap the stylesheet puts on it.
const STILL_WIDTH = 440;

// Kids Mode offers Play and two others, which always fit, so there is nothing for an overflow menu
// to hold. Everywhere else the row is the usual five with the rest behind More.
const KIDS_VISIBLE = 4;
const VISIBLE = 5;

const MinimalistDetailContent = (props) => {
	const {
		item, settings, effectiveServerUrl, backdropUrl, logoUrl, onLogoError,
		seasons, episodes, seriesEpisodes, onSelectItem, spotlightBackRef
	} = props;

	const draws = drawsMinimalist(item.Type);
	const menuBackRef = useRef(null);

	// App closes the screen on BACK unless something here says it took the press, so the open menu
	// gets its say first. Left alone when Spotlight is drawing instead, since it has its own back
	// handler and more than one thing to close with it.
	useEffect(() => {
		if (!spotlightBackRef || !draws) return undefined;
		spotlightBackRef.current = () => Boolean(menuBackRef.current?.());
		return () => {
			spotlightBackRef.current = null;
		};
	});

	if (!draws) return <SpotlightDetailContent {...props} />;

	const kidsMode = isKidsMode(settings);
	const hasEpisodes = showsEpisodes(item.Type);
	const {title, episodeName} = minimalistBranding(item);
	const stillUrl = minimalistStillUrl(effectiveServerUrl, item, {settings, width: STILL_WIDTH});
	const scrimStyle = {backgroundColor: `rgba(0, 0, 0, ${minimalistScrimAlpha(settings.backdropBlurDetail)})`};

	return (
		<>
			<div className={css.backdrop}>
				{backdropUrl && <img className={css.backdropImage} src={backdropUrl} alt="" />}
				<div className={css.scrim} style={scrimStyle} />
			</div>
			<div className={`${css.content} ${settings.navbarPosition === 'left' ? css.sidebarOffset : ''}`}>
				<div className={css.upper}>
					<div className={css.headline}>
						{logoUrl
							? <img className={css.logo} src={logoUrl} onError={onLogoError} alt="" />
							: <h1 className={css.title}>{title}</h1>}
						{episodeName && <div className={css.episodeName}>{episodeName}</div>}
						<AnimeItemPills item={item} serverUrl={effectiveServerUrl} large className={css.markers} />
						<div className={css.actions}>
							<ModernActionButtons
								{...props}
								maxVisibleButtons={kidsMode ? KIDS_VISIBLE : VISIBLE}
								overflowAsMenu={!kidsMode}
								downTarget={hasEpisodes ? EPISODES_ID : null}
								menuBackRef={menuBackRef}
							/>
						</div>
					</div>
					{stillUrl && (
						<div className={css.aside}>
							<img className={css.still} src={stillUrl} alt="" />
						</div>
					)}
				</div>
				{hasEpisodes && (
					<MinimalistEpisodes
						item={item}
						settings={settings}
						serverUrl={effectiveServerUrl}
						seasons={seasons}
						episodes={episodes}
						seriesEpisodes={seriesEpisodes}
						onSelectEpisode={onSelectItem}
					/>
				)}
			</div>
		</>
	);
};

export default MinimalistDetailContent;
