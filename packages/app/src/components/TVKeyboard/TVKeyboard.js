import {Component, memo} from 'react';
import {Pause} from '@enact/spotlight/Pause';

import {useSettings} from '../../context/SettingsContext';
import {toCssColor, toCssColorWithAlpha, radiusToCss, shadowToCss} from '../../theme/themeSpec';
import {getPerfTier} from '../../utils/perfTier';
import {
	NUMERIC_LAYOUT,
	NUMBER_PAD_LAYOUT,
	lowerFor,
	upperFor,
	variantForLocale,
	alternatesFor,
	REPEATABLE_KEYS,
	keyUnitSpan,
	KEY_GAP_FACTOR,
	maxRowSpan
} from './keyboardLayouts';
import * as textModel from './keyboardTextModel';
import {registerKeyboardHost, publishTvKeyboardVisibility} from './keyboardBus';
import css from './TVKeyboard.module.less';

const URL_CHIPS = ['https://', 'http://', 'www.', 'jellyfin', '.com', '.org', '.net', ':8096', '/'];
const EMAIL_CHIPS = ['@gmail.com', '@outlook.com', '@icloud.com', '@yahoo.com', '.com', '.'];
const SUGGESTION_DEBOUNCE_MS = 280;
const LONG_PRESS_MS = 500;
const MIN_POPUP_EDGE_GAP = 16;

const ICON_PATHS = {
	BACKSPACE: 'M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H7.07L2.4 12l4.66-7H22v14zm-11.59-2L14 13.41 17.59 17 19 15.59 15.41 12 19 8.41 17.59 7 14 10.59 10.41 7 9 8.41 12.59 12 9 15.59z',
	PASTE: 'M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z',
	CURSORL: 'M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z',
	CURSORR: 'M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z',
	DONE: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z',
	IME: 'M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z',
	SHIFT: 'M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z',
	SHIFT_LOCKED: 'M12 8.41L16.59 13 18 11.59l-6-6-6 6L7.41 13 12 8.41zM6 18h12v-2H6v2z'
};

const ICON_SIZES = {
	BACKSPACE: 36,
	PASTE: 32,
	CURSORL: 44,
	CURSORR: 44,
	DONE: 40,
	IME: 36,
	SHIFT: 40,
	SHIFT_LOCKED: 40
};

const KeyIcon = ({name, color}) => (
	<svg
		className={css.keyIcon}
		width={ICON_SIZES[name]}
		height={ICON_SIZES[name]}
		viewBox="0 0 24 24"
		fill={color}
	>
		<path d={ICON_PATHS[name]} />
	</svg>
);

const buildPalette = (theme) => {
	const b = theme.borders;
	const c = theme.colors;
	return {
		panel: toCssColor(c.surface),
		panelBorder: `${b.cardBorder.width}px solid ${toCssColor(b.cardBorder.color)}`,
		panelRadius: radiusToCss(b.cardRadius),
		idleKey: toCssColorWithAlpha(c.surfaceVariant, 0.92),
		idleKeyBorder: `${b.chipBorder.width}px solid ${toCssColor(b.chipBorder.color)}`,
		selectedKey: toCssColor(c.buttonFocused),
		selectedKeyBorder: `${b.focusBorder.width}px solid ${toCssColor(b.focusBorder.color)}`,
		textPrimary: toCssColor(c.onSurface),
		textMuted: toCssColorWithAlpha(c.onSurface, 0.64),
		textOnSelected: toCssColor(c.onButtonFocused),
		chipBackground: toCssColor(b.chipBackground),
		chipRadius: radiusToCss(b.chipRadius),
		focusGlow: b.focusGlow.length ? b.focusGlow.map(shadowToCss).join(', ') : 'none',
		accent: toCssColor(c.accent)
	};
};

const keyContent = (label, selected, palette, width, shifted) => {
	if (label === 'SHIFT') {
		const idleColor = shifted ? palette.accent : palette.textPrimary;
		return <KeyIcon name={shifted ? 'SHIFT_LOCKED' : 'SHIFT'} color={selected ? palette.textOnSelected : idleColor} />;
	}
	if (label === 'SPACE') {
		return (
			<div
				className={css.spaceBar}
				style={{width: width * 0.5, background: selected ? palette.textOnSelected : palette.textMuted, opacity: 0.65}}
			/>
		);
	}
	if (label === 'DONE' || label === 'IME') {
		return <KeyIcon name={label} color={selected ? palette.textOnSelected : palette.accent} />;
	}
	if (ICON_PATHS[label]) {
		return <KeyIcon name={label} color={selected ? palette.textOnSelected : palette.textPrimary} />;
	}
	return label;
};

