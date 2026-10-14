import {useCallback, useEffect, useRef, useState} from 'react';
import $L from '@enact/i18n/$L';

import SpottableInput from '../../components/SpottableInput/SpottableInput';

import css from './Settings.module.less';

// The TMDB key of this TV. The plugin keeps its own key on the server and never sends it down, so a key
// typed here is the one thing that lets the app read TMDB itself: titles and episodes of Seerr in the
// Jellyfin language, and the rows and dates that look for a key before asking the server. It is kept on
// this TV and never sent back, and it is saved when the field is left.
const TmdbKeyPanel = ({value, onSave}) => {
	const [text, setText] = useState(value || '');
	const textRef = useRef(text);
	textRef.current = text;
	const savedRef = useRef(value || '');
	const onSaveRef = useRef(onSave);
	onSaveRef.current = onSave;

	const save = useCallback(() => {
		const next = textRef.current.trim();
		if (next === savedRef.current) return;
		savedRef.current = next;
		onSaveRef.current(next);
	}, []);

	const handleChange = useCallback((ev) => setText(ev.target.value), []);

	// Leaving the screen with the keyboard still up counts as leaving the field.
	useEffect(() => save, [save]);

	return (
		<>
			<div className={css.authHint}>
				{$L('Your own TMDB key, kept on this TV only. With it, Seerr titles and episodes are read from TMDB in your Jellyfin language. Without it, the server\'s own key is used where the server can use it.')}
			</div>
			<div className={css.inputGroup}>
				<label>{$L('TMDB API key')}</label>
				<SpottableInput
					className={css.input}
					type='text'
					value={text}
					onChange={handleChange}
					onBlur={save}
					placeholder={$L('Paste or type the v3 API key')}
					autoComplete='off'
					spotlightId='tmdb-key-input'
				/>
			</div>
		</>
	);
};

export default TmdbKeyPanel;
