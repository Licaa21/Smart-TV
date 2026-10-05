jest.mock('../platform', () => ({getPlatform: () => 'xbox'}));
jest.mock('../services/serverLogger', () => ({__esModule: true, default: {documentRequest: jest.fn()}}));

import serverLogger from '../services/serverLogger';
import {PROBE_HANDOFF_KEY, PROBE_PAGE, openDeviceProbe} from './deviceProbe';

describe('opening the device probe', () => {
	afterEach(() => window.sessionStorage.clear());

	test('leaves the probe the way back and where its report goes, then goes to it', () => {
		const upload = {url: 'http://server:8096/ClientLog/Document?documentType=Log&name=moonfin-xbox-probe', method: 'POST', headers: {Authorization: 'MediaBrowser Token="abc"'}};
		serverLogger.documentRequest.mockReturnValue(upload);
		const navigate = jest.fn();

		openDeviceProbe(navigate);

		expect(serverLogger.documentRequest).toHaveBeenCalledWith('moonfin-xbox-probe');
		const handoff = JSON.parse(window.sessionStorage.getItem(PROBE_HANDOFF_KEY));
		expect(handoff.upload).toEqual(upload);
		expect(handoff.returnTo).toBe(window.location.href);
		expect(handoff.app).toMatch(/^\d+\.\d+\.\d+$/);
		expect(navigate).toHaveBeenCalledWith(PROBE_PAGE);
	});

	test('still opens when the server has nowhere to take a report', () => {
		serverLogger.documentRequest.mockReturnValue(null);
		const navigate = jest.fn();

		openDeviceProbe(navigate);

		expect(JSON.parse(window.sessionStorage.getItem(PROBE_HANDOFF_KEY)).upload).toBeNull();
		expect(navigate).toHaveBeenCalledWith(PROBE_PAGE);
	});
});
