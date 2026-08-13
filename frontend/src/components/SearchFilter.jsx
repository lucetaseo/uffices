import React, { useState } from 'react';

export default function SearchFilter({ onSearch, onAddContract, onExportExcel }) {
  const [dateType, setDateType] = useState('시공예정일');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [aptName, setAptName] = useState('');
  const [dong, setDong] = useState('');
  const [ho, setHo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearch({
      dateType,
      startDate,
      endDate,
      aptName,
      dong,
      ho,
      customerName,
      phone
    });
  };

  return (
    <div className="search-filter-container">
      {/* 상단 퀵 버튼 그룹 */}
      <div className="quick-btn-group">
        <button type="button" className="btn-quick">계약자 등록</button>
        <button type="button" className="btn-quick">계약서 등록하기</button>
        <button type="button" className="btn-quick">지도검색</button>
        <button type="button" className="btn-quick">계산기</button>
        {/* 모달 열기 함수 연결 */}
        <button type="button" className="btn-quick primary" onClick={onAddContract}>
          + 빠른계약등록
        </button>
      </div>

      {/* 검색 필터 박스 */}
      <div className="filter-box">
        <form onSubmit={handleSearchSubmit}>
          <div className="filter-row">
            <select 
              value={dateType} 
              onChange={(e) => setDateType(e.target.value)}
              className="input-select"
            >
              <option value="시공예정일">시공예정일</option>
              <option value="시공완료">시공완료일</option>
              <option value="취소일">취소일</option>
            </select>

            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="input-date"
            />
            <span>~</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="input-date"
            />
          </div>

          <div className="filter-row">
            <input 
              type="text" 
              placeholder="아파트명" 
              value={aptName} 
              onChange={(e) => setAptName(e.target.value)}
              className="input-search"
            />
            <input 
              type="text" 
              placeholder="동" 
              value={dong} 
              onChange={(e) => setDong(e.target.value)}
              className="input-search"
              style={{ width: '60px' }}
            />
            <input 
              type="text" 
              placeholder="호" 
              value={ho} 
              onChange={(e) => setHo(e.target.value)}
              className="input-search"
              style={{ width: '60px' }}
            />
            <input 
              type="text" 
              placeholder="계약자명" 
              value={customerName} 
              onChange={(e) => setCustomerName(e.target.value)}
              className="input-search"
            />
            <input 
              type="text" 
              placeholder="계약자 전화번호" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)}
              className="input-search"
              style={{ width: '150px' }}
            />
            <button type="submit" className="btn-search-submit">
              검색
            </button>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
              <button type="button" className="btn-quick" onClick={onAddContract}>
                + 계약등록
              </button>
              <button type="button" className="btn-quick" onClick={onExportExcel}>
                📄 엑셀다운로드
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}