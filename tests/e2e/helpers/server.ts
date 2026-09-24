import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { AddressInfo } from 'node:net';

const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.png': 'image/png' };

// Three origins from one server, 127.0.0.1, localhost and [::1], which a sign-in round trip needs.
// /go?to= redirects, as a signed-out service does to a page on another site.
export async function serveFixtures(): Promise<{ server: Server; at: (host: '127.0.0.1' | 'localhost' | '[::1]', path: string) => string }> {
	const root = join(__dirname, '..', 'fixtures');
	const server = createServer(async (request, response) => {
		const address = new URL(request.url ?? '/', 'http://x');
		const path = address.pathname;
		if ( path === '/go' ) {
			response.writeHead(302, { location: address.searchParams.get('to') ?? '/' });
			response.end();
			return;
		}
		try {
			const body = await readFile(join(root, path));
			response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
			response.end(body);
		} catch {
			response.writeHead(404);
			response.end();
		}
	});
	await new Promise<void>(resolve => server.listen(0, '::', resolve));
	const { port } = server.address() as AddressInfo;
	return { server, at: (host, path) => `http://${host}:${port}${path}` };
}
