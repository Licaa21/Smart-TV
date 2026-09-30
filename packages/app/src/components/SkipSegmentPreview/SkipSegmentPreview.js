import {useEffect, useRef, useState} from 'react';
import $L from '@enact/i18n/$L';
import {useSettings} from '../../context/SettingsContext';
import SkipSegmentOverlay from '../../views/Player/SkipSegmentOverlay';

import css from './SkipSegmentPreview.module.less';

// The prompt is written in the pixels of a 1920x1080 screen. The preview lays it out on a
// canvas that size and shrinks the whole thing to fit, so where it lands and how big it is
// match what the video will show.
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const FALLBACK_SCALE = 0.375;
const CYCLE_MS = 2600;

// One of each label the prompt can wear, so a change in size or position shows on the widest.
const SEGMENTS = ['intro', 'recap', 'outro'];
const SAMPLE_REMAINING = 24;
const SAMPLE_PROGRESS = 0.65;

const SkipSegmentPreview = () => {
	const {settings} = useSettings();
	const stageRef = useRef(null);
	const [scale, setScale] = useState(FALLBACK_SCALE);
	const [index, setIndex] = useState(0);

	useEffect(() => {
		const measure = () => {
			if (stageRef.current && stageRef.current.clientWidth > 0) {
				setScale(stageRef.current.clientWidth / CANVAS_WIDTH);
			}
		};
		measure();
		window.addEventListener('resize', measure);
		return () => window.removeEventListener('resize', measure);
	}, []);

	useEffect(() => {
		const timer = setInterval(() => setIndex((current) => (current + 1) % SEGMENTS.length), CYCLE_MS);
		return () => clearInterval(timer);
	}, []);

	const transform = `scale(${scale})`;

	return (
		<div className={css.preview}>
			<div className={css.stage} ref={stageRef} style={{height: `${Math.round(CANVAS_HEIGHT * scale)}px`}}>
				<div
					className={css.canvas}
					style={{width: `${CANVAS_WIDTH}px`, height: `${CANVAS_HEIGHT}px`, transform, WebkitTransform: transform}}
				>
					<SkipSegmentOverlay
						preview
						type={SEGMENTS[index]}
						remainingSeconds={SAMPLE_REMAINING}
						progress={SAMPLE_PROGRESS}
						countdownStyle={settings.nextUpCountdownStyle ?? 'both'}
					/>
				</div>
				<div className={css.badge}>
					<div className={css.badgeDot} />
					<div className={css.badgeLabel}>{$L('Preview').toUpperCase()}</div>
				</div>
			</div>
		</div>
	);
};

export default SkipSegmentPreview;
