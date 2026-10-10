import {SpottableButton} from './settingsSpottables';

import css from './Settings.module.less';

// The buttons an editor ends on, Save filled and the rest as text. A disabled one can't take the
// focus, so the cursor never lands on something that does nothing.
const SettingsButton = ({primary, disabled, children, onClick, ...rest}) => {
	let classes = css.settingsButton;
	if (primary) classes += ` ${css.settingsButtonPrimary}`;
	if (disabled) classes += ` ${css.settingsButtonDisabled}`;
	return (
		<SpottableButton
			{...rest}
			className={classes}
			spotlightDisabled={disabled}
			aria-disabled={disabled || undefined}
			onClick={disabled ? undefined : onClick}
		>
			{children}
		</SpottableButton>
	);
};

export default SettingsButton;
