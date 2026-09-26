// ============================================================
// 서비스 계층 (= 앞으로 만들 백엔드 API 의 계약서)
//
// 화면 컴포넌트는 반드시 이 모듈(api/index.js)의 export 만 호출합니다.
// 지금은 localStorage 로 동작하지만, 각 함수 주석에 적힌 REST 엔드포인트로
// 내부 구현만 바꾸면 화면 코드는 수정할 필요가 없습니다.
//
// ※ 권한 검사를 여기(= 서버 자리)에서 합니다. 화면에서 버튼을 숨기는 것은
//   편의일 뿐이고, 실제 차단은 서버가 해야 합니다. 백엔드로 옮길 때도
//   이 검사 로직을 그대로 서버에 구현해야 합니다.
//
//   core.js      세션/권한 공통
//   contracts.js 계약·전자서명·알림톡·통계
//   schedule.js  일정·기사 휴무·기사모바일·일정관리설정
// ============================================================

import { ensureDb, saveDb, nextId, hashPassword, resetDb } from './storage.js';
import { ROLES, DATA_SCOPES, permissionsOf, isOwnScopeOnly, ALL_PERMISSION_KEYS } from '../auth/permissions.js';
import { digitsOnly, formatPhone } from '../utils/format.js';
import {
  ApiError,
  SESSION_KEY,
  authorize,
  clone,
  companyAccessError,
  engineerAsUser,
  isLoginIdTaken,
  nowIso,
  publicUser,
  session,
  validatePassword,
  visibleContracts,
} from './core.js';

export { ApiError } from './core.js';
export { contracts, esign, notifications, reports } from './contracts.js';
export { schedules, engineerOffs, engineerApp, scheduleSettings } from './schedule.js';

// ============================================================
// 인증   POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
// ============================================================

export const auth = {
  async login(loginId, password) {
    const db = await ensureDb();
    const id = loginId.trim();
    const hash = await hashPassword(password);
    // 기사 계정 (기사모바일)
    const engineer = db.engineers.find((e) => e.loginId === id && e.passwordHash);
    if (engineer) {
      if (engineer.passwordHash !== hash) throw new ApiError('아이디 또는 비밀번호가 올바르지 않습니다.');
      if (!engineer.active) throw new ApiError('사용이 중지된 기사 계정입니다. 사무실에 문의해 주세요.');
      const err = companyAccessError(db, engineerAsUser(engineer));
      if (err) throw new ApiError(err);
      engineer.lastLoginAt = nowIso();
      saveDb(db);
      localStorage.setItem(SESSION_KEY, JSON.stringify({ engineerId: engineer.id }));
      return auth.me();
    }
    const user = db.users.find((u) => u.loginId === id);
    if (!user || user.passwordHash !== hash) throw new ApiError('아이디 또는 비밀번호가 올바르지 않습니다.');
    if (!user.active) throw new ApiError('사용이 중지된 계정입니다. 관리자에게 문의해 주세요.');
    const err = companyAccessError(db, user);
    if (err) throw new ApiError(err);
    user.lastLoginAt = nowIso();
    saveDb(db);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id }));
    return auth.me();
  },

  logout() {
    localStorage.removeItem(SESSION_KEY);
  },

  async me() {
    const { db, user } = await session();
    const company = db.companies.find((c) => c.id === user.companyId) || null;
    return { user: publicUser(user), company: company && clone(company) };
  },

  async changePassword(currentPassword, newPassword) {
    const { db, user } = await session();
    const record = user.role === ROLES.ENGINEER ? db.engineers.find((e) => e.id === user.engineerId) : user;
    if (record.passwordHash !== (await hashPassword(currentPassword))) throw new ApiError('현재 비밀번호가 올바르지 않습니다.');
    validatePassword(newPassword);
    record.passwordHash = await hashPassword(newPassword);
    saveDb(db);
  },

  resetDemoData: resetDb,
};

// ============================================================
// 업체 (운영자 전용)   GET/POST/PATCH /api/companies
// ============================================================

