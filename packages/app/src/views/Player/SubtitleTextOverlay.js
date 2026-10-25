/* eslint-disable react/no-danger */
import {getSubtitleOverlayStyle, getSubtitleTextStyle, sanitizeSubtitleHtml} from '../../utils/subtitleConstants';
import {DEFAULT_SECONDARY_OFFSET, secondaryTextStyle} from './secondarySubtitle';

// The second track stacks right above the first in one column, so the two never overlap
// however many lines either has. While it's loaded, its vertical offset moves the pair.
const SubtitleTextOverlay = ({css, settings, primaryText, secondaryText, secondaryLoaded}) => {
	if (!primaryText && !secondaryText) return null;

	const textStyle = getSubtitleTextStyle(settings);
	const shift = secondaryLoaded ? settings.secondarySubtitleOffset - DEFAULT_SECONDARY_OFFSET : 0;

	return (
		<div
			className={css.subtitleOverlay}
			style={{...getSubtitleOverlayStyle(settings, shift), flexDirection: 'column', alignItems: 'center'}}
		>
			{secondaryText && (
				<div
					className={css.subtitleText}
					style={secondaryTextStyle(settings, textStyle)}
					dangerouslySetInnerHTML={{__html: sanitizeSubtitleHtml(secondaryText)}}
				/>
			)}
			{primaryText && (
				<div
					className={css.subtitleText}
					style={textStyle}
					dangerouslySetInnerHTML={{__html: sanitizeSubtitleHtml(primaryText)}}
				/>
			)}
		</div>
	);
};

export default SubtitleTextOverlay;