// A press only changes two keys, so each one renders on its own props and the
// rest of the grid is left alone.
const Key = memo(({label, row, col, selected, width, marginRight, palette, glow, shifted, hasAlternates, onClick, onHoldStart, onHoldEnd, children}) => (
	<div
		className={css.key}
		data-row={row}
		data-col={col}
		data-key={label}
		style={{
			width: width > 0 ? width : undefined,
			flex: width > 0 ? undefined : 1,
			marginRight,
			background: selected ? palette.selectedKey : palette.idleKey,
			border: selected ? palette.selectedKeyBorder : palette.idleKeyBorder,
			borderRadius: palette.chipRadius,
			color: selected ? palette.textOnSelected : palette.textPrimary,
			boxShadow: selected ? glow : 'none'
		}}
		onClick={onClick}
		onMouseDown={onHoldStart}
		onMouseUp={onHoldEnd}
		onMouseLeave={onHoldEnd}
	>
		{keyContent(label, selected, palette, width, shifted)}
		{hasAlternates && (
			<div
				className={css.alternatesDot}
				style={{background: selected ? palette.textOnSelected : palette.textMuted, opacity: 0.55}}
			/>
		)}
		{children}
	</div>
));

const Chip = memo(({value, index, selected, palette, glow, onClick}) => (
	<div
		className={css.chip}
		data-index={index}
		style={{
			background: selected ? palette.selectedKey : palette.chipBackground,
			border: selected ? palette.selectedKeyBorder : palette.idleKeyBorder,
			borderRadius: palette.chipRadius,
			color: selected ? palette.textOnSelected : palette.textPrimary,
			boxShadow: selected ? glow : 'none'
		}}
		onClick={onClick}
	>
		{value}
	</div>
));

class TVKeyboardHost extends Component {
	constructor(props) {
		super(props);
		this.state = {
			session: null,
			textState: textModel.makeState(''),
			shifted: false,
			numericPage: false,
			row: 0,
			col: 0,
			popup: null,
			suggestions: [],
			gridWidth: 0
		};
		this.pause = new Pause('TVKeyboard');
		this.enterHeld = false;
		this.pendingAlternate = false;
		this.suggestTimer = null;
		this.holdTimer = null;
		this.enterHoldTimer = null;
		this.suppressClick = false;
		this.panelRef = null;
		this.popupRef = null;
		this.gridRef = null;
		this.paletteSource = null;
		this.palette = null;
	}

	componentDidMount() {
		this.unregister = registerKeyboardHost(this);
	}

	componentDidUpdate(prevProps, prevState) {
		// Only when a row opens. Stepping along it leaves the box where it was, and
		// measuring on every press costs a layout the sets here can feel.
		if (this.state.popup && this.state.popup.options !== prevState.popup?.options) this.clampPopup();
	}

	componentWillUnmount() {
		this.unregister?.();
		this.teardownSession();
	}

	open = (options) => {
		if (this.state.session) this.teardownSession();
		this.setState({
			session: options,
			textState: textModel.makeState(options.value || ''),
			shifted: false,
			numericPage: false,
			row: 0,
			col: 0,
			popup: null,
			suggestions: [],
			gridWidth: 0
		}, () => {
			this.measure();
			this.revealAnchor();
			this.scheduleSuggestions(options.value || '');
		});
		this.pause.pause();
		window.addEventListener('keydown', this.handleKeyDown, true);
		window.addEventListener('keyup', this.handleKeyUp, true);
		window.addEventListener('resize', this.measure);
		publishTvKeyboardVisibility(true, options.anchor || null);
	};

	close = (submitted, reason) => {
		const {session} = this.state;
		if (!session) return;
		this.teardownSession();
		this.setState({session: null});
		publishTvKeyboardVisibility(false, null);
		session.onClose?.({submitted: !!submitted, reason});
	};

	teardownSession() {
		window.removeEventListener('keydown', this.handleKeyDown, true);
		window.removeEventListener('keyup', this.handleKeyUp, true);
		window.removeEventListener('resize', this.measure);
		this.pause.resume();
		clearTimeout(this.suggestTimer);
		clearTimeout(this.holdTimer);
		clearTimeout(this.enterHoldTimer);
		this.suggestTimer = null;
		this.holdTimer = null;
		this.enterHoldTimer = null;
		this.enterHeld = false;
		this.pendingAlternate = false;
		this.suppressClick = false;
	}

