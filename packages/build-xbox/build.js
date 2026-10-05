/* eslint-disable no-console */
// Builds Moonfin for Xbox.
//
// The web app is packed with Enact like the other platforms and copied into the UWP
// host under shell/Moonfin.Xbox/www, which serves it to a WebView2 from the package.
// The host is then built into an .msix with MSBuild, so that last step needs Windows
// with the Visual Studio Build Tools and their UWP workload. Pass --no-msix to stop
// once the web app is in place, which works on any system.
//
//   node build.js [--debug] [--no-msix] [--no-web] [--dev-url <url>]
//
// --no-web keeps the web app already in www and only builds the host again, for
// when nothing but the C# changed.
//
// --dev-url makes a Debug package that loads the app from a dev server (npm run
// dev:xbox) instead of from the package, so changes show on the console as they are
// saved.
//
// The package is signed with the certificate in MOONFIN_XBOX_PFX, its password in
// MOONFIN_XBOX_PFX_PASSWORD. Without one a throwaway certificate is made and kept in
// .cert, which is all sideloading through the Device Portal needs. Either way its
// subject has to be the Publisher in Package.appxmanifest.
//
// The package version follows packages/app/package.json.
const {execFileSync, execSync, spawnSync} = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {LINT_DIRS, runLintGate} = require('../../scripts/lint-gate');

const APP_DIR = path.resolve(__dirname, '..', 'app');
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const HOST_DIR = path.join(__dirname, 'shell', 'Moonfin.Xbox');
const WWW_DIR = path.join(HOST_DIR, 'www');
const PACKAGES_DIR = path.join(HOST_DIR, 'AppPackages');
const CERT_DIR = path.join(__dirname, '.cert');
const MANIFEST_PATH = path.join(HOST_DIR, 'Package.appxmanifest');
const BUILD_MANIFEST = 'Package.Build.appxmanifest';

// Files the subtitle renderers load next to the page. The page has a real origin
// here, so they are copied as they are.
const LIBASS_DIR = path.join(ROOT_DIR, 'node_modules', 'libass-wasm', 'dist', 'js');
const PAGE_ASSETS = [
	{src: path.join(ROOT_DIR, 'node_modules', 'libpgs', 'dist', 'libpgs.worker.js')},
	{src: path.join(LIBASS_DIR, 'subtitles-octopus-worker.js')},
	{src: path.join(LIBASS_DIR, 'subtitles-octopus-worker.wasm')},
	{src: path.join(ROOT_DIR, 'node_modules', '@enact', 'sandstone', 'fonts', 'MuseoSans', 'MuseoSans-Light.ttf'), name: 'ass-fallback-font.ttf'},
	{src: path.join(APP_DIR, 'resources', 'banner-dark.png'), name: path.join('resources', 'banner-dark.png')}
];

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);

const run = (cmd, opts = {}) => {
	console.log(`> ${cmd}`);
	execSync(cmd, {stdio: 'inherit', ...opts});
};

const copyDirRecursive = (src, dest) => {
	fs.mkdirSync(dest, {recursive: true});
	for (const entry of fs.readdirSync(src, {withFileTypes: true})) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		if (entry.isDirectory()) copyDirRecursive(srcPath, destPath);
		else fs.copyFileSync(srcPath, destPath);
	}
};

const copyPageAssets = (dir) => {
	for (const asset of PAGE_ASSETS) {
		const name = asset.name || path.basename(asset.src);
		if (!fs.existsSync(asset.src)) {
			console.warn(`  ${name} not found, subtitle rendering may degrade`);
			continue;
		}
		const dest = path.join(dir, name);
		fs.mkdirSync(path.dirname(dest), {recursive: true});
		fs.copyFileSync(asset.src, dest);
		console.log(`  Copied ${name}`);
	}
};

// Sandstone's CSS asks for its fonts at /node_modules/@enact/sandstone/fonts, which
// the pack leaves out. The page is served from the root of www, so they go at that
// very path and the CSS stays as it is.
const SANDSTONE_FONTS = path.join('node_modules', '@enact', 'sandstone', 'fonts');