export const companies = {
  async list() {
    const { db, user } = await session();
    if (user.role !== ROLES.SUPER) throw new ApiError('권한이 없습니다.', 'FORBIDDEN');
    return db.companies.map((c) => ({
      ...clone(c),
      admins: db.users.filter((u) => u.companyId === c.id && u.role === ROLES.ADMIN).map(publicUser),
      managerCount: db.users.filter((u) => u.companyId === c.id && u.role === ROLES.MANAGER).length,
      contractCount: db.contracts.filter((x) => x.companyId === c.id && !x.deletedAt).length,
    }));
  },

  // 업체 + 최초 관리자 계정을 함께 발급
  async create({ company, admin }) {
    const { db, user } = await session();
    if (user.role !== ROLES.SUPER) throw new ApiError('권한이 없습니다.', 'FORBIDDEN');
    if (!company.name?.trim()) throw new ApiError('업체명을 입력해 주세요.');
    if (!company.periodStart || !company.periodEnd || company.periodStart > company.periodEnd) {
      throw new ApiError('이용기간을 올바르게 입력해 주세요.');
    }
    const newCompany = {
      id: nextId(db, 'companies'),
      name: company.name.trim(),
      ceo: company.ceo || '',
      bizNo: company.bizNo || '',
      address: company.address || '',
      brands: company.brands?.length ? company.brands : [company.name.trim()],
      periodStart: company.periodStart,
      periodEnd: company.periodEnd,
      active: true,
      contractSeq: 0,
      createdAt: nowIso(),
    };
    const adminUser = await buildUser(db, { ...admin, role: ROLES.ADMIN, companyId: newCompany.id, createdBy: user.id });
    db.companies.push(newCompany);
    db.users.push(adminUser);
    saveDb(db);
    return clone(newCompany);
  },

  async update(id, patch) {
    const { db, user } = await session();
    if (user.role !== ROLES.SUPER) throw new ApiError('권한이 없습니다.', 'FORBIDDEN');
    const c = db.companies.find((x) => x.id === id);
    if (!c) throw new ApiError('업체를 찾을 수 없습니다.', 'NOT_FOUND');
    const allowed = ['name', 'ceo', 'bizNo', 'address', 'brands', 'periodStart', 'periodEnd', 'active'];
    allowed.forEach((k) => {
      if (k in patch) c[k] = patch[k];
    });
    if (c.periodStart > c.periodEnd) throw new ApiError('이용기간을 올바르게 입력해 주세요.');
    saveDb(db);
    return clone(c);
  },
};

// ============================================================
// 계정 (운영자: 업체 관리자 / 관리자: 실장)   GET/POST/PATCH /api/users
// ============================================================

async function buildUser(db, data) {
  const loginId = (data.loginId || '').trim();
  if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(loginId)) throw new ApiError('아이디는 영문/숫자 3~20자로 입력해 주세요.');
  if (isLoginIdTaken(db, loginId)) throw new ApiError('이미 사용 중인 아이디입니다.');
  if (!data.name?.trim()) throw new ApiError('이름을 입력해 주세요.');
  validatePassword(data.password);
  return {
    id: nextId(db, 'users'),
    loginId,
    passwordHash: await hashPassword(data.password),
    name: data.name.trim(),
    phone: data.phone ? formatPhone(data.phone) : '',
    role: data.role,
    companyId: data.companyId,
    permissions: data.role === ROLES.MANAGER ? data.permissions || [] : [],
    dataScope: data.dataScope || DATA_SCOPES.ALL,
    teamId: data.teamId ? Number(data.teamId) : null,
    position: data.position || '',
    active: true,
    createdBy: data.createdBy,
    createdAt: nowIso(),
    lastLoginAt: null,
  };
}

// 요청자가 대상 계정을 관리할 수 있는지
function assertCanManage(actor, target) {
  if (actor.role === ROLES.SUPER && target.role === ROLES.ADMIN) return;
  if (actor.role === ROLES.ADMIN && target.role === ROLES.MANAGER && target.companyId === actor.companyId) return;
  throw new ApiError('해당 계정을 관리할 권한이 없습니다.', 'FORBIDDEN');
}

