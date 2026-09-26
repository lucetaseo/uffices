// ============================================================
// 임시 저장소 (브라우저 localStorage)
//
// 백엔드가 붙기 전까지 "서버 DB" 역할을 합니다. 테이블 구조는
// 실제 DB 스키마로 그대로 옮길 수 있게 정규화해 두었습니다.
//   companies / users / engineers / customers / contracts / notifications
// 백엔드 연동 시 이 파일과 api/index.js 내부만 HTTP 호출로 교체하면 됩니다.
// ============================================================

import { ROLES, DATA_SCOPES, DEFAULT_MANAGER_PERMISSIONS } from '../auth/permissions.js';
import { addDays, today } from '../utils/date.js';

const DB_KEY = 'uffice.db.v1';

export async function hashPassword(password) {
  const text = `uffice:${password}`;
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // http(비보안 컨텍스트) 접속 시 대체용. 실제 보안은 서버에서 bcrypt 등으로 처리해야 합니다.
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return `weak-${h}`;
}

let cache = null;

export function loadDb() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) cache = JSON.parse(raw);
  } catch {
    cache = null;
  }
  return cache;
}

export function saveDb(db) {
  cache = db;
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function nextId(db, table) {
  db.seq[table] = (db.seq[table] || 0) + 1;
  return db.seq[table];
}

export async function ensureDb() {
  const existing = loadDb();
  if (existing) {
    // 비밀번호 해시 방식이 바뀐 환경(http↔https)에서 데모 계정 로그인이 막히지 않도록 재생성
    if (existing.hashMode === hashMode()) return existing;
  }
  const db = await buildSeed();
  saveDb(db);
  return db;
}

export async function resetDb() {
  cache = null;
  localStorage.removeItem(DB_KEY);
  return ensureDb();
}

const hashMode = () => (globalThis.crypto?.subtle ? 'sha256' : 'weak');

// ------------------------------------------------------------
// 샘플 데이터
// ------------------------------------------------------------

// 매번 같은 샘플이 나오도록 고정 시드 난수 사용
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const APTS = [
  { name: '디에이치 방배', type: '84A타입' },
  { name: '힐스테이트 메디알레', type: '84타입' },
  { name: '힐스테이트 장승배기', type: '84타입' },
  { name: '강릉 오션시티 아이파크', type: '84B타입' },
  { name: '미사 하우스디 더레이크', type: '59타입' },
  { name: '래미안 원베일리', type: '112타입' },
];
const LAST = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];
const FIRST = ['혜준', '성호', '기순', '승일', '동호', '정하', '은하', '지희', '동훈', '주원', '형진', '다움'];
const ITEMS = {
  청소: '플러스 청소 외창 / (현관, 바닥)',
  줄눈: '욕실2개(빅라이언) + 현관 / (s.v)주방&욕실 실리콘 오염방지',
  나노코팅: '욕실 나노코팅 2개 + 주방상판',
  탄성: '베란다 탄성코트 3곳',
  코팅: '바닥 코팅 전체',
  기타: '',
};

