'use strict';

// The rules that catch mistakes, not the ones that argue about formatting: .editorconfig settles that.

const recommended = require('@eslint/js').configs.recommended;
const tseslint = require('typescript-eslint');
const svelte = require('eslint-plugin-svelte');

const node = {
	 require: 'readonly'
	,module: 'writable'
	,process: 'readonly'
	,console: 'readonly'
	,__dirname: 'readonly'
	,Buffer: 'readonly'
	,URL: 'readonly'
	,fetch: 'readonly'
	,setTimeout: 'readonly'
};

module.exports = [
	{ ignores: ['dist/**', 'out/**', 'test-results/**', 'node_modules/**'] },
	{
		 files: ['scripts/**/*.js', 'eslint.config.js', 'tests/**/*.cjs']
		,languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...node, document: 'readonly', window: 'readonly', location: 'readonly' } }
		,rules: { ...recommended.rules, 'no-unused-vars': ['error', { args: 'none' }] }
	},
	...tseslint.configs.recommended.map(config => ({ ...config, files: ['src/**/*.ts', 'src/**/*.svelte', 'tests/**/*.ts', '*.config.ts'] })),
	...svelte.configs['flat/recommended'].map(config => ({ ...config, files: ['src/**/*.svelte'] })),
	{
		 files: ['src/**/*.svelte']
		,languageOptions: { parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.svelte'] } }
	}
];
