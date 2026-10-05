// The first thing a new user sees after signing in.
//
// A few questions about how the app should look, then a screen showing what
// else is in here. It only ever asks about things it cant work out on its
// own, and only about things a person can answer by looking.

import {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import Spotlight from '@enact/spotlight';
import $L from '@enact/i18n/$L';

import {useAuth} from '../../context/AuthContext';
import {useSettings, isServerSyncInitialized} from '../../context/SettingsContext';
import {getActiveServer} from '../../services/multiServerManager';
import {isBuiltInThemeId, resolveThemeById} from '../../theme/themeRegistry';
import {toCssColor, toRgbTriplet} from '../../theme/themeSpec';
import LoadingSpinner from '../../components/LoadingSpinner';
import {rootScale} from '../../utils/rootScale';
import {remainingSteps, markComplete, deferThisLaunch, SETUP_QUESTION_STEPS} from '../../utils/setupWizardGate';
import {ModalContainer} from '../../utils/spotlightContainers';
import {keepFocusInView} from '../../utils/focusScroll';
import {getAudioLanguageOptions, getSubtitleLanguageOptions, getSubtitleModeOptions, getLabel} from '../Settings/settingsOptions';
import {ensurePreviewItemsLoaded} from './setupPreviewData';
import {MediaBarPreview, NavbarPreview, HomeRowsPreview, DetailStylePreview, SetupIcon, usePreviewPalette} from './SetupPreviews';
import css from './SetupWizard.module.less';

const SpottableDiv = Spottable('div');

const MEDIA_BAR_MODES = ['moonfin', 'makd', 'bookshelf', 'gallery', 'banner', 'aya', 'off'];

// Seven styles in one line would leave each too small to judge, so they sit
// four across and wrap onto a second row.
const MEDIA_BAR_COLUMNS = 4;

// What each card adds to its own width, from the margin the card carries.
const CARD_GUTTER = 24;

// Spotlight goes to whatever is nearest in a direction, and the cards just above the buttons are
// nearer than Next at the far end of the row. These point Right from Back and from the last card
// at Next, and Left from Next at Back.
const NEXT_TARGET = '[data-spotlight-id="setup-wizard-next"]';
const BACK_TARGET = '[data-spotlight-id="setup-wizard-back"]';

const mediaBarLabel = (mode) => {
	switch (mode) {
		case 'makd': return $L('MakD');
		case 'bookshelf': return $L('Bookshelf');
		case 'gallery': return $L('Gallery');
		case 'banner': return $L('Banner');
		case 'aya': return $L('Aya');
		case 'off': return $L('Off');
		default: return $L('Moonfin');
	}
};

const subtitleModeDescription = (mode) => {
	switch (mode) {
		case 'always': return $L('Automatically loads and displays subtitles every time a video starts.');
		case 'foreign': return $L('Automatically turns on subtitles if the default audio track is in a foreign language.');
		case 'forced': return $L('Only loads subtitles explicitly tagged with the forced metadata flag.');
		case 'none': return $L('Completely disables automatic subtitle loading.');
		default: return $L("Plays tracks internally flagged in the media file's metadata as \"default\" or \"forced\".");
	}
};

const questionFor = (step) => {
	switch (step) {
		case 'navbar': return $L('Where should navigation go?');
		case 'mediaBar': return $L('How should the top of your Home screen look?');
		case 'homeRows': return $L('How should your rows look?');
		case 'detailStyle': return $L('How should a movie or show look when you open it?');
		default: return $L("You're set. Here's what else is in here.");
	}
};

const useBodySize = () => {
	const ref = useRef(null);
	const [size, setSize] = useState({width: 0, height: 0});
	useEffect(() => {
		const measure = () => {
			const node = ref.current;
			if (!node) return;
			setSize((prev) => (
				prev.width === node.offsetWidth && prev.height === node.offsetHeight
					? prev
					: {width: node.offsetWidth, height: node.offsetHeight}
			));
		};
		measure();
		window.addEventListener('resize', measure);
		return () => window.removeEventListener('resize', measure);
	});
	return [ref, size];
};

// One pickable layout, shown rather than described.
const OptionCard = ({spotlightId, label, hint, selected, preview, onSelect, width, t, ...rest}) => {
	const [focused, setFocused] = useState(false);
	const handleFocus = useCallback(() => setFocused(true), []);
	const handleBlur = useCallback(() => setFocused(false), []);
	const borderColor = focused ? t.onSurface : t.onSurfaceA(selected ? 0.34 : 0.14);
	return (
		<SpottableDiv
			{...rest}
			spotlightId={spotlightId}
			className={css.optionCard}
			style={{width}}
			onClick={onSelect}
			onFocus={handleFocus}
			onBlur={handleBlur}
		>
			<div
				className={css.optionPreviewBorder}
				style={{
					border: `${focused ? 4 : 2}px solid ${borderColor}`,
					boxShadow: focused ? `0px 0px 44px 2px ${t.onSurfaceA(0.34)}` : 'none',
					transform: focused ? 'scale(1.035)' : 'scale(1)'
				}}
			>
				<div className={css.optionPreviewFrame} style={{backgroundColor: t.surface}}>
					{preview}
				</div>
			</div>
			<div className={css.optionLabelRow}>
				{selected && <div className={css.selectedDot} style={{backgroundColor: t.onSurface}} />}
				<div className={css.optionLabel} style={{color: selected ? t.onSurface : t.onSurfaceA(0.7), fontWeight: selected ? 600 : 400}}>
					{label}
				</div>
			</div>
			{hint && <div className={css.optionHint} style={{color: t.onSurfaceA(0.55)}}>{hint}</div>}
		</SpottableDiv>
	);
};

const TextButton = ({spotlightId, label, onSelect, onFocusChange, t, ...rest}) => {
	const [focused, setFocused] = useState(false);
	const handleFocus = useCallback(() => {
		setFocused(true);
		if (onFocusChange) onFocusChange(true);
	}, [onFocusChange]);
	const handleBlur = useCallback(() => {
		setFocused(false);
		if (onFocusChange) onFocusChange(false);
	}, [onFocusChange]);
	return (
		<SpottableDiv
			{...rest}
			spotlightId={spotlightId}
			className={css.textButton}
			style={{
				color: t.onSurfaceA(focused ? 1 : 0.62),
				borderBottomColor: focused ? t.onSurface : 'transparent'
			}}
			onClick={onSelect}
			onFocus={handleFocus}
			onBlur={handleBlur}
		>
			{label}
		</SpottableDiv>
	);
};

const PrimaryButton = ({spotlightId, label, onSelect, t, ...rest}) => {
	const [focused, setFocused] = useState(false);
	const handleFocus = useCallback(() => setFocused(true), []);
	const handleBlur = useCallback(() => setFocused(false), []);
	return (
		<SpottableDiv
			{...rest}
			spotlightId={spotlightId}
			className={css.primaryButton}
			style={{
				backgroundColor: t.accent,
				color: t.onAccent,
				borderColor: focused ? t.onSurface : 'transparent',
				boxShadow: focused ? `0px 0px 36px 2px ${t.accentA(0.5)}` : 'none'
			}}
			onClick={onSelect}
			onFocus={handleFocus}
			onBlur={handleBlur}
		>
			{label}
		</SpottableDiv>
	);
};

const ThemeSwatch = ({theme, selected, onSelect, t}) => {
	const [focused, setFocused] = useState(false);
	const handleFocus = useCallback(() => setFocused(true), []);
	const handleBlur = useCallback(() => setFocused(false), []);
	const spec = resolveThemeById(theme.id);
	return (
		<SpottableDiv
			spotlightId={`setup-wizard-theme-${theme.id}`}
			className={css.themeSwatch}
			onClick={onSelect}
			onFocus={handleFocus}
			onBlur={handleBlur}
		>
			<div
				className={css.swatchBox}
				style={{
					background: `linear-gradient(to bottom right, ${toCssColor(spec.colors.surface)}, ${toCssColor(spec.colors.background)})`,
					border: `${focused ? 4 : 2}px solid ${focused ? t.onSurface : t.onSurfaceA(selected ? 0.4 : 0.16)}`,
					boxShadow: focused ? `0px 0px 36px ${t.onSurfaceA(0.3)}` : 'none'
				}}
			>
				<div className={css.swatchInner}>
					<div className={css.swatchAccentDot} style={{backgroundColor: toCssColor(spec.colors.accent)}} />
					<div className={css.swatchBar} style={{backgroundColor: `rgba(${toRgbTriplet(spec.colors.onSurface)}, 0.7)`}} />
				</div>
			</div>
			<div className={css.swatchLabel} style={{color: t.onSurfaceA(selected ? 1 : 0.62)}}>
				{theme.displayName}
			</div>
		</SpottableDiv>
	);
};

// The box a playback row sits in, lit up while focused.
const panelStyle = (t, focused, radius) => ({
	borderRadius: radius,
	backgroundColor: t.onSurfaceA(focused ? 0.1 : 0.04),
	border: `2px solid ${focused ? t.onSurface : t.onSurfaceA(0.14)}`
});

// The answer on a row that opens a list.
const ChosenValue = ({label, t}) => (
	<div className={css.chosenValue}>
		<div className={css.chosenLabel} style={{color: t.onSurface}}>{label}</div>
		<SetupIcon name='chevron_right' size={32} color={t.onSurfaceA(0.55)} />
	</div>
);

// The row takes the press and the focus, the switch only shows the state.
const SwitchValue = ({on, t}) => (
	<div className={css.switchTrack} style={{backgroundColor: on ? t.accent : t.onSurfaceA(0.25)}}>
		<div className={css.switchKnob} style={{backgroundColor: on ? t.onAccent : t.onSurface, transform: on ? 'translateX(28px)' : 'translateX(0)'}} />
	</div>
);

// One playback setting: its name, an optional line under it, and its current
// answer on the right.
const SettingRow = ({spotlightId, label, hint, trailing, onSelect, t}) => {
	const [focused, setFocused] = useState(false);
	const handleFocus = useCallback(() => setFocused(true), []);
	const handleBlur = useCallback(() => setFocused(false), []);
	return (
		<SpottableDiv
			spotlightId={spotlightId}
			className={css.settingRow}
			style={panelStyle(t, focused, 16)}
			onClick={onSelect}
			onFocus={handleFocus}
			onBlur={handleBlur}
		>
			<div className={css.settingRowText}>
				<div className={css.settingRowLabel} style={{color: t.onSurfaceA(0.7)}}>{label}</div>
				{hint && <div className={css.settingRowHint} style={{color: t.onSurfaceA(0.5)}}>{hint}</div>}
			</div>
			{trailing}
		</SpottableDiv>
	);
};

// A header that shows the current answers while folded, opening downwards
// into its children when pressed.
const CollapsibleSection = ({spotlightId, expanded, icon, title, badge, summary, onToggle, t, children}) => {
	const [focused, setFocused] = useState(false);
	const handleFocus = useCallback(() => setFocused(true), []);
	const handleBlur = useCallback(() => setFocused(false), []);
	return (
		<div className={css.collapsible}>
			<SpottableDiv
				spotlightId={spotlightId}
				className={css.collapsibleHeader}
				style={panelStyle(t, focused, 20)}
				onClick={onToggle}
				onFocus={handleFocus}
				onBlur={handleBlur}
			>
				<SetupIcon name={icon} size={30} color={t.onSurface} style={{marginRight: 16, flexShrink: 0}} />
				<div className={css.collapsibleText}>
					<div className={css.collapsibleTitle} style={{color: t.onSurface}}>
						{title}
						<span className={css.collapsibleBadge} style={{color: t.onSurfaceA(0.55)}}>{badge}</span>
					</div>
					{!expanded && <div className={css.collapsibleSummary} style={{color: t.onSurfaceA(0.65)}}>{summary}</div>}
				</div>
				<SetupIcon name='keyboard_arrow_down' size={40} color={t.onSurfaceA(0.7)} style={{flexShrink: 0, transition: 'transform 180ms', transform: expanded ? 'rotate(180deg)' : 'none'}} />
			</SpottableDiv>
			{expanded && children}
		</div>
	);
};

const PickerOption = ({option, selected, description, onPick, t}) => {
	const [focused, setFocused] = useState(false);
	const handleFocus = useCallback(() => setFocused(true), []);
	const handleBlur = useCallback(() => setFocused(false), []);
	const handleClick = useCallback(() => onPick(option.value), [onPick, option.value]);
	return (
		<SpottableDiv
			className={css.pickerOption}
			style={{backgroundColor: focused ? t.onSurfaceA(0.12) : 'transparent'}}
			data-selected={selected ? 'true' : undefined}
			onClick={handleClick}
			onFocus={handleFocus}
			onBlur={handleBlur}
		>
			<div className={css.pickerOptionText}>
				<div className={css.pickerOptionLabel} style={{color: t.onSurface}}>{option.label}</div>
				{description && <div className={css.pickerOptionHint} style={{color: t.onSurfaceA(0.6)}}>{description}</div>}
			</div>
			{selected && <SetupIcon name='check' size={36} color={t.accent} />}
		</SpottableDiv>
	);
};

// The list a row opens: every value, the current one ticked, and an optional
// line under each. Opens on the current value and hands focus back on close.
const OptionPicker = ({title, options, current, descriptionOf, onPick, onClose, t}) => {
	const stopPropagation = useCallback((ev) => ev.stopPropagation(), []);
	return (
		<div className={css.pickerOverlay} style={{backgroundColor: t.scrimA(0.6)}} onClick={onClose}>
			<ModalContainer
				className={css.pickerPanel}
				style={{backgroundColor: t.surface, border: `2px solid ${t.onSurfaceA(0.22)}`, boxShadow: `0px 0px 60px 2px ${t.scrimA(0.4)}`}}
				onClick={stopPropagation}
				spotlightId='setup-wizard-picker'
			>
				<div className={css.pickerTitle} style={{color: t.onSurface}}>{title}</div>
				<div className={css.pickerList} onFocus={keepFocusInView}>
					{options.map((option) => (
						<PickerOption
							key={String(option.value)}
							option={option}
							selected={option.value === current}
							description={descriptionOf ? descriptionOf(option.value) : null}
							onPick={onPick}
							t={t}
						/>
					))}
				</div>
			</ModalContainer>
		</div>
	);
};

// The closing screen. Pick a look, the optional playback languages, then a
// list of what else lives in Settings. Only the theme writes anything here,
// the languages go out with the rest of the answers.
const TourStep = ({t, playback}) => {
	const {availableThemes, activeThemeId, selectThemeById} = useSettings();
	const builtIns = availableThemes.filter((theme) => isBuiltInThemeId(theme.id));
	const bullets = [
		$L('Seerr requests'),
		$L('SyncPlay watch parties'),
		$L('Live TV'),
		$L('Custom themes'),
		$L('And plenty more')
	];
	return (
		<div className={css.tourScroll} onFocus={keepFocusInView}>
			<div className={css.tourLabel} style={{color: t.onSurfaceA(0.62)}}>{$L('Pick a look')}</div>
			<div className={css.swatchRow}>
				{builtIns.map((theme) => (
					<ThemeSwatch
						key={theme.id}
						theme={theme}
						selected={activeThemeId === theme.id}
						// Written straight away rather than held back with the rest,
						// because the point is that the wizard restyles around you as
						// you move across the row.
						onSelect={() => selectThemeById(theme.id)} // eslint-disable-line react/jsx-no-bind
						t={t}
					/>
				))}
			</div>
			{playback}
			<div className={css.tourMoreBox} style={{backgroundColor: t.onSurfaceA(0.04), border: `2px solid ${t.onSurfaceA(0.14)}`}}>
				<div className={css.tourMoreHeader} style={{color: t.onSurface}}>
					<SetupIcon name='settings' size={36} color={t.onSurface} style={{marginRight: 16}} />
					{$L('There is more waiting in Settings')}
				</div>
				{bullets.map((entry) => (
					<div key={entry} className={css.tourBullet} style={{color: t.onSurfaceA(0.65)}}>
						<div className={css.tourBulletMark}>{'•'}</div>
						<div>{entry}</div>
					</div>
				))}
			</div>
		</div>
	);
};

const SetupWizard = ({onDone, backHandlerRef}) => {
	const {api, serverUrl, user} = useAuth();
	const {settings, initialSyncSettled, updateSettings, activeThemeId} = useSettings();
	const t = usePreviewPalette();

	const [steps, setSteps] = useState([]);
	const [index, setIndex] = useState(0);
	const [ready, setReady] = useState(false);
	const [advancing, setAdvancing] = useState(true);
	const [answers, setAnswers] = useState({});
	const [playbackExpanded, setPlaybackExpanded] = useState(false);
	const [picker, setPicker] = useState(null);

	const syncSettledRef = useRef(initialSyncSettled);
	syncSettledRef.current = initialSyncSettled;
	const settingsRef = useRef(settings);
	settingsRef.current = settings;
	const skipFocusedRef = useRef(false);
	const leavingRef = useRef(false);
	const pickerRef = useRef(picker);
	pickerRef.current = picker;
	const pickerOpenerRef = useRef(null);
	const answersRef = useRef(answers);
	answersRef.current = answers;
	const stepsRef = useRef(steps);
	stepsRef.current = steps;
	const indexRef = useRef(index);
	indexRef.current = index;

	const leave = useCallback(() => {
		if (leavingRef.current) return;
		leavingRef.current = true;
		onDone();
	}, [onDone]);

	const completeAndLeave = useCallback(async () => {
		const active = await getActiveServer().catch(() => null);
		await markComplete(active?.id, serverUrl, user?.Id).catch(() => null);
		leave();
	}, [serverUrl, user?.Id, leave]);

	const finish = useCallback(async () => {
		const held = answersRef.current;
		const batch = {};
		for (const key of Object.keys(held)) {
			if (held[key] != null) batch[key] = held[key];
		}
		// With subtitles off the language stays as it was.
		const subtitleMode = held.subtitleMode != null ? held.subtitleMode : settingsRef.current.subtitleMode;
		if (subtitleMode === 'none') delete batch.subtitleLanguage;
		// Held rather than written as they are chosen. Each write kicks off a
		// profile push that the plugin then echoes back, so the answers across
		// the steps land as one batch at the end.
		if (Object.keys(batch).length > 0) updateSettings(batch);
		await completeAndLeave();
	}, [updateSettings, completeAndLeave]);

	// Skipping leaves without answering anything, and without being asked
	// again. What it must not do is write the defaults, which would mark them
	// as deliberate choices and stop any future device from asking either.
	const skip = completeAndLeave;

	const advance = useCallback(() => {
		if (indexRef.current >= stepsRef.current.length - 1) {
			finish();
			return;
		}
		// Costs nothing once artwork is in, and gives a slow server another
		// chance to fill the previews before the next step shows them.
		ensurePreviewItemsLoaded(api);
		setAdvancing(true);
		setIndex((value) => value + 1);
	}, [api, finish]);

	const goBack = useCallback(() => {
		if (indexRef.current === 0) return;
		setAdvancing(false);
		setIndex((value) => value - 1);
	}, []);

	const closePicker = useCallback(() => {
		setPicker(null);
		window.requestAnimationFrame(() => {
			if (pickerOpenerRef.current) Spotlight.focus(pickerOpenerRef.current);
		});
	}, []);

	// BACK never leaves the wizard on the first press. It moves to Skip, so
	// the way out is always something the user chose to press twice.
	useEffect(() => {
		if (!backHandlerRef) return undefined;
		backHandlerRef.current = () => {
			if (pickerRef.current) {
				closePicker();
				return;
			}
			if (skipFocusedRef.current) {
				skip();
				return;
			}
			Spotlight.focus('setup-wizard-skip');
		};
		return () => {
			backHandlerRef.current = null;
		};
	}, [backHandlerRef, skip, closePicker]);

	useEffect(() => {
		let cancelled = false;
		const prepare = async () => {
			// The plugin resolves a profile shortly after sign in and applies it
			// whole. Answering before that lands means watching the answers get
			// overwritten a second later.
			const deadline = Date.now() + 3000;
			let settled = false;
			while (Date.now() < deadline) {
				if (syncSettledRef.current) {
					settled = true;
					break;
				}
				await new Promise((resolve) => setTimeout(resolve, 120));
			}
			if (cancelled) return;
			if (!settled) {
				// A server with no plugin on it has no profile coming, so there is
				// nothing left to wait for. One that has it is still going to push,
				// and it would land on top of anything chosen here.
				const noProfileComing = !settingsRef.current.useMoonfinPlugin &&
					await isServerSyncInitialized(serverUrl).catch(() => false);
				if (cancelled) return;
				if (!noProfileComing) {
					deferThisLaunch();
					leave();
					return;
				}
			}
			// Kicked off now so the previews carry real artwork by the time the
			// user reaches them.
			ensurePreviewItemsLoaded(api);
			const remaining = remainingSteps();
			if (remaining.length === 0) {
				// Everything here was answered on another device or an earlier
				// visit. Nothing to show, and nothing to ask again.
				await completeAndLeave();
				return;
			}
			if (cancelled) return;
			setSteps(remaining);
			setReady(true);
		};
		prepare();
		return () => {
			cancelled = true;
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	const step = ready ? steps[index] : null;

	// The held answer when there is one, the current setting otherwise, which
	// always exists because the provider merges the defaults in.
	const selectedFor = useCallback((settingKey) => {
		const held = answers[settingKey];
		return held != null ? held : settings[settingKey];
	}, [answers, settings]);

	// Land focus on the choice already in effect, the way every step opens.
	useEffect(() => {
		if (!step) return;
		const question = SETUP_QUESTION_STEPS.find((entry) => entry.step === step);
		const target = question
			? `setup-card-${step}-${selectedFor(question.settingKey)}`
			: `setup-wizard-theme-${activeThemeId}`;
		const timer = setTimeout(() => Spotlight.focus(target), 50);
		return () => clearTimeout(timer);
	}, [step]); // eslint-disable-line react-hooks/exhaustive-deps

	const [bodyRef, bodySize] = useBodySize();

	// Sized from the width the row gives each card and from the height the
	// body can hold, so a focused card grows without running out of the step.
	// labelAllowance is the room the text under the preview needs.
	// The body is measured in screen pixels, while the gutter, the label room
	// and the card's margin come from the stylesheet and grow with the UI
	// scale, so they're scaled to match.
	const cardWidthFor = useCallback((columns, rows, labelAllowance) => {
		if (!bodySize.width) return 240;
		const scale = rootScale();
		const byWidth = (bodySize.width - CARD_GUTTER * scale * columns) / columns;
		const byHeight = ((bodySize.height / rows) - (labelAllowance + 24) * scale) * (16 / 9);
		return Math.floor(Math.min(840, Math.max(160, Math.min(byWidth, byHeight))));
	}, [bodySize]);

	const pick = useCallback((settingKey, value) => {
		setAnswers((prev) => ({...prev, [settingKey]: value}));
	}, []);

	const openPicker = useCallback((next) => {
		pickerOpenerRef.current = document.activeElement;
		setPicker(next);
		window.requestAnimationFrame(() => Spotlight.focus('setup-wizard-picker'));
	}, []);

	const handlePicked = useCallback((value) => {
		const open = pickerRef.current;
		if (open && value !== open.current) pick(open.settingKey, value);
		closePicker();
	}, [pick, closePicker]);

	const togglePlayback = useCallback(() => setPlaybackExpanded((value) => !value), []);
	const togglePreferDefaultAudio = useCallback(() => {
		pick('preferDefaultAudioTrack', !selectedFor('preferDefaultAudioTrack'));
	}, [pick, selectedFor]);

	// The optional playback languages under the themes. Sign-in has already
	// filled these in from the server or the device, so it starts folded up
	// with those answers showing. The same lists the audio and subtitle
	// settings offer, and a language the server brought in that isnt in them
	// shows as its code, the way the settings show it.
	const playbackSection = useMemo(() => {
		if (step !== 'tour') return null;
		const audioOptions = getAudioLanguageOptions();
		const subtitleOptions = getSubtitleLanguageOptions();
		const modeOptions = getSubtitleModeOptions();
		const audio = selectedFor('audioLanguage');
		const subtitle = selectedFor('subtitleLanguage');
		const mode = selectedFor('subtitleMode');
		const audioLabel = getLabel(audioOptions, audio, audio);
		const subtitleLabel = getLabel(subtitleOptions, subtitle, subtitle);
		const modeLabel = getLabel(modeOptions, mode, $L('Flagged'));
		const subtitlesOn = mode !== 'none';
		return (
			<CollapsibleSection
				spotlightId='setup-wizard-playback'
				expanded={playbackExpanded}
				icon='translate'
				title={$L('Playback languages')}
				badge={$L('Optional')}
				summary={[audioLabel, subtitlesOn ? subtitleLabel : null, modeLabel].filter(Boolean).join(' · ')}
				onToggle={togglePlayback}
				t={t}
			>
				<SettingRow
					spotlightId='setup-wizard-audioLanguage'
					label={$L('Default Audio Language')}
					trailing={<ChosenValue label={audioLabel} t={t} />}
					onSelect={() => openPicker({settingKey: 'audioLanguage', title: $L('Default Audio Language'), options: audioOptions, current: audio})} // eslint-disable-line react/jsx-no-bind
					t={t}
				/>
				<SettingRow
					spotlightId='setup-wizard-preferDefaultAudioTrack'
					label={$L('Prefer Default Audio Track')}
					hint={$L('Pick the track the file marks as default before matching languages')}
					trailing={<SwitchValue on={Boolean(selectedFor('preferDefaultAudioTrack'))} t={t} />}
					onSelect={togglePreferDefaultAudio}
					t={t}
				/>
				{/* Mode stays above the language so hiding the language doesnt move the focused row. */}
				<SettingRow
					spotlightId='setup-wizard-subtitleMode'
					label={$L('Subtitle Mode')}
					trailing={<ChosenValue label={modeLabel} t={t} />}
					onSelect={() => openPicker({settingKey: 'subtitleMode', title: $L('Subtitle Mode'), options: modeOptions, current: mode, descriptionOf: subtitleModeDescription})} // eslint-disable-line react/jsx-no-bind
					t={t}
				/>
				{subtitlesOn && (
					<SettingRow
						spotlightId='setup-wizard-subtitleLanguage'
						label={$L('Default Subtitle Language')}
						trailing={<ChosenValue label={subtitleLabel} t={t} />}
						onSelect={() => openPicker({settingKey: 'subtitleLanguage', title: $L('Default Subtitle Language'), options: subtitleOptions, current: subtitle})} // eslint-disable-line react/jsx-no-bind
						t={t}
					/>
				)}
			</CollapsibleSection>
		);
	}, [step, selectedFor, playbackExpanded, togglePlayback, togglePreferDefaultAudio, openPicker, t]);

	const handleSkipFocusChange = useCallback((focused) => {
		skipFocusedRef.current = focused;
	}, []);

	const stepContent = useMemo(() => {
		if (!step) return null;
		if (step === 'navbar') {
			const selected = selectedFor('navbarPosition');
			const width = cardWidthFor(2, 1, 60);
			return (
				<div className={css.optionRow}>
					<OptionCard spotlightId='setup-card-navbar-top' label={$L('Top Bar')} selected={selected === 'top'} preview={<NavbarPreview position='top' />} onSelect={() => pick('navbarPosition', 'top')} width={width} t={t} /> {/* eslint-disable-line react/jsx-no-bind */}
					<OptionCard spotlightId='setup-card-navbar-left' label={$L('Left Sidebar')} selected={selected === 'left'} preview={<NavbarPreview position='left' />} onSelect={() => pick('navbarPosition', 'left')} width={width} t={t} data-spot-right={NEXT_TARGET} /> {/* eslint-disable-line react/jsx-no-bind */}
				</div>
			);
		}
		if (step === 'mediaBar') {
			const selected = selectedFor('featuredBarStyle');
			const width = cardWidthFor(MEDIA_BAR_COLUMNS, 2, 60);
			// Capping the row keeps the wrap at four. A card sized down to fit
			// the height would otherwise let a fifth slip onto the line. The
			// spare pixel keeps rounding in the scaled margins from wrapping the
			// fourth, and is far too little to let a fifth in.
			const rowStyle = {
				maxWidth: MEDIA_BAR_COLUMNS * (width + CARD_GUTTER * rootScale()) + 1,
				margin: '0 auto'
			};
			return (
				<div className={css.optionRow} style={rowStyle}>
					{MEDIA_BAR_MODES.map((mode) => (
						<OptionCard
							key={mode}
							spotlightId={`setup-card-mediaBar-${mode}`}
							label={mediaBarLabel(mode)}
							selected={selected === mode}
							preview={<MediaBarPreview mode={mode} />}
							onSelect={() => pick('featuredBarStyle', mode)} // eslint-disable-line react/jsx-no-bind
							width={width}
							t={t}
							data-spot-right={mode === MEDIA_BAR_MODES[MEDIA_BAR_MODES.length - 1] ? NEXT_TARGET : undefined}
						/>
					))}
				</div>
			);
		}
		if (step === 'homeRows') {
			const selected = selectedFor('homeRowsStyle');
			const width = cardWidthFor(2, 1, 110);
			return (
				<div className={css.optionRow}>
					<OptionCard spotlightId='setup-card-homeRows-v1' label={$L('Classic')} hint={$L('Compact. More rows on screen at once.')} selected={selected === 'v1'} preview={<HomeRowsPreview modern={false} />} onSelect={() => pick('homeRowsStyle', 'v1')} width={width} t={t} /> {/* eslint-disable-line react/jsx-no-bind */}
					<OptionCard spotlightId='setup-card-homeRows-v2' label={$L('Modern')} hint={$L('Larger cards with titles underneath.')} selected={selected === 'v2'} preview={<HomeRowsPreview modern />} onSelect={() => pick('homeRowsStyle', 'v2')} width={width} t={t} data-spot-right={NEXT_TARGET} /> {/* eslint-disable-line react/jsx-no-bind */}
				</div>
			);
		}
		if (step === 'detailStyle') {
			const selected = selectedFor('detailScreenStyle');
			const width = cardWidthFor(5, 1, 110);
			return (
				<div className={css.optionRow}>
					<OptionCard spotlightId='setup-card-detailStyle-v1' label={$L('Classic')} hint={$L('Everything centred in one stack.')} selected={selected === 'v1'} preview={<DetailStylePreview variant='v1' />} onSelect={() => pick('detailScreenStyle', 'v1')} width={width} t={t} /> {/* eslint-disable-line react/jsx-no-bind */}
					<OptionCard spotlightId='setup-card-detailStyle-v2' label={$L('Modern')} hint={$L('Cinematic, with tabs for cast and extras.')} selected={selected === 'v2'} preview={<DetailStylePreview variant='v2' />} onSelect={() => pick('detailScreenStyle', 'v2')} width={width} t={t} /> {/* eslint-disable-line react/jsx-no-bind */}
					<OptionCard spotlightId='setup-card-detailStyle-v3' label={$L('Spotlight')} hint={$L('Artwork first, with cards that open what they name.')} selected={selected === 'v3'} preview={<DetailStylePreview variant='v3' />} onSelect={() => pick('detailScreenStyle', 'v3')} width={width} t={t} /> {/* eslint-disable-line react/jsx-no-bind */}
					<OptionCard spotlightId='setup-card-detailStyle-v4' label={$L('Nouveau')} hint={$L('Every section stacked down one page.')} selected={selected === 'v4'} preview={<DetailStylePreview variant='v4' />} onSelect={() => pick('detailScreenStyle', 'v4')} width={width} t={t} /> {/* eslint-disable-line react/jsx-no-bind */}
					<OptionCard spotlightId='setup-card-detailStyle-v5' label={$L('Minimalist')} hint={$L('Artwork, one play button and the episodes.')} selected={selected === 'v5'} preview={<DetailStylePreview variant='v5' />} onSelect={() => pick('detailScreenStyle', 'v5')} width={width} t={t} data-spot-right={NEXT_TARGET} /> {/* eslint-disable-line react/jsx-no-bind */}
				</div>
			);
		}
		return <TourStep t={t} playback={playbackSection} />;
	}, [step, selectedFor, cardWidthFor, pick, playbackSection, t]);

	const isLast = ready && index >= steps.length - 1;

	return (
		<div className={css.root} style={{backgroundColor: t.background}}>
			<div
				className={css.surface}
				style={{
					background: `linear-gradient(to bottom right, ${t.backgroundA(0.97)}, ${t.surfaceA(0.96)})`,
					border: `2px solid ${t.onSurfaceA(0.22)}`,
					boxShadow: `0px 0px 80px 2px ${t.scrimA(0.35)}`
				}}
			>
				{!ready && (
					<div className={css.loadingBox}>
						<LoadingSpinner />
					</div>
				)}
				{ready && (
					<>
						<div className={css.topBar}>
							<div className={css.stepDots}>
								{steps.map((name, i) => (
									<div key={name} className={css.stepDot} style={{backgroundColor: i === index ? t.onSurface : t.onSurfaceA(0.24)}} />
								))}
							</div>
							<TextButton
								spotlightId='setup-wizard-skip'
								label={$L('Skip setup')}
								onSelect={skip}
								onFocusChange={handleSkipFocusChange}
								t={t}
							/>
						</div>
						<div className={css.question} style={{color: t.onSurface}}>
							{questionFor(step)}
						</div>
						<div className={css.stepBody} ref={bodyRef}>
							<div key={step} className={`${css.stepInner} ${step === 'tour' ? css.stepInnerTour : ''} ${advancing ? css.stepEnterForward : css.stepEnterBackward}`}>
								{stepContent}
							</div>
						</div>
						<div className={css.actions}>
							{index > 0 && (
								<TextButton spotlightId='setup-wizard-back' label={$L('Back')} onSelect={goBack} t={t} data-spot-right={NEXT_TARGET} />
							)}
							<div className={css.actionsSpacer} />
							<PrimaryButton
								spotlightId='setup-wizard-next'
								label={isLast ? $L('Done') : $L('Next')}
								onSelect={advance}
								t={t}
								data-spot-left={index > 0 ? BACK_TARGET : undefined}
							/>
						</div>
					</>
				)}
			</div>
			{picker && (
				<OptionPicker
					title={picker.title}
					options={picker.options}
					current={picker.current}
					descriptionOf={picker.descriptionOf}
					onPick={handlePicked}
					onClose={closePicker}
					t={t}
				/>
			)}
		</div>
	);
};

export default SetupWizard;
