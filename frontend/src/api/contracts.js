// ============================================================
// 계약 / 전자서명 / 알림톡 / 통계
//   GET/POST/PATCH/DELETE /api/contracts ...
// ============================================================

import { loadDb, saveDb, nextId, publicBaseUrl, clientInfo } from './runtime.js';
import { ApiError, authorize, clone, findContract, nowIso, visibleContracts } from './core.js';
import { addHistory, assigneeOf, contractView } from './views.js';
import { assertAssignable } from './schedule.js';
import { can } from '../auth/permissions.js';
import {
  APPROVAL_STATUS,
  ASSIGN_TYPES,
  CATEGORIES,
  ESIGN_STATUS,
  MAX_SCHEDULE_STEPS,
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  RECEPTION_TYPES,
  WORK_STATUS,
  WORK_TYPES,
} from '../constants.js';
import { inRange, isDateKey, isoToDateKey, today } from '../utils/date.js';
import { digitsOnly, formatAddress, formatPhone, won } from '../utils/format.js';
import { calcAmounts, firstScheduleDate } from '../utils/contract.js';

// ------------------------------------------------------------
// 검색
// ------------------------------------------------------------

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
    case 'moveInDate':
      return [c.moveInDate];
    case 'createdAt':
      return [isoToDateKey(c.createdAt)];
    default:
      return [];
  }
};

export function matchesFilter(c, f) {
  if (f.startDate || f.endDate) {
    const dates = contractDateOf(c, f.dateType || 'contractDate');
    if (!dates.some((d) => inRange(d, f.startDate, f.endDate))) return false;
  }
  if (f.aptName && !c.aptName.includes(f.aptName.trim())) return false;
  if (f.dong && c.dong !== f.dong.trim()) return false;
  if (f.ho && c.ho !== f.ho.trim()) return false;
  if (f.customerName && !c.customerName.includes(f.customerName.trim())) return false;
  if (f.phone) {
    const d = digitsOnly(f.phone);
    if (!digitsOnly(c.customerPhone).includes(d) && !digitsOnly(c.customerPhone2).includes(d)) return false;
  }
  if (f.brand && c.brand !== f.brand) return false;
  if (f.category && c.category !== f.category) return false;
  if (f.workType && c.workType !== f.workType) return false;
  if (f.receptionType && c.receptionType !== f.receptionType) return false;
  if (f.status && c.status !== f.status) return false;
  if (f.approval && c.approval !== f.approval) return false;
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

// ------------------------------------------------------------
// 입력 정규화 + 검증 (서버 검증에 해당)
// ------------------------------------------------------------

const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);

function normalizeSchedules(db, user, input = [], prev = []) {
  const companyId = user.companyId;
  const engineerIds = new Set(db.engineers.filter((e) => e.companyId === companyId).map((e) => e.id));
  const teamIds = new Set(db.teams.filter((t) => t.companyId === companyId && t.kind === '시공팀').map((t) => t.id));
  const out = input.slice(0, MAX_SCHEDULE_STEPS).map((s, i) => {
    const assignType = s.assignType === ASSIGN_TYPES.TEAM ? ASSIGN_TYPES.TEAM : ASSIGN_TYPES.ENGINEER;
    const old = prev[i] || {};
    return {
      date: isDateKey(s.date) ? s.date : '',
      time: /^\d{2}:\d{2}$/.test(s.time || '') ? s.time : '',
      ampm: s.time ? '' : oneOf(s.ampm, ['AM', 'PM'], ''),
      assignType,
      engineerId: assignType === ASSIGN_TYPES.ENGINEER && engineerIds.has(Number(s.engineerId)) ? Number(s.engineerId) : null,
      teamId: assignType === ASSIGN_TYPES.TEAM && teamIds.has(Number(s.teamId)) ? Number(s.teamId) : null,
      memo: s.memo || '',
      // 모바일웹 보고값은 기사만 변경 (화면 입력값 무시)
      mobileStatus: old.mobileStatus || '',
      mobileMemo: old.mobileMemo || '',
      reportedAt: old.reportedAt || null,
      reportedBy: old.reportedBy || '',
    };
  });
  if (!out.length) out.push(normalizeSchedules(db, user, [{}])[0]);
  return out;
}

