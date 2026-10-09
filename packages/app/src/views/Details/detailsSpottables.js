import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';

export const SpottableDiv = Spottable('div');
export const SpottableButton = Spottable('button');

export const HorizontalContainer = SpotlightContainerDecorator({restrict: 'self-first'}, 'div');
export const RowContainer = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');
// A row that has a card of its own to open on, such as the episode being looked at among its season
export const CurrentRowContainer = SpotlightContainerDecorator({enterTo: 'last-focused', defaultElement: '[data-current="true"]'}, 'div');
