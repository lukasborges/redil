/**
 * This is an example test.
 */

var chai = require('chai');
var expect = chai.expect;
var RedilTestHelper = require('../../helpers/RedilTestHelper');

describe('Redil window', function() {

	/**
	 * The Redil test helper does common stuff.
	 *
	 * @type {module.exports}
	 */
	var ramboxTestHelper = new RedilTestHelper();

	it('should have "Redil" in the title', function () {
		return ramboxTestHelper.app.client.browserWindow.getTitle().then(function(title) {
			expect(title).to.contain('Redil');
			return Promise.resolve();
		});
	})
});