const scheduleKey = (s) => [s?.date, s?.time, s?.ampm, s?.assignType, s?.engineerId, s?.teamId].join('|');

function assertSchedulesAssignable(db, user, schedules, prev = [], contractId) {
  schedules.forEach((s, i) => {
    if (scheduleKey(s) === scheduleKey(prev[i])) return; // 바뀐 회차만 검사
    assertAssignable(db, user.companyId, s, { contractId, stepIndex: i });
  });
}

function normalizeContractInput(db, user, data, existing) {
  const company = db.companies.find((c) => c.id === user.companyId);
  const brands = company.brands?.length ? company.brands : [company.name];

  // 계약자명은 등록 후 수정 불가
  const customerName = existing ? existing.customerName : String(data.customerName || '').trim();
  if (!customerName) throw new ApiError('고객명을 입력해 주세요.');
  if (digitsOnly(data.customerPhone).length < 10) throw new ApiError('고객 연락처①을 올바르게 입력해 주세요.');
  if (data.customerPhone2 && digitsOnly(data.customerPhone2).length < 10) throw new ApiError('고객 연락처②를 올바르게 입력해 주세요.');
  if (!String(data.aptName || '').trim()) throw new ApiError('현장(아파트명)을 입력해 주세요.');
  if (!isDateKey(data.contractDate)) throw new ApiError('계약일을 선택해 주세요.');
  if (!brands.includes(data.brand)) throw new ApiError('브랜드를 선택해 주세요.');

  // 계약담당: 관리자는 직원 중 선택, 실장은 본인(수정 시 기존 담당 유지)
  let ownerId = existing ? existing.ownerId : user.id;
  if (user.role === 'ADMIN' && data.ownerId) {
    const staff = db.users.find((u) => u.id === Number(data.ownerId) && u.companyId === user.companyId);
    if (!staff) throw new ApiError('계약담당자를 선택해 주세요.');
    ownerId = staff.id;
  }

  const approval = can(user, 'contract.approve')
    ? oneOf(data.approval, APPROVAL_STATUS, '승인')
    : existing?.approval || '승인대기';

  const status = oneOf(data.status, WORK_STATUS, '미정');
  const out = {
    brand: data.brand,
    category: oneOf(data.category, CATEGORIES, CATEGORIES[0]),
    workType: oneOf(data.workType, WORK_TYPES, WORK_TYPES[0]),
    receptionType: oneOf(data.receptionType, RECEPTION_TYPES, RECEPTION_TYPES[0]),
    customerName,
    customerPhone: formatPhone(data.customerPhone),
    customerPhone2: data.customerPhone2 ? formatPhone(data.customerPhone2) : '',
    ownerId,
    aptName: data.aptName.trim(),
    dong: String(data.dong || '').trim(),
    ho: String(data.ho || '').trim(),
    aptType: String(data.aptType || '').trim(),
    area: String(data.area || '').trim(),
    contractDate: data.contractDate,
    moveInDate: isDateKey(data.moveInDate) ? data.moveInDate : '',
    approval,
    schedules: normalizeSchedules(db, user, data.schedules, existing?.schedules),
    status,
    completedDate: status === '시공완료' ? (isDateKey(data.completedDate) ? data.completedDate : today()) : '',
    canceledDate: status === '취소' ? (isDateKey(data.canceledDate) ? data.canceledDate : today()) : '',
    cancelReason: status === '취소' ? String(data.cancelReason || '').trim() : '',
    items: data.items || '',
    happyCallMemo: data.happyCallMemo || '',
    memo: data.memo || '',
  };
  if (status === '취소' && !out.cancelReason) throw new ApiError('취소 사유를 입력해 주세요.');

  if (can(user, 'contract.amount')) {
    out.lineItems = (data.lineItems || [])
      .filter((l) => String(l.name || '').trim())
      .map((l) => ({
        productId: l.productId ? Number(l.productId) : null,
        name: String(l.name).trim(),
        detail: l.detail || '',
        qty: Math.max(1, Math.floor(Number(l.qty) || 1)),
        unitPrice: Math.max(0, Number(l.unitPrice) || 0),
      }));
    // 상품내역이 있으면 시공총액은 상품 합계로 자동 계산
    out.totalAmount = out.lineItems.length
      ? out.lineItems.reduce((s, l) => s + l.qty * l.unitPrice, 0)
      : Math.max(0, Number(data.totalAmount) || 0);
    out.discount = Math.max(0, Number(data.discount) || 0);
    out.voucher = Math.max(0, Number(data.voucher) || 0);
    if (out.discount + out.voucher > out.totalAmount) throw new ApiError('할인/상품권 금액이 시공총액보다 큽니다.');
    out.payments = (data.payments || [])
      .filter((p) => Number(p.amount))
      .map((p, i) => ({
        id: i + 1,
        date: isDateKey(p.date) ? p.date : today(),
        kind: oneOf(p.kind, PAYMENT_KINDS, PAYMENT_KINDS[0]),
        method: oneOf(p.method, PAYMENT_METHODS, PAYMENT_METHODS[0]),
        amount: Number(p.amount),
        memo: p.memo || '',
      }));
  }
  return out;
}

