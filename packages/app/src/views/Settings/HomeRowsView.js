/* eslint-disable react/jsx-no-bind */
import $L from '@enact/i18n/$L';

import {getPluginSectionSourceLabel, isHomeRowVisibleByGates} from './homeSectionsModel';
import {ReorderRow, useCommitOnLeave} from './settingsRows';
import SettingsView, {TitleAction} from './SettingsView';

import css from './Settings.module.less';
import SettingsButton from './SettingsButton';

// Rows the viewer has switched off elsewhere are filtered out, so a move steps between the rows
// actually on show rather than over gaps. Left and right move a row and OK switches it, and
// the arrangement is written back when the screen closes.
const HomeRowsView = ({
	settings,
	tempHomeRows,
	tempPluginSections,
	pluginSectionRenderLimit,
	onShowMoreSections,
	onToggleHomeRow,
	onMoveHomeRow,
	onTogglePluginSection,
	onMovePluginSection,
	onReset,
	onLeave
}) => {
	useCommitOnLeave(onLeave);
	const visibleRows = tempHomeRows.filter((row) => isHomeRowVisibleByGates(row.id, settings));
	const sections = tempPluginSections.slice(0, pluginSectionRenderLimit);

	return (
		<SettingsView
			spotlightId='homerows-view'
			title={$L('Rows')}
			clean
			action={<TitleAction icon='restore' label={$L('Reset to defaults')} onClick={onReset} />}
		>
			{visibleRows.map((row, index) => (
				<ReorderRow
					key={row.id}
					spotlightId={`homerow-${row.id}`}
					title={$L(row.name)}
					checkbox
					enabled={row.enabled}
					isFirst={index === 0}
					isLast={index === visibleRows.length - 1}
					onToggle={() => onToggleHomeRow(row.id)}
					onMove={(direction) => onMoveHomeRow(row.id, direction)}
				/>
			))}
			{sections.map((section, index) => (
				<ReorderRow
					key={section.id}
					spotlightId={`pluginrow-${section.id}`}
					title={section.name}
					subtitle={getPluginSectionSourceLabel(section.source)}
					checkbox
					enabled={section.enabled}
					isFirst={index === 0}
					isLast={index === tempPluginSections.length - 1}
					onToggle={() => onTogglePluginSection(section.id)}
					onMove={(direction) => onMovePluginSection(section.id, direction)}
				/>
			))}
			{tempPluginSections.length > pluginSectionRenderLimit && (
				<div className={css.actionBar}>
					<SettingsButton onClick={onShowMoreSections} spotlightId='pluginrow-show-more'>
						{$L('Show More')} ({tempPluginSections.length - pluginSectionRenderLimit})
					</SettingsButton>
				</div>
			)}
		</SettingsView>
	);
};

export default HomeRowsView;
