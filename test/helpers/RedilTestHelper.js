
var Application = require('spectron').Application;
var electron = require('electron-prebuilt');

/**
 * The RedilTestHelper contains common stuff for tests.
 */
module.exports = function() {

	var self = this;

	/**
	 * Makes the Redil Application available.
	 *
	 * @type {Application}
	 */
	self.app = null;

	/**
	 * Starts Redil from '/electron/main.js/'.
	 */
	beforeEach(function() {
		self.app = new Application({
			path: electron,
			args: [__dirname + '/../../electron/main.js']
		});
		return self.app.start();
	});

	/**
	 * Stops Redil.
	 */
	afterEach(function() {
		if (self.app && self.app.isRunning()) {
			return self.app.stop()
		}
	});
};