	measure = () => {
		if (!this.gridRef) return;
		const width = this.gridRef.clientWidth;
		if (width && width !== this.state.gridWidth) this.setState({gridWidth: width});
	};

	// The panel covers the bottom of the screen, so a field sitting under it gets
	// scrolled up above the keys where possible.
	revealAnchor() {
		window.requestAnimationFrame(() => {
			const {session} = this.state;
			const anchor = session?.anchor;
			if (!anchor || !this.panelRef) return;
			try {
				const panelTop = this.panelRef.getBoundingClientRect().top;
				const anchorRect = anchor.getBoundingClientRect();
				const overlap = anchorRect.bottom - (panelTop - 24);
				if (overlap <= 0) return;
				let node = anchor.parentElement;
				while (node) {
					const style = window.getComputedStyle(node);
					const scrollable = (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
						node.scrollHeight > node.clientHeight;
					if (scrollable) {
						node.scrollTop += overlap;
						return;
					}
					node = node.parentElement;
				}
			} catch {
				// Leave the page where it is when the layout cant be measured
			}
		});
	}

	// Every key carries its colors inline, so this would otherwise re-read the whole
	// theme on each keystroke.
	getPalette() {
		if (this.paletteSource !== this.props.theme) {
			this.paletteSource = this.props.theme;
			this.palette = buildPalette(this.props.theme);
		}
		return this.palette;
	}

	usesNumberPad() {
		return this.state.session?.purpose === 'numeric';
	}

	layout() {
		if (this.usesNumberPad()) return NUMBER_PAD_LAYOUT;
		if (this.state.numericPage) return NUMERIC_LAYOUT;
		const variant = variantForLocale(this.props.uiLanguage);
		return this.state.shifted ? upperFor(variant) : lowerFor(variant);
	}

	chips() {
		const {session, textState, suggestions} = this.state;
		if (!session) return [];
		const text = textState.text;
		const purpose = session.purpose || 'text';
		if (purpose === 'url') {
			const query = text.toLowerCase();
			const recents = (session.recents || [])
				.filter((entry) => !query || (entry.toLowerCase().indexOf(query) >= 0 && entry !== text))
				.slice(0, 5)
				.map((value) => ({value, replaceOnTap: true}));
			return recents.concat(URL_CHIPS.map((value) => ({value})));
		}
		if (purpose === 'email') {
			return EMAIL_CHIPS.map((value) => ({value}));
		}
		if (purpose === 'username') {
			return (session.recents || []).slice(0, 5).map((value) => ({value, submitOnTap: true}));
		}
		if (purpose === 'search') {
			if (!text) return (session.recents || []).slice(0, 5).map((value) => ({value, submitOnTap: true}));
			return suggestions.map((value) => ({value, submitOnTap: true}));
		}
		return [];
	}

	scheduleSuggestions(text) {
		const {session} = this.state;
		clearTimeout(this.suggestTimer);
		if (!session || session.purpose !== 'search' || !session.suggestionsBuilder || !text) return;
		this.suggestTimer = setTimeout(() => {
			Promise.resolve(session.suggestionsBuilder(text)).then((results) => {
				const current = this.state;
				if (current.session !== session || current.textState.text !== text) return;
				const unique = [];
				(results || []).forEach((value) => {
					if (value && value !== text && unique.indexOf(value) < 0) unique.push(value);
				});
				this.setState({suggestions: unique.slice(0, 5)});
			}).catch(() => {});
		}, SUGGESTION_DEBOUNCE_MS);
	}

	applyText(next) {
		const {session, textState} = this.state;
		if (!session || next === textState) return;
		this.setState({textState: next}, () => {
			// The chip row follows the text, so a shrinking list cant strand the selection
			if (this.state.row === -1) {
				const count = this.chips().length;
				if (count === 0) this.setState({row: 0});
				else if (this.state.col > count - 1) this.setState({col: count - 1});
			}
		});
		if (next.text !== textState.text) this.scheduleSuggestions(next.text);
		session.onChange?.(next.text, next.cursor);
	}

	insert(value) {
		const {session, textState} = this.state;
		const maxLength = Number(session?.maxLength);
		if (Number.isFinite(maxLength) && maxLength > 0 &&
			textState.text.length + value.length > maxLength) return;
		this.applyText(textModel.insertText(textState, value));
	}

	paste() {
		if (!navigator.clipboard?.readText) return;
		navigator.clipboard.readText().then((raw) => {
			const cleaned = String(raw || '').replace(/[\r\n]+$/, '').replace(/[\r\n]+/g, ' ');
			if (cleaned) this.insert(cleaned);
		}).catch(() => {});
	}

	requestSystemKeyboard() {
		const {session} = this.state;
		this.close(false);
		session?.onSystemKeyboard?.();
	}

	switchPage() {
		this.setState((prev) => ({numericPage: !prev.numericPage, shifted: false}), () => {
			const layout = this.layout();
			this.setState((prev) => {
				if (prev.row < 0) return null;
				const row = Math.min(prev.row, layout.length - 1);
				return {row, col: Math.min(prev.col, layout[row].length - 1)};
			});
		});
	}

	act(key) {
		switch (key) {
			case 'BACKSPACE':
				this.applyText(textModel.backspace(this.state.textState));
				break;
			case 'SPACE':
				this.insert(' ');
				break;
			case 'SHIFT':
				this.setState((prev) => ({shifted: !prev.shifted}));
				break;
			case 'CURSORL':
				this.applyText(textModel.moveCursor(this.state.textState, -1));
				break;
			case 'CURSORR':
				this.applyText(textModel.moveCursor(this.state.textState, 1));
				break;
			case 'PASTE':
				this.paste();
				break;
			case 'DONE':
				this.close(true);
				break;
			case '123':
			case 'ABC':
				this.switchPage();
				break;
			case 'IME':
				this.requestSystemKeyboard();
				break;
			default:
				this.insert(key);
		}
	}

	activateChip(chip) {
		if (!chip) return;
		if (chip.submitOnTap || chip.replaceOnTap) {
			this.applyText(textModel.makeState(chip.value));
		} else {
			this.insert(chip.value);
		}
		if (chip.submitOnTap) this.close(true);
	}

	openAlternates(key, viaHold) {
		const options = alternatesFor(key);
		if (!options) return;
		this.setState({popup: {options, index: 0, awaitRelease: !!viaHold, shift: 0}});
	}

	setPopupRef = (node) => {
		this.popupRef = node;
	};

	// The row is centred on its key, so one near either end of the keyboard hangs off
	// the screen. How far it hangs off is only known once it has been laid out.
	clampPopup() {
		const {popup} = this.state;
		if (!popup || !this.popupRef) return;
		const box = this.popupRef.getBoundingClientRect();
		const overLeft = MIN_POPUP_EDGE_GAP - box.left;
		const overRight = box.right - (window.innerWidth - MIN_POPUP_EDGE_GAP);
		const shift = overLeft > 0 ? overLeft : (overRight > 0 ? -overRight : 0);
		if (!shift) return;
		this.setState({popup: {...popup, shift}});
	}

	commitAlternate(value) {
		this.setState({popup: null});
		this.insert(value);
	}

	selectedKey() {
		const {row, col} = this.state;
		if (row < 0) return null;
		const layout = this.layout();
		const line = layout[Math.min(row, layout.length - 1)];
		return line[Math.min(col, line.length - 1)];
	}

	// Whether up has anywhere left to go inside the keyboard.
	atTopRow() {
		if (this.state.row === -1) return true;
		return this.state.row === 0 && this.chips().length === 0;
	}

	// Up from the top row is a way out for screens that name somewhere to go, so
	// the keyboard can be left without finding the done key. A screen with nowhere
	// to send focus says so and the keyboard stays where it is.
	exitTop() {
		const {session} = this.state;
		if (!session?.onExitTop) return false;
		if (session.onExitTop() === false) return false;
		this.close(true, 'exitTop');
		return true;
	}

	move(dRow, dCol) {
		const layout = this.layout();
		const chips = this.chips();
		this.setState((prev) => {
			let {row, col} = prev;
			if (row === -1) {
				if (dRow > 0) {
					row = 0;
					col = Math.min(col, layout[0].length - 1);
				} else if (dCol !== 0 && chips.length) {
					col = (col + dCol + chips.length) % chips.length;
				}
			} else if (dRow !== 0) {
				const next = row + dRow;
				if (next < 0) {
					if (chips.length) {
						row = -1;
						col = Math.min(col, chips.length - 1);
					}
				} else if (next <= layout.length - 1) {
					row = next;
					col = Math.min(col, layout[next].length - 1);
				}
			} else {
				const length = layout[row].length;
				col = (col + dCol + length) % length;
			}
			return {row, col, popup: null};
		});
	}

	handleKeyDown = (e) => {
		if (!this.state.session) return;
		e.preventDefault();
		e.stopPropagation();
		const code = e.keyCode || e.which;
		const {popup} = this.state;
		const isBack = code === 461 || code === 10009 || code === 27;

		if (code === 13) {
			if (this.enterHeld) {
				if (popup) return;
				if (this.pendingAlternate) {
					this.pendingAlternate = false;
					this.openAlternates(this.selectedKey(), true);
					return;
				}
				const heldKey = this.selectedKey();
				if (heldKey && REPEATABLE_KEYS.indexOf(heldKey) >= 0) this.act(heldKey);
				return;
			}
			this.enterHeld = true;
			if (popup) {
				if (!popup.awaitRelease) this.commitAlternate(popup.options[popup.index]);
				return;
			}
			if (this.state.row === -1) {
				const chips = this.chips();
				this.activateChip(chips[Math.min(this.state.col, chips.length - 1)]);
				return;
			}
			const key = this.selectedKey();
			if (alternatesFor(key)) {
				// Timed rather than counting repeats, since the sets here dont all send
				// a fresh keydown while the button stays down.
				this.pendingAlternate = true;
				clearTimeout(this.enterHoldTimer);
				this.enterHoldTimer = setTimeout(() => {
					this.enterHoldTimer = null;
					if (!this.pendingAlternate) return;
					this.pendingAlternate = false;
					this.openAlternates(this.selectedKey(), true);
				}, LONG_PRESS_MS);
				return;
			}
			this.act(key);
			return;
		}

		if (popup) {
			if (code === 37 || code === 38) {
				this.setState({popup: {...popup, index: (popup.index - 1 + popup.options.length) % popup.options.length}});
			} else if (code === 39 || code === 40) {
				this.setState({popup: {...popup, index: (popup.index + 1) % popup.options.length}});
			} else if (isBack) {
				this.setState({popup: null});
			}
			return;
		}

		if (code === 8) {
			this.act('BACKSPACE');
			return;
		}
		if (code === 37) return this.move(0, -1);
		if (code === 39) return this.move(0, 1);
		if (code === 38) {
			if (this.atTopRow() && this.exitTop()) return;
			return this.move(-1, 0);
		}
		if (code === 40) return this.move(1, 0);
		if (isBack) {
			this.pendingAlternate = false;
			this.close(false);
			return;
		}
		// A real keyboard plugged into the TV types straight into the field
		if (e.key && e.key.length === 1 && e.key.charCodeAt(0) >= 32) {
			this.insert(e.key);
		}
	};

	handleKeyUp = (e) => {
		if (!this.state.session) return;
		e.preventDefault();
		e.stopPropagation();
		const code = e.keyCode || e.which;
		if (code !== 13) return;
		const {popup} = this.state;
		clearTimeout(this.enterHoldTimer);
		this.enterHoldTimer = null;
		if (popup?.awaitRelease) {
			this.setState({popup: {...popup, awaitRelease: false}});
			this.enterHeld = false;
			return;
		}
		if (this.pendingAlternate) {
			this.pendingAlternate = false;
			this.act(this.selectedKey());
		}
		this.enterHeld = false;
	};

	handleOverlayClick = () => this.close(true);

	handlePanelClick = (e) => e.stopPropagation();

	setPanelRef = (node) => {
		this.panelRef = node;
	};

	setGridRef = (node) => {
		this.gridRef = node;
	};

	handleKeyClick = (e) => {
		if (this.suppressClick) {
			this.suppressClick = false;
			return;
		}
		const {row, col, key} = e.currentTarget.dataset;
		this.setState({row: Number(row), col: Number(col), popup: null});
		this.act(key);
	};

	handleKeyHoldStart = (e) => {
		const {row, col, key} = e.currentTarget.dataset;
		if (key !== 'BACKSPACE' && !alternatesFor(key)) return;
		clearTimeout(this.holdTimer);
		this.holdTimer = setTimeout(() => {
			this.suppressClick = true;
			this.setState({row: Number(row), col: Number(col)});
			if (key === 'BACKSPACE') {
				this.applyText(textModel.clearText());
			} else {
				this.openAlternates(key, false);
			}
		}, LONG_PRESS_MS);
	};

	handleKeyHoldEnd = () => {
		clearTimeout(this.holdTimer);
		this.holdTimer = null;
	};

	handleChipClick = (e) => {
		const chips = this.chips();
		this.activateChip(chips[Number(e.currentTarget.dataset.index)]);
	};

	handleAlternateClick = (e) => {
		this.commitAlternate(e.currentTarget.dataset.value);
	};

	renderPopup(palette) {
		const {popup} = this.state;
		return (
			<div
				ref={this.setPopupRef}
				className={css.alternatesPopup}
				style={{
					background: palette.panel,
					border: palette.panelBorder,
					borderRadius: palette.panelRadius,
					marginLeft: popup.shift
				}}
			>
				{popup.options.map((option, index) => {
					const isSelected = index === popup.index;
					return (
						<div
							key={option}
							className={css.alternateOption}
							data-value={option}
							style={{
								background: isSelected ? palette.selectedKey : 'transparent',
								border: isSelected ? palette.selectedKeyBorder : '1px solid transparent',
								borderRadius: palette.chipRadius,
								color: isSelected ? palette.textOnSelected : palette.textMuted,
								boxShadow: isSelected ? palette.focusGlow : 'none'
							}}
							onClick={this.handleAlternateClick}
						>
							{option}
						</div>
					);
				})}
			</div>
		);
	}

	renderGrid(palette, glow) {
		const layout = this.layout();
		const uniform = this.usesNumberPad();
		const {row, col, popup, gridWidth, shifted} = this.state;
		const base = gridWidth > 0 ? gridWidth / maxRowSpan(layout, uniform) : 0;
		const spacing = base * KEY_GAP_FACTOR;
		return (
			<div className={css.grid} ref={this.setGridRef}>
				{layout.map((line, rowIndex) => (
					<div key={rowIndex} className={css.gridRow}>
						{line.map((key, colIndex) => {
							const isSelected = row === rowIndex && col === colIndex;
							return (
								<Key
									key={`${rowIndex}-${colIndex}`}
									label={key}
									row={rowIndex}
									col={colIndex}
									selected={isSelected}
									width={base * keyUnitSpan(key, uniform)}
									marginRight={colIndex === line.length - 1 ? 0 : spacing}
									palette={palette}
									glow={glow}
									shifted={key === 'SHIFT' && shifted}
									hasAlternates={!!alternatesFor(key)}
									onClick={this.handleKeyClick}
									onHoldStart={this.handleKeyHoldStart}
									onHoldEnd={this.handleKeyHoldEnd}
								>
									{popup && isSelected ? this.renderPopup(palette) : null}
								</Key>
							);
						})}
					</div>
				))}
			</div>
		);
	}

	renderChips(palette, glow) {
		const chips = this.chips();
		if (!chips.length) return null;
		const {row, col} = this.state;
		const activeIndex = row === -1 ? Math.min(col, chips.length - 1) : -1;
		return (
			<div className={css.chipBar}>
				{chips.map((chip, index) => (
					<Chip
						key={`${chip.value}-${index}`}
						value={chip.value}
						index={index}
						selected={index === activeIndex}
						palette={palette}
						glow={glow}
						onClick={this.handleChipClick}
					/>
				))}
			</div>
		);
	}

	render() {
		const {session} = this.state;
		if (!session) return null;
		const palette = this.getPalette();
		// The glow is a blurred shadow, which the lower tiers skip as the cards do
		const glow = getPerfTier() === 'high' ? palette.focusGlow : 'none';
		const narrow = this.usesNumberPad();
		return (
			<div className={css.overlay} onClick={this.handleOverlayClick}>
				<div
					className={`${css.panel} ${narrow ? css.panelNarrow : ''}`}
					ref={this.setPanelRef}
					style={{background: palette.panel, border: palette.panelBorder, borderRadius: palette.panelRadius}}
					onClick={this.handlePanelClick}
				>
					{this.renderChips(palette, glow)}
					{this.renderGrid(palette, glow)}
				</div>
			</div>
		);
	}
}

const TVKeyboard = () => {
	const {settings, activeTheme} = useSettings();
	return <TVKeyboardHost uiLanguage={settings.uiLanguage} theme={activeTheme} />;
};

export default TVKeyboard;
