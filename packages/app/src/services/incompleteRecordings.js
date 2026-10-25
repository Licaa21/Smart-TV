import {useSyncExternalStore} from 'react';
import {getAuthHeader, getServerUrl} from './jellyfinApi';

// The Moonfin plugin's list of Live TV recordings that missed part of their program, keyed by
// item id. It's read again once it's a few minutes old and a screen showing recordings asks.
const CACHE_MS = 5 * 60 * 1000;
// A program this far past its start has lost enough that a later showing is worth offering.
const LATER_SHOWING_AFTER_MS = 60000;

let supported = false;
let canManage = false;
let entries = new Map();
let fetchedAt = 0;
let inFlight = null;
// Bumped by every configure, so a reply from before a server switch is dropped.
let generation = 0;
const listeners = new Set();

const normalizeId = (id) => String(id || '').replace(/-/g, '').toLowerCase();

const notify = () => listeners.forEach((listener) => listener());

const pluginRequest = async (path, options = {}) => {
	const headers = {Authorization: getAuthHeader()};
	if (options.body) headers['Content-Type'] = 'application/json';
	const response = await fetch(`${getServerUrl()}/Moonfin/LiveTv${path}`, {...options, headers});
	if (!response.ok) {
		const error = new Error('Plugin error: ' + response.status);
		error.status = response.status;
		throw error;
	}
	return response;
};

// A refused read clears the marks. Any other failure keeps the last list.
export const refreshIncompleteRecordings = () => {
	if (!supported || inFlight || Date.now() - fetchedAt < CACHE_MS) return inFlight || Promise.resolve();
	const request = generation;
	const apply = (next) => {
		if (request !== generation) return;
		entries = next;
		notify();
	};
	const done = () => {
		if (request !== generation) return;
		fetchedAt = Date.now();
		inFlight = null;
	};
	inFlight = pluginRequest('/Recordings/Incomplete')
		.then((response) => response.json())
		.then((list) => apply(new Map((Array.isArray(list) ? list : []).map((entry) => [normalizeId(entry.itemId), entry]))), (err) => {
			if (err.status === 401 || err.status === 403) apply(new Map());
		})
		.then(done, done);
	return inFlight;
};

// App keeps this in step with the plugin's ping and the signed in user. A new ping can mean a
// different server, so the list always starts over.
export const configureIncompleteRecordings = ({supported: isSupported, canManage: isManager}) => {
	supported = isSupported;
	canManage = isManager;
	generation++;
	entries = new Map();
	fetchedAt = 0;
	inFlight = null;
	notify();
	refreshIncompleteRecordings();
};

const subscribe = (listener) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

export const useIncompleteRecording = (itemId) => useSyncExternalStore(
	subscribe,
	() => (supported && itemId ? entries.get(normalizeId(itemId)) || null : null)
);

// Keep as Complete clears the mark for everyone on the server, so it's for Live TV managers only.
export const canKeepAsComplete = () => supported && canManage;

export const keepAsComplete = async (itemId) => {
	const id = normalizeId(itemId);
	await pluginRequest(`/Recordings/${id}/Dismiss`, {method: 'POST'});
	entries = new Map(entries);
	entries.delete(id);
	notify();
};

// An episode recorded after it started is missing its beginning, and the plugin can look for a
// later showing to record in full.
export const offersLaterShowing = (program, now) => canKeepAsComplete() &&
	program?.ParentIndexNumber != null && program?.IndexNumber != null &&
	now - new Date(program.StartDate).getTime() > LATER_SHOWING_AFTER_MS;

export const requestLaterShowing = (programId) => pluginRequest('/CompleteShowing', {
	method: 'POST',
	body: JSON.stringify({programId})
});
