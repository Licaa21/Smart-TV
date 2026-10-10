import {installMissingFileAnswer} from '../../../platform-xbox/src/packageFiles';

// What the folder mapping does with a file that isnt there
const networkError = () => {
	const error = new Error('Failed to load');
	error.name = 'NetworkError';
	return error;
};

describe('the Xbox package files', () => {
	const proto = window.XMLHttpRequest.prototype;
	let realOpen;
	let realSend;
	let send;
	let remove;

	beforeEach(() => {
		realOpen = proto.open;
		realSend = proto.send;
		proto.open = jest.fn();
		send = jest.fn();
		proto.send = send;
		remove = installMissingFileAnswer();
	});

	afterEach(() => {
		remove();
		proto.open = realOpen;
		proto.send = realSend;
	});

	const request = (url, async) => {
		const xhr = new window.XMLHttpRequest();
		if (async === undefined) xhr.open('GET', url);
		else xhr.open('GET', url, async);
		return xhr;
	};

	test('a synchronous request for a missing file of the page gets a 404 instead of a throw', () => {
		send.mockImplementation(() => { throw networkError(); });
		const xhr = request('locale/ilibmanifest.json', false);
		const onload = jest.fn();
		xhr.onload = onload;
		expect(() => xhr.send(null)).not.toThrow();
		expect(xhr.status).toBe(404);
		expect(xhr.readyState).toBe(4);
		expect(xhr.responseText).toBe('');
		expect(onload).toHaveBeenCalledTimes(1);
	});

	test('a file that is there is left as the WebView answered it', () => {
		const xhr = request('/main.js', false);
		xhr.send(null);
		expect(send).toHaveBeenCalledWith(null);
		expect(xhr.status).toBe(0);
	});

	test('a request to a server still throws, as does any other failure', () => {
		send.mockImplementation(() => { throw networkError(); });
		expect(() => request('http://server:8096/System/Info/Public', false).send()).toThrow('Failed to load');

		send.mockImplementation(() => { throw new Error('something else'); });
		expect(() => request('strings.json', false).send()).toThrow('something else');
	});

	test('an asynchronous request is not touched', () => {
		send.mockImplementation(() => { throw networkError(); });
		expect(() => request('strings.json', true).send()).toThrow('Failed to load');
		expect(() => request('strings.json').send()).toThrow('Failed to load');
	});

	test('nothing is answered once it is removed', () => {
		remove();
		proto.send = jest.fn(() => { throw networkError(); });
		expect(() => request('strings.json', false).send()).toThrow('Failed to load');
	});
});
