import {useCallback} from 'react';
import $L from '@enact/i18n/$L';


import SpottableInput from '../../components/SpottableInput/SpottableInput';
import SettingsView from './SettingsView';

import css from './Settings.module.less';
import SettingsButton from './SettingsButton';

// The field hands back an event, and both screens only want the digits out of it.
const usePinInput = (onPinChange) => useCallback(
	(e) => onPinChange(String(e.target.value || '').replace(/\D/g, '').slice(0, 4)),
	[onPinChange]
);

const PinField = ({pin, error, onChange}) => (
	<>
		<div className={css.inputGroup}>
			<label>{$L('PIN')}</label>
			<SpottableInput
				className={css.input}
				type="password"
				purpose="numeric"
				value={pin}
				onChange={onChange}
				placeholder={$L('4 digits')}
				maxLength={4}
				spotlightId="kids-pin-input"
			/>
		</div>
		{error && <div className={`${css.statusMessage} ${css.statusError}`}>{error}</div>}
	</>
);

// Choosing the PIN that turns the mode on. A fresh one every time, since there is nowhere else to
// change it and carrying an old one over would hand the mode a code the parent turning it on
// never chose and may not know.
export const KidsModeSetView = ({pin, error, onPinChange, onCancel, onSave}) => {
	const handleChange = usePinInput(onPinChange);

	return (
		<SettingsView spotlightId="kids-mode-set-view" title={$L('Set Kids Mode PIN')}>
			<div className={css.viewDescription}>
				{$L('Choose a 4-digit PIN. You will need it to turn Kids Mode off.')}
			</div>
			<PinField pin={pin} error={error} onChange={handleChange} />
			<div className={css.actionBar}>
				<SettingsButton onClick={onCancel} spotlightId="kids-pin-cancel">
					{$L('Cancel')}
				</SettingsButton>
				<SettingsButton primary onClick={onSave} spotlightId="kids-pin-save">
					{$L('Save')}
				</SettingsButton>
			</div>
		</SettingsView>
	);
};

// The way out. The PIN is the whole boundary, so a wrong guess costs a growing wait rather than
// nothing at all.
export const KidsModeExitView = ({pin, error, onPinChange, onCancel, onSubmit}) => {
	const handleChange = usePinInput(onPinChange);

	return (
		<SettingsView spotlightId="kids-mode-exit-view" title={$L('Exit Kids Mode')}>
			<div className={css.viewDescription}>
				{$L('Enter your PIN to restore the full app')}
			</div>
			<PinField pin={pin} error={error} onChange={handleChange} />
			<div className={css.actionBar}>
				<SettingsButton onClick={onCancel} spotlightId="kids-pin-cancel">
					{$L('Cancel')}
				</SettingsButton>
				<SettingsButton primary onClick={onSubmit} spotlightId="kids-pin-save">
					{$L('Unlock')}
				</SettingsButton>
			</div>
		</SettingsView>
	);
};
