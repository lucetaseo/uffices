// PostgreSQL 연결 + 데이터 읽기/쓰기
import pg from 'pg';

const TABLE_MAP = {
  companies: 'companies',
  users: 'users',
  engineers: 'engineers',
  engineerOffs: 'engineer_offs',
  teams: 'teams',
  products: 'products',
  apartments: 'apartments',
  customers: 'customers',
  contracts: 'contracts',
  notifications: 'notifications',
};
export const TABLE_KEYS = Object.keys(TABLE_MAP);
// 업체별로 나뉘는 테이블 (요청한 사람의 업체 데이터만 읽음)
const COMPANY_SCOPED = ['engineerOffs', 'teams', 'products', 'apartments', 'customers', 'contracts', 'notifications'];

let pool = null;

function sslOption(url) {
  if (process.env.DATABASE_SSL === 'disable' || /localhost|127\.0\.0\.1/.test(url)) return false;
  // Supabase 등: 전송 구간 암호화. DATABASE_CA_CERT(PEM)를 넣으면 서버 인증서까지 검증
  if (process.env.DATABASE_CA_CERT) return { ca: process.env.DATABASE_CA_CERT.replace(/\\n/g, '\n'), rejectUnauthorized: true };
  return { rejectUnauthorized: false };
}

export function getPool() {
  if (!pool) {
    const url = String(process.env.DATABASE_URL || '').trim(); // 복사·붙여넣기 때 들어간 공백/줄바꿈 제거
    if (!url) throw new Error('DATABASE_URL 환경변수가 필요합니다.');
    pool = new pg.Pool({
      connectionString: url.replace(/[?&]sslmode=[^&]*/, ''),
      ssl: sslOption(url),
      max: Number(process.env.DATABASE_POOL_MAX || 3), // 서버리스: 인스턴스당 연결 수를 작게
      idleTimeoutMillis: 10000,
    });
  }
  return pool;
}

export async function closePool() {
  if (pool) await pool.end();
  pool = null;
}

const rows = async (client, sql, params = []) => (await client.query(sql, params)).rows;

// 요청 범위(scope)에 필요한 데이터만 읽어 업무 로직이 쓰는 db 객체 형태로 만듦
//   scope.companyId: 이 업체의 업무 데이터 로드
//   scope.allCompanies: 운영자 — 업체별 계약 건수만 필요 → 계약은 요약만 로드 (저장 안 함)
//   scope.tables: 읽을 업체 표 목록 (가벼운 요청은 계약 등 큰 표를 읽지 않음)
//   scope.signatureFor: 이 계약의 서명 이미지도 함께 로드 (계약서 보기)
export async function loadSnapshot(client, scope) {
  const db = { seq: {}, version: 2 };
  const readOnly = new Set();
  const meta = await rows(client, `SELECT key, value FROM meta WHERE key IN ('seq','schema_version')`);
  meta.forEach((m) => {
    if (m.key === 'seq') db.seq = m.value;
    if (m.key === 'schema_version') db.version = m.value;
  });
  const toObj = (r) => r.data;

  // 업체/계정/기사: 로그인 아이디 중복 검사 등에 필요 (행 수가 적음)
  for (const key of ['companies', 'users', 'engineers']) {
    db[key] = (await rows(client, `SELECT data FROM ${TABLE_MAP[key]} ORDER BY id`)).map(toObj);
  }
  // scope.tables: 이 요청에 필요한 업체 표만 (없으면 전부) — 트래픽 절약
  const wanted = scope.tables || COMPANY_SCOPED;
  for (const key of COMPANY_SCOPED) {
    if (scope.companyId && wanted.includes(key)) {
      db[key] = (await rows(client, `SELECT data FROM ${TABLE_MAP[key]} WHERE company_id = $1 ORDER BY id`, [scope.companyId])).map(toObj);
    } else {
      db[key] = [];
      readOnly.add(key);
    }
  }
  if (scope.signatureFor && db.contracts.length) {
    const id = Number(scope.signatureFor);
    const sig = await rows(client, `SELECT image FROM contract_signatures WHERE contract_id = $1 AND company_id = $2`, [id, scope.companyId]);
    const c = db.contracts.find((x) => x.id === id);
    if (sig[0] && c?.esign) c.esign.signature = sig[0].image;
  }
  if (scope.allCompanies) {
    db.contracts = (await rows(client, `SELECT id, company_id, data->>'deletedAt' AS deleted_at FROM contracts`)).map((r) => ({
      id: Number(r.id), // bigint 는 문자열로 오므로 숫자로 변환
      companyId: Number(r.company_id),
      deletedAt: r.deleted_at,
    }));
    readOnly.add('contracts');
  }
  return { db, readOnly };
}

