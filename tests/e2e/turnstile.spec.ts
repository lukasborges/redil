import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { test, expect } from '@playwright/test';
import { repoRoot, serviceRecord } from './helpers/launch.ts';

// Real network, so it runs only when asked: SHEP_NETWORK=1 npm run test:next
const LOGIN = 'https://app.todoist.com/auth/login';
const TURNSTILE_TOKEN_MS = 45000;

test.skip(!process.env.SHEP_NETWORK, 'needs the network; set SHEP_NETWORK=1');

test('passes Cloudflare Turnstile on a real login, which an overridden user agent fails', async () => {
	test.setTimeout(TURNSTILE_TOKEN_MS + 45000);
	const userDataDir = mkdtempSync(join(tmpdir(), 'shep-turnstile-'));
	try {
		writeFileSync(join(userDataDir, 'shep.json'), JSON.stringify({ services: [serviceRecord('1', LOGIN)], activeServiceId: '1' }));
		const electron = join(repoRoot, 'node_modules', '.bin', 'electron');
		const probe = join(repoRoot, 'tests', 'e2e', 'fixtures', 'turnstile-probe.cjs');
		const main = join(repoRoot, 'out', 'main', 'index.js');
		const { stdout } = await promisify(execFile)(electron, [probe, main, LOGIN, String(TURNSTILE_TOKEN_MS), `--user-data-dir=${userDataDir}`],
			{ timeout: TURNSTILE_TOKEN_MS + 40000 });
		expect(stdout).toContain('TURNSTILE token');
	} finally {
		rmSync(userDataDir, { recursive: true, force: true });
	}
});