const buildApp = (appPkg) => {
	const ENACT_ALIAS = JSON.stringify({
		'@moonfin/platform-webos': path.resolve(__dirname, '..', 'platform-webos', 'src'),
		'@moonfin/platform-tizen': path.resolve(__dirname, '..', 'platform-tizen', 'src'),
		'@moonfin/platform-vega': path.resolve(__dirname, '..', 'platform-vega', 'src'),
		'@moonfin/platform-xbox': path.resolve(__dirname, '..', 'platform-xbox', 'src'),
		'@moonfin/app': APP_DIR
	});

	console.log('Applying Enact compatibility patches...');
	require(path.join(ROOT_DIR, 'scripts', 'patch-enact-legacy.js'));

	console.log('Cleaning previous build...');
	run('npx enact clean', {cwd: APP_DIR});

	console.log('\n Running lint checks...');
	for (const dir of LINT_DIRS) {
		if (!runLintGate(dir, (msg) => console.log(`> ${msg}`))) {
			console.error('Lint check failed: warnings/errors detected.');
			process.exit(1);
		}
	}

	console.log('\n Checking CSS against the browser targets...');
	if (spawnSync('node', [path.join(ROOT_DIR, 'scripts', 'check-legacy-css.js')], {stdio: 'inherit'}).status !== 0) {
		console.error('CSS target check failed.');
		process.exit(1);
	}

	console.log('\n Building with Enact...');
	run('npx enact pack -p', {
		cwd: APP_DIR,
		env: {
			...process.env,
			BROWSERSLIST_CONFIG: path.join(__dirname, '.browserslistrc'),
			ENACT_ALIAS,
			REACT_APP_VERSION: appPkg.version,
			REACT_APP_PLATFORM: 'xbox'
		}
	});

	console.log('\n Copying build output into the host...');
	fs.rmSync(WWW_DIR, {recursive: true, force: true});
	copyDirRecursive(path.join(APP_DIR, 'dist'), WWW_DIR);
	fs.rmSync(path.join(APP_DIR, 'dist'), {recursive: true, force: true});

	console.log('\n Copying the subtitle workers and banner...');
	copyPageAssets(WWW_DIR);

	console.log('\n Copying Sandstone fonts...');
	copyDirRecursive(path.join(ROOT_DIR, SANDSTONE_FONTS), path.join(WWW_DIR, SANDSTONE_FONTS));

	console.log('\n Pruning ilib locale data...');
	require(path.join(ROOT_DIR, 'scripts', 'prune-ilib-locales.js'))(WWW_DIR);

	console.log('\n Pruning bundled translation copies...');
	require(path.join(ROOT_DIR, 'scripts', 'prune-bundled-strings.js'))(WWW_DIR);
};

// A console only takes a package over one it already has when the version went up,
// and removing the old one first throws away the sign in and every setting. So each
// Debug build counts the last part of its version one higher. The count is kept
// beside the certificate, outside the repo.
const nextDebugRevision = () => {
	const file = path.join(CERT_DIR, 'debug-revision.txt');
	const last = fs.existsSync(file) ? Number(fs.readFileSync(file, 'utf8')) || 0 : 0;
	const next = last >= 65535 ? 1 : last + 1;
	fs.mkdirSync(CERT_DIR, {recursive: true});
	fs.writeFileSync(file, String(next));
	return next;
};

