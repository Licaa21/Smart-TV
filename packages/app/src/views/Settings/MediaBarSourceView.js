/* eslint-disable react/jsx-no-bind */
import $L from '@enact/i18n/$L';

import {renderToggle} from './settingsIcons';
import {SpottableDiv} from './settingsSpottables';
import SettingsView from './SettingsView';

import css from './Settings.module.less';
import SettingsButton from './SettingsButton';

// Picking libraries and picking collections are the same screen with different words and a
// different list, so both go through here.
const MediaBarSourceView = ({
	viewSpotlightId,
	title,
	description,
	loadingLabel,
	loading,
	items,
	itemIdKey,
	itemNameKey,
	selectedIds,
	itemSpotlightPrefix,
	cancelSpotlightId,
	saveSpotlightId,
	onToggleSelection,
	onCancel,
	onSave
}) => (
	<SettingsView spotlightId={viewSpotlightId} title={title}>
		<div className={css.viewDescription}>{description}</div>
		{loading ? (
			<div className={css.loadingMessage}>{loadingLabel}</div>
		) : (
			items.map((item) => {
				const itemId = item[itemIdKey];
				const itemName = item[itemNameKey];
				const isSelected = selectedIds.includes(itemId);
				return (
					<SpottableDiv
						key={itemId}
						className={css.listItem}
						onClick={() => onToggleSelection(itemId)}
						spotlightId={`${itemSpotlightPrefix}-${itemId}`}
					>
						<div className={css.listItemBody}>
							<div className={css.listItemHeading}>{itemName}</div>
						</div>
						<div className={css.listItemTrailing}>{renderToggle(isSelected)}</div>
					</SpottableDiv>
				);
			})
		)}
		{!loading && (
			<div className={css.actionBar}>
				<SettingsButton onClick={onCancel} spotlightId={cancelSpotlightId}>
					{$L('Cancel')}
				</SettingsButton>
				<SettingsButton primary onClick={onSave} spotlightId={saveSpotlightId}>
					{$L('Save')}
				</SettingsButton>
			</div>
		)}
	</SettingsView>
);

export default MediaBarSourceView;
