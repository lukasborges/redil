'use strict';

// Scoped to the code this fork wrote: the main process, the build and
// translation scripts, the preloads and the tests. The ExtJS sources under app/
// and overrides/ are left out on purpose. They are a 2016 Sencha application in
// a style no modern config describes, and linting them would bury a real finding
// under thousands of complaints nobody is going to act on.
//
// The rules are the ones that catch mistakes, not the ones that argue about
// formatting: .editorconfig already settles tabs and line endings, and there is
// no formatter here to fight with.

const recommended = require('@eslint/js').configs.recommended;

const node = {
	 require: 'readonly'
	,module: 'writable'
	,exports: 'writable'
	,process: 'readonly'
	,console: 'readonly'
	,__dirname: 'readonly'
	,__filename: 'readonly'
	,Buffer: 'readonly'
	,setTimeout: 'readonly'
	,clearTimeout: 'readonly'
	,setInterval: 'readonly'
	,clearInterval: 'readonly'
	,setImmediate: 'readonly'
	,URL: 'readonly'
	,fetch: 'readonly'
	,AbortController: 'readonly'
};

module.exports = [
	{
		ignores: [
			 'app/**'
			,'overrides/**'
			,'ext/**'
			,'resources/languages/**'
			,'resources/fonts/**'
			// A minified Modernizr 3.2.0 build with the loading screen appended.
			,'resources/js/loadscreen.js'
			,'bootstrap.js'
			,'dist/**'
			,'test-results/**'
			,'node_modules/**'
		]
	},
	{
		 files: ['electron/**/*.js', 'scripts/**/*.js', 'languages.js', 'eslint.config.js', 'playwright.config.js']
		,languageOptions: {
			 ecmaVersion: 2023
			,sourceType: 'commonjs'
			,globals: node
		}
		,rules: {
			 ...recommended.rules
			,'no-unused-vars': ['error', { args: 'none' }]
		}
	},
	{
		// The service preload runs in a browser with a little of Electron beside it.
		 files: ['resources/js/**/*.js']
		,languageOptions: {
			 ecmaVersion: 2023
			,sourceType: 'commonjs'
			,globals: { ...node, window: 'readonly', document: 'readonly', location: 'readonly', Notification: 'writable' }
		}
		,rules: { ...recommended.rules, 'no-unused-vars': ['error', { args: 'none' }] }
	},
	{
		 files: ['test/**/*.js']
		,languageOptions: {
			 ecmaVersion: 2023
			,sourceType: 'commonjs'
			,globals: { ...node, Ext: 'readonly', Redil: 'readonly', redil: 'readonly', window: 'readonly', document: 'readonly', Notification: 'readonly', getComputedStyle: 'readonly', matchMedia: 'readonly' }
		}
		,rules: { ...recommended.rules, 'no-unused-vars': ['error', { args: 'none' }] }
	}
];
