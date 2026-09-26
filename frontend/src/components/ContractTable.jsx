import React from 'react';
import { calcAmounts, itemsSummary, timeLabel } from '../utils/contract.js';
import { formatAddress, won } from '../utils/format.js';
import { ESIGN_STATUS } from '../constants.js';

const CIRCLED = ['①', '②', '③'];

const STATUS_CLASS = {
  미정: 'st-gray',
  해피콜완료: 'st-blue',
  배정: 'st-blue',
  시공완료: 'st-green',
  시공연기: 'st-orange',
  취소: 'st-red',
};

const APPROVAL_CLASS = { 승인: 'ap-ok', 승인대기: 'ap-wait', 미승인: 'ap-no' };

const ESIGN_CLASS = {
  [ESIGN_STATUS.NONE]: 'es-none',
  [ESIGN_STATUS.WAITING]: 'es-wait',
  [ESIGN_STATUS.SIGNED]: 'es-done',
};

export default function ContractTable({ contracts, selectedIds, onToggle, onToggleAll, showAmount, renderActions }) {
  const allChecked = contracts.length > 0 && contracts.every((c) => selectedIds.has(c.id));
  const colCount = showAmount ? 16 : 11;

  return (
    <div className="contract-table-container">
      <table className="contract-table">
        <thead>
          <tr>
            <th>
              <input type="checkbox" checked={allChecked} onChange={(e) => onToggleAll(e.target.checked)} />
            </th>
            <th>번호</th>
            <th>브랜드</th>
            <th>구분</th>
            <th>접수형태</th>
            <th>시공상태</th>
            <th>시공예정일</th>
            <th>시공담당</th>
            <th>계약자</th>
            <th>아파트명</th>
            {showAmount && (
              <>
                <th>시공총액</th>
                <th>할인</th>
                <th>실계약금</th>
                <th>입금</th>
                <th>잔액</th>
              </>
            )}
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          {contracts.length === 0 && (
            <tr>
              <td colSpan={colCount} className="no-data">
                조건에 맞는 계약이 없습니다.
              </td>
            </tr>
          )}
          {contracts.map((item) => {
            const a = showAmount ? calcAmounts(item) : null;
            return (
              <tr key={item.id}>
                <td data-label="선택">
                  <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => onToggle(item.id)} />
                </td>
                <td data-label="번호" className="nowrap-cell">{item.no}</td>
                <td data-label="브랜드" className="nowrap-cell">{item.brand}</td>
                <td data-label="구분" className="nowrap-cell">
                  {item.category}
                  {item.workType && item.workType !== '시공' && <div className="sub-text">{item.workType}</div>}
                </td>
                <td data-label="접수형태" className="nowrap-cell">{item.receptionType}</td>
                <td data-label="시공상태">
                  <span className={`status-chip ${STATUS_CLASS[item.status] || ''}`}>{item.status}</span>
                </td>
                <td data-label="시공예정일" className="nowrap text-left">
                  {item.schedules.map((s, i) => (
                    <div key={i}>
                      {CIRCLED[i]} {s.date ? `${s.date} ${timeLabel(s)}`.trim() : '미정'}
                    </div>
                  ))}
                </td>
                <td data-label="시공담당" className="nowrap text-left">
                  {item.schedules.map((s, i) => (
                    <div key={i}>
                      {CIRCLED[i]} {s.assigneeName || '미배정'}
                      {s.mobileStatus && <span className="mobile-chip">{s.mobileStatus}</span>}
                    </div>
                  ))}
                </td>
                <td data-label="계약자" className="nowrap">
                  <div className="bold-text">
                    {item.customerName}{' '}
                    <span className={`approval ${APPROVAL_CLASS[item.approval] || ''}`}>({item.approval})</span>
                  </div>
                  <div className="sub-text">{item.customerPhone}</div>
                  <span className={`esign-chip ${ESIGN_CLASS[item.esign?.status] || ''}`}>{item.esign?.status}</span>
                </td>
                <td data-label="아파트명" className="text-left apt-cell">
                  <div>{formatAddress(item)}</div>
                  {itemsSummary(item) && <div className="sub-text ellipsis">{itemsSummary(item)}</div>}
                  <div className="sub-text">
                    계약일 {item.contractDate} · 작성 {item.ownerName}
                  </div>
                </td>
                {showAmount && (
                  <>
                    <td data-label="시공총액" className="text-right">{won(a.total)}</td>
                    <td data-label="할인" className="text-left nowrap sub-text">
                      할인 {won(a.discount)}
                      <br />
                      상품권 {won(a.voucher)}
                    </td>
                    <td data-label="실계약금" className="text-right">{won(a.actual)}</td>
                    <td data-label="입금" className="text-right">{won(a.paid)}</td>
                    <td data-label="잔액" className={`text-right ${a.balance > 0 ? 'text-red' : ''}`}>{won(a.balance)}</td>
                  </>
                )}
                <td data-label="관리" className="action-cell">
                  {renderActions(item)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
