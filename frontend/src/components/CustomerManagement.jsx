import React, { useCallback, useEffect, useState } from 'react';
import { customers as customerApi } from '../api/index.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { formatPhone, isValidPhone } from '../utils/format.js';
import { downloadExcel } from '../utils/excel.js';
import Pagination from './Pagination.jsx';
import { navigate } from '../router.js';

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  id: null,
  userType: '개인',
  name: '',
  phone1: '',
  phone2: '',
  email: '',
  zipcode: '',
  address1: '',
  address2: '',
};

export default function CustomerManagement({ route }) {
  const openNew = route?.query.get('new') === '1';
  const { can, handleError } = useAuth();
  const canEdit = can('customer.edit');
  const [list, setList] = useState([]);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null); // null=모달 닫힘
  const [duplicates, setDuplicates] = useState([]);

  const load = useCallback(async () => {
    try {
      setList(await customerApi.list(appliedQuery));
    } catch (e) {
      handleError(e);
    }
  }, [appliedQuery, handleError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (openNew) {
      if (canEdit) setForm({ ...EMPTY_FORM });
      navigate('/customers', { replace: true }); // 새로고침 시 다시 열리지 않도록 주소 정리
    }
  }, [openNew]); // eslint-disable-line react-hooks/exhaustive-deps

  // 연락처① 입력 시 기존 계약자 중복 확인
  useEffect(() => {
    if (!form || !isValidPhone(form.phone1)) {
      setDuplicates([]);
      return;
    }
    customerApi
      .findByPhone(form.phone1)
      .then((found) => setDuplicates(found.filter((c) => c.id !== form.id)))
      .catch(() => setDuplicates([]));
  }, [form?.phone1, form?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e) => {
    e.preventDefault();
    setAppliedQuery(query);
    setPage(1);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: name.startsWith('phone') ? formatPhone(value) : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidPhone(form.phone1)) {
      alert('연락처①을 올바르게 입력해 주세요. (예: 010-1234-5678)');
      return;
    }
    if (form.phone2 && !isValidPhone(form.phone2)) {
      alert('연락처②를 올바르게 입력해 주세요.');
      return;
    }
    if (duplicates.length && !window.confirm('같은 연락처로 등록된 계약자가 있습니다. 그래도 저장하시겠습니까?')) return;
    try {
      await customerApi.save(form);
      alert(form.id ? '수정되었습니다.' : '계약자가 등록되었습니다.');
      setForm(null);
      load();
    } catch (err) {
      handleError(err);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`[${item.name}] 계약자를 삭제하시겠습니까?`)) return;
    try {
      await customerApi.remove(item.id);
      load();
    } catch (err) {
      handleError(err);
    }
  };

  const handleExport = () =>
    downloadExcel(
      list.map((c) => ({
        번호: c.id,
        유형: c.userType,
        이름: c.name,
        연락처1: c.phone1,
        연락처2: c.phone2,
        이메일: c.email,
        주소: `${c.address1} ${c.address2}`.trim(),
        계약건수: c.contractCount,
      })),
      '계약자목록',
      '계약자관리',
    );

  const pageRows = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="page-card">
      <div className="page-header">
        <h2>계약자 관리</h2>
        <ul className="notice-list">
          <li>계약을 등록하기 위한 계약자 기본정보를 관리하는 리스트입니다.</li>
          <li>계약 등록 시 입력한 고객은 연락처 기준으로 자동 등록/연결됩니다.</li>
        </ul>
      </div>

      <div className="customer-action-bar">
        <form className="search-box" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="이름 또는 연락처 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="customer-search-input"
          />
          <button type="submit" className="btn-search-icon">
            🔍
          </button>
        </form>
        {canEdit && (
          <button type="button" className="btn-add-customer" onClick={() => setForm({ ...EMPTY_FORM })}>
            + 등록하기
          </button>
        )}
        {can('excel.export') && (
          <button type="button" className="btn-add-customer" onClick={handleExport}>
            📄 엑셀다운로드
          </button>
        )}
        <span className="sub-text" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
          총 {list.length}명
        </span>
      </div>

      <div className="table-responsive">
        <table className="customer-table">
          <thead>
            <tr>
              <th>번호</th>
              <th>유형</th>
              <th>이름</th>
              <th>연락처 ①</th>
              <th>연락처 ②</th>
              <th>이메일</th>
              <th>주소</th>
              <th>계약</th>
              {canEdit && <th>관리</th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 9 : 8} className="no-data">
                  {appliedQuery ? '검색 결과가 없습니다.' : '등록된 계약자가 없습니다.'}
                </td>
              </tr>
            ) : (
              pageRows.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.userType}</td>
                  <td className="text-left bold-text">{item.name}</td>
                  <td>{item.phone1}</td>
                  <td>{item.phone2 || '-'}</td>
                  <td>{item.email || '-'}</td>
                  <td className="text-left">{item.address1 ? `${item.address1} ${item.address2}` : '-'}</td>
                  <td>{item.contractCount}건</td>
                  {canEdit && (
                    <td>
                      <div className="table-action-btns">
                        <button type="button" className="btn-edit-icon" title="수정" onClick={() => setForm({ ...EMPTY_FORM, ...item })}>
                          ✏️
                        </button>
                        <button type="button" className="btn-delete-icon" title="삭제" onClick={() => handleDelete(item)}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={list.length} pageSize={PAGE_SIZE} onChange={setPage} />

      {form && (
        <div className="modal-overlay" onMouseDown={() => setForm(null)}>
          <div className="customer-reg-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-top-bar">
              <h3>&gt; 계약자 {form.id ? '수정' : '등록'}</h3>
              <button type="button" className="modal-close-x" onClick={() => setForm(null)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="reg-table-form">
              <table className="form-grid-table">
                <tbody>
                  <tr>
                    <td className="label-col">유형분류</td>
                    <td className="input-col">
                      {['개인', '기업'].map((t) => (
                        <label key={t} className="radio-item">
                          <input type="radio" name="userType" value={t} checked={form.userType === t} onChange={handleChange} />
                          {t}
                        </label>
                      ))}
                    </td>
                  </tr>
                  <tr>
                    <td className="label-col">
                      이름<span className="star">*</span>
                    </td>
                    <td className="input-col">
                      <input type="text" name="name" value={form.name} onChange={handleChange} className="input-text name-input" required />
                    </td>
                  </tr>
                  <tr>
                    <td className="label-col">
                      연락처 ①<span className="star">*</span>
                    </td>
                    <td className="input-col">
                      <input type="tel" name="phone1" value={form.phone1} onChange={handleChange} className="input-text" placeholder="010-0000-0000" required />
                      {duplicates.length > 0 && (
                        <div className="warn-box">
                          ⓘ 같은 연락처로 등록된 계약자: {duplicates.map((d) => `${d.name}(No.${d.id})`).join(', ')}
                        </div>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="label-col">연락처 ②</td>
                    <td className="input-col">
                      <input type="tel" name="phone2" value={form.phone2} onChange={handleChange} className="input-text" placeholder="010-0000-0000" />
                    </td>
                  </tr>
                  <tr>
                    <td className="label-col">이메일</td>
                    <td className="input-col">
                      <input type="email" name="email" value={form.email} onChange={handleChange} className="input-text addr-input" />
                    </td>
                  </tr>
                  <tr>
                    <td className="label-col">주소</td>
                    <td className="input-col inline-fields">
                      <input type="text" name="zipcode" value={form.zipcode} onChange={handleChange} className="input-text" placeholder="우편번호" style={{ width: 90 }} />
                      <input type="text" name="address1" value={form.address1} onChange={handleChange} className="input-text addr-input" placeholder="주소" />
                      <input type="text" name="address2" value={form.address2} onChange={handleChange} className="input-text addr-input" placeholder="상세주소" />
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="form-bottom-btns">
                <button type="submit" className="btn-dark-lg">
                  {form.id ? '수정완료' : '등록확인'}
                </button>
                <button type="button" className="btn-dark-lg cancel" onClick={() => setForm(null)}>
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
