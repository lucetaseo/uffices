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
    <div className="filter-wrapper">
      <div className="action-button-group">
        <button type="button" className="btn-action blue">계약자 등록</button>
        <button type="button" className="btn-action blue">계약서 등록하기</button>
        <button type="button" className="btn-action blue">지도검색</button>
        <button type="button" className="btn-action blue">계산기</button>
        <button type="button" className="btn-action orange" onClick={onAddContract}>
          + 빠른계약등록
        </button>
      </div>

      <div className="filter-box">
        <form onSubmit={handleSearchSubmit}>
          <div className="filter-row">
            <select 
              value={dateType} 
              onChange={(e) => setDateType(e.target.value)}
              className="filter-select"
            >
              <option value="시공예정일">시공예정일</option>
              <option value="시공완료">시공완료일</option>
              <option value="취소일">취소일</option>
            </select>

            <div className="date-picker-group">
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="filter-input"
              />
              <span>~</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="filter-input"
              />
            </div>
          </div>

          <div className="filter-row search-row-between">
            <div className="search-inputs">
              <input 
                type="text" 
                placeholder="아파트명" 
                value={aptName} 
                onChange={(e) => setAptName(e.target.value)}
                className="filter-input input-apt"
              />
              <input 
                type="text" 
                placeholder="동" 
                value={dong} 
                onChange={(e) => setDong(e.target.value)}
                className="filter-input input-short"
              />
              <input 
                type="text" 
                placeholder="호" 
                value={ho} 
                onChange={(e) => setHo(e.target.value)}
                className="filter-input input-short"
              />
              <input 
                type="text" 
                placeholder="계약자명" 
                value={customerName} 
                onChange={(e) => setCustomerName(e.target.value)}
                className="filter-input"
              />
              <input 
                type="text" 
                placeholder="계약자 전화번호" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)}
                className="filter-input"
              />
              <button type="submit" className="btn-search">
                검색
              </button>
            </div>

            <div className="right-btn-group">
              <button type="button" className="btn-right-dark" onClick={onAddContract}>
                + 계약등록
              </button>
              <button type="button" className="btn-right-dark" onClick={onExportExcel}>
                📄 엑셀다운로드
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}  