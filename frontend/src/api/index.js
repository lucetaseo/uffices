// ============================================================
// 서비스 계층 (= 앞으로 만들 백엔드 API 의 계약서)
//
// 화면 컴포넌트는 반드시 이 모듈의 함수만 호출합니다.
// 지금은 localStorage 로 동작하지만, 각 함수 주석에 적힌 REST 엔드포인트로
// 내부 구현만 바꾸면 화면 코드는 수정할 필요가 없습니다.
//
// ※ 권한 검사를 여기(= 서버 자리)에서 합니다. 화면에서 버튼을 숨기는 것은
//   편의일 뿐이고, 실제 차단은 서버가 해야 합니다. 백엔드로 옮길 때도
//   이 검사 로직을 그대로 서버에 구현해야 합니다.
// ============================================================

import { ensureDb, saveDb, nextId, hashPassword, resetDb } from './storage.js';
import {
  ROLES,
  DATA_SCOPES,
  can,
  permissionsOf,
  isOwnScopeOnly,
  ALL_PERMISSION_KEYS,
} from '../auth/permissions.js';
import { inRange, isoToDateKey, today } from '../utils/date.js';
import { digitsOnly, formatPhone } from '../utils/format.js';
import { firstScheduleDate } from '../utils/contract.js';
import { ESIGN_STATUS, MAX_SCHEDULE_STEPS } from '../constants.js';

const SESSION_KEY = 'uffice.session';

export class ApiError extends Error {
  constructor(message, code = 'BAD_REQUEST') {
    super(message);
    this.code = code;
  }
}

const clone = (v) => JSON.parse(JSON.stringify(v));
const nowIso = () => new Date().toISOString();

function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return clone(rest);
}

// ------------------------------------------------------------
// 세션 / 권한 검사 헬퍼
// ------------------------------------------------------------

function companyAccessError(db, user) {
  if (user.role === ROLES.SUPER) return null;
  const company = db.companies.find((c) => c.id === user.companyId);
  if (!company || !company.active) return '사용이 정지된 업체입니다. 운영자에게 문의해 주세요.';
  const t = today();
  if (company.periodStart && t < company.periodStart) return `이용기간 시작 전입니다. (${company.periodStart} 부터)`;
  if (company.periodEnd && t > company.periodEnd) return `이용기간이 만료되었습니다. (${company.periodEnd} 까지)`;
  return null;
}

async function session() {
  const db = await ensureDb();
  const raw = localStorage.getItem(SESSION_KEY);
  const userId = raw ? JSON.parse(raw).userId : null;
  const user = db.users.find((u) => u.id === userId);
  if (!user || !user.active) throw new ApiError('로그인이 필요합니다.', 'UNAUTHORIZED');
  const err = companyAccessError(db, user);
  if (err) throw new ApiError(err, 'UNAUTHORIZED');
  return { db, user };
}

async function authorize(permission) {
  const ctx = await session();
  if (permission && !can(ctx.user, permission)) {
    throw new ApiError('권한이 없습니다.', 'FORBIDDEN');
  }
  return ctx;
}

// 실장 dataScope 까지 반영한 "내가 볼 수 있는 계약"
function visibleContracts(db, user) {
  return db.contracts.filter(
    (c) => c.companyId === user.companyId && (!isOwnScopeOnly(user) || c.ownerId === user.id),
  );
}

function findContract(db, user, id) {
  const c = visibleContracts(db, user).find((x) => x.id === Number(id));
  if (!c) throw new ApiError('계약을 찾을 수 없습니다.', 'NOT_FOUND');
  return c;
}

// 금액 권한이 없는 사용자에게는 금액 필드를 내려주지 않음
function contractView(c, user, db) {
  const out = clone(c);
  out.ownerName = db.users.find((u) => u.id === c.ownerId)?.name || '';
  out.schedules = out.schedules.map((s) => ({
    ...s,
    engineerName: db.engineers.find((e) => e.id === s.engineerId)?.name || '',
    engineerPhone: db.engineers.find((e) => e.id === s.engineerId)?.phone || '',
  }));
  if (out.esign) delete out.esign.signature; // 서명 이미지는 상세조회에서만
  if (!can(user, 'contract.amount')) {
    out.totalAmount = null;
    out.discount = null;
    out.voucher = null;
    out.payments = [];
    out.amountHidden = true;
  }
  return out;
}

