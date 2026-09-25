import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { test, expect } from '@playwright/test';
import { launchShep, closeShep, serviceRecord, type Shep } from './helpers/launch.ts';

let server: Server;
let url: string;
let keys: string;

test.beforeAll(async () => {
	keys = mkdtempSync(join(tmpdir(), 'shep-cert-'));
	execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=127.0.0.1',
		'-keyout', join(keys, 'key.pem'), '-out', join(keys, 'cert.pem')], { stdio: 'ignore' });
	server = createServer({ key: readFileSync(join(keys, 'key.pem')), cert: readFileSync(join(keys, 'cert.pem')) },
		(request, response) => { response.writeHead(200, { 'content-type': 'text/html' }); response.end('<title>Self-signed</title>'); });
	await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
	url = `https://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});

test.afterAll(() => {
	server.close();
	rmSync(keys, { recursive: true, force: true });
});

const titleOf = (shep: Shep) => shep.window.evaluate(async () =>
	(await window.shep.invoke('services:list') as { pageTitle: string }[])[0]?.pageTitle ?? '');

test('refuses a certificate nobody trusted, and tells the window', async () => {
	let shep: Shep | undefined;
	try {
		shep = await launchShep({ store: { services: [serviceRecord('1', url)], activeServiceId: '1' } });
		const told = shep.window.evaluate(() => new Promise(resolve => window.shep.on('services:certificate-error', value => { resolve(value); })));
		await expect(told).resolves.toBe('1');
		await new Promise(resolve => setTimeout(resolve, 500));
		expect(await titleOf(shep)).not.toBe('Self-signed');
	} finally {
		await closeShep(shep);
	}
});

test('loads a service whose certificate was trusted', async () => {
	let shep: Shep | undefined;
	try {
		shep = await launchShep({ store: { services: [serviceRecord('1', url, { trust: true })], activeServiceId: '1' } });
		await expect.poll(() => titleOf(shep as Shep)).toBe('Self-signed');
	} finally {
		await closeShep(shep);
	}
});
