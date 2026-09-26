// 계약 데이터를 화면용으로 가공 + 변경이력 기록 (서비스 계층 내부용)

import { can } from '../auth/permissions.js';
import { clone, nowIso } from './core.js';
import { numberOf } from './numbering.js';

export function assigneeOf(db, s) {
  const engineer = s.engineerId ? db.engineers.find((e) => e.id === s.engineerId) : null;
  const team = s.teamId ? db.teams.find((t) => t.id === s.teamId) : null;
  const isTeam = s.assignType === 'team';
  return {
    engineerName: engineer?.name || '',
    engineerPhone: engineer?.phone || '',
    teamName: team?.name || '',
    assigneeName: isTeam ? (team ? `[팀] ${team.name}` : '') : engineer?.name || '',
  };
}

// 금액 권한이 없는 사용자에게는 금액 필드를 내려주지 않음
export function contractView(c, user, db) {
  const out = clone(c);
  out.no = numberOf(db, c); // 계약일 순서 번호 (휴지통은 null)
  out.ownerName = db.users.find((u) => u.id === c.ownerId)?.name || '';
  out.schedules = out.schedules.map((s) => ({ ...s, ...assigneeOf(db, s) }));
  if (out.esign) delete out.esign.signature; // 서명 이미지는 상세조회에서만
  if (!can(user, 'contract.amount')) {
    out.totalAmount = null;
    out.discount = null;
    out.voucher = null;
    out.payments = [];
    out.lineItems = (out.lineItems || []).map(({ unitPrice, ...rest }) => rest);
    out.amountHidden = true;
  }
  return out;
}

// 변경이력: 누가 언제 무엇을 바꿨는지 (실장 권한 위임 구조에서 필수)
export function addHistory(c, user, action, changes = []) {
  c.history = c.history || [];
  c.history.push({
    at: nowIso(),
    byId: user.id,
    byName: user.name,
    byRole: user.role,
    action,
    changes,
  });
}
