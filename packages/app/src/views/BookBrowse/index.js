import {useSettings} from '../../context/SettingsContext';
import BookstoreBooks from './BookstoreBooks';
import ClassicBooks from './ClassicBooks';
import ReadingRoomBooks from './ReadingRoomBooks';

// The book library in the style picked in Settings, swapped as soon as the setting changes.
const BookBrowse = (props) => {
	const {settings} = useSettings();
	if (settings.bookLibraryStyle === 'classic') return <ClassicBooks {...props} />;
	if (settings.bookLibraryStyle === 'readingRoom') return <ReadingRoomBooks {...props} />;
	return <BookstoreBooks {...props} />;
};

export default BookBrowse;
