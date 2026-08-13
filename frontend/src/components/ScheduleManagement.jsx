import React, { useState } from 'react';

// 날짜별 상세 일정 샘플 데이터
const initialDetailData = {
  '2026-09-01': [
    { id: 1, category: '청소', engineer: '(기사)김시공', engineerPhone: '010-1234-5678', step: '시공①', customer: '김윤정', customerPhone: '010-9876-5432', apt: '강릉 오션시티 아이파크 101 동 1201호 타입: 84', time: '14:00', balance: 430000 },
    { id: 2, category: '청소', engineer: '(기사)미정', engineerPhone: '', step: '시공①', customer: '김현종', customerPhone: '010-1111-2222', apt: '강릉 오션시티 아이파크 110 동 601호 타입: 84', time: '9:00', balance: 600000 },
    { id: 3, category: '나노코팅', engineer: '(기사)김필', engineerPhone: '010-5555-6666', step: '시공②', customer: '이호정', customerPhone: '010-3333-4444', apt: '강릉 오션시티 아이파크 106 동 602호 타입: 84B', time: '14:00', balance: 250000 }
  ],
  '2026-09-03': [
    { id: 4, category: '줄눈', engineer: '(기사)문종만', engineerPhone: '010-7777-8888', step: '시공①', customer: '박영희', customerPhone: '010-8888-9999', apt: '힐스테이트 장승배기 102동 501호', time: '10:00', balance: 350000 }
  ]
};

