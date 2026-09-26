// ============================================================
// 화면이 사용하는 서비스 입구
//
//   VITE_API_MODE=server → 서버(/api/rpc)에 요청 (실서비스)
//   그 외               → 브라우저에서 직접 실행 (데모 모드, localStorage 저장)
//
// 업무 로직: services.js / contracts.js / schedule.js (브라우저·서버 공용)
// ============================================================

import * as local from './services.js';
import { remoteServices } from './remote.js';

export const API_MODE = import.meta.env?.VITE_API_MODE === 'server' ? 'server' : 'demo';
const impl = API_MODE === 'server' ? remoteServices : local;

export { ApiError } from './core.js';
export const {
  auth,
  companies,
  users,
  engineers,
  teams,
  products,
  apartments,
  customers,
  contracts,
  esign,
  notifications,
  reports,
  schedules,
  engineerOffs,
  engineerApp,
  scheduleSettings,
} = impl;
