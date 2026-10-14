import {useSettings} from '../../context/SettingsContext';
import {scrimStyle} from '../../utils/scrimImage';
import {serverBlurredUrl} from '../../utils/serverBlur';

import css from './Details.module.less';

// Same stops as .backdropGradient in the stylesheet, plain and under Neon Pulse.
const SCRIM = [{to: 'bottom', rgb: '0, 0, 0', stops: [[0, 0.3], [0.3, 0.5], [0.6, 0.85], [0.8, 0.95], [1, 1]]}];
const NEON_SCRIM = [{to: 'bottom', rgb: '11, 4, 32', stops: [[0, 0.2], [0.4, 0.55, '30, 10, 63'], [0.7, 0.85], [1, 0.95]]}];

// A person has no artwork worth blurring behind them, so they get the flat panel instead.
const DetailBackdrop = ({backdropUrl, isPerson, blur}) => {
	const {activeTheme} = useSettings();
	const blurredUrl = serverBlurredUrl(backdropUrl, blur);
	return (
		<>
			{backdropUrl && !isPerson && (
				<div className={css.backdrop}>
					<img
						src={blurredUrl || backdropUrl}
						className={css.backdropImage}
						alt=""
						style={!blurredUrl && blur > 0 ? {filter: `blur(${blur}px)`} : undefined}
					/>
				</div>
			)}
			{isPerson && <div className={`${css.backdrop} ${css.personBackdrop}`} />}
			<div className={css.backdropGradient} style={scrimStyle(activeTheme?.id === 'neon_pulse' ? NEON_SCRIM : SCRIM)} />
		</>
	);
};

export default DetailBackdrop;
