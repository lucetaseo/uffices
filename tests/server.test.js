// ============================================================
// 서버 자동 시험 (GitHub Actions 에서 매번 실행)
//
// 실제 PostgreSQL 에 서버 요청 처리(handleRpc)를 그대로 실행해
// 권한 검사·휴무 규칙·전자서명·동시 등록을 확인합니다.
//
// ⚠ 시험 전에 데이터베이스의 표를 모두 지웁니다.
//    그래서 DATABASE_URL 이 아닌 TEST_DATABASE_URL 만 사용하고,
//    Supabase 주소는 거부합니다 (실서비스 DB 보호).
//
// 로컬 실행: TEST_DATABASE_URL=postgresql://... npm test
// ============================================================

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL 환경변수가 필요합니다 (시험 전용 DB).');
if (/supabase/i.test(url)) throw new Error('실서비스(Supabase) DB 에서는 시험을 실행할 수 없습니다.');

process.env.DATABASE_URL = url;
process.env.SESSION_SECRET ||= 'test-session-secret-0123456789abcdef-0123456789';
process.env.INIT_SUPER_LOGIN = 'super';
process.env.INIT_SUPER_PASSWORD = 'super-test-1234';
process.env.INIT_DEMO_DATA = 'true';

const { handleRpc } = await import('../server/handler.js');
const { closePool } = await import('../server/pg.js');

// 로그인 쿠키를 기억하는 시험용 사용자
function client(headers = {}) {
  let cookie = '';
  const call = async (service, method, ...args) => {
    const out = await handleRpc({ body: { service, method, args }, headers: { cookie, host: 'test.local', ...headers } });
    const setCookie = out.headers['Set-Cookie'];
    if (setCookie) cookie = setCookie.split(';')[0];
    call.lastCookie = setCookie || call.lastCookie;
    return { status: out.status, ...JSON.parse(out.body) };
  };
  call.ok = async (...a) => {
    const r = await call(...a);
    assert.equal(r.status, 200, `${a[0]}.${a[1]} 실패: ${r.error?.message}`);
    return r.result;
  };
  return call;
}

before(async () => {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query(`DROP TABLE IF EXISTS meta, companies, users, engineers, engineer_offs, teams, products,
    apartments, customers, contracts, notifications, contract_signatures CASCADE`);
  await c.end();
});

after(closePool);

const admin = client();
const manager = client();
const base = { brand: '더좋은집', customerName: '시험고객', customerPhone: '010-4444-5555', aptName: '시험아파트', contractDate: '2026-09-27' };

test('첫 요청 시 표 자동 생성 + 운영자·샘플 계정', async () => {
  const sup = client();
  assert.equal((await sup('auth', 'login', 'super', 'super1234')).status, 400, '샘플 super 비밀번호는 환경변수 값으로 대체');
  const me = await sup.ok('auth', 'login', 'super', 'super-test-1234');
  assert.equal(me.user.role, 'SUPER');
  const [company] = await sup.ok('companies', 'list');
  assert.equal(company.contractCount, 48);
  assert.equal((await sup('contracts', 'list', {})).status, 403, '운영자는 업체 계약 조회 불가');
});

test('로그인: 쿠키 보안 속성, 비밀번호 해시 비노출', async () => {
  const secure = client({ 'x-forwarded-proto': 'https' });
  const me = await secure.ok('auth', 'login', 'admin', 'admin1234');
  assert.match(secure.lastCookie, /HttpOnly/);
  assert.match(secure.lastCookie, /SameSite=Lax/);
  assert.match(secure.lastCookie, /Secure/);
  assert.ok(!JSON.stringify(me).includes('passwordHash'));
  await admin.ok('auth', 'login', 'admin', 'admin1234');
  await manager.ok('auth', 'login', 'manager', 'manager1234');
});

test('비로그인·허용 외 호출 차단', async () => {
  const anon = client();
  assert.equal((await anon('contracts', 'list', {})).status, 401);
  assert.equal((await admin('auth', 'resetDemoData')).status, 400);
  assert.equal((await admin('contracts', '__proto__')).status, 400);
  assert.equal((await admin('nope', 'list')).status, 400);
});

test('실장 권한: 본인 작성 건만, 금액 숨김, 삭제 불가, 승인대기로 등록', async () => {
  const all = await admin.ok('contracts', 'list', {});
  const mine = await manager.ok('contracts', 'list', {});
  assert.ok(mine.length > 0 && mine.length < all.length);
  assert.ok(mine.every((c) => c.totalAmount === null));
  const other = all.find((c) => !mine.some((m) => m.id === c.id));
  assert.equal((await manager('contracts', 'get', other.id)).status, 404);
  assert.equal((await manager('contracts', 'moveToTrash', [mine[0].id])).status, 403);
  const created = await manager.ok('contracts', 'create', { ...base, customerName: '실장고객' });
  assert.equal(created.approval, '승인대기');
});