// 관리자는 본인이 가진 권한 범위 안에서만 위임 가능
function sanitizePermissions(actor, permissions = []) {
  const own = permissionsOf(actor);
  return permissions.filter((p) => ALL_PERMISSION_KEYS.includes(p) && own.includes(p));
}

export const users = {
  async list() {
    const { db, user } = await session();
    if (user.role === ROLES.SUPER) return db.users.filter((u) => u.role === ROLES.ADMIN).map(publicUser);
    if (user.role === ROLES.ADMIN) {
      return db.users.filter((u) => u.companyId === user.companyId && u.role === ROLES.MANAGER).map(publicUser);
    }
    throw new ApiError('권한이 없습니다.', 'FORBIDDEN');
  },

  // 운영자 → 기존 업체에 관리자 추가 / 관리자 → 실장 생성
  async create(data) {
    const { db, user } = await session();
    let newUser;
    if (user.role === ROLES.SUPER) {
      if (!db.companies.some((c) => c.id === Number(data.companyId))) throw new ApiError('업체를 선택해 주세요.');
      newUser = await buildUser(db, { ...data, companyId: Number(data.companyId), role: ROLES.ADMIN, createdBy: user.id });
    } else if (user.role === ROLES.ADMIN) {
      newUser = await buildUser(db, {
        ...data,
        role: ROLES.MANAGER,
        companyId: user.companyId,
        permissions: sanitizePermissions(user, data.permissions),
        dataScope: data.dataScope === DATA_SCOPES.OWN ? DATA_SCOPES.OWN : DATA_SCOPES.ALL,
        createdBy: user.id,
      });
    } else {
      throw new ApiError('권한이 없습니다.', 'FORBIDDEN');
    }
    db.users.push(newUser);
    saveDb(db);
    return publicUser(newUser);
  },

  async update(id, patch) {
    const { db, user } = await session();
    const target = db.users.find((u) => u.id === id);
    if (!target) throw new ApiError('계정을 찾을 수 없습니다.', 'NOT_FOUND');
    assertCanManage(user, target);
    if ('name' in patch) {
      if (!patch.name.trim()) throw new ApiError('이름을 입력해 주세요.');
      target.name = patch.name.trim();
    }
    if ('phone' in patch) target.phone = formatPhone(patch.phone);
    if ('active' in patch) target.active = !!patch.active;
    if ('teamId' in patch) target.teamId = patch.teamId ? Number(patch.teamId) : null;
    if ('position' in patch) target.position = patch.position || '';
    if (target.role === ROLES.MANAGER) {
      if ('permissions' in patch) target.permissions = sanitizePermissions(user, patch.permissions);
      if ('dataScope' in patch) target.dataScope = patch.dataScope === DATA_SCOPES.OWN ? DATA_SCOPES.OWN : DATA_SCOPES.ALL;
    }
    if (patch.password) {
      validatePassword(patch.password);
      target.passwordHash = await hashPassword(patch.password);
    }
    saveDb(db);
    return publicUser(target);
  },

  // 담당자(작성자) 선택 목록용 — 같은 업체의 관리자/실장 이름
  async staffOptions() {
    const { db, user } = await session();
    return db.users
      .filter((u) => u.companyId === user.companyId && u.role !== ROLES.SUPER)
      .map((u) => ({ id: u.id, name: u.name, role: u.role }));
  },
};

// ============================================================
// 기초코드 (설정 메뉴): 시공기사 / 팀 / 상품 / 아파트
//   GET/POST/PATCH/DELETE /api/{engineers|teams|products|apartments}
//   조회는 업체 내 모든 계정 가능(계약 등록 화면에서 사용), 변경은 settings.manage 권한
// ============================================================

