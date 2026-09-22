// electron-notarize was renamed to @electron/notarize, which dropped the legacy
// altool path: notarytool is the only tool now, so it takes a teamId and no
// longer takes appBundleId or ascProvider.
//
// This has never run. Only Linux has been built end to end, and the credentials
// below have to come from the environment, so packaging for macOS without them
// skips notarisation rather than failing. Upstream hardcoded its own Apple ID
// and team here, which would have signed this fork as somebody else.
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
	const { electronPlatformName, appOutDir } = context;
	if (electronPlatformName !== 'darwin') {
		return;
	}

	const { APPLE_ID, APPLE_ID_PWD, APPLE_TEAM_ID } = process.env;
	if (!APPLE_ID || !APPLE_ID_PWD || !APPLE_TEAM_ID) {
		console.log('Skipping notarization: set APPLE_ID, APPLE_ID_PWD and APPLE_TEAM_ID to enable it.');
		return;
	}

	const appName = context.packager.appInfo.productFilename;

	return await notarize({
		appPath: `${appOutDir}/${appName}.app`,
		appleId: APPLE_ID,
		appleIdPassword: APPLE_ID_PWD,
		teamId: APPLE_TEAM_ID
	});
};
