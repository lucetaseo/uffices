import React from 'react';

export default function ContractTable({ contracts, onOpenKakao }) {
  return (
    <>
      <div className="pc-table-view">
        <table>
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
            {contracts.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ padding: '30px', color: '#888' }}>
                  조회된 계약 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              contracts.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.category}</td>
                  <td>{item.schedules.map(s => s.date).filter(Boolean).join(', ') || '-'}</td>
                  <td>{item.engineers.map(e => e.name).filter(Boolean).join(', ') || '-'}</td>
                  <td>{item.customer}</td>
                  <td>{item.phone}</td>
                  <td className="text-left">{item.apt}</td>
                  <td>{item.balance.toLocaleString()}원</td>
                  <td>
                    <button className="btn-bizgo" onClick={() => onOpenKakao(item)}>
                      카톡알림
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mobile-card-view">
        {contracts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: '#888', padding: '30px' }}>
            조회된 계약 데이터가 없습니다.
          </div>
        ) : (
          contracts.map((item) => (
            <div className="card" key={item.id}>
              <div className="card-header">
                <span className="badge">{item.category}</span>
                <span className="contract-no">No. {item.id}</span>
              </div>
              <div className="card-body">
                <h3>{item.customer} ({item.phone})</h3>
                <p className="apt">{item.apt}</p>
                <p><strong>시공일:</strong> {item.schedules.map(s => s.date).filter(Boolean).join(', ') || '미정'}</p>
                <p><strong>잔액:</strong> {item.balance.toLocaleString()}원</p>
              </div>
              <div className="card-footer">
                <button className="btn-bizgo full-width" onClick={() => onOpenKakao(item)}>
                  카카오 알림톡 발송
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}