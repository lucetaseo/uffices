import React from 'react';

export default function ContractTable({ contracts, onOpenKakao }) {
  return (
    <div className="contract-table-container">
      <table className="contract-table">
        <thead>
          <tr>
            <th>번호</th>
            <th>구분</th>
            <th>시공예정일</th>
            <th>시공담당</th>
            <th>계약자</th>
            <th>연락처</th>
            <th>아파트명</th>
            <th>잔액</th>
            <th>알림톡</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{item.category}</td>
              <td>{item.schedules?.[0]?.date || '미정'}</td>
              <td>{item.engineers?.[0]?.name || '미배정'}</td>
              <td>{item.customer}</td>
              <td>{item.phone}</td>
              <td className="text-left">{item.apt}</td>
              <td className="text-right">{item.balance?.toLocaleString()}원</td>
              <td>
                <button 
                  type="button" 
                  className="btn-kakao-talk"
                  onClick={() => onOpenKakao(item)}
                >
                  카톡알림
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}