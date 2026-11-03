import $L from '@enact/i18n/$L';
import Spottable from '@enact/spotlight/Spottable';

import useUserAvatar from '../../hooks/useUserAvatar';
import AvatarImage from '../AvatarImage';

import css from './Sidebar.module.less';

const SpottableButton = Spottable('button');

const SidebarUserButton = ({onClick}) => {
	const {user, avatarUrl, initial, onError} = useUserAvatar();

	return (
		<SpottableButton className={`${css.sidebarItem} ${css.userBtn}`} onClick={onClick}>
			{avatarUrl ? (
				<AvatarImage className={css.userAvatarImg} src={avatarUrl} alt={user?.Name} onError={onError} />
			) : (
				<div className={css.userAvatar}>{initial}</div>
			)}
			<span className={css.sidebarLabel}>{user?.Name || $L('User')}</span>
		</SpottableButton>
	);
};

export default SidebarUserButton;
