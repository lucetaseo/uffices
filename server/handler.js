// ============================================================
// 서버 요청 처리 (POST /api/rpc)
//
// 화면이 { service, method, args } 를 보내면, 브라우저 데모 모드와 똑같은
// 업무 코드(frontend/src/api/services.js)를 서버에서 실행합니다.
//   1) 쿠키로 로그인 사용자 확인 → 그 업체의 데이터만 PostgreSQL 에서 읽음
//   2) 업무 코드 실행 (권한 검사 포함)
//   3) 업무 코드가 저장(saveDb)한 변경분만 DB 에 반영, 오류면 되돌림(롤백)
// 쓰기 요청은 DB 잠금으로 한 번에 하나씩 처리해 동시 수정 충돌을 막습니다.
// ============================================================

import { AsyncLocalStorage } from 'node:async_hooks';
import * as services from '../frontend/src/api/services.js';
import { setRuntimeAdapter } from '../frontend/src/api/runtime.js';
import { ApiError } from '../frontend/src/api/core.js';
import { getPool, loadSnapshot, persistChanges, resolveCompanyId, companyIdByEsignToken } from './pg.js';
import { hashPassword, verifyPassword } from './password.js';
import { bootstrap } from './bootstrap.js';
import { COOKIE_NAME, decodeSession, encodeSession, parseCookies, sessionCookie } from './session.js';

const store = new AsyncLocalStorage();
const clone = (v) => JSON.parse(JSON.stringify(v));

// 업무 코드가 쓰는 저장/세션/암호화 기능을 서버용으로 연결
setRuntimeAdapter({
  async loadDb() {
    // 요청 하나 안에서는 같은 기준 데이터(마지막 저장 시점)의 사본을 돌려줌
    return clone(store.getStore().committed);
  },
  saveDb(db) {
    store.getStore().committed = clone(db);
  },
  hashPassword,
  verifyPassword,
  getSession: () => store.getStore().session,
  setSession(data) {
    const ctx = store.getStore();
    ctx.session = data;
    ctx.setCookie = sessionCookie(encodeSession(data), { secure: ctx.secure });
  },
  clearSession() {
    const ctx = store.getStore();
    ctx.session = null;
    ctx.setCookie = sessionCookie('', { secure: ctx.secure });
  },
  publicBaseUrl: () => store.getStore().baseUrl,
  clientInfo: () => ({ userAgent: store.getStore().userAgent, ip: store.getStore().ip }),
  async resetDemoData() {
    throw new ApiError('서버 모드에서는 데이터 초기화를 할 수 없습니다.', 'FORBIDDEN');
  },
});

// 호출 가능한 서비스/함수 목록 (그 외는 거부)
const SERVICES = {
  auth: services.auth,
  companies: services.companies,
  users: services.users,
  engineers: services.engineers,
  teams: services.teams,
  products: services.products,
  apartments: services.apartments,
  customers: services.customers,
  contracts: services.contracts,
  esign: services.esign,
  notifications: services.notifications,
  reports: services.reports,
  schedules: services.schedules,
  engineerOffs: services.engineerOffs,
  engineerApp: services.engineerApp,
  scheduleSettings: services.scheduleSettings,
};
const BLOCKED = new Set(['auth.resetDemoData']);

// 읽기 전용 호출 (DB 잠금 불필요)
const READ_ONLY = new Set([
  'auth.me',
  'companies.list',
  'users.list',
  'users.staffOptions',
  'engineers.list',
  'teams.list',
  'products.list',
  'apartments.list',
  'customers.list',
  'customers.findByPhone',
  'contracts.list',
  'contracts.get',
  'contracts.group',
  'esign.getByToken',
  'notifications.history',
  'reports.contracts',
  'schedules.list',
  'engineerOffs.list',
  'engineerApp.mySchedules',
  'engineerApp.myOffs',
  'companies.publicInfo',
  'scheduleSettings.get',
]);

const STATUS = { UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404 };

