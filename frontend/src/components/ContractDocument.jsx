import React from 'react';
import { calcAmounts, timeLabel } from '../utils/contract.js';
import { formatAddress, won } from '../utils/format.js';

// 계약 약관. 업체별 약관 관리는 '설정' 메뉴 확장 시 DB 로 옮길 예정입니다.
export const DEFAULT_TERMS = [
  '시공 일정은 고객과 협의하여 확정하며, 일정 변경은 시공 3일 전까지 요청해야 합니다.',
  '잔금은 시공 완료 후 당일 결제를 원칙으로 합니다.',
  '시공 후 하자 발생 시 보증기간 내 무상 A/S 를 제공합니다.',
  '고객 사정에 의한 계약 취소 시 계약금은 환불되지 않을 수 있습니다.',
];

// 계약서 본문. 내부 조회(ContractViewModal)와 고객 서명 페이지(SignPage)가 함께 사용합니다.
export default function ContractDocument({ contract, company, showAmount = true, showStatus = false }) {
  const a = calcAmounts(contract);
  const esign = contract.esign || {};
  return (
    <div className="contract-doc">
      <h2 className="doc-title">
        {contract.brand} {contract.category} {contract.workType && contract.workType !== '시공' ? `${contract.workType} ` : ''}시공 계약서
      </h2>
      <p className="doc-no">계약번호 No.{contract.no} · 계약일 {contract.contractDate}</p>
      {showStatus && (
        <div className="doc-status">
          현재 진행상태 <strong>{contract.status}</strong>
          {contract.status === '시공완료' && contract.completedDate && ` (${contract.completedDate})`}
          {contract.status === '취소' && contract.cancelReason && ` — ${contract.cancelReason}`}
        </div>
      )}

      <table className="doc-table">
        <tbody>
          <tr>
            <th>시공사</th>
            <td colSpan={3}>
              {company?.name} (대표 {company?.ceo}, 사업자번호 {company?.bizNo})
              <br />
              <span className="sub-text">{company?.address}</span>
            </td>
          </tr>
          <tr>
            <th>계약자</th>
            <td>{contract.customerName}</td>
            <th>연락처</th>
            <td>{contract.customerPhone}</td>
          </tr>
          <tr>
            <th>시공 현장</th>
            <td>
              {formatAddress(contract)}
              {contract.area && ` · ${contract.area}평`}
            </td>
            <th>입주예정일</th>
            <td>{contract.moveInDate || '-'}</td>
          </tr>
          <tr>
            <th>시공 내용</th>
            <td colSpan={3}>
              {(contract.lineItems || []).length > 0 && (
                <table className="doc-lines">
                  <tbody>
                    {contract.lineItems.map((l, i) => (
                      <tr key={i}>
                        <td>
                          <strong>{l.name}</strong>
                          {l.detail && <div className="sub-text">{l.detail}</div>}
                        </td>
                        <td className="nowrap">{l.qty}개</td>
                        {showAmount && !contract.amountHidden && <td className="text-right nowrap">{won(l.qty * l.unitPrice)}원</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="pre-wrap">{contract.items || ((contract.lineItems || []).length ? '' : '-')}</div>
            </td>
          </tr>
          <tr>
            <th>시공 일정</th>
            <td colSpan={3}>
              {contract.schedules.map((s, i) => (
                <div key={i}>
                  {i + 1}차: {s.date ? `${s.date} ${timeLabel(s)}` : '협의 후 확정'}
                </div>
              ))}
            </td>
          </tr>
          {showAmount && !contract.amountHidden && (
            <>
              <tr>
                <th>시공총액</th>
                <td>{won(a.total)}원</td>
                <th>할인/상품권</th>
                <td>
                  {won(a.discount)}원 / {won(a.voucher)}원
                </td>
              </tr>
              <tr>
                <th>계약금액</th>
                <td className="bold-text">{won(a.actual)}원</td>
                <th>기납입 / 잔금</th>
                <td>
                  {won(a.paid)}원 / <strong>{won(a.balance)}원</strong>
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      <div className="doc-terms">
        <h4>계약 조건</h4>
        <ol>
          {DEFAULT_TERMS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </div>

      <div className="doc-sign">
        <div>
          계약자: <strong>{esign.signerName || contract.customerName}</strong>
          {esign.signedAt && <span className="sub-text"> (서명일시 {new Date(esign.signedAt).toLocaleString('ko-KR')})</span>}
        </div>
        {esign.signature ? (
          <img src={esign.signature} alt="서명" className="doc-signature" />
        ) : (
          <div className="doc-signature empty">{esign.status === '서명완료' ? '(서명 이미지 없음)' : '(서명 전)'}</div>
        )}
      </div>
    </div>
  );
}
