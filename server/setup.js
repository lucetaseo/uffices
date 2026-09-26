// 데이터베이스 초기 설정을 직접 실행 (서버가 자동으로도 실행하므로 선택 사항)
//   npm run db:setup            표 생성 + 운영자 계정
//   npm run db:setup -- --demo  + 시험용 샘플 데이터
import { getPool } from './pg.js';
import { bootstrap } from './bootstrap.js';

const pool = getPool();
const client = await pool.connect();
try {
  await bootstrap(client, { demo: process.argv.includes('--demo') || process.env.INIT_DEMO_DATA === 'true', log: console.log });
  console.log('완료했습니다.');
} catch (e) {
  console.error('✖ 설정 실패:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
