// 서버용 비밀번호 암호화 (Node 내장 scrypt, 사용자별 랜덤 salt)
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const KEYLEN = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('base64url');
  const key = await scrypt(String(password), salt, KEYLEN);
  return `scrypt$${salt}$${key.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, salt, expected] = stored.split('$');
  const key = await scrypt(String(password), salt, KEYLEN);
  const exp = Buffer.from(expected, 'base64url');
  return exp.length === key.length && timingSafeEqual(exp, key);
}