// 변경이력용 비교
function diffContract(db, before, after) {
  const changes = [];
  const push = (label, from, to) => {
    const f = String(from ?? '');
    const t = String(to ?? '');
    if (f !== t) changes.push({ label, from: f.slice(0, 80) || '-', to: t.slice(0, 80) || '-' });
  };
  const staffName = (id) => db.users.find((u) => u.id === id)?.name || '';
  push('브랜드', before.brand, after.brand);
  push('구분', before.category, after.category);
  push('시공종류', before.workType, after.workType);
  push('접수형태', before.receptionType, after.receptionType);
  push('계약승인', before.approval, after.approval);
  push('시공상태', before.status, after.status);
  push('취소사유', before.cancelReason, after.cancelReason);
  push('연락처①', before.customerPhone, after.customerPhone);
  push('연락처②', before.customerPhone2, after.customerPhone2);
  push('계약담당', staffName(before.ownerId), staffName(after.ownerId));
  push('현장', formatAddress(before), formatAddress(after));
  push('평수', before.area, after.area);
  push('계약일', before.contractDate, after.contractDate);
  push('입주예정일', before.moveInDate, after.moveInDate);
  const sched = (s) => {
    if (!s || (!s.date && !s.engineerId && !s.teamId)) return '';
    const when = s.time || (s.ampm === 'AM' ? '오전' : s.ampm === 'PM' ? '오후' : '');
    return `${s.date || '날짜미정'} ${when} ${assigneeOf(db, s).assigneeName || '미배정'}`.replace(/\s+/g, ' ').trim();
  };
  for (let i = 0; i < MAX_SCHEDULE_STEPS; i++) push(`시공일정${i + 1}`, sched(before.schedules?.[i]), sched(after.schedules?.[i]));
  if ('totalAmount' in after) {
    const a = calcAmounts(before);
    const b = calcAmounts(after);
    push('시공총액', won(a.total), won(b.total));
    push('할인', won(a.discount), won(b.discount));
    push('상품권', won(a.voucher), won(b.voucher));
    push('입금합계', won(a.paid), won(b.paid));
  }
  if ((before.items || '') !== (after.items || '')) changes.push({ label: '시공내용', from: '(변경)', to: '(변경)' });
  if ((before.happyCallMemo || '') !== (after.happyCallMemo || '')) changes.push({ label: '해피콜 메모', from: '(변경)', to: '(변경)' });
  if ((before.memo || '') !== (after.memo || '')) changes.push({ label: '기타사항', from: '(변경)', to: '(변경)' });
  return changes;
}

