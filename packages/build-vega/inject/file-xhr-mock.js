// The app is served from file:///pkg/assets, where a page has a null origin and
// a request for a sibling file fails with a NetworkError. ilib still asks for
// locale files it doesnt have bundled, so those requests get a quick 404 instead,
// while http, data and blob requests go through untouched.
(function () {
	if (location.protocol !== 'file:') return;
	const passThrough = /^(https?:|data:|blob:)/;
	const OrigOpen = XMLHttpRequest.prototype.open;
	const OrigSend = XMLHttpRequest.prototype.send;
	XMLHttpRequest.prototype.open = function (method, url, async) {
		if (!url || !passThrough.test(url)) {
			this.__xhrMocked = async === undefined || !!async;
			return;
		}
		return OrigOpen.apply(this, arguments);
	};
	XMLHttpRequest.prototype.send = function () {
		if (this.__xhrMocked === undefined) return OrigSend.apply(this, arguments);
		const isAsync = this.__xhrMocked;
		delete this.__xhrMocked;
		const xhr = this;
		const fire = function () {
			const fields = {readyState: 4, status: 404, statusText: 'Not Found', responseText: '{}', response: '{}'};
			Object.keys(fields).forEach(function (key) {
				try { Object.defineProperty(xhr, key, {value: fields[key], configurable: true}); } catch (e) { /* read only on this engine */ }
			});
			try { if (xhr.onreadystatechange) xhr.onreadystatechange(); } catch (e) { /* the caller's problem */ }
			try { if (xhr.onload) xhr.onload(); } catch (e) { /* the caller's problem */ }
		};
		if (isAsync) setTimeout(fire, 0);
		else fire();
	};
})();