// 서버 인스턴스마다 첫 요청 때 한 번 DB 준비 (표 생성 / 최초 운영자 계정)
let ready = null;
function ensureReady() {
  if (!ready) {
    ready = (async () => {
      const client = await getPool().connect();
      try {
        await bootstrap(client, { log: (m) => console.log(`[bootstrap] ${m}`) });
      } finally {
        client.release();
      }
    })().catch((e) => {
      ready = null; // 다음 요청에서 다시 시도
      throw e;
    });
  }
  return ready;
}

// req: { body, headers }  → { status, headers, body }
export async function handleRpc({ body, headers }) {
  const { service, method, args = [] } = body || {};
  const name = `${service}.${method}`;
  const fn = SERVICES[service] && Object.prototype.hasOwnProperty.call(SERVICES[service], method) ? SERVICES[service][method] : null;
  if (typeof fn !== 'function' || BLOCKED.has(name) || !Array.isArray(args)) {
    return json(400, { error: { message: '알 수 없는 요청입니다.', code: 'BAD_REQUEST' } });
  }

  const cookies = parseCookies(headers.cookie || '');
  const proto = headers['x-forwarded-proto'] || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const host = headers['x-forwarded-host'] || headers.host || 'localhost';
  const ctx = {
    session: decodeSession(cookies[COOKIE_NAME]),
    setCookie: null,
    secure: proto === 'https',
    baseUrl: process.env.PUBLIC_BASE_URL || `${proto}://${host}/`,
    userAgent: String(headers['user-agent'] || '').slice(0, 300),
    ip: String(headers['x-forwarded-for'] || '').split(',')[0].trim(),
    committed: null,
  };

  const readOnlyCall = READ_ONLY.has(name);
  try {
    await ensureReady();
  } catch (e) {
    console.error('[bootstrap] 실패:', e.message);
    return json(503, { error: { message: `서버 설정이 완료되지 않았습니다: ${e.message}`, code: 'SETUP' } });
  }
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    if (!readOnlyCall) await client.query(`SELECT 1 FROM meta WHERE key = 'seq' FOR UPDATE`); // 쓰기 직렬화

    // 필요한 업체 데이터 범위 결정
    let scope;
    if (service === 'esign') {
      scope = { companyId: await companyIdByEsignToken(client, args[0]) };
    } else {
      const who = await resolveCompanyId(client, ctx.session);
      scope = who.isSuper ? { allCompanies: true } : { companyId: who.companyId };
      if (name === 'contracts.get') scope.signatureFor = args[0]; // 계약서 보기일 때만 서명 이미지 로드
    }
    const { db, readOnly } = await loadSnapshot(client, scope);
    const before = clone(db);
    ctx.committed = db;

    let result;
    let error = null;
    try {
      result = await store.run(ctx, () => fn(...args));
    } catch (e) {
      error = e;
    }

    // 업무 코드가 저장(saveDb)한 내용만 반영. (예: 로그인 실패 횟수는 오류여도 저장됨)
    if (!readOnlyCall) await persistChanges(client, before, ctx.committed, readOnly);
    await client.query('COMMIT');

    const extraHeaders = ctx.setCookie ? { 'Set-Cookie': ctx.setCookie } : {};
    if (error) {
      if (error instanceof ApiError) {
        const cookieHeaders = error.code === 'UNAUTHORIZED' ? { 'Set-Cookie': sessionCookie('', { secure: ctx.secure }) } : extraHeaders;
        return json(STATUS[error.code] || 400, { error: { message: error.message, code: error.code } }, cookieHeaders);
      }
      throw error;
    }
    return json(200, { result: result === undefined ? null : result }, extraHeaders);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`[rpc] ${name} 실패:`, e);
    return json(500, { error: { message: '서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', code: 'SERVER' } });
  } finally {
    client.release();
  }
}

function json(status, body, headers = {}) {
  return { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }, body: JSON.stringify(body) };
}
