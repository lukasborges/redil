#!/usr/bin/env node
/**
 * Checks every URL in resources/services.json and prints what has rotted.
 *
 * The catalogue was last touched upstream in 2021 and nothing has verified it
 * since. This is the tool that keeps it honest: run it, read the report, decide
 * what to change. It never edits the catalogue by itself.
 *
 *   node scripts/check-services.js            # check everything
 *   node scripts/check-services.js slack zoom # check only these ids
 *
 * A service whose URL carries the ___ placeholder is a template for a custom
 * domain, so it is reported as skipped rather than fetched.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CATALOGUE = path.join(__dirname, '..', 'resources', 'services.json');
const CONCURRENCY = 8;
const TIMEOUT_MS = 20000;

// Some sites answer differently to something that does not look like a browser.
const BROWSER_AGENT =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
	'Chrome/' + process.versions.chrome + ' Safari/537.36';

// The same rewrite getUserAgent does in app/ux/WebView.js, so the check sees
// what the app sees rather than the version frozen in the catalogue.
function agentFor(service) {
	if (!service.userAgent) return BROWSER_AGENT;
	return service.userAgent.replace(/Chrome\/[0-9.]+/i, 'Chrome/' + process.versions.chrome);
}

// Good enough for this catalogue: the last two labels of the hostname.
function registrableDomain(hostname) {
	return hostname.split('.').slice(-2).join('.');
}

async function check(service) {
	if (service.url.includes('___')) {
		return { service, outcome: 'skipped', detail: 'custom domain template' };
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const response = await fetch(service.url, {
			redirect: 'follow',
			signal: controller.signal,
			headers: { 'User-Agent': agentFor(service) }
		});

		if (response.status === 404 || response.status === 410) {
			return { service, outcome: 'gone', detail: 'HTTP ' + response.status };
		}
		if (!response.ok) {
			// 403 and friends are usually bot protection rather than a dead service.
			return { service, outcome: 'suspect', detail: 'HTTP ' + response.status };
		}

		const from = registrableDomain(new URL(service.url).hostname);
		const to = registrableDomain(new URL(response.url).hostname);
		if (from !== to) {
			// Landing on a sign-in host is what a logged-out fetch is supposed to do.
			return { service, outcome: 'domain-changed', detail: response.url.slice(0, 110) };
		}
		return { service, outcome: 'ok', detail: 'HTTP ' + response.status };
	} catch (error) {
		const cause = error.name === 'AbortError' ? 'timed out' : (error.cause && error.cause.code) || error.message;
		const dead = String(cause) === 'ENOTFOUND';
		return { service, outcome: dead ? 'dns' : 'suspect', detail: String(cause) };
	} finally {
		clearTimeout(timer);
	}
}

async function runInBatches(services) {
	const results = [];
	let next = 0;
	async function worker() {
		while (next < services.length) {
			const service = services[next++];
			results.push(await check(service));
			process.stderr.write('.');
		}
	}
	await Promise.all(Array.from({ length: CONCURRENCY }, worker));
	process.stderr.write('\n');
	return results;
}

function report(results) {
	const groups = { dns: [], gone: [], 'domain-changed': [], suspect: [], skipped: [], ok: [] };
	results.forEach(r => groups[r.outcome].push(r));

	const headings = {
		dns: 'Domain does not resolve. The service is gone; decide whether to drop the entry.',
		gone: 'The host answers but this address does not exist any more.',
		'domain-changed': 'Ends up on a different domain. Check whether the entry should point there.',
		suspect: 'Could not be confirmed either way. Often bot protection or a slow host, so check by hand before changing anything.',
		skipped: 'Not checked.',
		ok: 'Reachable, including the ordinary redirect to a sign-in page.'
	};

	for (const outcome of ['dns', 'gone', 'domain-changed', 'suspect', 'skipped']) {
		const group = groups[outcome];
		if (!group.length) continue;
		console.log('\n' + headings[outcome] + ' (' + group.length + ')');
		group
			.sort((a, b) => a.service.id.localeCompare(b.service.id))
			.forEach(r => console.log('  ' + r.service.id.padEnd(22) + r.service.url + '\n' + ' '.repeat(24) + '-> ' + r.detail));
	}

	console.log('\n' + headings.ok + ' (' + groups.ok.length + ')');
	console.log('\nTotal checked: ' + results.length);
	return groups;
}

(async () => {
	const catalogue = JSON.parse(fs.readFileSync(CATALOGUE, 'utf8'));
	const wanted = process.argv.slice(2);
	const services = wanted.length ? catalogue.filter(s => wanted.includes(s.id)) : catalogue;

	if (!services.length) {
		console.error('No service matched: ' + wanted.join(', '));
		process.exit(1);
	}

	const groups = report(await runInBatches(services));
	// Non-zero when something needs a human decision, so CI can use this too.
	process.exit(groups.dns.length || groups.gone.length ? 1 : 0);
})();
