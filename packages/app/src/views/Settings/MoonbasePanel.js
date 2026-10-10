import {useCallback} from 'react';
import $L from '@enact/i18n/$L';

import {DEVICE_SYNC_PROFILE} from '../../context/SettingsContext';
import {SettingsGlyph, renderSettingsIcon, renderToggle} from './settingsIcons';
import {SectionTitle} from './settingsRows';
import {SpottableDiv} from './settingsSpottables';

import css from './Settings.module.less';

const PROFILE_CARDS = {
	global: {label: () => $L('Global'), caption: () => $L('Applies everywhere'), icon: 'public'},
	desktop: {label: () => $L('Desktop'), caption: () => $L('Overrides Global'), icon: 'desktop_windows'},
	mobile: {label: () => $L('Mobile'), caption: () => $L('Overrides Global'), icon: 'smartphone'},
	tv: {label: () => $L('TV'), icon: 'tv'}
};

// Two to a row, so up and down move between rows and left and right stay inside one.
const PROFILE_ROWS = [['global', 'desktop'], ['mobile', 'tv']];

const describeConnection = ({enabled, connected, connecting, version, statusText, seerrLabel}) => {
	if (!enabled) {
		return {text: $L('Connect for ratings, sync, and {seerrLabel} proxy').replace('{seerrLabel}', seerrLabel)};
	}
	if (connected) {
		return {
			text: version ? $L('Connected, version {version}').replace('{version}', version) : $L('Connected'),
			dot: css.syncDotOn
		};
	}
	if (connecting) return {text: $L('Connecting to Moonfin...'), dot: css.syncDotBusy};
	return {text: statusText || $L('Not connected'), dot: css.syncDotOff};
};

const syncCardClass = (extra, selected) => `${css.syncCard}${selected ? ` ${css.syncCardSelected}` : ''}${extra ? ` ${extra}` : ''}`;

// The Settings Sync screen. The status card turns the plugin on and off, and once the server
// offers settings sync the profile this device follows sits under it with the actions that move
// settings between the two.
const MoonbasePanel = ({
	enabled,
	pluginInfo,
	connecting,
	statusText,
	seerrLabel,
	onToggle,
	activeProfile,
	busy,
	message,
	onPickProfile,
	onLoad,
	onSave,
	onReset
}) => {
	const handleProfileClick = useCallback((e) => {
		const profile = e.currentTarget?.getAttribute('data-profile');
		if (profile) onPickProfile(profile);
	}, [onPickProfile]);

	const connected = enabled && Boolean(pluginInfo);
	const showSync = connected && pluginInfo.settingsSyncEnabled === true;
	const status = describeConnection({
		enabled, connected, connecting, statusText, seerrLabel, version: pluginInfo?.version
	});
	const services = connected ? [
		pluginInfo.mdblistAvailable === true && $L('MDBList'),
		pluginInfo.tmdbAvailable === true && $L('TMDB'),
		pluginInfo.seerrEnabled === true && seerrLabel
	].filter(Boolean) : [];

	const renderProfileCard = (profile) => {
		const card = PROFILE_CARDS[profile];
		const active = profile === activeProfile;
		return (
			<SpottableDiv
				key={profile}
				className={syncCardClass(css.syncProfileCard, active)}
				data-profile={profile}
				onClick={handleProfileClick}
				spotlightId={`sync-profile-${profile}`}
			>
				<div className={active ? `${css.syncProfileIcon} ${css.syncProfileIconActive}` : css.syncProfileIcon}>
					<SettingsGlyph name={card.icon} />
				</div>
				<div className={css.syncText}>
					<div className={css.syncProfileTitle}>{card.label()}</div>
					{profile === DEVICE_SYNC_PROFILE ? (
						<div className={`${css.syncSubtle} ${css.syncStatusLine}`}>
							<span className={`${css.syncDot} ${css.syncDotOn}`} />
							<span>{$L('This device')}</span>
						</div>
					) : (
						<div className={css.syncSubtle}>{card.caption()}</div>
					)}
				</div>
			</SpottableDiv>
		);
	};

	const renderTransferButton = (spotlightId, icon, title, subtitle, onClick) => (
		<SpottableDiv className={syncCardClass(css.syncTransferButton)} onClick={onClick} spotlightId={spotlightId}>
			<div className={css.syncTransferIcon}><SettingsGlyph name={icon} /></div>
			<div className={css.syncText}>
				<div className={css.syncTransferTitle}>{title}</div>
				<div className={css.syncSubtle}>{subtitle}</div>
			</div>
		</SpottableDiv>
	);

	return (
		<div className={css.syncPage}>
			<SpottableDiv className={syncCardClass(css.syncStatusCard)} onClick={onToggle} spotlightId='setting-useMoonfinPlugin'>
				<div className={css.syncStatusRow}>
					{renderSettingsIcon(connected ? 'extension' : 'extension_off', true)}
					<div className={css.syncText}>
						<div className={css.syncStatusTitle}>{$L('Moonbase')}</div>
						<div className={`${css.syncSubtle} ${css.syncStatusLine}`}>
							{status.dot && <span className={`${css.syncDot} ${status.dot}`} />}
							<span>{status.text}</span>
						</div>
					</div>
					<div className={css.syncSwitch}>
						{renderToggle(enabled)}
						<span className={css.syncSwitchLabel}>{enabled ? $L('On') : $L('Off')}</span>
					</div>
				</div>
				{services.length > 0 && (
					<div className={css.syncChips}>
						{services.map((service) => <span key={service} className={css.syncChip}>{service}</span>)}
					</div>
				)}
			</SpottableDiv>
			{showSync && (
				<>
					<SectionTitle>{$L('Profile')}</SectionTitle>
					<div className={css.syncCaption}>
						{$L('This device syncs with the profile you pick until you pick another.')}
					</div>
					<div className={css.syncProfileGrid}>
						{PROFILE_ROWS.map((row) => (
							<div key={row.join('-')} className={css.syncProfileRow}>
								{row.map(renderProfileCard)}
							</div>
						))}
					</div>
					<div className={css.syncTransferCard}>
						<div className={css.syncTransferRow}>
							{renderTransferButton('sync-profile-load', 'cloud_download', $L('Load'), $L('Server to this device'), onLoad)}
							{renderTransferButton('sync-profile-save', 'cloud_upload', $L('Save'), $L('This device to server'), onSave)}
						</div>
						<SpottableDiv className={syncCardClass(css.syncResetButton)} onClick={onReset} spotlightId='sync-profile-reset'>
							<div className={css.syncResetIcon}><SettingsGlyph name='restart_alt' /></div>
							<span>{$L('Reset {profile} Profile').replace('{profile}', PROFILE_CARDS[activeProfile].label())}</span>
						</SpottableDiv>
						{(busy || message) && (
							<div className={css.syncMessage}>{busy ? $L('Working...') : message}</div>
						)}
					</div>
				</>
			)}
		</div>
	);
};

export default MoonbasePanel;