test('동시 계약 등록 10건: 번호 중복 없음', async () => {
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) => admin('contracts', 'create', { ...base, customerName: `동시${i}` })),
  );
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(new Set(results.map((r) => r.result.no)).size, 10);
});

test('계약 수정 시 변경이력 기록, 고객명은 변경 불가', async () => {
  const c = await admin.ok('contracts', 'create', base);
  const updated = await admin.ok('contracts', 'update', c.id, { ...c, customerName: '바꾼이름', status: '배정' });
  assert.equal(updated.customerName, '시험고객');
  const full = await admin.ok('contracts', 'get', c.id);
  const last = full.history.at(-1);
  assert.equal(last.action, '계약 수정');
  assert.ok(last.changes.some((ch) => ch.label === '시공상태' && ch.to === '배정'));
});

test('휴무: 종일/반일 휴무 시간대 배정 차단, 반대 시간대는 허용', async () => {
  const offs = await admin.ok('engineerOffs', 'list', {});
  const dayOff = offs.find((o) => o.period === 'DAY');
  let r = await admin('contracts', 'create', { ...base, schedules: [{ date: dayOff.date, time: '14:00', engineerId: dayOff.engineerId }] });
  assert.equal(r.status, 400);
  assert.match(r.error.message, /종일 휴무/);

  const amOff = offs.find((o) => o.period === 'AM');
  r = await admin('contracts', 'create', { ...base, schedules: [{ date: amOff.date, time: '', engineerId: amOff.engineerId }] });
  assert.equal(r.status, 400, '시간 미정은 반일 휴무와 겹침');
  r = await admin('contracts', 'create', { ...base, schedules: [{ date: amOff.date, time: '09:00', engineerId: amOff.engineerId }] });
  assert.equal(r.status, 400, '오전 휴무에 09:00 배정 불가');
  await admin.ok('contracts', 'create', { ...base, schedules: [{ date: amOff.date, time: '14:00', engineerId: amOff.engineerId }] });
});

test('휴무: 배정된 시간대에는 휴무 등록 불가', async () => {
  const c = await admin.ok('contracts', 'create', { ...base, schedules: [{ date: '2027-01-05', time: '10:00', engineerId: 4 }] });
  assert.ok(c);
  let r = await admin('engineerOffs', 'set', { engineerId: 4, date: '2027-01-05', period: 'AM', reason: '시험' });
  assert.equal(r.status, 400);
  await admin.ok('engineerOffs', 'set', { engineerId: 4, date: '2027-01-05', period: 'PM', reason: '시험' });
});

test('팀배정: 팀원 전원 휴무일 때만 차단', async () => {
  const teams = await admin.ok('teams', 'list');
  const smile = teams.find((t) => t.name === '스마일팀');
  const members = (await admin.ok('engineers', 'list')).filter((e) => e.teamId === smile.id);
  assert.equal(members.length, 2);
  const date = '2027-02-10';
  const team = (time) => ({ ...base, schedules: [{ date, time, assignType: 'team', teamId: smile.id }] });

  await admin.ok('engineerOffs', 'set', { engineerId: members[0].id, date, period: 'AM', reason: '시험' });
  const c = await admin.ok('contracts', 'create', team('09:00')); // 1명만 휴무 → 가능
  let r = await admin('engineerOffs', 'set', { engineerId: members[1].id, date, period: 'AM', reason: '시험' });
  assert.equal(r.status, 400, '팀 일정이 있는 시간대에 마지막 팀원 휴무 불가');

  await admin.ok('contracts', 'moveToTrash', [c.id]);
  await admin.ok('engineerOffs', 'set', { engineerId: members[1].id, date, period: 'AM', reason: '시험' });
  r = await admin('contracts', 'create', team('09:00'));
  assert.equal(r.status, 400, '전원 오전 휴무 → 오전 팀 배정 불가');
  await admin.ok('contracts', 'create', team('14:00'));
});

test('기사모바일: 계약 목록 차단, 본인 일정 보고 → 계약서에 반영', async () => {
  const eng = client();
  const me = await eng.ok('auth', 'login', 'gong', 'gong1234');
  assert.equal(me.user.role, 'ENGINEER');
  assert.equal((await eng('contracts', 'list', {})).status, 403);
  const [s] = await eng.ok('engineerApp', 'mySchedules', { from: '2000-01-01', to: '2100-12-31' });
  await eng.ok('engineerApp', 'report', { contractId: s.contractId, stepIndex: s.stepIndex, mobileStatus: '시공완료', memo: '완료' });
  const c = await admin.ok('contracts', 'get', s.contractId);
  assert.equal(c.schedules[s.stepIndex].mobileStatus, '시공완료');
});

