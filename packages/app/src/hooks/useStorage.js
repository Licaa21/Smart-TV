import {useState, useEffect, useCallback, useRef} from 'react';
import {getFromStorage, saveToStorage} from '../services/storage';

export function useStorage(key, defaultValue) {
	const [value, setValue] = useState(defaultValue);
	const [loaded, setLoaded] = useState(false);
	const defaultRef = useRef(defaultValue);

	useEffect(() => {
		// A new key is not loaded until its own value has come in
		let current = true;
		setLoaded(false);
		getFromStorage(key).then((stored) => {
			if (!current) return;
			// A key with nothing stored is at its default, not at what the last key held
			setValue(stored !== null ? stored : defaultRef.current);
			setLoaded(true);
		});
		return () => { current = false; };
	}, [key]);

	const save = useCallback((newValue) => {
		setValue(newValue);
		saveToStorage(key, newValue);
	}, [key]);

	return [value, save, loaded];
}

export default useStorage;
