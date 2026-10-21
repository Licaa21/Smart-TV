/* eslint-disable react/jsx-no-bind */
import {useState} from 'react';
import $L from '@enact/i18n/$L';
import Spotlight from '@enact/spotlight';

import {HOME_ROW_GROUPS, getPluginSectionSourceLabel, homeRowGroup, isHomeRowVisibleByGates} from './homeSectionsModel';
import {ReorderRow, SectionTitle, useCommitOnLeave} from './settingsRows';
import {SettingsGlyph} from './settingsIcons';
import {SpottableDiv} from './settingsSpottables';
import SettingsView, {TitleAction} from './SettingsView';

import css from './Settings.module.less';
import SettingsButton from './SettingsButton';

const groupLabel = (group) => {
	switch (group) {
		case 'collections': return $L('Collections');
		case 'favorites': return $L('Favorites');
		case 'genres': return $L('Genres and Studios');
		case 'playlists': return $L('Playlists');
		case 'seerr': return $L('Seerr');
		case 'external': return $L('External Lists');
		default: return $L('General');
	}
};

const groupSpotlightId = (group) => `homerows-group-${group}`;

// Built-in rows and the discovered plugin sections are kept in lists of their own
const isPluginSection = (item) => Boolean(item.source);
const rowSpotlightId = (item) => (isPluginSection(item) ? `pluginrow-${item.id}` : `homerow-${item.id}`);
const rowTitle = (item) => (isPluginSection(item) ? item.name : $L(item.name));
const rowSubtitle = (item) => (isPluginSection(item) ? getPluginSectionSourceLabel(item.source) : undefined);

const GroupRow = ({group, count, open, onToggle}) => (
	<SpottableDiv className={`${css.listItem} ${css.listItemClean}`} onClick={onToggle} spotlightId={groupSpotlightId(group)}>
		<div className={open ? `${css.listItemIconPlain} ${css.groupChevronOpen}` : css.listItemIconPlain}>
			<SettingsGlyph name='chevron_right' />
		</div>
		<div className={css.listItemBody}>
			<div className={css.listItemHeading}>{groupLabel(group)}</div>
		</div>
		<div className={css.listItemTrailing}>
			<div className={css.valueBubble}>{count}</div>
		</div>
	</SpottableDiv>
);

// The Enabled list is what Home shows, in its order: the built-in rows, then the plugin
// sections, each moving among its own with left and right. The disabled rows sit below in a
// group per kind that OK opens and closes. Rows the viewer has switched off elsewhere, and the
// Live TV rows on a server without Live TV, are left out. The arrangement is written back when
// the screen closes.
const HomeRowsView = ({
	settings,
	tempHomeRows,
	tempPluginSections,
	serverHasLiveTv,
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
	const [openGroups, setOpenGroups] = useState(() => new Set(['general']));
	const visibleRows = tempHomeRows.filter((row) => isHomeRowVisibleByGates(row.id, settings, serverHasLiveTv));
	const enabledRows = visibleRows.filter((row) => row.enabled);
	const enabledSections = tempPluginSections.filter((section) => section.enabled);
	const enabledIds = [...enabledRows, ...enabledSections].map(rowSpotlightId);
	const disabled = [...visibleRows, ...tempPluginSections].filter((item) => !item.enabled);
	const groups = HOME_ROW_GROUPS
		.map((group) => ({group, items: disabled.filter((item) => homeRowGroup(item) === group)}))
		.filter(({items}) => items.length > 0);

	const toggleGroup = (group) => setOpenGroups((prev) => {
		const next = new Set(prev);
		if (!next.delete(group)) next.add(group);
		return next;
	});

	// The row slides out of the list it was in, so the focus goes to the one taking its place
	const toggleFrom = (ids, item, fallbackId) => {
		const at = ids.indexOf(rowSpotlightId(item));
		if (isPluginSection(item)) onTogglePluginSection(item.id);
		else onToggleHomeRow(item.id);
		const next = ids[at + 1] || ids[at - 1] || fallbackId;
		window.requestAnimationFrame(() => Spotlight.focus(next));
	};

	const renderEnabled = (list, onMove) => list.map((item, index) => (
		<ReorderRow
			key={item.id}
			spotlightId={rowSpotlightId(item)}
			title={rowTitle(item)}
			subtitle={rowSubtitle(item)}
			checkbox
			enabled
			isFirst={index === 0}
			isLast={index === list.length - 1}
			onToggle={() => toggleFrom(enabledIds, item, groupSpotlightId(homeRowGroup(item)))}
			onMove={(direction) => onMove(item.id, direction)}
		/>
	));

	return (
		<SettingsView
			spotlightId='homerows-view'
			title={$L('Rows')}
			clean
			action={<TitleAction icon='restore' label={$L('Reset to defaults')} onClick={onReset} />}
		>
			<SectionTitle>{$L('Enabled')}</SectionTitle>
			{renderEnabled(enabledRows, onMoveHomeRow)}
			{renderEnabled(enabledSections, onMovePluginSection)}
			{groups.length > 0 && <SectionTitle>{$L('Disabled')}</SectionTitle>}
			{groups.map(({group, items}) => {
				const open = openGroups.has(group);
				const shown = open ? items.slice(0, pluginSectionRenderLimit) : [];
				const ids = shown.map(rowSpotlightId);
				return [
					<GroupRow key={`group-${group}`} group={group} count={items.length} open={open} onToggle={() => toggleGroup(group)} />,
					...shown.map((item) => (
						<ReorderRow
							key={item.id}
							spotlightId={rowSpotlightId(item)}
							title={rowTitle(item)}
							subtitle={rowSubtitle(item)}
							checkbox
							enabled={false}
							isFirst
							isLast
							onToggle={() => toggleFrom(ids, item, rowSpotlightId(item))}
						/>
					)),
					open && items.length > shown.length && (
						<div key={`more-${group}`} className={css.actionBar}>
							<SettingsButton onClick={onShowMoreSections} spotlightId={`homerows-more-${group}`}>
								{$L('Show More')} ({items.length - shown.length})
							</SettingsButton>
						</div>
					)
				];
			})}
		</SettingsView>
	);
};

export default HomeRowsView;
