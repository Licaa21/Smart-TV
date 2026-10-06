import {memo, useEffect} from 'react';

import css from './SeerrNotificationToast.module.less';

const AUTO_DISMISS_MS = 7000;

// Passive banner for Seerr notifications pushed over the settings stream, and
// for anything else the shell has to say in passing. It never takes focus so
// D-pad navigation is undisturbed. An icon path, when given, leads the text.
const SeerrNotificationToast = ({notification, onDismiss}) => {
	useEffect(() => {
		if (!notification) return;
		const timer = setTimeout(() => onDismiss?.(), AUTO_DISMISS_MS);
		return () => clearTimeout(timer);
	}, [notification, onDismiss]);

	if (!notification) return null;

	return (
		<div className={css.toast} key={notification.key}>
			{notification.icon ? (
				<svg className={css.icon} viewBox="0 -960 960 960" aria-hidden="true"><path d={notification.icon} /></svg>
			) : null}
			<div className={css.text}>
				<div className={css.title}>{notification.title}</div>
				{notification.body ? <div className={css.body}>{notification.body}</div> : null}
			</div>
		</div>
	);
};

export default memo(SeerrNotificationToast);
