import React, { useCallback, useEffect, useState } from 'react';
import { apartments, engineers, products, scheduleSettings, teams } from '../../api/index.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { CATEGORIES, DEFAULT_SCHEDULE_SETTINGS } from '../../constants.js';
import { formatPhone, won } from '../../utils/format.js';
import Pagination from '../../components/Pagination.jsx';
import { backdrop } from '../../utils/backdrop.js';
import { match, navigateForward } from '../../router.js';
import EngineerForm from './EngineerForm.jsx';

export const PRODUCT_KINDS = ['패키지', '추가시공품목', '무료시공'];

const PAGE_SIZE = 20;

// ------------------------------------------------------------
// 설정 > 기초코드 공통 화면 (목록 + 검색 + 등록/수정 모달)
//   columns: [{ key, label, render?, className? }]
//   fields:  [{ key, label, type: text|select|textarea|number|checkbox|tel, options?, required? }]
//   filters: [{ key, placeholder, options }]  → 드롭다운 필터
// ------------------------------------------------------------
//   onAdd/onEdit: 주면 팝업 대신 별도 화면으로 이동 (기사관리)
function MasterPage({ title, notices, api, columns, fields, filters = [], searchKeys, emptyForm, removeConfirm, onAdd, onEdit }) {
  const { handleError } = useAuth();
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState('');
  const [filterValues, setFilterValues] = useState({});
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null);

  const load = useCallback(() => api.list({ includeInactive: true }).then(setRows).catch(handleError), [api, handleError]);
  useEffect(() => {
    load();
  }, [load]);

  // 번호: 업체 안에서 등록 순서대로 1, 2, 3 … (목록은 최신 번호가 위)
  const seq = new Map([...rows].sort((a, b) => a.id - b.id).map((r, i) => [r.id, i + 1]));
  const filtered = [...rows].sort((a, b) => b.id - a.id).filter(
    (r) =>
      (!applied || searchKeys.some((k) => String(r[k] ?? '').includes(applied))) &&
      filters.every((f) => !filterValues[f.key] || (f.match ? f.match(r, filterValues[f.key]) : String(r[f.key]) === filterValues[f.key])),
  );
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.save(form);
      setForm(null);
      load();
    } catch (err) {
      handleError(err);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(removeConfirm ? removeConfirm(row) : `[${row.name}] 을(를) 삭제하시겠습니까?`)) return;
    try {
      await api.remove(row.id);
      load();
    } catch (err) {
      handleError(err);
    }
  };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const renderField = (f) => {
    const value = form[f.key] ?? '';
    switch (f.type) {
      case 'select':
        return (
          <select className="input-text" value={value} onChange={(e) => setField(f.key, e.target.value)}>
            {f.options.map((o) => (
              <option key={o.value ?? o} value={o.value ?? o}>
                {o.label ?? o}
              </option>
            ))}
          </select>
        );
      case 'textarea':
        return <textarea className="input-text full" rows={3} value={value} onChange={(e) => setField(f.key, e.target.value)} />;
      case 'checkbox':
        return (
          <label className="radio-item">
            <input type="checkbox" checked={value !== false} onChange={(e) => setField(f.key, e.target.checked)} /> {f.checkLabel}
          </label>
        );
      case 'password':
        return (
          <input
            type="password"
            className="input-text"
            value={value}
            autoComplete="new-password"
            placeholder={form.id && form.hasPassword ? '변경할 때만 입력' : ''}
            onChange={(e) => setField(f.key, e.target.value)}
          />
        );
      case 'tel':
        return <input type="tel" className="input-text" value={value} onChange={(e) => setField(f.key, formatPhone(e.target.value))} placeholder="010-0000-0000" required={f.required} />;
      default:
        return (
          <input
            type={f.type || 'text'}
            className={`input-text ${f.wide ? 'full' : ''}`}
            value={value}
            min={f.type === 'number' ? 0 : undefined}
            onChange={(e) => setField(f.key, e.target.value)}
            required={f.required}
          />
        );
    }
  };

  return (
    <div className="page-card">
      <div className="page-header">
        <h2>{title}</h2>
        <ul className="notice-list">
          {notices.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>

      <div className="customer-action-bar">
        {filters.map((f) => (
          <select
            key={f.key}
            className="input-select"
            value={filterValues[f.key] || ''}
            onChange={(e) => {
              setFilterValues({ ...filterValues, [f.key]: e.target.value });
              setPage(1);
            }}
          >
            <option value="">{f.placeholder}</option>
            {f.options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ))}
        <form
          className="search-box"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(query.trim());
            setPage(1);
          }}
        >
          <input className="customer-search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="검색어" />
          <button type="submit" className="btn-search-icon">🔍</button>
        </form>
        <button type="button" className="btn-add-customer" onClick={() => (onAdd ? onAdd() : setForm({ ...emptyForm }))}>
          + 등록하기
        </button>
        <span className="sub-text" style={{ marginLeft: 'auto', alignSelf: 'center' }}>총 {filtered.length}건</span>
      </div>

      <div className="table-responsive">
        <table className="customer-table">
          <thead>
            <tr>
              <th>번호</th>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="no-data">등록된 항목이 없습니다.</td>
              </tr>
            )}
            {pageRows.map((r) => (
              <tr
                key={r.id}
                className={`${r.active === false ? 'inactive-row' : ''} ${onEdit ? 'clickable-row' : ''}`}
                onClick={onEdit ? (e) => !e.target.closest('button') && onEdit(r) : undefined}
              >
                <td>{seq.get(r.id)}</td>
                {columns.map((c) => (
                  <td key={c.key} className={c.className || ''}>
                    {c.render ? c.render(r) : r[c.key] || '-'}
                  </td>
                ))}
                <td>
                  <div className="table-action-btns">
                    <button type="button" className="btn-edit-icon" title="수정" onClick={() => (onEdit ? onEdit(r) : setForm({ ...r }))}>✏️</button>
                    <button type="button" className="btn-delete-icon" title="삭제" onClick={() => remove(r)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />

      {form && (
        <div className="modal-overlay" {...backdrop(() => setForm(null))}>
          <div className="customer-reg-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-top-bar">
              <h3>&gt; {title} {form.id ? '수정' : '등록'}</h3>
              <button type="button" className="modal-close-x" onClick={() => setForm(null)}>&times;</button>
            </div>
            <form onSubmit={save} className="reg-table-form">
              <table className="form-grid-table">
                <tbody>
                  {fields.map((f) => (
                    <tr key={f.key}>
                      <td className="label-col">
                        {f.label}
                        {f.required && <span className="star">*</span>}
                      </td>
                      <td className="input-col">
                        {renderField(f)}
                        {f.help && <div className="sub-text">{f.help}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="form-bottom-btns">
                <button type="submit" className="btn-dark-lg">저장</button>
                <button type="button" className="btn-dark-lg cancel" onClick={() => setForm(null)}>취소</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function EngineerSettings({ path = '' }) {
  const [crewTeams, setCrewTeams] = useState([]);
  useEffect(() => {
    teams.list().then((t) => setCrewTeams(t.filter((x) => x.kind === '시공팀'))).catch(() => {});
  }, []);
  // /settings/engineers/new, /settings/engineers/:id → 기사 등록/수정 화면
  if (match('/settings/engineers/new', path)) return <EngineerForm />;
  const edit = match('/settings/engineers/:id', path);
  if (edit) return <EngineerForm key={edit.id} engineerId={edit.id} />;

  const teamName = (id) => crewTeams.find((t) => t.id === id)?.name || '-';
  return (
    <MasterPage
      title="기사 관리"
      notices={[
        '시공을 진행하는 기사 정보를 등록하는 페이지입니다. 계약 등록/일정관리에서 기사를 배정할 때 사용됩니다.',
        "아이디와 비밀번호를 등록하면 기사가 같은 로그인 화면에서 '기사모바일'(내 일정 확인, 시공상태 보고, 휴무 설정)을 사용할 수 있습니다.",
        '기사를 누르면 정보 수정과 휴무일 관리(달력)를 할 수 있습니다. 주소는 시공 현장과의 거리 확인에 사용됩니다.',
        '계약에 배정된 적이 있는 기사는 삭제 시 기록 보존을 위해 “미사용” 처리됩니다.',
      ]}
      api={engineers}
      searchKeys={['name', 'phone', 'loginId', 'address']}
      filters={[{ key: 'category', placeholder: '담당시공', options: CATEGORIES, match: (r, v) => (r.categories || []).includes(v) }]}
      removeConfirm={(r) => `[${r.name}] 기사를 삭제하시겠습니까?\n(배정 이력이 있으면 미사용 처리됩니다)`}
      onAdd={() => navigateForward('/settings/engineers/new')}
      onEdit={(r) => navigateForward(`/settings/engineers/${r.id}`)}
      columns={[
        { key: 'name', label: '이름', className: 'text-left bold-text' },
        { key: 'category', label: '담당시공' },
        { key: 'teamId', label: '소속팀', render: (r) => (r.teamId ? teamName(r.teamId) : '-') },
        { key: 'loginId', label: '아이디' },
        { key: 'hasPassword', label: '모바일 로그인', render: (r) => (r.loginId && r.hasPassword ? '가능' : <span className="sub-text">미설정</span>) },
        { key: 'phone', label: '연락처' },
        { key: 'address', label: '주소', className: 'text-left', render: (r) => [r.address, r.addressDetail].filter(Boolean).join(' ') || '-' },
        { key: 'active', label: '사용', render: (r) => (r.active === false ? <span className="text-red">미사용</span> : '사용') },
      ]}
      fields={[]}
    />
  );
}

export function TeamSettings() {
  return (
    <MasterPage
      title="팀 관리"
      notices={[
        '부서(상담팀/박람회팀 등)와 시공팀(스마일팀 등)을 관리합니다.',
        '부서는 사용자관리에서 직원에게, 시공팀은 기사관리에서 기사에게 지정하며 계약서의 [팀배정]에 사용됩니다.',
      ]}
      api={teams}
      searchKeys={['name', 'description']}
      emptyForm={{ name: '', kind: '부서', description: '' }}
      removeConfirm={(r) => `[${r.name}] 팀을 삭제하시겠습니까?\n소속된 사용자는 '팀 없음'으로 변경됩니다.`}
      columns={[
        { key: 'name', label: '팀명', className: 'bold-text' },
        { key: 'kind', label: '종류' },
        { key: 'description', label: '설명', className: 'text-left' },
      ]}
      fields={[
        { key: 'name', label: '팀명', required: true },
        { key: 'kind', label: '종류', type: 'select', options: ['부서', '시공팀'], help: "시공팀은 계약서 '팀배정'과 기사 소속팀에 사용됩니다." },
        { key: 'description', label: '설명', wide: true },
      ]}
    />
  );
}

export function ProductSettings() {
  return (
    <MasterPage
      title="상품관리"
      notices={[
        '계약서 등록 시 사용되는 상품코드 관리 페이지입니다.',
        '상품을 미리 등록해 두면 계약 등록 시 [상품선택]으로 시공내용과 금액이 자동 입력됩니다.',
      ]}
      api={products}
      searchKeys={['name', 'detail']}
      filters={[
        { key: 'category', placeholder: '품목', options: CATEGORIES },
        { key: 'kind', placeholder: '구분', options: PRODUCT_KINDS },
      ]}
      emptyForm={{ name: '', kind: PRODUCT_KINDS[0], category: CATEGORIES[0], detail: '', price: '', visible: true }}
      columns={[
        { key: 'name', label: '상품명', className: 'text-left' },
        { key: 'kind', label: '구분' },
        { key: 'category', label: '품목' },
        { key: 'detail', label: '상세품목', className: 'text-left' },
        { key: 'price', label: '금액', className: 'text-right', render: (r) => won(r.price) },
        { key: 'visible', label: '노출여부', render: (r) => (r.visible === false ? 'N' : 'Y') },
      ]}
      fields={[
        { key: 'name', label: '상품명', required: true, wide: true },
        { key: 'kind', label: '구분', type: 'select', options: PRODUCT_KINDS },
        { key: 'category', label: '품목', type: 'select', options: CATEGORIES },
        { key: 'detail', label: '상세품목', type: 'textarea' },
        { key: 'price', label: '금액', type: 'number' },
        { key: 'visible', label: '노출여부', type: 'checkbox', checkLabel: '계약 등록 시 상품목록에 노출' },
      ]}
    />
  );
}

export function ApartmentSettings() {
  return (
    <MasterPage
      title="아파트 관리"
      notices={['계약 등록 시 사용되는 아파트 기초코드입니다. 계약서 등록 시 아파트명 자동완성에 사용됩니다.']}
      api={apartments}
      searchKeys={['name', 'sido', 'sigungu']}
      emptyForm={{ sido: '', sigungu: '', name: '' }}
      columns={[
        { key: 'region', label: '지역', className: 'text-left', render: (r) => [r.sido, r.sigungu].filter(Boolean).join(' / ') || '-' },
        { key: 'name', label: '아파트', className: 'text-left' },
      ]}
      fields={[
        { key: 'sido', label: '시/도', help: '예) 서울특별시, 경기도' },
        { key: 'sigungu', label: '시/군/구', help: '예) 강서구, 하남시' },
        { key: 'name', label: '아파트명', required: true, wide: true },
      ]}
    />
  );
}

export function ScheduleSettings() {
  const { handleError, refresh } = useAuth();
  const [form, setForm] = useState(null);

  useEffect(() => {
    scheduleSettings.get().then(setForm).catch(handleError);
  }, [handleError]);

  if (!form) return <div className="page-card page-loading">불러오는 중...</div>;

  const save = async (e) => {
    e.preventDefault();
    try {
      await scheduleSettings.save(form);
      await refresh(); // 다른 화면의 시간 선택 목록에 바로 반영
      alert('저장되었습니다.');
    } catch (err) {
      handleError(err);
    }
  };

  const f = (key, props = {}) => (
    <input className="input-text" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
  );

  return (
    <div className="page-card">
      <div className="page-header">
        <h2>일정관리설정</h2>
        <ul className="notice-list">
          <li>계약서/일정관리의 시간 선택 목록과 기사 휴무(오전/오후) 판단 기준을 설정합니다.</li>
          <li>기사 1인 하루 최대 배정 건수를 정하면 초과 배정이 차단됩니다. (0 = 제한 없음)</li>
        </ul>
      </div>
      <form onSubmit={save}>
        <table className="form-grid-table narrow-table">
          <tbody>
            <tr>
              <td className="label-col">오전/오후 기준</td>
              <td className="input-col">
                {f('amEnd', { type: 'time' })} 이전 시작 = 오전, 이후 = 오후
              </td>
            </tr>
            <tr>
              <td className="label-col">시간 선택 범위</td>
              <td className="input-col inline-fields">
                {f('startTime', { type: 'time' })} ~ {f('endTime', { type: 'time' })}
              </td>
            </tr>
            <tr>
              <td className="label-col">시간 간격</td>
              <td className="input-col">
                <select className="input-text" value={form.interval} onChange={(e) => setForm({ ...form, interval: Number(e.target.value) })}>
                  {[10, 15, 20, 30, 60].map((m) => <option key={m} value={m}>{m}분</option>)}
                </select>
              </td>
            </tr>
            <tr>
              <td className="label-col">하루 최대 배정</td>
              <td className="input-col">
                {f('maxPerDay', { type: 'number', min: 0, style: { width: 80 } })} 건 / 기사 1인
              </td>
            </tr>
          </tbody>
        </table>
        <div className="form-bottom-btns">
          <button type="submit" className="btn-dark-lg">저장</button>
          <button type="button" className="btn-dark-lg cancel" onClick={() => setForm({ ...DEFAULT_SCHEDULE_SETTINGS })}>기본값으로</button>
        </div>
      </form>
    </div>
  );
}