function masterTable(table, { normalize, sort, beforeRemove, present = (r) => r }) {
  return {
    async list({ includeInactive = false } = {}) {
      const { db, user } = await session();
      return clone(
        db[table]
          .filter((r) => r.companyId === user.companyId)
          .filter((r) => includeInactive || (r.active !== false && r.visible !== false))
          .sort(sort || ((a, b) => b.id - a.id))
          .map(present),
      );
    },

    async save(data) {
      const { db, user } = await authorize('settings.manage');
      const fields = await normalize(data, db, user);
      let row;
      if (data.id) {
        row = db[table].find((r) => r.id === data.id && r.companyId === user.companyId);
        if (!row) throw new ApiError('항목을 찾을 수 없습니다.', 'NOT_FOUND');
        Object.assign(row, fields, { updatedAt: nowIso() });
      } else {
        row = { id: nextId(db, table), companyId: user.companyId, createdAt: nowIso(), ...fields };
        db[table].push(row);
      }
      saveDb(db);
      return clone(present(row));
    },

    async remove(id) {
      const { db, user } = await authorize('settings.manage');
      const row = db[table].find((r) => r.id === id && r.companyId === user.companyId);
      if (!row) return;
      if (beforeRemove && beforeRemove(db, row) === false) {
        saveDb(db);
        return;
      }
      db[table] = db[table].filter((r) => r !== row);
      saveDb(db);
    },
  };
}

const required = (v, msg) => {
  if (!String(v ?? '').trim()) throw new ApiError(msg);
  return String(v).trim();
};

export const engineers = masterTable('engineers', {
  sort: (a, b) => a.name.localeCompare(b.name),
  // 비밀번호 해시는 내려주지 않음
  present: ({ passwordHash, ...rest }) => ({ ...rest, hasPassword: !!passwordHash }),
  normalize: async (d, db, user) => {
    const loginId = (d.loginId || '').trim();
    const existing = d.id ? db.engineers.find((e) => e.id === d.id) : null;
    if (loginId) {
      if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(loginId)) throw new ApiError('기사 아이디는 영문/숫자 3~20자로 입력해 주세요.');
      if (isLoginIdTaken(db, loginId, { exceptEngineerId: d.id })) throw new ApiError('이미 사용 중인 아이디입니다.');
    }
    let passwordHash = existing?.passwordHash || null;
    if (d.password) {
      validatePassword(d.password);
      passwordHash = await hashPassword(d.password);
    }
    if (!loginId) passwordHash = null; // 아이디가 없으면 기사모바일 로그인 불가
    const teamId = db.teams.some((t) => t.id === Number(d.teamId) && t.companyId === user.companyId && t.kind === '시공팀')
      ? Number(d.teamId)
      : null;
    return {
      name: required(d.name, '기사 이름을 입력해 주세요.'),
      category: d.category || '기타',
      phone: required(formatPhone(d.phone), '연락처를 입력해 주세요.'),
      loginId, // '기사모바일' 로그인용
      passwordHash,
      teamId,
      email: d.email || '',
      address: d.address || '',
      memo: d.memo || '',
      active: d.active !== false,
    };
  },
  // 계약에 배정된 적 있는 기사는 기록 보존을 위해 삭제 대신 비활성화
  beforeRemove: (db, row) => {
    const used = db.contracts.some((c) => c.schedules.some((s) => s.engineerId === row.id));
    if (used) {
      row.active = false;
      return false;
    }
    return true;
  },
});

export const teams = masterTable('teams', {
  sort: (a, b) => a.name.localeCompare(b.name),
  normalize: (d) => ({
    name: required(d.name, '팀 이름을 입력해 주세요.'),
    kind: d.kind === '시공팀' ? '시공팀' : '부서', // 시공팀은 계약서 '팀배정'에 사용
    description: d.description || '',
  }),
  beforeRemove: (db, row) => {
    const used = db.contracts.some((c) => c.schedules.some((s) => s.assignType === 'team' && s.teamId === row.id));
    if (used) throw new ApiError('계약에 배정된 적이 있는 시공팀은 삭제할 수 없습니다.');
    db.users.forEach((u) => {
      if (u.teamId === row.id) u.teamId = null;
    });
    db.engineers.forEach((e) => {
      if (e.teamId === row.id) e.teamId = null;
    });
    return true;
  },
});

