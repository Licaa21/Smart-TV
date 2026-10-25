import Spottable from '@enact/spotlight/Spottable';
import Marquee from '@enact/sandstone/Marquee';

import css from './TrackOptionRow.module.less';

const SpottableButton = Spottable('button');

// One row in a picker. Every row carries an indicator, filled on the chosen
// option and hollow on the rest, so the column stays aligned and the list reads
// as a set of choices. A name wider than the dialog scrolls rather than being
// cut off, which is the only way to read the long ones.
const TrackOptionRow = ({label, detail, selected, dimmed = false, className, onClick, onKeyDown, spotlightId, ...rest}) => (
	<SpottableButton
		className={[css.trackOption, selected && css.selected, dimmed && css.dimmed, className].filter(Boolean).join(' ')}
		data-selected={selected ? 'true' : undefined}
		onClick={onClick}
		onKeyDown={onKeyDown}
		spotlightId={spotlightId}
		{...rest}
	>
		<svg className={css.trackIndicator} viewBox="0 0 24 24" aria-hidden="true">
			{selected ? (
				<path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m-1.4 14.6L6.4 12.4l1.4-1.4 2.8 2.8 5.6-5.6 1.4 1.4z" />
			) : (
				<path fill="currentColor" d="M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16m0-2a10 10 0 1 0 0 20 10 10 0 0 0 0-20" />
			)}
		</svg>
		<span className={css.trackText}>
			<Marquee className={css.trackName} marqueeOn="render">{label}</Marquee>
			{detail ? <Marquee className={css.trackInfo} marqueeOn="render">{detail}</Marquee> : null}
		</span>
	</SpottableButton>
);

export const TrackDivider = () => <div className={css.trackDivider} />;

export default TrackOptionRow;
