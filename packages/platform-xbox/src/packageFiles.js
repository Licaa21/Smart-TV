// The app's own files, as WebView2 serves them out of the package.
//
// The host maps a folder of the package to the page's origin, and the mapping
// answers a file that isnt there with a network error where a web server would say
// 404. A synchronous request throws on that. The locale loader asks synchronously
// for files that were never packaged and takes a 404 in its stride, but the throw
// stops the app before it draws anything. So a synchronous request for one of the
// page's own files that fails this way is given the 404 it should have had. The
// host cant do this itself, since mapped files never reach its request handler.

const isOwnFile = (url) => {
	try {
		return new URL(url, window.location.href).origin === window.location.origin;
	} catch (e) {
		return false;
	}
};

const answerNotFound = (xhr) => {
	const fields = {readyState: 4, status: 404, statusText: 'Not Found', responseText: '', response: ''};
	Object.keys(fields).forEach((key) => Object.defineProperty(xhr, key, {value: fields[key], configurable: true}));
	if (xhr.onreadystatechange) xhr.onreadystatechange();
	if (xhr.onload) xhr.onload();
};

export const installMissingFileAnswer = () => {
	if (typeof window === 'undefined' || !window.XMLHttpRequest) return () => {};
	const proto = window.XMLHttpRequest.prototype;
	const nativeOpen = proto.open;
	const nativeSend = proto.send;
	const watched = new WeakSet();

	proto.open = function (method, url, async) {
		if (async === false && isOwnFile(url)) watched.add(this);
		else watched.delete(this);
		return nativeOpen.apply(this, arguments);
	};
	proto.send = function () {
		if (!watched.has(this)) return nativeSend.apply(this, arguments);
		try {
			return nativeSend.apply(this, arguments);
		} catch (e) {
			if (!e || e.name !== 'NetworkError') throw e;
			answerNotFound(this);
			return undefined;
		}
	};

	return () => {
		proto.open = nativeOpen;
		proto.send = nativeSend;
	};
};