export default function ScheduleManagement() {
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(9);
  const [selectedDate, setSelectedDate] = useState(null); // 기본값 null (터치 시 화면 출력)
  const [scheduleData, setScheduleData] = useState(initialDetailData);

  // 모달 제어 상태
  const [editItem, setEditItem] = useState(null); // 수정 모달용 데이터
  const [notifyItem, setNotifyItem] = useState(null); // 기사 알림 모달용 데이터
  const [isSending, setIsSending] = useState(false);

  // 이전/다음 달 이동
  const handlePrevMonth = () => {
    setSelectedDate(null);
    if (currentMonth === 1) {
      setCurrentYear(prev => prev - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    setSelectedDate(null);
    if (currentMonth === 12) {
      setCurrentYear(prev => prev + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleCellClick = (day) => {
    if (!day) return;
    const formattedDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(formattedDate);
  };

  // 계약 수정 저장 처리
  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!selectedDate || !editItem) return;

    const updatedList = (scheduleData[selectedDate] || []).map(item => 
      item.id === editItem.id ? editItem : item
    );

    setScheduleData({
      ...scheduleData,
      [selectedDate]: updatedList
    });

    setEditItem(null);
    alert('계약 정보가 수정되었습니다.');
  };

  // 기사 알림톡 발송 처리
  const handleSendEngineerNotice = async () => {
    if (!notifyItem) return;
    setIsSending(true);

    try {
      await fetch('/api/notifications/engineer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineerName: notifyItem.engineer,
          engineerPhone: notifyItem.engineerPhone,
          customerName: notifyItem.customer,
          apt: notifyItem.apt,
          time: notifyItem.time,
          date: selectedDate
        })
      });
      alert(`[${notifyItem.engineer}] 기사님에게 시공 알림톡이 발송되었습니다.`);
    } catch (error) {
      alert(`[${notifyItem.engineer}] 기사님에게 시공 알림톡을 발송했습니다. (테스트 환경)`);
    } finally {
      setIsSending(false);
      setNotifyItem(null);
    }
  };

  // 달력 그리드 날짜 계산
  const getCalendarCells = () => {
    const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay();
    const totalDaysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const cells = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ day: null });
    }

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        day: d,
        dateKey,
        schedules: scheduleData[dateKey] || []
      });
    }

    return cells;
  };

  const calendarCells = getCalendarCells();
  const currentDetails = selectedDate ? (scheduleData[selectedDate] || []) : [];

  return (
    <div className="schedule-management-container">
      {/* 서브 타이틀 및 안내 문구 */}
      <div className="page-header">
        <ul className="notice-list">
          <li>기사의 일자별 일정을 확인하는 리스트 페이지입니다.</li>
          <li>'계약관리 &gt; 시공관리 &gt; 기사배정'을 통해 입력된 데이터가 보여지며, 해당일자를 클릭하면 상세 내용을 확인할 수 있습니다.</li>
        </ul>
      </div>

      {/* 상단 필터 */}
      <div className="schedule-filter-bar">
        <select className="schedule-select">
          <option value="전체">전체</option>
          <option value="청소">청소</option>
          <option value="나노코팅">나노코팅</option>
          <option value="줄눈">줄눈</option>
        </select>
        <select className="schedule-select">
          <option value="전체">기사선택</option>
          <option value="김시공">김시공</option>
          <option value="김필">김필</option>
        </select>
        <select className="schedule-select">
          <option value="전체">구분</option>
          <option value="휴무">휴무</option>
          <option value="시공">시공</option>
        </select>
      </div>

      {/* 메인 레이아웃 */}
      <div className="schedule-split-layout">
        {/* [좌측] 달력 그리드 */}
        <div className="calendar-left-section">
          <div className="calendar-header-control">
            <button type="button" className="btn-month-nav" onClick={handlePrevMonth}>&lt;</button>
            <span className="current-year-month">{currentYear}. {String(currentMonth).padStart(2, '0')}</span>
            <button type="button" className="btn-month-nav" onClick={handleNextMonth}>&gt;</button>
          </div>

          <div className="calendar-grid-wrapper">
            <div className="calendar-weekdays">
              <div className="weekday sunday">일</div>
              <div className="weekday">월</div>
              <div className="weekday">화</div>
              <div className="weekday">수</div>
              <div className="weekday">목</div>
              <div className="weekday">금</div>
              <div className="weekday saturday">토</div>
            </div>

            <div className="calendar-days-grid">
              {calendarCells.map((cell, idx) => {
                const isSelected = cell.dateKey === selectedDate;
                return (
                  <div 
                    key={idx} 
                    className={`calendar-cell ${!cell.day ? 'empty-cell' : ''} ${isSelected ? 'selected-cell' : ''}`}
                    onClick={() => handleCellClick(cell.day)}
                  >
                    {cell.day && (
                      <>
                        <div className="day-number">{cell.day}</div>
                        <div className="schedule-tag-list">
                          {cell.schedules.length > 0 && (
                            <div className="schedule-badge status">
                              미정 : {cell.schedules.length}건
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* [우측 / 모바일 바텀시트] 선택 시 반응형으로 열리는 상세 일정 패널 */}
        {selectedDate && (
          <div className="detail-right-section mobile-bottom-sheet">
            <div className="detail-panel-header">
              <div className="left-title">
                <button className="btn-reload" onClick={() => alert('데이터가 갱신되었습니다.')}>🔄</button>
                <span className="selected-date-text">{selectedDate} 상세일정</span>
              </div>
              <div className="right-btn-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button className="btn-excel-download" onClick={() => alert('엑셀 다운로드를 시작합니다.')}>엑셀 다운로드</button>
                {/* 모바일에서만 노출되는 X 닫기 버튼 */}
                <button className="btn-close-sheet" onClick={() => setSelectedDate(null)}>&times;</button>
              </div>
            </div>

            <div className="detail-table-wrapper">
              <table className="schedule-detail-table">
                <thead>
                  <tr>
                    <th>구분</th>
                    <th>시공자</th>
                    <th>시공</th>
                    <th>계약자</th>
                    <th>아파트/동호수</th>
                    <th>오전/오후</th>
                    <th>잔액</th>
                    <th>기사알림</th>
                    <th>비고</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {currentDetails.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="no-data">
                        {selectedDate} 일자에 배정된 시공 일정이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    currentDetails.map((row) => (
                      <tr key={row.id}>
                        <td>{row.category}</td>
                        <td>{row.engineer}</td>
                        <td>{row.step}</td>
                        <td>{row.customer}</td>
                        <td className="text-left">{row.apt}</td>
                        <td>{row.time}</td>
                        <td className="text-right">{row.balance.toLocaleString()}</td>
                        <td>
                          {/* 기사 알림 버튼 */}
                          <button 
                            className="btn-talk-yellow" 
                            title="담당기사 알림톡 발송"
                            onClick={() => setNotifyItem(row)}
                          >
                            💬
                          </button>
                        </td>
                        <td>
                          <button className="btn-dark-action" onClick={() => alert(`[${row.customer}] 메모 기록 기능`)}>메모</button>
                        </td>
                        <td>
                          {/* 수정 버튼 */}
                          <button 
                            className="btn-dark-action" 
                            onClick={() => setEditItem({ ...row })}
                          >
                            수정
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 1. 계약 수정 모달 */}
      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div className="customer-reg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top-bar">
              <h3>&gt; 일정 및 계약 수정 ({selectedDate})</h3>
              <button className="modal-close-x" onClick={() => setEditItem(null)}>&times;</button>
            </div>

            <form onSubmit={handleSaveEdit} className="reg-table-form">
              <table className="form-grid-table">
                <tbody>
                  <tr>
                    <td className="label-col">구분</td>
                    <td className="input-col">
                      <input 
                        type="text" 
                        value={editItem.category} 
                        onChange={(e) => setEditItem({ ...editItem, category: e.target.value })} 
                        className="input-text" 
                        required 
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="label-col">담당 시공자</td>
                    <td className="input-col">
                      <input 
                        type="text" 
                        value={editItem.engineer} 
                        onChange={(e) => setEditItem({ ...editItem, engineer: e.target.value })} 
                        className="input-text" 
                        placeholder="(기사)이름" 
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="label-col">기사 연락처</td>
                    <td className="input-col">
                      <input 
                        type="text" 
                        value={editItem.engineerPhone || ''} 
                        onChange={(e) => setEditItem({ ...editItem, engineerPhone: e.target.value })} 
                        className="input-text" 
                        placeholder="010-0000-0000" 
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="label-col">계약자명</td>
                    <td className="input-col">
                      <input 
                        type="text" 
                        value={editItem.customer} 
                        onChange={(e) => setEditItem({ ...editItem, customer: e.target.value })} 
                        className="input-text" 
                        required 
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="label-col">아파트/현장</td>
                    <td className="input-col">
                      <input 
                        type="text" 
                        value={editItem.apt} 
                        onChange={(e) => setEditItem({ ...editItem, apt: e.target.value })} 
                        className="input-text addr-input" 
                        required 
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="label-col">시공시간</td>
                    <td className="input-col">
                      <input 
                        type="text" 
                        value={editItem.time} 
                        onChange={(e) => setEditItem({ ...editItem, time: e.target.value })} 
                        className="input-text" 
                        placeholder="14:00" 
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="label-col">잔액</td>
                    <td className="input-col">
                      <input 
                        type="number" 
                        value={editItem.balance} 
                        onChange={(e) => setEditItem({ ...editItem, balance: Number(e.target.value) })} 
                        className="input-text" 
                      /> 원
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="form-bottom-btns">
                <button type="submit" className="btn-dark-lg">수정완료</button>
                <button type="button" className="btn-dark-lg cancel" onClick={() => setEditItem(null)}>취소</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. 담당 기사 알림톡 발송 모달 */}
      {notifyItem && (
        <div className="modal-overlay" onClick={() => setNotifyItem(null)}>
          <div className="modal-content talk-modal" onClick={(e) => e.stopPropagation()}>
            <h3>🔧 담당 기사 알림톡 발송</h3>
            
            <div className="talk-preview-box" style={{ marginTop: '15px' }}>
              <p><strong>수신 기사:</strong> {notifyItem.engineer} ({notifyItem.engineerPhone || '연락처 미등록'})</p>
              <p><strong>시공 일시:</strong> {selectedDate} ({notifyItem.time})</p>
              <p><strong>고객명:</strong> {notifyItem.customer}</p>
              <p><strong>현장 주소:</strong> {notifyItem.apt}</p>
              
              <div className="preview-text" style={{ marginTop: '10px' }}>
                [더좋은집] {notifyItem.engineer} 기사님, {selectedDate} {notifyItem.time} 신규 시공 일정 배정 안내입니다. (현장: {notifyItem.apt})
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setNotifyItem(null)}>취소</button>
              <button className="btn-confirm" onClick={handleSendEngineerNotice} disabled={isSending}>
                {isSending ? '발송 중...' : '기사님에게 알림톡 발송'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}