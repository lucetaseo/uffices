import React, { useCallback, useEffect, useState } from 'react';
import { apartments, engineers, products, teams } from '../../api/index.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { CATEGORIES } from '../../constants.js';
import { formatPhone, won } from '../../utils/format.js';
import Pagination from '../../components/Pagination.jsx';

export const PRODUCT_KINDS = ['패키지', '추가시공품목', '무료시공'];

const PAGE_SIZE = 20;

// ------------------------------------------------------------
// 설정 > 기초코드 공통 화면 (목록 + 검색 + 등록/수정 모달)
//   columns: [{ key, label, render?, className? }]
//   fields:  [{ key, label, type: text|select|textarea|number|checkbox|tel, options?, required? }]
//   filters: [{ key, placeholder, options }]  → 드롭다운 필터
// ------------------------------------------------------------
function MasterPage({ title, notices, api, columns, fields, filters = [], searchKeys, emptyForm, removeConfirm }) {
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

  const filtered = rows.filter(
    (r) =>
      (!applied || searchKeys.some((k) => String(r[k] ?? '').includes(applied))) &&
      filters.every((f) => !filterValues[f.key] || String(r[f.key]) === filterValues[f.key]),
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
        <button type="button" className="btn-add-customer" onClick={() => setForm({ ...emptyForm })}>
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
              <tr key={r.id} className={r.active === false ? 'inactive-row' : ''}>
                <td>{r.id}</td>
                {columns.map((c) => (
                  <td key={c.key} className={c.className || ''}>
                    {c.render ? c.render(r) : r[c.key] || '-'}
                  </td>
                ))}
                <td>
                  <div className="table-action-btns">
                    <button type="button" className="btn-edit-icon" title="수정" onClick={() => setForm({ ...r })}>✏️</button>
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
        <div className="modal-overlay" onMouseDown={() => setForm(null)}>
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

export function EngineerSettings() {
  return (
    <MasterPage
      title="기사 관리"
      notices={[
        '시공을 진행하는 기사 정보를 등록하는 페이지입니다. 계약 등록/일정관리에서 기사를 배정할 때 사용됩니다.',
        '아이디는 추후 기사 전용 모바일 페이지(기사모바일) 로그인에 사용됩니다.',
        '계약에 배정된 적이 있는 기사는 삭제 시 기록 보존을 위해 “미사용” 처리됩니다.',
      ]}
      api={engineers}
      searchKeys={['name', 'phone', 'loginId']}
      filters={[{ key: 'category', placeholder: '품목', options: CATEGORIES }]}
      emptyForm={{ name: '', category: CATEGORIES[0], phone: '', loginId: '', email: '', address: '', memo: '', active: true }}
      removeConfirm={(r) => `[${r.name}] 기사를 삭제하시겠습니까?\n(배정 이력이 있으면 미사용 처리됩니다)`}
      columns={[
        { key: 'name', label: '이름', className: 'text-left bold-text' },
        { key: 'category', label: '품목' },
        { key: 'loginId', label: '아이디' },
        { key: 'phone', label: '연락처' },
        { key: 'email', label: '이메일' },
        { key: 'address', label: '주소', className: 'text-left' },
        { key: 'active', label: '사용', render: (r) => (r.active === false ? <span className="text-red">미사용</span> : '사용') },
      ]}
      fields={[
        { key: 'name', label: '이름', required: true },
        { key: 'category', label: '품목', type: 'select', options: CATEGORIES },
        { key: 'phone', label: '연락처', type: 'tel', required: true },
        { key: 'loginId', label: '아이디', help: '기사모바일 로그인용 (선택)' },
        { key: 'email', label: '이메일', type: 'email' },
        { key: 'address', label: '주소', wide: true },
        { key: 'memo', label: '메모', type: 'textarea' },
        { key: 'active', label: '사용여부', type: 'checkbox', checkLabel: '사용 (해제 시 배정 목록에서 제외)' },
      ]}
    />
  );
}

export function TeamSettings() {
  return (
    <MasterPage
      title="팀 관리"
      notices={['상담팀/박람회팀/시공팀 등 부서를 관리합니다.', '사용자관리에서 계정마다 팀과 직책을 지정할 수 있습니다.']}
      api={teams}
      searchKeys={['name', 'description']}
      emptyForm={{ name: '', description: '' }}
      removeConfirm={(r) => `[${r.name}] 팀을 삭제하시겠습니까?\n소속된 사용자는 '팀 없음'으로 변경됩니다.`}
      columns={[
        { key: 'name', label: '팀명', className: 'bold-text' },
        { key: 'description', label: '설명', className: 'text-left' },
      ]}
      fields={[
        { key: 'name', label: '팀명', required: true },
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
  return (
    <div className="page-card">
      <h2>일정관리설정</h2>
      <p className="sub-text">
        이 화면은 참고 화면을 받은 뒤 구현할 예정입니다. (예: 기사별 휴무 등록, 하루 최대 배정 건수, 오전/오후 시간대 구분)
      </p>
    </div>
  );
}
