import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { AddressInfo } from 'node:net';

const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.png': 'image/png' };

// Two origins from one server, 127.0.0.1 and localhost, which a sign-in round trip needs.
export async function serveFixtures(): Promise<{ server: Server; at: (host: '127.0.0.1' | 'localhost', path: string) => string }> {
	const root = join(__dirname, '..', 'fixtures');
	const server = createServer(async (request, response) => {
		const path = new URL(request.url ?? '/', 'http://x').pathname;
		try {
			const body = await readFile(join(root, path));
			response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
			response.end(body);
		} catch {
			response.writeHead(404);
			response.end();
		}
	});
	await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as AddressInfo;
	return { server, at: (host, path) => `http://${host}:${port}${path}` };
}
