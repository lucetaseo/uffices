// ============================================================
// 계약 번호 (화면 표시용)
//
// 번호는 저장하지 않고 "계약일 순서"로 매번 계산합니다.
//   - 가장 오래된 계약 = 1번, 최신 계약 = 전체 건수 (예: 총 1800건이면 최신이 1800)
//   - 계약일이 같으면 먼저 등록된 순
//   - 나중에 예전 날짜로 계약을 등록해도 그 날짜 위치에 번호가 들어감
//   - 휴지통 계약은 번호에서 제외 (번호 없음)
// 내부 식별자는 id 로 따로 관리하므로 번호가 바뀌어도 데이터 연결은 유지됩니다.
// ============================================================

const cache = new WeakMap(); // db 객체별 계산 결과

function build(db, companyId) {
  const list = db.contracts
    .filter((c) => c.companyId === companyId && !c.deletedAt)
    .sort(
      (a, b) =>
        (a.contractDate || '').localeCompare(b.contractDate || '') ||
        (a.createdAt || '').localeCompare(b.createdAt || '') ||
        a.id - b.id,
    );
  return new Map(list.map((c, i) => [c.id, i + 1]));
}

export function contractNumbers(db, companyId) {
  let perDb = cache.get(db);
  if (!perDb) cache.set(db, (perDb = new Map()));
  if (!perDb.has(companyId)) perDb.set(companyId, build(db, companyId));
  return perDb.get(companyId);
}

export const numberOf = (db, c) => (c.deletedAt ? null : contractNumbers(db, c.companyId).get(c.id) ?? null);

// 계약 추가/삭제/계약일 변경 후 호출
export function invalidateNumbers(db) {
  cache.delete(db);
}
