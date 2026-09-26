// ============================================================
// 데이터베이스 자동 준비
//   - 표(테이블)가 없으면 만들고
//   - 계정이 하나도 없으면 환경변수(INIT_SUPER_LOGIN / INIT_SUPER_PASSWORD)로 운영자 계정 발급
//   - INIT_DEMO_DATA=true 이면 시험용 샘플 데이터도 함께 생성
// 서버가 처음 요청을 받을 때 한 번 실행되며(npm run db:setup 으로 직접 실행도 가능),
// 여러 서버가 동시에 켜져도 DB 잠금으로 한 번만 실행됩니다.
// ============================================================

import { SCHEMA_SQL } from './schema.js';
import { persistChanges } from './pg.js';
import { hashPassword } from './password.js';
import { buildSeed, emptyDb, SCHEMA_VERSION } from '../frontend/src/api/seed.js';
import { ROLES } from '../frontend/src/auth/permissions.js';

const LOCK_KEY = 20260927;

export async function bootstrap(client, { demo = process.env.INIT_DEMO_DATA === 'true', log = () => {} } = {}) {
  await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
  try {
    await client.query(SCHEMA_SQL);
    await client.query(`INSERT INTO meta (key, value) VALUES ('seq', '{}') ON CONFLICT (key) DO NOTHING`);
    log('✔ 표(테이블) 준비 완료');

    const { rows } = await client.query('SELECT count(*)::int AS n FROM users');
    if (rows[0].n > 0) {
      log(`ℹ 이미 계정이 ${rows[0].n}개 있어 데이터 생성을 건너뜁니다.`);
      return;
    }
    const loginId = process.env.INIT_SUPER_LOGIN;
    const password = process.env.INIT_SUPER_PASSWORD;
    if (!loginId || !password || password.length < 8) {
      throw new Error('INIT_SUPER_LOGIN, INIT_SUPER_PASSWORD(8자 이상) 환경변수를 설정해 주세요.');
    }

    await client.query('BEGIN');
    try {
      const db = demo ? await buildSeed(hashPassword) : { ...emptyDb(), version: SCHEMA_VERSION };
      const existingSuper = db.users.find((u) => u.role === ROLES.SUPER);
      const superUser = {
        id: existingSuper?.id ?? (db.seq.users = (db.seq.users || 0) + 1),
        loginId,
        passwordHash: await hashPassword(password),
        name: '유피스 운영자',
        phone: '',
        role: ROLES.SUPER,
        companyId: null,
        permissions: [],
        dataScope: 'all',
        teamId: null,
        position: '',
        active: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
      };
      db.users = [...db.users.filter((u) => u.role !== ROLES.SUPER), superUser];
      await client.query(
        `INSERT INTO meta (key, value) VALUES ('schema_version', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [JSON.stringify(db.version || SCHEMA_VERSION)],
      );
      await persistChanges(client, { ...emptyDb(), seq: {} }, db, new Set());
      await client.query('COMMIT');
      log(`✔ 운영자 계정 생성: ${loginId}${demo ? ' (+ 샘플 데이터: admin / manager / gong 계정)' : ''}`);
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
  }
}