test('전자서명: 링크 조회(내부정보 제외) → 서명 → 이미지는 별도 저장', async () => {
  const [target] = await admin.ok('contracts', 'list', { esignStatus: '미발송' });
  const { token, url: link } = await admin.ok('contracts', 'requestSign', target.id);
  assert.match(link, /^http:\/\/test\.local\/#\/sign\//);
  const anon = client({ 'x-forwarded-for': '203.0.113.7' });
  const view = await anon.ok('esign', 'getByToken', token);
  assert.equal(view.contract.history, undefined);
  assert.equal(view.contract.memo, undefined);
  const img = `data:image/png;base64,${'A'.repeat(5000)}`;
  await anon.ok('esign', 'sign', token, { signerName: '고객', signature: img, agreed: true });

  const signed = await admin.ok('contracts', 'get', target.id);
  assert.equal(signed.esign.status, '서명완료');
  assert.equal(signed.esign.signature, img);
  assert.equal(signed.esign.ip, '203.0.113.7');
  const list = await admin.ok('contracts', 'list', {});
  assert.ok(list.every((c) => !c.esign?.signature), '목록에는 서명 이미지 없음');
});

test('로그인 5회 실패 시 잠금, 로그아웃 후 차단', async () => {
  const bad = client();
  for (let i = 0; i < 5; i++) assert.equal((await bad('auth', 'login', 'manager', 'wrong')).status, 400);
  const r = await bad('auth', 'login', 'manager', 'manager1234');
  assert.match(r.error.message, /잠겼습니다/);

  await admin.ok('auth', 'logout');
  assert.equal((await admin('contracts', 'list', {})).status, 401);
});

test('계약번호: 계약일 순서로 부여, 예전 날짜 계약은 그 위치에 들어감, 목록은 번호순', async () => {
  await admin.ok('auth', 'login', 'admin', 'admin1234'); // 앞 시험에서 로그아웃했으므로 다시 로그인
  const before = await admin.ok('contracts', 'list', {});
  const total = before.length;
  assert.equal(before[0].no, total, '최신 계약 번호 = 전체 건수');
  assert.ok(before.every((c, i) => i === 0 || before[i - 1].no > c.no), '번호 내림차순 정렬');

  const oldest = await admin.ok('contracts', 'create', { ...base, customerName: '오래된계약', contractDate: '2000-01-01' });
  assert.equal(oldest.no, 1, '가장 오래된 계약일 → 1번');
  const after = await admin.ok('contracts', 'list', {});
  assert.equal(after[0].no, total + 1);
  assert.equal(new Set(after.map((c) => c.no)).size, after.length, '번호 중복 없음');

  await admin.ok('contracts', 'moveToTrash', [oldest.id]);
  const trash = await admin.ok('contracts', 'list', { trash: true });
  assert.equal(trash.find((c) => c.id === oldest.id).no, null, '휴지통 계약은 번호 없음');
  assert.equal((await admin.ok('contracts', 'list', {}))[0].no, total);
});

test('계약 상세: 같은 계약자·현장 시공 묶음, 입금/환불/수정/삭제, 상담내역', async () => {
  const site = { ...base, customerName: '묶음고객', customerPhone: '010-7070-8080', aptName: '묶음아파트', dong: '101', ho: '202', totalAmount: 500000 };
  const a = await admin.ok('contracts', 'create', { ...site, category: '줄눈' });
  const b = await admin.ok('contracts', 'create', { ...site, category: '청소', totalAmount: 300000 });
  await admin.ok('contracts', 'create', { ...site, ho: '999', category: '탄성' }); // 다른 호수 → 다른 묶음

  const g = await admin.ok('contracts', 'group', a.id);
  assert.deepEqual(g.contracts.map((c) => c.id).sort(), [a.id, b.id].sort());
  assert.equal(g.otherContracts.length, 1, '같은 계약자의 다른 현장');

  let c = await admin.ok('contracts', 'addPayment', a.id, { kind: '계약금', method: '카드', amount: 100000, cardLast4: '1234-5678-9012-3456' });
  assert.equal(c.payments[0].cardLast4, '3456', '카드번호는 끝 4자리만 저장');
  c = await admin.ok('contracts', 'addPayment', a.id, { kind: '환불', method: '계좌이체', amount: 20000 });
  const { calcAmounts } = await import('../frontend/src/utils/contract.js');
  let amt = calcAmounts(c);
  assert.equal(amt.paid, 100000);
  assert.equal(amt.refund, 20000);
  assert.equal(amt.balance, 500000 - (100000 - 20000));

  c = await admin.ok('contracts', 'updatePayment', a.id, c.payments[0].id, { ...c.payments[0], amount: 150000 });
  assert.equal(calcAmounts(c).paid, 150000);
  c = await admin.ok('contracts', 'removePayment', a.id, c.payments[1].id);
  assert.equal(calcAmounts(c).refund, 0);
  assert.ok(c.history.some((h) => h.action === '입금 수정'));

  assert.equal((await manager('contracts', 'addPayment', a.id, { amount: 1000 })).status, 403, '수정 권한 없는 실장은 입금 등록 불가');

  await admin.ok('contracts', 'addNote', b.id, '고객 통화: 오전 선호');
  const g2 = await admin.ok('contracts', 'group', a.id);
  assert.equal(g2.notes[0].text, '고객 통화: 오전 선호');
  assert.equal(g2.notes[0].category, '청소');
});