// The manifest a Debug build is made from: the app's own under a higher version. It
// is written fresh each build and never committed. Null for a Release build, which
// uses the manifest as it is.
const writeBuildManifest = (version) => {
	if (!flag('--debug')) return null;
	const manifest = fs.readFileSync(MANIFEST_PATH, 'utf8')
		.replace(/(<Identity[^>]*?Version=")[^"]*(")/, `$1${version}.${nextDebugRevision()}$2`);
	fs.writeFileSync(path.join(HOST_DIR, BUILD_MANIFEST), manifest);
	return BUILD_MANIFEST;
};

// Nothing is packed for a dev server build. The host finds the address in the one
// file www holds and loads the app from there.
const writeDevUrl = (devUrl) => {
	if (!/^https?:\/\/[^/]/i.test(devUrl || '')) throw new Error(`--dev-url needs an http or https address, got ${devUrl}`);
	const url = new URL(devUrl);
	fs.rmSync(WWW_DIR, {recursive: true, force: true});
	fs.mkdirSync(WWW_DIR, {recursive: true});
	fs.writeFileSync(path.join(WWW_DIR, 'dev-url.txt'), `${url.href}\n`);
	console.log(` The package will load the app from ${url.href}`);
};

// The manifest takes four parts and the Store keeps the last for itself.
const syncManifestVersion = (version) => {
	const manifest = fs.readFileSync(MANIFEST_PATH, 'utf8');
	const updated = manifest.replace(/(<Identity[^>]*?Version=")[^"]*(")/, `$1${version}.0$2`);
	if (updated !== manifest) fs.writeFileSync(MANIFEST_PATH, updated);
};

const manifestPublisher = () => {
	const match = /<Identity[^>]*?Publisher="([^"]*)"/.exec(fs.readFileSync(MANIFEST_PATH, 'utf8'));
	if (!match) throw new Error('No Publisher in Package.appxmanifest');
	return match[1];
};

const findMSBuild = () => {
	const vswhere = path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
	if (process.platform !== 'win32' || !fs.existsSync(vswhere)) return null;
	const found = execFileSync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.Component.MSBuild', '-find', 'MSBuild\\**\\Bin\\MSBuild.exe'], {encoding: 'utf8'});
	return found.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0] || null;
};

// A code signing certificate of the manifest's publisher, made in memory and written
// straight to .cert, so no certificate store on the machine is touched.
const CERT_SCRIPT = `
param($Subject, $PfxPath, $CerPath, $Password)
$ErrorActionPreference = 'Stop'
$rsa = [System.Security.Cryptography.RSA]::Create(2048)
$request = New-Object System.Security.Cryptography.X509Certificates.CertificateRequest($Subject, $rsa, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
$request.CertificateExtensions.Add((New-Object System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension($false, $false, 0, $true)))
$request.CertificateExtensions.Add((New-Object System.Security.Cryptography.X509Certificates.X509KeyUsageExtension([System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature, $true)))
$usages = New-Object System.Security.Cryptography.OidCollection
[void]$usages.Add((New-Object System.Security.Cryptography.Oid('1.3.6.1.5.5.7.3.3')))
$request.CertificateExtensions.Add((New-Object System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension($usages, $true)))
$certificate = $request.CreateSelfSigned([System.DateTimeOffset]::UtcNow.AddDays(-1), [System.DateTimeOffset]::UtcNow.AddYears(5))
[System.IO.File]::WriteAllBytes($PfxPath, $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $Password))
[System.IO.File]::WriteAllBytes($CerPath, $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert))
`;

const signingCertificate = () => {
	if (process.env.MOONFIN_XBOX_PFX) {
		const pfx = path.resolve(process.env.MOONFIN_XBOX_PFX);
		if (!fs.existsSync(pfx)) throw new Error(`MOONFIN_XBOX_PFX names ${pfx}, which does not exist`);
		return {pfx, password: process.env.MOONFIN_XBOX_PFX_PASSWORD || ''};
	}

	const pfx = path.join(CERT_DIR, 'moonfin-xbox-dev.pfx');
	const cer = path.join(CERT_DIR, 'moonfin-xbox-dev.cer');
	const passwordFile = path.join(CERT_DIR, 'password.txt');
	const subjectFile = path.join(CERT_DIR, 'subject.txt');
	const subject = manifestPublisher();
	const current = fs.existsSync(pfx) && fs.existsSync(passwordFile) && fs.existsSync(subjectFile) && fs.readFileSync(subjectFile, 'utf8') === subject;
	if (!current) {
		console.log(`\n Making a throwaway signing certificate for ${subject}...`);
		fs.mkdirSync(CERT_DIR, {recursive: true});
		const password = crypto.randomBytes(18).toString('base64url');
		const script = path.join(CERT_DIR, 'make-certificate.ps1');
		fs.writeFileSync(script, CERT_SCRIPT);
		execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-Subject', subject, '-PfxPath', pfx, '-CerPath', cer, '-Password', password], {stdio: 'inherit'});
		fs.rmSync(script, {force: true});
		fs.writeFileSync(passwordFile, password);
		fs.writeFileSync(subjectFile, subject);
	}
	return {pfx, cer, password: fs.readFileSync(passwordFile, 'utf8')};
};

const findFiles = (dir, test) => {
	const found = [];
	if (!fs.existsSync(dir)) return found;
	for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) found.push(...findFiles(full, test));
		else if (test(entry.name)) found.push(full);
	}
	return found;
};