export const products = masterTable('products', {
  normalize: (d) => ({
    name: required(d.name, '상품명을 입력해 주세요.'),
    kind: d.kind || '패키지',
    category: d.category || '기타',
    detail: d.detail || '',
    price: Math.max(0, Number(d.price) || 0),
    visible: d.visible !== false,
  }),
});

export const apartments = masterTable('apartments', {
  sort: (a, b) => a.name.localeCompare(b.name),
  normalize: (d) => ({
    sido: d.sido || '',
    sigungu: d.sigungu || '',
    name: required(d.name, '아파트명을 입력해 주세요.'),
  }),
});

// ============================================================
// 계약자(고객)   GET/POST/PATCH/DELETE /api/customers
// ============================================================

export const customers = {
  async list(query = '') {
    const { db, user } = await authorize('customer.view');
    const q = query.trim();
    const qDigits = digitsOnly(q);
    const visibleIds = new Set(visibleContracts(db, user).map((c) => c.customerId));
    return db.customers
      .filter((c) => c.companyId === user.companyId)
      // 본인 건만 보는 실장은 본인 계약에 연결된 계약자만
      .filter((c) => !isOwnScopeOnly(user) || visibleIds.has(c.id) || c.createdBy === user.id)
      .filter(
        (c) =>
          !q ||
          c.name.includes(q) ||
          (qDigits && (digitsOnly(c.phone1).includes(qDigits) || digitsOnly(c.phone2).includes(qDigits))),
      )
      .sort((a, b) => b.id - a.id)
      .map((c) => ({
        ...clone(c),
        contractCount: db.contracts.filter((x) => x.customerId === c.id && !x.deletedAt).length,
      }));
  },

  async findByPhone(phone) {
    const { db, user } = await authorize('customer.view');
    const d = digitsOnly(phone);
    if (d.length < 10) return [];
    return clone(
      db.customers.filter(
        (c) => c.companyId === user.companyId && (digitsOnly(c.phone1) === d || digitsOnly(c.phone2) === d),
      ),
    );
  },

  async save(data) {
    const { db, user } = await authorize('customer.edit');
    if (!data.name?.trim()) throw new ApiError('이름을 입력해 주세요.');
    if (digitsOnly(data.phone1).length < 10) throw new ApiError('연락처①을 올바르게 입력해 주세요.');
    const fields = {
      userType: data.userType || '개인',
      name: data.name.trim(),
      phone1: formatPhone(data.phone1),
      phone2: data.phone2 ? formatPhone(data.phone2) : '',
      email: data.email || '',
      zipcode: data.zipcode || '',
      address1: data.address1 || '',
      address2: data.address2 || '',
    };
    let target;
    if (data.id) {
      target = db.customers.find((c) => c.id === data.id && c.companyId === user.companyId);
      if (!target) throw new ApiError('계약자를 찾을 수 없습니다.', 'NOT_FOUND');
      Object.assign(target, fields);
      // 계약서에 복사된 이름/연락처도 함께 갱신
      db.contracts
        .filter((c) => c.customerId === target.id)
        .forEach((c) => {
          c.customerName = target.name;
          c.customerPhone = target.phone1;
        });
    } else {
      target = { id: nextId(db, 'customers'), companyId: user.companyId, createdBy: user.id, createdAt: nowIso(), ...fields };
      db.customers.push(target);
    }
    saveDb(db);
    return clone(target);
  },

  async remove(id) {
    const { db, user } = await authorize('customer.edit');
    const linked = db.contracts.filter((c) => c.customerId === id && !c.deletedAt).length;
    if (linked) throw new ApiError(`이 계약자로 등록된 계약이 ${linked}건 있어 삭제할 수 없습니다.`);
    db.customers = db.customers.filter((c) => !(c.id === id && c.companyId === user.companyId));
    saveDb(db);
  },
};

