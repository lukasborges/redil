import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SALT_BYTES = 16;
const KEY_BYTES = 32;

// salt:key, both hex. Never the password itself.
export function hashPassword(password: string): string {
	const salt = randomBytes(SALT_BYTES);
	return salt.toString('hex') + ':' + scryptSync(password, salt, KEY_BYTES).toString('hex');
}

export function matchesPassword(password: string, stored: string): boolean {
	const [salt, key] = stored.split(':');
	if ( !salt || !key ) return false;
	const expected = Buffer.from(key, 'hex');
	const given = scryptSync(password, Buffer.from(salt, 'hex'), expected.length);
	return timingSafeEqual(given, expected);
}
