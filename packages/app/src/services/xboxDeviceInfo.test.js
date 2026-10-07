import {getDeviceInfo} from '../../../platform-xbox/src/deviceInfo';

describe('the Xbox device info', () => {
	afterEach(() => {
		delete window.__MOONFIN_XBOX__;
	});

	test('reports the package version the host was built as', async () => {
		window.__MOONFIN_XBOX__ = {v: 1, os: {version: '10.0.26100.9623'}, device: {form: 'Xbox Series X'}, package: {version: '2.9.0.54'}};
		expect(await getDeviceInfo()).toMatchObject({platform: 'Xbox', appVersion: '2.9.0.54', tvVersion: 'Xbox OS 10.0.26100.9623', modelName: 'Xbox Series X'});
	});
});
