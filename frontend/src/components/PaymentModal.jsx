import React, { useState } from 'react';
import { PAYMENT_KINDS, PAYMENT_METHODS, RECEIPT_TYPES } from '../constants.js';
import { today } from '../utils/date.js';
import { backdrop } from '../utils/backdrop.js';
import { compressImage } from '../utils/image.js';
import { contracts as contractApi } from '../api/index.js';

// 입금 등록/수정 창 (계약 상세 > 입금등록)
export default function PaymentModal({ contract, payment, onSave, onClose }) {
  const [form, setForm] = useState(() =>
    payment
      ? { ...payment }
      : {
          date: today(),
          kind: (contract.payments || []).some((p) => p.kind === '계약금') ? '잔금' : '계약금',
          method: '계좌이체',
          amount: '',
          payerName: contract.customerName,
          approvalNo: '',
          bankOrCard: '',
          cardLast4: '',
          receipt: '미발행',
          memo: '',
        },
  );
  const [saving, setSaving] = useState(false);
  // 영수증 사진: receiptImage — 새로 고른 사진(data URL) / null(삭제) / undefined(그대로)
  const [receiptImage, setReceiptImage] = useState(undefined);
  const [preview, setPreview] = useState(null);
  const hasSaved = !!payment?.hasReceipt && receiptImage === undefined;
  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const pickReceipt = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = await compressImage(file);
      setReceiptImage(data);
      setPreview(data);
    } catch (err) {
      alert(err.message);
    }
  };
  const showSaved = async () => {
    try {
      const r = await contractApi.receipt(contract.id, payment.id);
      setPreview(r.image);
    } catch (err) {
      alert(err.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form, receiptImage });
    } finally {
      setSaving(false);
    }
  };

  const isCard = form.method === '카드';

  return (
    <div className="modal-overlay" {...backdrop(onClose)}>
      <div className="customer-reg-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-top-bar">
          <h3>
            &gt; {payment ? '입금 수정' : '입금 등록'} — {contract.category} ({contract.customerName})
          </h3>
          <button type="button" className="modal-close-x" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={submit} className="reg-table-form">
          <table className="form-grid-table">
            <tbody>
              <tr>
                <td className="label-col">입금일 / 항목<span className="star">*</span></td>
                <td className="input-col inline-fields">
                  <input type="date" className="input-text" value={form.date} onChange={(e) => set('date', e.target.value)} required />
                  <select className="input-text" value={form.kind} onChange={(e) => set('kind', e.target.value)}>
                    {PAYMENT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  {form.kind === '환불' && <span className="text-red sub-text">고객에게 돌려준 금액으로 기록됩니다.</span>}
                </td>
              </tr>
              <tr>
                <td className="label-col">결제수단 / 금액<span className="star">*</span></td>
                <td className="input-col inline-fields">
                  <select className="input-text" value={form.method} onChange={(e) => set('method', e.target.value)}>
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input type="number" min="1" className="input-text money" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="금액" required /> 원
                </td>
              </tr>
              <tr>
                <td className="label-col">입금자명</td>
                <td className="input-col">
                  <input className="input-text" value={form.payerName} onChange={(e) => set('payerName', e.target.value)} />
                </td>
              </tr>
              <tr>
                <td className="label-col">{isCard ? '카드사' : '은행명'}</td>
                <td className="input-col inline-fields">
                  <input className="input-text" value={form.bankOrCard} onChange={(e) => set('bankOrCard', e.target.value)} placeholder={isCard ? '예: 신한카드' : '예: 국민은행'} />
                  {isCard && (
                    <>
                      <input className="input-text" value={form.approvalNo} onChange={(e) => set('approvalNo', e.target.value)} placeholder="승인번호" />
                      <input
                        className="input-text"
                        style={{ width: 90 }}
                        value={form.cardLast4}
                        onChange={(e) => set('cardLast4', e.target.value.replace(/\D/g, '').slice(-4))}
                        placeholder="카드 끝 4자리"
                        inputMode="numeric"
                      />
                      <span className="sub-text">보안상 카드번호는 끝 4자리만 저장합니다.</span>
                    </>
                  )}
                </td>
              </tr>
              <tr>
                <td className="label-col">영수증</td>
                <td className="input-col">
                  <select className="input-text" value={form.receipt} onChange={(e) => set('receipt', e.target.value)}>
                    {RECEIPT_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
              </tr>
              <tr className={isCard ? 'receipt-row card' : 'receipt-row'}>
                <td className="label-col">영수증 사진</td>
                <td className="input-col">
                  <div className="inline-fields">
                    <label className="btn-file sm">
                      📷 {receiptImage || hasSaved ? '사진 바꾸기' : '사진 첨부'}
                      <input type="file" accept="image/*" onChange={pickReceipt} hidden />
                    </label>
                    {hasSaved && !preview && (
                      <button type="button" className="btn-link" onClick={showSaved}>첨부된 사진 보기</button>
                    )}
                    {(receiptImage || hasSaved) && (
                      <button
                        type="button"
                        className="btn-link text-red"
                        onClick={() => {
                          setReceiptImage(payment?.hasReceipt ? null : undefined);
                          setPreview(null);
                        }}
                      >
                        사진 삭제
                      </button>
                    )}
                    {receiptImage === null && <span className="sub-text">저장하면 사진이 삭제됩니다.</span>}
                  </div>
                  {preview && <img className="receipt-preview" src={preview} alt="영수증 사진" />}
                  <div className="sub-text">{isCard ? '카드 결제는 카드 영수증을 찍어 첨부해 두세요.' : '영수증·이체 확인 화면 등을 첨부할 수 있습니다.'}</div>
                </td>
              </tr>
              <tr>
                <td className="label-col">비고</td>
                <td className="input-col">
                  <input className="input-text full" value={form.memo} onChange={(e) => set('memo', e.target.value)} />
                </td>
              </tr>
            </tbody>
          </table>
          <div className="form-bottom-btns">
            <button type="submit" className="btn-dark-lg" disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
            <button type="button" className="btn-dark-lg cancel" onClick={onClose}>취소</button>
          </div>
        </form>
      </div>
    </div>
  );
}
