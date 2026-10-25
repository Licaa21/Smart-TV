import {useCallback, useEffect, useMemo} from 'react';
import Popup from '@enact/sandstone/Popup';
import Spotlight from '@enact/spotlight';
import $L from '@enact/i18n/$L';

import MessageMarkdown from '../../components/ServerMessagesDialog/MessageMarkdown';
import messagesCss from '../../components/ServerMessagesDialog/ServerMessagesDialog.module.less';
import {KEYS} from '../../utils/keys';
import {parseMarkdown} from '../../utils/markdown';
import {ReviewAuthor} from './ReviewCard';
import {SpottableButton, SpottableDiv} from './detailsSpottables';

import css from './Reviews.module.less';

const BODY_ID = 'review-dialog-body';
// How much of the visible text one press moves past, leaving a few lines on screen to read on from.
const SCROLL_SHARE = 0.6;

// The text is the focused stop, so Up and Down scroll it, and Up at the top reaches the close button.
const ReviewDialog = ({review, onClose}) => {
	const blocks = useMemo(() => (review ? parseMarkdown(review.content) : []), [review]);

	useEffect(() => {
		if (!review) return undefined;
		const timer = setTimeout(() => Spotlight.focus(BODY_ID), 100);
		return () => clearTimeout(timer);
	}, [review]);

	const handleBodyKeyDown = useCallback((ev) => {
		const body = ev.currentTarget;
		if (ev.keyCode !== KEYS.UP && ev.keyCode !== KEYS.DOWN) return;
		const down = ev.keyCode === KEYS.DOWN;
		const room = down ? body.scrollHeight - body.clientHeight - body.scrollTop : body.scrollTop;
		if (room < 1) return;
		ev.preventDefault();
		ev.stopPropagation();
		const step = Math.min(room, Math.round(body.clientHeight * SCROLL_SHARE));
		body.scrollTop += down ? step : -step;
	}, []);

	if (!review) return null;

	return (
		<Popup open onClose={onClose} position="center" scrimType="translucent" noAutoDismiss spotlightRestrict="self-only">
			<div className={css.dialog}>
				<div className={css.dialogHeader}>
					<ReviewAuthor review={review} className={css.dialogAuthor} />
					<SpottableButton className={messagesCss.closeBtn} onClick={onClose} aria-label={$L('Close')}>
						<svg viewBox="0 0 24 24" fill="currentColor">
							<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
						</svg>
					</SpottableButton>
				</div>
				<SpottableDiv className={css.dialogBody} spotlightId={BODY_ID} onKeyDown={handleBodyKeyDown}>
					<MessageMarkdown blocks={blocks} />
				</SpottableDiv>
			</div>
		</Popup>
	);
};

export default ReviewDialog;
