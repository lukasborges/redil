#!/usr/bin/env node
'use strict';

/*
 * Which of our unread snippets have a maintained counterpart.
 *
 * Detection cannot be tested from here -- every service needs a logged-in
 * account -- so when one goes quiet the fastest fix is to read how someone
 * else counts it today. ferdium-recipes is that someone: 441 recipes, MIT,
 * still maintained, and its getMessages does the same job as our js_unread.
 *
 * This only reports. Porting is a judgement call, one service at a time, and
 * the licence asks for the credit that CLAUDE.md carries.
 */

const path = require('path');
const services = require(path.join(__dirname, '..', 'resources', 'services.json'));

const LIST = 'https://api.github.com/repos/ferdium/ferdium-recipes/contents/recipes?per_page=500';
const RECIPE = name => `https://github.com/ferdium/ferdium-recipes/blob/main/recipes/${name}/webview.js`;

const normalise = text => String(text).toLowerCase().replace(/[^a-z0-9]/g, '');

async function main() {
	const answer = await fetch(LIST, { headers: { 'User-Agent': 'shep-check-recipes' } });
	if (!answer.ok) throw new Error(`GitHub answered ${answer.status} ${answer.statusText}`);

	const recipes = new Map((await answer.json()).map(entry => [normalise(entry.name), entry.name]));

	const withSnippet = [];
	const withoutSnippet = [];
	const alone = [];

	for (const service of services) {
		if (service.id === 'custom') continue;

		// their folder names are spelled out where ours are run together
		const candidates = [service.id, service.name, service.id.replace(/^google/, '')];
		const match = candidates.map(normalise).map(key => recipes.get(key)).find(Boolean);

		if (!match) alone.push(service.id);
		else if (service.js_unread) withSnippet.push([service.id, match]);
		else withoutSnippet.push([service.id, match]);
	}

	console.log(`${services.length - 1} services, ${recipes.size} recipes\n`);

	console.log(`Ours counts, and a recipe exists to compare against (${withSnippet.length}):`);
	for (const [id, recipe] of withSnippet) console.log(`  ${id.padEnd(18)} ${RECIPE(recipe)}`);

	console.log(`\nOurs counts from the page title only, and a recipe exists (${withoutSnippet.length}):`);
	for (const [id, recipe] of withoutSnippet) console.log(`  ${id.padEnd(18)} ${RECIPE(recipe)}`);

	console.log(`\nNo recipe, so the title is all there is (${alone.length}):`);
	console.log('  ' + alone.join(' '));
}

main().catch(error => {
	console.error(error.message);
	process.exitCode = 1;
});
