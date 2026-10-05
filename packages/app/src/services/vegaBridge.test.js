import {allowInsecureHost, bootData, exitApp, onShellMessage, postToShell} from '../../../platform-vega/src/bridge';
import {setupVegaLifecycle} from '../../../platform-vega/src/video';

describe('the Vega bridge', () => {
	afterEach(() => {
		delete window.__MOONFIN_VEGA__;
		delete window.ReactNativeWebView;
	});

	test('reads the boot data the shell wrote, and only of its own version', () => {
		expect(bootData()).toBeNull();
		window.__MOONFIN_VEGA__ = {v: 1, ip: '192.168.1.20'};
		expect(bootData().ip).toBe('192.168.1.20');
		window.__MOONFIN_VEGA__ = {v: 2, ip: '192.168.1.20'};
		expect(bootData()).toBeNull();
	});

	test('posts versioned messages to the shell and says when there is none', () => {
		expect(exitApp()).toBe(false);
		const postMessage = jest.fn();
		window.ReactNativeWebView = {postMessage};
		expect(allowInsecureHost('nas:8920')).toBe(true);
		expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({v: 1, type: 'ALLOW_INSECURE_HOST', payload: {host: 'nas:8920'}});
		expect(postToShell('EXIT_APP')).toBe(true);
	});

	test('hands shell messages of one type to the handler until removed', () => {
		const handler = jest.fn();
		const remove = onShellMessage('APP_STATE', handler);
		window.dispatchEvent(new CustomEvent('moonfin:vega', {detail: {v: 1, type: 'APP_STATE', payload: {state: 'background'}}}));
		window.dispatchEvent(new CustomEvent('moonfin:vega', {detail: {v: 1, type: 'KEY', payload: {key: 'Menu'}}}));
		window.dispatchEvent(new CustomEvent('moonfin:vega', {detail: {v: 2, type: 'APP_STATE', payload: {state: 'active'}}}));
		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler).toHaveBeenCalledWith({state: 'background'});
		remove();
		window.dispatchEvent(new CustomEvent('moonfin:vega', {detail: {v: 1, type: 'APP_STATE', payload: {state: 'active'}}}));
		expect(handler).toHaveBeenCalledTimes(1);
	});
});

describe('the Vega lifecycle', () => {
	const shellSays = (connected) => window.dispatchEvent(new CustomEvent('moonfin:vega', {detail: {v: 1, type: 'NETWORK', payload: {connected, ip: null}}}));

	test('turns a change in the shell network report into the browser events, after the first word', () => {
		const offline = jest.fn();
		const online = jest.fn();
		window.addEventListener('offline', offline);
		window.addEventListener('online', online);
		const remove = setupVegaLifecycle();
		shellSays(true);
		shellSays(true);
		expect(offline).not.toHaveBeenCalled();
		shellSays(false);
		expect(offline).toHaveBeenCalledTimes(1);
		shellSays(false);
		expect(offline).toHaveBeenCalledTimes(1);
		shellSays(true);
		expect(online).toHaveBeenCalledTimes(1);
		remove();
		shellSays(false);
		expect(offline).toHaveBeenCalledTimes(1);
		window.removeEventListener('offline', offline);
		window.removeEventListener('online', online);
	});

	test('raises the remote menu key on the focused element as the context menu key', () => {
		const button = document.createElement('button');
		document.body.appendChild(button);
		button.focus();
		const seen = jest.fn();
		button.addEventListener('keydown', (e) => seen(e.keyCode, e.bubbles));
		const remove = setupVegaLifecycle();
		window.dispatchEvent(new CustomEvent('moonfin:vega', {detail: {v: 1, type: 'KEY', payload: {key: 'Menu', action: 'up'}}}));
		window.dispatchEvent(new CustomEvent('moonfin:vega', {detail: {v: 1, type: 'KEY', payload: {key: 'Menu', action: 'down'}}}));
		expect(seen).toHaveBeenCalledTimes(1);
		expect(seen).toHaveBeenCalledWith(93, true);
		remove();
		button.remove();
	});
});