const buildMsix = (version) => {
	const msbuild = findMSBuild();
	if (!msbuild) {
		throw new Error('MSBuild was not found. The package needs Windows with the Visual Studio Build Tools and their Universal Windows Platform workload. Run again with --no-msix to stop at the web app.');
	}

	const configuration = flag('--debug') ? 'Debug' : 'Release';
	const certificate = signingCertificate();

	console.log(`\n Building the Xbox package (${configuration})...`);
	fs.rmSync(PACKAGES_DIR, {recursive: true, force: true});
	const msbuildArgs = [
		path.join(HOST_DIR, 'Moonfin.Xbox.csproj'),
		'-restore',
		'-nologo',
		'-verbosity:minimal',
		`-p:Configuration=${configuration}`,
		'-p:Platform=x64',
		'-p:UapAppxPackageBuildMode=SideloadOnly',
		`-p:AppxPackageDir=${PACKAGES_DIR}${path.sep}`,
		'-p:AppxPackageSigningEnabled=true',
		`-p:PackageCertificateKeyFile=${certificate.pfx}`
	];
	const buildManifest = writeBuildManifest(version);
	if (buildManifest) msbuildArgs.push(`-p:MoonfinManifest=${buildManifest}`);
	console.log(`> MSBuild ${msbuildArgs.slice(1).join(' ')}`);
	// The password goes in through the environment, where MSBuild reads properties from
	// too, so it stays out of the command line and the log.
	execFileSync(msbuild, msbuildArgs, {stdio: 'inherit', env: {...process.env, PackageCertificatePassword: certificate.password}});

	const built = findFiles(PACKAGES_DIR, (name) => /^Moonfin\.Xbox_.*\.(msix|appx)$/.test(name))[0];
	if (!built) throw new Error(`No package found under ${PACKAGES_DIR}`);

	const prefix = `Moonfin_Xbox_${configuration === 'Debug' ? 'Debug_' : ''}`;
	for (const file of fs.readdirSync(ROOT_DIR).filter((entry) => entry.startsWith(prefix) && /^\d+\.\d+\.\d+\.msix$/.test(entry.slice(prefix.length)))) {
		fs.unlinkSync(path.join(ROOT_DIR, file));
	}
	const finalName = `${prefix}${version}.msix`;
	fs.copyFileSync(built, path.join(ROOT_DIR, finalName));
	console.log(`  ${finalName}`);

	// A console needs these installed along with the package the first time.
	const dependencies = path.join(path.dirname(built), 'Dependencies', 'x64');
	if (fs.existsSync(dependencies)) console.log(`  Dependencies for sideloading: ${dependencies}`);
	if (certificate.cer) console.log(`  Certificate it is signed with: ${certificate.cer}`);
};

try {
	const appPkg = require(path.join(APP_DIR, 'package.json'));
	if (flag('--dev-url') && !flag('--debug')) throw new Error('--dev-url only works with --debug, since a Release host loads nothing but its own package');

	console.log(' Building Moonfin for Xbox...\n');
	if (flag('--dev-url')) writeDevUrl(option('--dev-url'));
	else if (!flag('--no-web')) buildApp(appPkg);
	else if (!fs.existsSync(path.join(WWW_DIR, 'main.js'))) throw new Error(`--no-web needs the web app in ${WWW_DIR}, and it is not there.`);
	syncManifestVersion(appPkg.version);

	if (flag('--no-msix')) {
		console.log(`\n Web app ready in ${WWW_DIR}. Run again without --no-msix on Windows with the Visual Studio Build Tools to build the package.`);
	} else {
		buildMsix(appPkg.version);
	}

	console.log('\n Build complete!');
} catch (err) {
	console.error('\n Build failed:', err.message);
	process.exit(1);
}
