// 로그인 세션: 서명된 쿠키 (HttpOnly — 화면 스크립트에서 읽을 수 없음)
import { createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE_NAME = 'uffice_session';
const MAX_AGE_SEC = 60 * 60 * 12; // 12시간

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET 환경변수(32자 이상)가 필요합니다.');
  return s;
}

const sign = (payload) => createHmac('sha256', secret()).update(payload).digest('base64url');

export function encodeSession(data) {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(value) {
  if (!value || !value.includes('.')) return null;
  const [payload, sig] = value.split('.');
  const expected = sign(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.exp || data.exp < Date.now() / 1000) return null;
    return data;
  } catch {
    return null;
  }
}

export function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const i = p.indexOf('=');
        return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))];
      }),
  );
}

export function sessionCookie(value, { secure }) {
  const parts = [`${COOKIE_NAME}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (secure) parts.push('Secure');
  parts.push(value ? `Max-Age=${MAX_AGE_SEC}` : 'Max-Age=0');
  return parts.join('; ');
}
