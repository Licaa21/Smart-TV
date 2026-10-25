import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';

export const SpottableDiv = Spottable('div');
export const SpottableButton = Spottable('button');

export const HorizontalContainer = SpotlightContainerDecorator({restrict: 'self-first'}, 'div');
export const RowContainer = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');
// A row that can stop short of the right edge. Right off its last card would otherwise land on
// whatever Spotlight finds nearest, which on a long page can be the action row far above.
export const ShortRowContainer = SpotlightContainerDecorator({enterTo: 'last-focused', leaveFor: {right: ''}}, 'div');
