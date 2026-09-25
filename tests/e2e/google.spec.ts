import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { test, expect } from '@playwright/test';
import { repoRoot, serviceRecord } from './helpers/launch.ts';

const SIGN_IN = 'https://accounts.google.com/signin/v2/identifier?service=mail&continue=https://mail.google.com/mail/';

test.skip(!process.env.SHEP_NETWORK, 'needs the network; set SHEP_NETWORK=1');

test('takes a fresh sign-in past Google\'s "This browser or app may not be secure", to its answer that no account has the address typed', async () => {
	test.setTimeout(60000);
	const userDataDir = mkdtempSync(join(tmpdir(), 'shep-google-'));
	try {
		writeFileSync(join(userDataDir, 'shep.json'), JSON.stringify({ services: [serviceRecord('1', SIGN_IN)], activeServiceId: '1' }));
		const electron = join(repoRoot, 'node_modules', '.bin', 'electron');
		const probe = join(repoRoot, 'tests', 'e2e', 'fixtures', 'google-signin-probe.cjs');
		const main = join(repoRoot, 'out', 'main', 'index.js');
		const { stdout } = await promisify(execFile)(electron, [probe, main, `--user-data-dir=${userDataDir}`], { timeout: 50000 });
		expect(stdout).toContain('GOOGLE accepted');
	} finally {
		rmSync(userDataDir, { recursive: true, force: true });
	}
});