async function buildSeed() {
  const db = {
    version: 1,
    hashMode: hashMode(),
    seq: {},
    companies: [],
    users: [],
    engineers: [],
    customers: [],
    contracts: [],
    notifications: [],
  };
  const now = new Date().toISOString();
  const t = today();

  const company = {
    id: nextId(db, 'companies'),
    name: '더좋은집',
    ceo: '장경국',
    bizNo: '888-51-01056',
    address: '경기도 하남시 조정대로 35, 10층 에프 1013호',
    brands: ['더좋은집', '더스타트'],
    periodStart: addDays(t, -100),
    periodEnd: addDays(t, 20),
    active: true,
    contractSeq: 0,
    createdAt: now,
  };
  db.companies.push(company);

  const mk = async (u) => ({
    id: nextId(db, 'users'),
    active: true,
    createdAt: now,
    lastLoginAt: null,
    phone: '',
    permissions: [],
    dataScope: DATA_SCOPES.ALL,
    ...u,
    passwordHash: await hashPassword(u.password),
    password: undefined,
  });

  db.users.push(await mk({ loginId: 'super', password: 'super1234', name: '유피스 운영자', role: ROLES.SUPER, companyId: null }));
  const admin = await mk({ loginId: 'admin', password: 'admin1234', name: '장경국', role: ROLES.ADMIN, companyId: company.id, phone: '010-1000-2000' });
  db.users.push(admin);
  const manager = await mk({
    loginId: 'manager',
    password: 'manager1234',
    name: '이실장',
    role: ROLES.MANAGER,
    companyId: company.id,
    phone: '010-5555-6666',
    createdBy: admin.id,
    permissions: [...DEFAULT_MANAGER_PERMISSIONS, 'notify.send'],
    dataScope: DATA_SCOPES.OWN,
  });
  db.users.push(manager);

  [
    ['공두환', '010-2001-1001', '줄눈'],
    ['김준영', '010-2001-1002', '줄눈'],
    ['문종만', '010-2001-1003', '줄눈'],
    ['양정훈', '010-2001-1004', '청소'],
    ['박영노', '010-2001-1005', '청소'],
    ['김필', '010-2001-1006', '코팅'],
    ['박태종', '010-2001-1007', '코팅'],
    ['김주하', '010-2001-1008', '탄성'],
  ].forEach(([name, phone, category]) => {
    db.engineers.push({ id: nextId(db, 'engineers'), companyId: company.id, name, phone, category, active: true });
  });

  const r = rng(20260927);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];

  for (let i = 0; i < 48; i++) {
    const name = pick(LAST) + pick(FIRST);
    const phone = `010-${String(2000 + Math.floor(r() * 7999))}-${String(1000 + Math.floor(r() * 8999))}`;
    let customer = db.customers.find((c) => c.phone1 === phone);
    if (!customer) {
      customer = {
        id: nextId(db, 'customers'),
        companyId: company.id,
        userType: '개인',
        name,
        phone1: phone,
        phone2: '',
        email: '',
        zipcode: '',
        address1: '',
        address2: '',
        createdAt: now,
      };
      db.customers.push(customer);
    }
    const apt = pick(APTS);
    const category = pick(['청소', '줄눈', '줄눈', '나노코팅', '탄성']);
    const contractDate = addDays(t, -Math.floor(r() * 75));
    const schedDate = addDays(contractDate, 5 + Math.floor(r() * 40));
    const eng = db.engineers.filter((e) => e.category === category || category === '나노코팅');
    const engineer = eng.length ? pick(eng) : null;
    const total = (5 + Math.floor(r() * 20)) * 100000;
    const discount = r() < 0.2 ? 50000 : 0;
    const deposit = pick([0, 30000, 50000, 100000]);
    let status = schedDate < t ? '시공완료' : pick(['미정', '미정', '확정']);
    if (r() < 0.08) status = '취소';
    const payments = [];
    if (deposit) payments.push({ id: 1, date: contractDate, method: pick(['카드', '계좌이체', '현금']), amount: deposit });
    if (status === '시공완료') payments.push({ id: 2, date: schedDate, method: pick(['카드', '계좌이체']), amount: total - discount - deposit });

    company.contractSeq += 1;
    db.contracts.push({
      id: nextId(db, 'contracts'),
      companyId: company.id,
      no: company.contractSeq,
      brand: r() < 0.8 ? '더좋은집' : '더스타트',
      category,
      receptionType: pick(['음성', '음성', '박람회', '온라인']),
      status,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone1,
      aptName: apt.name,
      dong: String(100 + Math.floor(r() * 20)),
      ho: String((1 + Math.floor(r() * 25)) * 100 + 1 + Math.floor(r() * 4)),
      aptType: apt.type,
      items: ITEMS[category],
      contractDate,
      schedules: [
        {
          date: schedDate,
          time: pick(['09:00', '10:00', '13:00', '14:00']),
          ampm: '',
          engineerId: engineer?.id || null,
          memo: '',
        },
      ],
      completedDate: status === '시공완료' ? schedDate : '',
      canceledDate: status === '취소' ? addDays(contractDate, 2) : '',
      totalAmount: total,
      discount,
      voucher: 0,
      payments,
      memo: '',
      esign: status === '미정' && r() < 0.5
        ? { status: '미발송', token: null }
        : { status: '서명완료', token: null, signedAt: `${contractDate}T12:00:00.000Z`, signerName: customer.name, signature: null },
      ownerId: i % 4 === 0 ? manager.id : admin.id,
      createdAt: `${contractDate}T09:00:00.000Z`,
      updatedAt: now,
      deletedAt: null,
    });
  }
  return db;
}
