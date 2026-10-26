import {useCallback, useEffect} from 'react';
import $L from '@enact/i18n/$L';
import Spotlight from '@enact/spotlight';

import {ModalContainer} from '../../../../utils/spotlightContainers';
import TrackOptionRow from '../../../../components/TrackOptionRow';

import css from './NouveauSections.module.less';

// The picker behind the sort button. The rows mark which option is active, and the container opens
// focused on that one, so the remote starts where the viewer left off rather than at the top.
const NouveauSortDialog = ({title = $L('Playlist Sort Options'), heading, options = [], active, onSelect, onClose, children}) => {
	// The backdrop closes the dialog, so a press inside it must not travel out to that.
	const stopPropagation = useCallback((ev) => ev.stopPropagation(), []);

	// The remote moves into the picker as it opens and back to whatever opened it once it closes.
	useEffect(() => {
		const opener = Spotlight.getCurrent();
		Spotlight.focus('nouveau-sort-modal');
		return () => {
			if (opener && document.body.contains(opener)) Spotlight.focus(opener);
		};
	}, []);

	const handleClick = useCallback((ev) => {
		const id = ev.currentTarget.dataset.sortId;
		if (id) onSelect?.(id);
	}, [onSelect]);

	return (
		<div className={css.sortOverlay} onClick={onClose}>
			<ModalContainer
				className={css.sortPanel}
				onClick={stopPropagation}
				spotlightId="nouveau-sort-modal"
			>
				<h2 className={css.sortTitle}>{title}</h2>
				{heading && <div className={css.sortHeading}>{heading}</div>}
				<div className={css.sortList}>
					{options.map((option) => (
						<TrackOptionRow
							key={option.id}
							label={option.label}
							selected={option.id === active}
							data-sort-id={option.id}
							onClick={handleClick}
						/>
					))}
				</div>
				{children}
			</ModalContainer>
		</div>
	);
};

export default NouveauSortDialog;
