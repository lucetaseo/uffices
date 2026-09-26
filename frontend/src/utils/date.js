// 날짜는 모두 로컬 기준 'YYYY-MM-DD' 문자열로 저장/비교합니다.
// (문자열 비교가 곧 날짜 비교가 되어 검색·정렬이 단순해집니다)

const pad = (n) => String(n).padStart(2, '0');

export const toDateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const today = () => toDateKey(new Date());

export function addDays(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return toDateKey(new Date(y, m - 1, d + days));
}

export const isDateKey = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

// ISO 타임스탬프 → 로컬 'YYYY-MM-DD'
export const isoToDateKey = (iso) => (iso ? toDateKey(new Date(iso)) : '');

export function inRange(dateKey, from, to) {
  if (!dateKey) return false;
  if (from && dateKey < from) return false;
  if (to && dateKey > to) return false;
  return true;
}

// 검색필터 빠른선택 버튼용 기간 계산
export function presetRange(preset) {
  const now = new Date();
  const t = toDateKey(now);
  switch (preset) {
    case 'today':
      return [t, t];
    case 'week': {
      const start = addDays(t, -now.getDay());
      return [start, addDays(start, 6)];
    }
    case 'month':
      return [
        toDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
        toDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      ];
    case 'lastMonth':
      return [
        toDateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        toDateKey(new Date(now.getFullYear(), now.getMonth(), 0)),
      ];
    case '3months':
      return [addDays(t, -90), t];
    default:
      return ['', ''];
  }
}

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function formatKoreanDate(dateKey) {
  if (!dateKey) return '';
  const [y, m, d] = dateKey.split('-').map(Number);
  return `${y}.${m}.${d}(${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`;
}
