export const won = (n) => (Number(n) || 0).toLocaleString('ko-KR');

// 숫자만 남겨 010-0000-0000 형태로 정리
export function formatPhone(value = '') {
  const d = String(value).replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

export const digitsOnly = (v = '') => String(v).replace(/\D/g, '');

export const isValidPhone = (v) => /^01\d{8,9}$/.test(digitsOnly(v));

export function formatAddress({ aptName = '', dong = '', ho = '', aptType = '' } = {}) {
  let s = aptName.trim();
  if (dong || ho) s += ` ${[dong, ho].filter(Boolean).join('-')}`;
  if (aptType) s += `(${aptType})`;
  return s;
}
