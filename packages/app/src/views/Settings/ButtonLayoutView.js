/* eslint-disable react/jsx-no-bind */
import $L from '@enact/i18n/$L';
import Button from '@enact/sandstone/Button';

import {IconArrowUp, IconArrowDown, renderToggle} from './settingsIcons';
import {SpottableDiv} from './settingsSpottables';
import {SectionTitle} from './settingsRows';
import SettingsView from './SettingsView';

import css from './Settings.module.less';

const ButtonLayoutView = ({kind, tempButtons, onToggleButton, onMoveButton, onReset, onSave}) => {
	// The codec ranking has nothing to switch off, so the rows show their place in the order.
	const isCodecOrder = kind === 'audioCodec';
	return (
	<SettingsView spotlightId='button-layout-view'>
		<SectionTitle>
			{isCodecOrder ? $L('Audio Codec Priority') : (kind === 'osd' ? $L('Player Buttons') : (kind === 'metadata' ? $L('Metadata Row') : $L('Details Buttons')))}
		</SectionTitle>
		<div className={css.viewDescription}>
			{isCodecOrder
				? $L('Move the codecs up or down to rank them, best first. Your audio language is applied before this, so the ranking only decides between tracks in the same language.')
				: (kind === 'osd'
				? $L('Enable/disable and reorder the buttons around the playback controls.')
				: (kind === 'metadata'
				? $L('Enable/disable and reorder the metadata items displayed on the details screen.')
				: $L('Enable/disable and reorder the buttons on the details screen action row.')))}
		</div>
		{tempButtons.map((btn, index) => (
			<div key={btn.id} className={css.homeRowItem}>
				<SpottableDiv
					className={css.listItem}
					onClick={isCodecOrder ? undefined : () => onToggleButton(btn.id)}
					spotlightId={`layoutbtn-${btn.id}`}
				>
					<div className={css.listItemBody}>
						<div className={css.listItemHeading}>{$L(btn.label)}</div>
						{btn.subtitle && <div className={css.listItemCaption}>{$L(btn.subtitle)}</div>}
					</div>
					<div className={css.listItemTrailing}>{isCodecOrder ? index + 1 : renderToggle(btn.enabled)}</div>
				</SpottableDiv>
				<div className={css.homeRowControls}>
					<Button
						onClick={() => onMoveButton(btn.id, -1)}
						disabled={index === 0}
						size='small'
						aria-label={$L('Up')}
						spotlightId={`layoutbtn-up-${btn.id}`}
					>
						<IconArrowUp />
					</Button>
					<Button
						onClick={() => onMoveButton(btn.id, 1)}
						disabled={index === tempButtons.length - 1}
						size='small'
						aria-label={$L('Down')}
						spotlightId={`layoutbtn-down-${btn.id}`}
					>
						<IconArrowDown />
					</Button>
				</div>
			</div>
		))}
		<div className={css.actionBar}>
			<Button onClick={onReset} size='small' spotlightId='layoutbtn-reset'>
				{$L('Reset to defaults')}
			</Button>
			<Button onClick={onSave} size='small' spotlightId='layoutbtn-save'>
				{$L('Save')}
			</Button>
		</div>
	</SettingsView>
	);
};

export default ButtonLayoutView;