// ============================================================
// 인증   POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
// ============================================================

export const auth = {
  async login(loginId, password) {
    const db = await ensureDb();
    const user = db.users.find((u) => u.loginId === loginId.trim());
    const hash = await hashPassword(password);
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
    if (user.passwordHash !== (await hashPassword(currentPassword))) throw new ApiError('현재 비밀번호가 올바르지 않습니다.');
    validatePassword(newPassword);
    user.passwordHash = await hashPassword(newPassword);
    saveDb(db);
  },

  resetDemoData: resetDb,
};

function validatePassword(pw) {
  if (!pw || pw.length < 4) throw new ApiError('비밀번호는 4자 이상이어야 합니다.');
}

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
  if (db.users.some((u) => u.loginId === loginId)) throw new ApiError('이미 사용 중인 아이디입니다.');
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

function masterTable(table, { normalize, sort, beforeRemove }) {
  return {
    async list({ includeInactive = false } = {}) {
      const { db, user } = await session();
      return clone(
        db[table]
          .filter((r) => r.companyId === user.companyId)
          .filter((r) => includeInactive || (r.active !== false && r.visible !== false))
          .sort(sort || ((a, b) => b.id - a.id)),
      );
    },

    async save(data) {
      const { db, user } = await authorize('settings.manage');
      const fields = normalize(data, db, user);
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
      return clone(row);
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
  normalize: (d, db, user) => {
    const loginId = (d.loginId || '').trim();
    if (loginId && db.engineers.some((e) => e.companyId === user.companyId && e.loginId === loginId && e.id !== d.id)) {
      throw new ApiError('이미 사용 중인 기사 아이디입니다.');
    }
    return {
      name: required(d.name, '기사 이름을 입력해 주세요.'),
      category: d.category || '기타',
      phone: required(formatPhone(d.phone), '연락처를 입력해 주세요.'),
      loginId, // 추후 '기사모바일' 로그인용
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
  normalize: (d) => ({ name: required(d.name, '팀 이름을 입력해 주세요.'), description: d.description || '' }),
  beforeRemove: (db, row) => {
    db.users.forEach((u) => {
      if (u.teamId === row.id) u.teamId = null;
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

// ============================================================
// 계약   GET/POST/PATCH/DELETE /api/contracts
// ============================================================

const contractDateOf = (c, dateType) => {
  switch (dateType) {
    case 'contractDate':
      return [c.contractDate];
    case 'scheduleDate':
      return (c.schedules || []).map((s) => s.date);
    case 'completedDate':
      return [c.completedDate];
    case 'canceledDate':
      return [c.canceledDate];
    case 'createdAt':
      return [isoToDateKey(c.createdAt)];
    default:
      return [];
  }
};

function matchesFilter(c, f) {
  if (f.startDate || f.endDate) {
    const dates = contractDateOf(c, f.dateType || 'contractDate');
    if (!dates.some((d) => inRange(d, f.startDate, f.endDate))) return false;
  }
  if (f.aptName && !c.aptName.includes(f.aptName.trim())) return false;
  if (f.dong && c.dong !== f.dong.trim()) return false;
  if (f.ho && c.ho !== f.ho.trim()) return false;
  if (f.customerName && !c.customerName.includes(f.customerName.trim())) return false;
  if (f.phone && !digitsOnly(c.customerPhone).includes(digitsOnly(f.phone))) return false;
  if (f.brand && c.brand !== f.brand) return false;
  if (f.category && c.category !== f.category) return false;
  if (f.receptionType && c.receptionType !== f.receptionType) return false;
  if (f.status && c.status !== f.status) return false;
  if (f.esignStatus && c.esign?.status !== f.esignStatus) return false;
  if (f.ownerId && c.ownerId !== Number(f.ownerId)) return false;
  if (f.engineerId && !(c.schedules || []).some((s) => s.engineerId === Number(f.engineerId))) return false;
  return true;
}

const SORTERS = {
  contractDate_desc: (a, b) => (b.contractDate || '').localeCompare(a.contractDate || '') || b.no - a.no,
  contractDate_asc: (a, b) => (a.contractDate || '').localeCompare(b.contractDate || '') || a.no - b.no,
  scheduleDate_asc: (a, b) =>
    (firstScheduleDate(a) || '9999').localeCompare(firstScheduleDate(b) || '9999') || b.no - a.no,
  no_desc: (a, b) => b.no - a.no,
};

function normalizeContractInput(db, user, data) {
  if (!data.customerName?.trim()) throw new ApiError('고객 성함을 입력해 주세요.');
  if (digitsOnly(data.customerPhone).length < 10) throw new ApiError('고객 연락처를 올바르게 입력해 주세요.');
  if (!data.aptName?.trim()) throw new ApiError('아파트명(현장명)을 입력해 주세요.');
  if (!data.contractDate) throw new ApiError('계약일을 입력해 주세요.');

  const engineerIds = new Set(db.engineers.filter((e) => e.companyId === user.companyId).map((e) => e.id));
  const schedules = (data.schedules || [])
    .slice(0, MAX_SCHEDULE_STEPS)
    .map((s) => ({
      date: s.date || '',
      time: s.time || '',
      ampm: s.ampm || '',
      engineerId: engineerIds.has(Number(s.engineerId)) ? Number(s.engineerId) : null,
      memo: s.memo || '',
    }));
  if (!schedules.length) schedules.push({ date: '', time: '', ampm: '', engineerId: null, memo: '' });

  const out = {
    brand: data.brand,
    category: data.category,
    receptionType: data.receptionType,
    status: data.status || '미정',
    customerName: data.customerName.trim(),
    customerPhone: formatPhone(data.customerPhone),
    aptName: data.aptName.trim(),
    dong: (data.dong || '').trim(),
    ho: (data.ho || '').trim(),
    aptType: (data.aptType || '').trim(),
    items: data.items || '',
    contractDate: data.contractDate,
    schedules,
    completedDate: data.completedDate || '',
    canceledDate: data.canceledDate || '',
    memo: data.memo || '',
  };
  // 상태 변경 시 완료일/취소일 자동 기록 → 날짜검색에 바로 반영
  if (out.status === '시공완료' && !out.completedDate) out.completedDate = today();
  if (out.status === '취소' && !out.canceledDate) out.canceledDate = today();
  if (out.status !== '시공완료') out.completedDate = '';
  if (out.status !== '취소') out.canceledDate = '';

  if (can(user, 'contract.amount')) {
    out.totalAmount = Math.max(0, Number(data.totalAmount) || 0);
    out.discount = Math.max(0, Number(data.discount) || 0);
    out.voucher = Math.max(0, Number(data.voucher) || 0);
    out.payments = (data.payments || [])
      .filter((p) => Number(p.amount))
      .map((p, i) => ({ id: i + 1, date: p.date || today(), method: p.method || '카드', amount: Number(p.amount) }));
  }
  return out;
}

// 전화번호로 계약자를 찾고 없으면 자동 등록
function upsertCustomerForContract(db, user, name, phone) {
  const d = digitsOnly(phone);
  let cust = db.customers.find((c) => c.companyId === user.companyId && digitsOnly(c.phone1) === d);
  if (!cust) {
    cust = {
      id: nextId(db, 'customers'),
      companyId: user.companyId,
      userType: '개인',
      name,
      phone1: phone,
      phone2: '',
      email: '',
      zipcode: '',
      address1: '',
      address2: '',
      createdBy: user.id,
      createdAt: nowIso(),
    };
    db.customers.push(cust);
  }
  return cust;
}

export const contracts = {
  // filters: { trash, dateType, startDate, endDate, aptName, dong, ho, customerName, phone,
  //            brand, category, receptionType, status, esignStatus, ownerId, engineerId, sort }
  async list(filters = {}) {
    const { db, user } = await authorize('contract.view');
    const rows = visibleContracts(db, user)
      .filter((c) => (filters.trash ? !!c.deletedAt : !c.deletedAt))
      .filter((c) => matchesFilter(c, filters))
      .sort(SORTERS[filters.sort] || SORTERS.contractDate_desc);
    return rows.map((c) => contractView(c, user, db));
  },

  async get(id) {
    const { db, user } = await authorize('contract.view');
    const c = findContract(db, user, id);
    const view = contractView(c, user, db);
    if (c.esign?.signature) view.esign.signature = c.esign.signature;
    return view;
  },

  async create(data) {
    const { db, user } = await authorize('contract.create');
    const fields = normalizeContractInput(db, user, data);
    const company = db.companies.find((c) => c.id === user.companyId);
    const cust = upsertCustomerForContract(db, user, fields.customerName, fields.customerPhone);
    company.contractSeq = (company.contractSeq || 0) + 1;
    const contract = {
      totalAmount: 0,
      discount: 0,
      voucher: 0,
      payments: [],
      ...fields,
      id: nextId(db, 'contracts'),
      companyId: user.companyId,
      no: company.contractSeq,
      customerId: cust.id,
      esign: { status: ESIGN_STATUS.NONE, token: null },
      ownerId: user.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    db.contracts.push(contract);
    saveDb(db);
    return contractView(contract, user, db);
  },

  async update(id, data) {
    const { db, user } = await authorize('contract.edit');
    const c = findContract(db, user, id);
    if (c.deletedAt) throw new ApiError('휴지통에 있는 계약은 수정할 수 없습니다.');
    const fields = normalizeContractInput(db, user, data);
    // 서명완료된 계약의 핵심 조건(금액/시공내용)이 바뀌면 재서명이 필요함을 표시
    if (c.esign?.status === ESIGN_STATUS.SIGNED) {
      const changed =
        fields.items !== c.items ||
        ('totalAmount' in fields &&
          (fields.totalAmount !== c.totalAmount || fields.discount !== c.discount || fields.voucher !== c.voucher));
      if (changed) c.esign = { ...c.esign, status: ESIGN_STATUS.NONE, token: null, previousSignedAt: c.esign.signedAt };
    }
    if (fields.customerPhone !== c.customerPhone || fields.customerName !== c.customerName) {
      c.customerId = upsertCustomerForContract(db, user, fields.customerName, fields.customerPhone).id;
    }
    Object.assign(c, fields, { updatedAt: nowIso() });
    saveDb(db);
    return contractView(c, user, db);
  },

  // 일정관리 화면에서 특정 회차의 날짜/시간/기사만 수정
  async updateSchedule(id, stepIndex, patch) {
    const { db, user } = await authorize('schedule.edit');
    const c = findContract(db, user, id);
    const s = c.schedules[stepIndex];
    if (!s) throw new ApiError('일정을 찾을 수 없습니다.', 'NOT_FOUND');
    ['date', 'time', 'ampm', 'memo'].forEach((k) => {
      if (k in patch) s[k] = patch[k] || '';
    });
    if ('engineerId' in patch) {
      const ok = db.engineers.some((e) => e.id === Number(patch.engineerId) && e.companyId === user.companyId);
      s.engineerId = ok ? Number(patch.engineerId) : null;
    }
    c.updatedAt = nowIso();
    saveDb(db);
    return contractView(c, user, db);
  },

  async moveToTrash(ids) {
    const { db, user } = await authorize('contract.delete');
    ids.forEach((id) => {
      findContract(db, user, id).deletedAt = nowIso();
    });
    saveDb(db);
  },

  async restore(ids) {
    const { db, user } = await authorize('contract.delete');
    ids.forEach((id) => {
      findContract(db, user, id).deletedAt = null;
    });
    saveDb(db);
  },

  async purge(ids) {
    const { db, user } = await authorize('contract.delete');
    const set = new Set(ids.map(Number));
    const targets = visibleContracts(db, user).filter((c) => set.has(c.id) && c.deletedAt);
    const purgeIds = new Set(targets.map((c) => c.id));
    db.contracts = db.contracts.filter((c) => !purgeIds.has(c.id));
    saveDb(db);
  },

  // ---------------- 전자계약 ----------------
  // POST /api/contracts/:id/esign  → 고객에게 서명 링크 발송
  async requestSign(id) {
    const { db, user } = await authorize('esign.send');
    const c = findContract(db, user, id);
    if (c.deletedAt) throw new ApiError('휴지통에 있는 계약입니다.');
    if (c.esign?.status === ESIGN_STATUS.SIGNED) throw new ApiError('이미 서명이 완료된 계약입니다.');
    const token = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    c.esign = { ...c.esign, status: ESIGN_STATUS.WAITING, token, requestedAt: nowIso(), requestedBy: user.id };
    c.updatedAt = nowIso();
    saveDb(db);
    return { token, url: `${location.origin}${location.pathname}#/sign/${token}` };
  },
};

// ============================================================
// 전자서명 (고객용 공개 페이지, 로그인 불필요)
//   GET /api/esign/:token, POST /api/esign/:token
// ============================================================

export const esign = {
  async getByToken(token) {
    const db = await ensureDb();
    const c = db.contracts.find((x) => x.esign?.token === token && !x.deletedAt);
    if (!c) throw new ApiError('유효하지 않거나 만료된 서명 링크입니다.', 'NOT_FOUND');
    const company = db.companies.find((x) => x.id === c.companyId);
    const view = clone(c);
    delete view.esign.signature;
    return { contract: view, company: { name: company.name, ceo: company.ceo, bizNo: company.bizNo, address: company.address } };
  },

  async sign(token, { signerName, signature, agreed }) {
    const db = await ensureDb();
    const c = db.contracts.find((x) => x.esign?.token === token && !x.deletedAt);
    if (!c) throw new ApiError('유효하지 않거나 만료된 서명 링크입니다.', 'NOT_FOUND');
    if (c.esign.status === ESIGN_STATUS.SIGNED) throw new ApiError('이미 서명이 완료된 계약입니다.');
    if (!agreed) throw new ApiError('계약 내용에 동의해 주세요.');
    if (!signerName?.trim()) throw new ApiError('서명자 성함을 입력해 주세요.');
    if (!signature) throw new ApiError('서명을 해 주세요.');
    c.esign = {
      ...c.esign,
      status: ESIGN_STATUS.SIGNED,
      signerName: signerName.trim(),
      signature,
      signedAt: nowIso(),
      userAgent: navigator.userAgent, // 서버에서는 IP 등 증빙정보도 함께 저장
    };
    c.updatedAt = nowIso();
    saveDb(db);
  },
};

// ============================================================
// 알림톡   POST /api/notifications   (서버에서 비즈고 API 호출)
// ============================================================

export const notifications = {
  async send({ contractId, template, target, brand, receiverName, receiverPhone, message }) {
    const { db, user } = await authorize('notify.send');
    findContract(db, user, contractId);
    if (digitsOnly(receiverPhone).length < 10) throw new ApiError('수신자 연락처가 없습니다.');
    // TODO: 백엔드 연동 시 서버가 비즈고(Bizgo) 알림톡 API 를 호출하고 결과를 기록
    const log = {
      id: nextId(db, 'notifications'),
      companyId: user.companyId,
      contractId,
      template,
      target,
      brand,
      receiverName,
      receiverPhone,
      message,
      sentBy: user.id,
      sentAt: nowIso(),
      result: 'MOCK',
    };
    db.notifications.push(log);
    saveDb(db);
    return clone(log);
  },

  async history(contractId) {
    const { db, user } = await authorize('notify.send');
    return clone(db.notifications.filter((n) => n.companyId === user.companyId && n.contractId === contractId));
  },
};

// ============================================================
// 일정 (계약의 시공일정을 날짜 단위로 펼친 뷰)   GET /api/schedules?from=&to=
//   별도 테이블이 아니라 계약서의 schedules 가 원본이므로
//   계약에서 수정하면 달력에 바로 반영됩니다.
// ============================================================

export const schedules = {
  async list({ from, to, category, engineerId, status } = {}) {
    const { db, user } = await authorize('schedule.view');
    const out = [];
    visibleContracts(db, user)
      .filter((c) => !c.deletedAt)
      .filter((c) => (!category || c.category === category) && (!status || c.status === status))
      .forEach((c) => {
        c.schedules.forEach((s, stepIndex) => {
          if (!s.date || !inRange(s.date, from, to)) return;
          if (engineerId === 'none' && s.engineerId) return;
          if (engineerId && engineerId !== 'none' && s.engineerId !== Number(engineerId)) return;
          const view = contractView(c, user, db);
          out.push({ ...view.schedules[stepIndex], stepIndex, contract: view });
        });
      });
    return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  },
};

// ============================================================
// 통계/진행현황   GET /api/reports/contracts?dateType=&from=&to=
// ============================================================

export const reports = {
  async contracts({ dateType = 'contractDate', from, to } = {}) {
    const { db, user } = await authorize('stats.view');
    return visibleContracts(db, user)
      .filter((c) => !c.deletedAt)
      .filter((c) => matchesFilter(c, { dateType, startDate: from, endDate: to }))
      .map((c) => contractView(c, user, db));
  },
};
