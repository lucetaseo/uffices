import React, { useEffect, useState } from 'react';
import { apartments as apartmentApi, contracts as contractApi, customers as customerApi, products as productApi } from '../api/index.js';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  BRANDS,
  CATEGORIES,
  MAX_SCHEDULE_STEPS,
  PAYMENT_METHODS,
  RECEPTION_TYPES,
  WORK_STATUS,
} from '../constants.js';
import { calcAmounts } from '../utils/contract.js';
import { today } from '../utils/date.js';
import { formatPhone, won } from '../utils/format.js';

const emptySchedule = () => ({ date: '', time: '', ampm: '', engineerId: '', memo: '' });

function initialForm(contract, company) {
  if (contract) {
    return {
      ...contract,
      schedules: contract.schedules.map((s) => ({ ...s, engineerId: s.engineerId ? String(s.engineerId) : '' })),
      payments: contract.payments.map((p) => ({ ...p })),
    };
  }
  return {
    brand: company?.brands?.[0] || BRANDS[0],
    receptionType: RECEPTION_TYPES[0],
    category: CATEGORIES[0],
    status: '미정',
    contractDate: today(),
    customerName: '',
    customerPhone: '',
    aptName: '',
    dong: '',
    ho: '',
    aptType: '',
    items: '',
    schedules: [emptySchedule()],
    totalAmount: '',
    discount: '',
    voucher: '',
    payments: [],
    memo: '',
  };
}