// 계약의 서명 이미지는 별도 표에 저장 → 계약 데이터에서는 떼어냄
function splitSignature(row) {
  if (!row.esign?.signature) return [row, null];
  const { signature, ...esign } = row.esign;
  return [{ ...row, esign }, signature];
}

// 변경된 행만 저장 (추가/수정/삭제)
export async function persistChanges(client, before, after, readOnly) {
  for (const key of TABLE_KEYS) {
    if (readOnly.has(key)) continue;
    const table = TABLE_MAP[key];
    const isContracts = key === 'contracts';
    const prevSig = new Map();
    const prev = new Map(
      (before[key] || []).map((r) => {
        const [data, sig] = isContracts ? splitSignature(r) : [r, null];
        if (sig) prevSig.set(r.id, sig);
        return [r.id, JSON.stringify(data)];
      }),
    );
    const nextIds = new Set();
    const ids = [];
    const companyIds = [];
    const datas = [];
    for (const original of after[key] || []) {
      const [row, sig] = isContracts ? splitSignature(original) : [original, null];
      nextIds.add(row.id);
      if (sig && sig !== prevSig.get(row.id)) {
        await client.query(
          `INSERT INTO contract_signatures (contract_id, company_id, image, updated_at) VALUES ($1, $2, $3, now())
           ON CONFLICT (contract_id) DO UPDATE SET image = EXCLUDED.image, updated_at = now()`,
          [row.id, row.companyId, sig],
        );
      }
      const json = JSON.stringify(row);
      if (prev.get(row.id) === json) continue;
      ids.push(row.id);
      companyIds.push(key === 'companies' ? row.id : row.companyId ?? null);
      datas.push(json);
    }
    // 바뀐 행을 표마다 한 번에 저장 (DB 가 멀어도 왕복 횟수가 적도록)
    for (let i = 0; i < ids.length; i += 500) {
      await client.query(
        `INSERT INTO ${table} (id, company_id, data, updated_at)
         SELECT id, company_id, data::jsonb, now() FROM unnest($1::bigint[], $2::bigint[], $3::text[]) AS t(id, company_id, data)
         ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id, data = EXCLUDED.data, updated_at = now()`,
        [ids.slice(i, i + 500), companyIds.slice(i, i + 500), datas.slice(i, i + 500)],
      );
    }
    const removed = [...prev.keys()].filter((id) => !nextIds.has(id));
    if (removed.length) {
      await client.query(`DELETE FROM ${table} WHERE id = ANY($1::bigint[])`, [removed]);
      if (isContracts) await client.query(`DELETE FROM contract_signatures WHERE contract_id = ANY($1::bigint[])`, [removed]);
    }
  }
  if (JSON.stringify(before.seq) !== JSON.stringify(after.seq)) {
    await client.query(
      `INSERT INTO meta (key, value) VALUES ('seq', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(after.seq)],
    );
  }
}

// 요청 전에 로그인한 사람의 업체를 알아냄
export async function resolveCompanyId(client, session) {
  if (session?.userId) {
    const r = await rows(client, `SELECT data->>'companyId' AS c, data->>'role' AS role FROM users WHERE id = $1`, [session.userId]);
    if (!r[0]) return { companyId: null };
    return { companyId: r[0].c ? Number(r[0].c) : null, isSuper: r[0].role === 'SUPER' };
  }
  if (session?.engineerId) {
    const r = await rows(client, `SELECT company_id FROM engineers WHERE id = $1`, [session.engineerId]);
    return { companyId: r[0] ? Number(r[0].company_id) : null };
  }
  return { companyId: null };
}

export async function companyIdByEsignToken(client, token) {
  const r = await rows(client, `SELECT company_id FROM contracts WHERE data->'esign'->>'token' = $1`, [String(token || '')]);
  return r[0] ? Number(r[0].company_id) : null;
}