// 전화번호로 계약자를 찾고 없으면 자동 등록
function upsertCustomerForContract(db, user, name, phone, phone2) {
  const d = digitsOnly(phone);
  let cust = db.customers.find((c) => c.companyId === user.companyId && digitsOnly(c.phone1) === d);
  if (!cust) {
    cust = {
      id: nextId(db, 'customers'),
      companyId: user.companyId,
      userType: '개인',
      name,
      phone1: phone,
      phone2: phone2 || '',
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

// ============================================================
// 계약
// ============================================================

export const contracts = {
  // filters: { trash, dateType, startDate, endDate, aptName, dong, ho, customerName, phone, brand, category,
  //            workType, receptionType, status, approval, esignStatus, ownerId, engineerId, sort }
  async list(filters = {}) {
    const { db, user } = await authorize('contract.view');
    return visibleContracts(db, user)
      .filter((c) => (filters.trash ? !!c.deletedAt : !c.deletedAt))
      .filter((c) => matchesFilter(c, filters))
      .sort(SORTERS[filters.sort] || SORTERS.contractDate_desc)
      .map((c) => contractView(c, user, db));
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
    const fields = normalizeContractInput(db, user, data, null);
    assertSchedulesAssignable(db, user, fields.schedules, [], null);
    const company = db.companies.find((c) => c.id === user.companyId);
    const cust = upsertCustomerForContract(db, user, fields.customerName, fields.customerPhone, fields.customerPhone2);
    company.contractSeq = (company.contractSeq || 0) + 1;
    const contract = {
      totalAmount: 0,
      discount: 0,
      voucher: 0,
      payments: [],
      lineItems: [],
      ...fields,
      id: nextId(db, 'contracts'),
      companyId: user.companyId,
      no: company.contractSeq,
      customerId: cust.id,
      esign: { status: ESIGN_STATUS.NONE, token: null },
      history: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    };
    addHistory(contract, user, '계약 등록');
    db.contracts.push(contract);
    saveDb(db);
    return contractView(contract, user, db);
  },

  async update(id, data) {
    const { db, user } = await authorize('contract.edit');
    const c = findContract(db, user, id);
    if (c.deletedAt) throw new ApiError('휴지통에 있는 계약은 수정할 수 없습니다.');
    const fields = normalizeContractInput(db, user, data, c);
    assertSchedulesAssignable(db, user, fields.schedules, c.schedules, c.id);
    const before = clone(c);

    // 서명완료된 계약의 핵심 조건(금액/시공내용)이 바뀌면 재서명 필요
    if (c.esign?.status === ESIGN_STATUS.SIGNED) {
      const changed =
        fields.items !== c.items ||
        ('totalAmount' in fields &&
          (fields.totalAmount !== c.totalAmount ||
            fields.discount !== c.discount ||
            fields.voucher !== c.voucher ||
            JSON.stringify(fields.lineItems) !== JSON.stringify(c.lineItems || [])));
      if (changed) c.esign = { ...c.esign, status: ESIGN_STATUS.NONE, token: null, previousSignedAt: c.esign.signedAt };
    }
    if (fields.customerPhone !== c.customerPhone) {
      c.customerId = upsertCustomerForContract(db, user, c.customerName, fields.customerPhone, fields.customerPhone2).id;
    }
    Object.assign(c, fields, { updatedAt: nowIso() });
    const changes = diffContract(db, before, c);
    if (changes.length) addHistory(c, user, '계약 수정', changes);
    saveDb(db);
    return contractView(c, user, db);
  },

  // 일정관리 화면에서 특정 회차의 날짜/시간/담당만 수정
  async updateSchedule(id, stepIndex, patch) {
    const { db, user } = await authorize('schedule.edit');
    const c = findContract(db, user, id);
    if (!c.schedules[stepIndex]) throw new ApiError('일정을 찾을 수 없습니다.', 'NOT_FOUND');
    const before = clone(c);
    const input = c.schedules.map((s, i) => (i === stepIndex ? { ...s, ...patch } : s));
    const next = normalizeSchedules(db, user, input, c.schedules);
    assertSchedulesAssignable(db, user, next, c.schedules, c.id);
    c.schedules = next;
    c.updatedAt = nowIso();
    const changes = diffContract(db, before, c);
    if (changes.length) addHistory(c, user, '일정 변경', changes);
    saveDb(db);
    return contractView(c, user, db);
  },

  // 목록에서 선택 승인/미승인
  async setApproval(ids, approval) {
    const { db, user } = await authorize('contract.approve');
    if (!APPROVAL_STATUS.includes(approval)) throw new ApiError('승인 상태를 선택해 주세요.');
    ids.forEach((id) => {
      const c = findContract(db, user, id);
      if (c.approval === approval) return;
      addHistory(c, user, '계약 승인 변경', [{ label: '계약승인', from: c.approval, to: approval }]);
      c.approval = approval;
      c.updatedAt = nowIso();
    });
    saveDb(db);
  },

  async moveToTrash(ids) {
    const { db, user } = await authorize('contract.delete');
    ids.forEach((id) => {
      const c = findContract(db, user, id);
      c.deletedAt = nowIso();
      addHistory(c, user, '휴지통으로 이동');
    });
    saveDb(db);
  },

  async restore(ids) {
    const { db, user } = await authorize('contract.delete');
    ids.forEach((id) => {
      const c = findContract(db, user, id);
      c.deletedAt = null;
      addHistory(c, user, '휴지통에서 복구');
    });
    saveDb(db);
  },

  async purge(ids) {
    const { db, user } = await authorize('contract.delete');
    const set = new Set(ids.map(Number));
    const purgeIds = new Set(visibleContracts(db, user).filter((c) => set.has(c.id) && c.deletedAt).map((c) => c.id));
    db.contracts = db.contracts.filter((c) => !purgeIds.has(c.id));
    saveDb(db);
  },

  // POST /api/contracts/:id/esign  → 고객에게 서명 링크 발송
  async requestSign(id) {
    const { db, user } = await authorize('esign.send');
    const c = findContract(db, user, id);
    if (c.deletedAt) throw new ApiError('휴지통에 있는 계약입니다.');
    if (c.esign?.status === ESIGN_STATUS.SIGNED) throw new ApiError('이미 서명이 완료된 계약입니다.');
    const token = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    c.esign = { ...c.esign, status: ESIGN_STATUS.WAITING, token, requestedAt: nowIso(), requestedBy: user.id };
    c.updatedAt = nowIso();
    addHistory(c, user, '전자서명 요청');
    saveDb(db);
    return { token, url: `${publicBaseUrl()}#/sign/${token}` };
  },
};

// ============================================================
// 전자서명 / 고객 모바일웹 (로그인 불필요)   GET/POST /api/esign/:token
// ============================================================

export const esign = {
  async getByToken(token) {
    const db = await loadDb();
    const c = db.contracts.find((x) => x.esign?.token === token && !x.deletedAt);
    if (!c) throw new ApiError('유효하지 않거나 만료된 서명 링크입니다.', 'NOT_FOUND');
    const company = db.companies.find((x) => x.id === c.companyId);
    const view = clone(c);
    delete view.esign.signature;
    delete view.history;
    delete view.memo; // 내부 메모는 고객에게 노출하지 않음
    delete view.happyCallMemo;
    return { contract: view, company: { name: company.name, ceo: company.ceo, bizNo: company.bizNo, address: company.address } };
  },

  async sign(token, { signerName, signature, agreed }) {
    const db = await loadDb();
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
      ...(await clientInfo()), // 서명 증빙: 접속 기기(서버에서는 IP 포함)
    };
    c.updatedAt = nowIso();
    addHistory(c, { id: null, name: `고객(${signerName.trim()})`, role: 'CUSTOMER' }, '전자서명 완료');
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