// 부모에서 조건부 렌더링({open && <ContractModal/>})하므로 열릴 때마다 폼이 초기화됩니다.
export default function ContractModal({ contract, engineers, onClose, onSaved }) {
  const { company, can, handleError } = useAuth();
  const showAmount = can('contract.amount');
  const isEdit = !!contract;
  const [form, setForm] = useState(() => initialForm(contract, company));
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState(null); // null=닫힘, 배열=검색결과
  const brands = company?.brands?.length ? company.brands : BRANDS;
  const [productList, setProductList] = useState([]);
  const [aptList, setAptList] = useState([]);

  useEffect(() => {
    productApi.list().then(setProductList).catch(() => {});
    apartmentApi.list().then(setAptList).catch(() => {});
  }, []);

  // 상품선택: 시공내용에 상세품목을 이어 붙이고 금액을 시공총액에 더함
  const addProduct = (id) => {
    const p = productList.find((x) => x.id === Number(id));
    if (!p) return;
    setForm((prev) => ({
      ...prev,
      category: prev.items ? prev.category : p.category,
      items: prev.items ? `${prev.items}\n${p.detail || p.name}` : p.detail || p.name,
      totalAmount: showAmount ? (Number(prev.totalAmount) || 0) + (Number(p.price) || 0) : prev.totalAmount,
    }));
  };

  const set = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));
  const handleChange = (e) => set(e.target.name, e.target.value);

  const setSchedule = (idx, name, value) =>
    setForm((prev) => ({
      ...prev,
      schedules: prev.schedules.map((s, i) => (i === idx ? { ...s, [name]: value } : s)),
    }));

  const setPayment = (idx, name, value) =>
    setForm((prev) => ({
      ...prev,
      payments: prev.payments.map((p, i) => (i === idx ? { ...p, [name]: value } : p)),
    }));

  const searchCustomer = async () => {
    const q = form.customerPhone || form.customerName;
    if (!q.trim()) {
      alert('고객 성함 또는 연락처를 입력한 후 검색해 주세요.');
      return;
    }
    try {
      setCustomerSearch(await customerApi.list(q));
    } catch (e) {
      handleError(e);
    }
  };

  const amounts = calcAmounts(form);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (showAmount && amounts.actual < 0) {
      alert('할인/상품권 금액이 시공총액보다 큽니다.');
      return;
    }
    setSaving(true);
    try {
      const saved = isEdit ? await contractApi.update(contract.id, form) : await contractApi.create(form);
      onSaved(saved, isEdit);
    } catch (err) {
      handleError(err);
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="customer-reg-modal wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-top-bar">
          <h3>&gt; 전자계약 {isEdit ? `수정 (No.${contract.no})` : '등록'}</h3>
          <button type="button" className="modal-close-x" onClick={onClose}>
            &times;
          </button>
        </div>

        {isEdit && contract.esign?.status === '서명완료' && (
          <p className="warn-box">⚠ 서명이 완료된 계약입니다. 시공내용이나 금액을 바꾸면 서명이 초기화되어 재서명이 필요합니다.</p>
        )}

        <form onSubmit={handleSubmit} className="reg-table-form">
          <table className="form-grid-table">
            <tbody>
              <tr>
                <td className="label-col">브랜드 <span className="star">*</span></td>
                <td className="input-col">
                  {brands.map((b) => (
                    <label key={b} className="radio-item">
                      <input type="radio" name="brand" value={b} checked={form.brand === b} onChange={handleChange} /> {b}
                    </label>
                  ))}
                </td>
              </tr>

              <tr>
                <td className="label-col">접수 / 구분 / 상태</td>
                <td className="input-col inline-fields">
                  <select name="receptionType" value={form.receptionType} onChange={handleChange} className="input-text">
                    {RECEPTION_TYPES.map((v) => <option key={v} value={v}>{v}접수</option>)}
                  </select>
                  <select name="category" value={form.category} onChange={handleChange} className="input-text">
                    {CATEGORIES.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <select name="status" value={form.status} onChange={handleChange} className="input-text">
                    {WORK_STATUS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  {form.status === '시공완료' && (
                    <label className="inline-label">
                      완료일 <input type="date" name="completedDate" value={form.completedDate || ''} onChange={handleChange} className="input-text" />
                    </label>
                  )}
                  {form.status === '취소' && (
                    <label className="inline-label">
                      취소일 <input type="date" name="canceledDate" value={form.canceledDate || ''} onChange={handleChange} className="input-text" />
                    </label>
                  )}
                </td>
              </tr>

              <tr>
                <td className="label-col">계약일 <span className="star">*</span></td>
                <td className="input-col">
                  <input type="date" name="contractDate" value={form.contractDate} onChange={handleChange} className="input-text" required />
                </td>
              </tr>

              <tr>
                <td className="label-col">고객 정보 <span className="star">*</span></td>
                <td className="input-col">
                  <div className="inline-fields">
                    <input type="text" name="customerName" value={form.customerName} onChange={handleChange} className="input-text" placeholder="고객 성함" style={{ width: 130 }} required />
                    <input
                      type="tel"
                      name="customerPhone"
                      value={form.customerPhone}
                      onChange={(e) => set('customerPhone', formatPhone(e.target.value))}
                      className="input-text"
                      placeholder="010-0000-0000"
                      style={{ width: 150 }}
                      required
                    />
                    {can('customer.view') && (
                      <button type="button" className="btn-dark-sm" onClick={searchCustomer}>
                        🔍 기존 계약자 검색
                      </button>
                    )}
                  </div>
                  {customerSearch && (
                    <div className="inline-search-result">
                      {customerSearch.length === 0 ? (
                        <p className="sub-text">일치하는 계약자가 없습니다. 저장 시 새 계약자로 자동 등록됩니다.</p>
                      ) : (
                        customerSearch.slice(0, 8).map((c) => (
                          <div key={c.id} className="search-result-row">
                            <span>
                              <strong>{c.name}</strong> {c.phone1} <span className="sub-text">(계약 {c.contractCount}건)</span>
                            </span>
                            <button
                              type="button"
                              className="btn-dark-sm"
                              onClick={() => {
                                setForm((prev) => ({ ...prev, customerName: c.name, customerPhone: c.phone1 }));
                                setCustomerSearch(null);
                              }}
                            >
                              선택
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </td>
              </tr>

              <tr>
                <td className="label-col">아파트 / 현장 <span className="star">*</span></td>
                <td className="input-col inline-fields">
                  <input type="text" name="aptName" value={form.aptName} onChange={handleChange} className="input-text addr-input" placeholder="아파트명 또는 현장명" list="apt-options" autoComplete="off" required />
                  <datalist id="apt-options">
                    {aptList.map((a) => (
                      <option key={a.id} value={a.name}>{[a.sido, a.sigungu].filter(Boolean).join(' ')}</option>
                    ))}
                  </datalist>
                  <input type="text" name="dong" value={form.dong} onChange={handleChange} className="input-text" placeholder="동" style={{ width: 60 }} />
                  <input type="text" name="ho" value={form.ho} onChange={handleChange} className="input-text" placeholder="호" style={{ width: 60 }} />
                  <input type="text" name="aptType" value={form.aptType} onChange={handleChange} className="input-text" placeholder="타입(84A)" style={{ width: 90 }} />
                </td>
              </tr>

              <tr>
                <td className="label-col">시공 내용</td>
                <td className="input-col">
                  {productList.length > 0 && (
                    <div className="inline-fields" style={{ marginBottom: 6 }}>
                      <select className="input-text" value="" onChange={(e) => addProduct(e.target.value)}>
                        <option value="">+ 상품선택 (선택 시 시공내용{showAmount ? '·금액' : ''} 자동 입력)</option>
                        {productList
                          .filter((p) => p.category === form.category || !form.items)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              [{p.category}/{p.kind}] {p.name}{showAmount ? ` — ${won(p.price)}원` : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  <textarea name="items" value={form.items} onChange={handleChange} className="input-text full" rows={2} placeholder="예) 욕실2개(빅라이언) + 현관 / 주방&욕실 실리콘 오염방지" />
                </td>
              </tr>

              <tr>
                <td className="label-col">시공일정 / 기사</td>
                <td className="input-col">
                  {form.schedules.map((s, i) => (
                    <div key={i} className="inline-fields schedule-row">
                      <span className="step-label">{i + 1}차</span>
                      <input type="date" value={s.date} onChange={(e) => setSchedule(i, 'date', e.target.value)} className="input-text" />
                      <input type="time" value={s.time} onChange={(e) => setSchedule(i, 'time', e.target.value)} className="input-text" />
                      <select value={s.engineerId} onChange={(e) => setSchedule(i, 'engineerId', e.target.value)} className="input-text">
                        <option value="">기사 미배정</option>
                        {s.engineerId && !engineers.some((en) => String(en.id) === String(s.engineerId)) && (
                          <option value={s.engineerId}>{s.engineerName || '기사'}(미사용)</option>
                        )}
                        {engineers.map((en) => (
                          <option key={en.id} value={en.id}>{en.name}({en.category})</option>
                        ))}
                      </select>
                      <input type="text" value={s.memo} onChange={(e) => setSchedule(i, 'memo', e.target.value)} className="input-text" placeholder="메모" style={{ width: 140 }} />
                      {form.schedules.length > 1 && (
                        <button type="button" className="btn-text-danger" onClick={() => set('schedules', form.schedules.filter((_, j) => j !== i))}>
                          삭제
                        </button>
                      )}
                    </div>
                  ))}
                  {form.schedules.length < MAX_SCHEDULE_STEPS && (
                    <button type="button" className="btn-dark-sm" onClick={() => set('schedules', [...form.schedules, emptySchedule()])}>
                      + 일정 추가
                    </button>
                  )}
                </td>
              </tr>

              {showAmount && (
                <>
                  <tr>
                    <td className="label-col">금액</td>
                    <td className="input-col inline-fields">
                      <label className="inline-label">
                        시공총액 <input type="number" min="0" name="totalAmount" value={form.totalAmount} onChange={handleChange} className="input-text money" />
                      </label>
                      <label className="inline-label">
                        할인 <input type="number" min="0" name="discount" value={form.discount} onChange={handleChange} className="input-text money" />
                      </label>
                      <label className="inline-label">
                        상품권 <input type="number" min="0" name="voucher" value={form.voucher} onChange={handleChange} className="input-text money" />
                      </label>
                      <span className="calc-result">
                        실계약금 <strong>{won(amounts.actual)}</strong>원
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="label-col">입금 내역</td>
                    <td className="input-col">
                      {form.payments.map((p, i) => (
                        <div key={i} className="inline-fields schedule-row">
                          <input type="date" value={p.date} onChange={(e) => setPayment(i, 'date', e.target.value)} className="input-text" />
                          <select value={p.method} onChange={(e) => setPayment(i, 'method', e.target.value)} className="input-text">
                            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <input type="number" min="0" value={p.amount} onChange={(e) => setPayment(i, 'amount', e.target.value)} className="input-text money" placeholder="금액" />
                          <button type="button" className="btn-text-danger" onClick={() => set('payments', form.payments.filter((_, j) => j !== i))}>
                            삭제
                          </button>
                        </div>
                      ))}
                      <div className="inline-fields">
                        <button
                          type="button"
                          className="btn-dark-sm"
                          onClick={() => set('payments', [...form.payments, { date: today(), method: PAYMENT_METHODS[0], amount: '' }])}
                        >
                          + 입금 추가
                        </button>
                        <span className="calc-result">
                          입금 <strong>{won(amounts.paid)}</strong>원 / 잔액{' '}
                          <strong className={amounts.balance > 0 ? 'text-red' : ''}>{won(amounts.balance)}</strong>원
                        </span>
                      </div>
                    </td>
                  </tr>
                </>
              )}

              <tr>
                <td className="label-col">메모</td>
                <td className="input-col">
                  <textarea name="memo" value={form.memo} onChange={handleChange} className="input-text full" rows={2} />
                </td>
              </tr>
            </tbody>
          </table>

          <div className="form-bottom-btns">
            <button type="submit" className="btn-dark-lg" disabled={saving}>
              {saving ? '저장 중...' : isEdit ? '수정완료' : '계약 등록완료'}
            </button>
            <button type="button" className="btn-dark-lg cancel" onClick={onClose}>
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
