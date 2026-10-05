/* eslint-disable react/jsx-no-bind */
import {Fragment} from 'react';
import $L from '@enact/i18n/$L';

import {DETAIL_SECTION_GROUPS, offeredSections, sectionVisibility} from '../../utils/detailSectionLayout';
import {renderToggle} from './settingsIcons';
import {SpottableDiv} from './settingsSpottables';
import {SectionTitle} from './settingsRows';
import SettingsView from './SettingsView';

import css from './Settings.module.less';

// Switches for the parts of the Details screen, limited to what the chosen style draws. The
// hidden list is shared, so a section switched off under one style stays off after switching
// to another. Each press writes straight away, there is no order to arrange first.
const DetailSectionsView = ({style, seerrAvailable, seerrLabel, hidden, onToggle}) => {
	const shows = sectionVisibility(hidden);
	const offered = offeredSections(style, seerrAvailable);

	return (
		<SettingsView spotlightId='detail-sections-view'>
			<SectionTitle>{$L('Sections')}</SectionTitle>
			<div className={css.viewDescription}>
				{$L('Only the sections the current Details screen style can show are listed. Hiding one hides it in every style that has it.')}
			</div>
			{DETAIL_SECTION_GROUPS.map((group) => {
				const sections = offered.filter((section) => section.group === group.id);
				if (sections.length === 0) return null;
				return (
					<Fragment key={group.id}>
						<SectionTitle>{group.id === 'seerr' ? seerrLabel : $L(group.label)}</SectionTitle>
						{sections.map((section) => (
							<SpottableDiv
								key={section.id}
								className={css.listItem}
								onClick={() => onToggle(section.id)}
								spotlightId={`detail-section-${section.id}`}
							>
								<div className={css.listItemBody}>
									<div className={css.listItemHeading}>{$L(section.label)}</div>
									{section.subtitle && <div className={css.listItemCaption}>{$L(section.subtitle)}</div>}
								</div>
								<div className={css.listItemTrailing}>{renderToggle(shows(section.id))}</div>
							</SpottableDiv>
						))}
					</Fragment>
				);
			})}
		</SettingsView>
	);
};

export default DetailSectionsView;
