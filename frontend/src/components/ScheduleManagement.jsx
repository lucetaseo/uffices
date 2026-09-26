import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { contracts as contractApi, engineers as engineerApi, schedules as scheduleApi } from '../api/index.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { CATEGORIES, WORK_STATUS } from '../constants.js';
import { calcAmounts } from '../utils/contract.js';
import { WEEKDAYS, formatKoreanDate, toDateKey, today } from '../utils/date.js';
import { formatAddress, won } from '../utils/format.js';
import { downloadExcel } from '../utils/excel.js';
import KakaoModal from './KakaoModal.jsx';
import ContractViewModal from './ContractViewModal.jsx';

const CATEGORY_SHORT = { 청소: '청', 줄눈: '줄', 나노코팅: '나', 탄성: '탄', 코팅: '코', 기타: '기' };

export default function ScheduleManagement() {
  const { can, handleError } = useAuth();
  const showAmount = can('contract.amount');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(null);
  const [items, setItems] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [filter, setFilter] = useState({ category: '', engineerId: '', status: '' });

  const [editItem, setEditItem] = useState(null);
  const [notifyItem, setNotifyItem] = useState(null);
  const [viewId, setViewId] = useState(null);

  const monthStart = toDateKey(new Date(year, month - 1, 1));
  const monthEnd = toDateKey(new Date(year, month, 0));

  const load = useCallback(async () => {
    try {
      setItems(await scheduleApi.list({ from: monthStart, to: monthEnd, ...filter }));
    } catch (e) {
      handleError(e);
    }
  }, [monthStart, monthEnd, filter, handleError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    engineerApi.list().then(setEngineers).catch(() => {});
  }, []);

  const moveMonth = (delta) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    setSelectedDate(null);
  };

  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setSelectedDate(today());
  };

  const byDate = useMemo(() => {
    const map = {};
    items.forEach((it) => {
      (map[it.date] = map[it.date] || []).push(it);
    });
    return map;
  }, [items]);

  // 날짜 칸에 "줄)공두환 : 2건" 형태로 기사별 건수 표시
  const cellSummary = (list) => {
    const counts = {};
    list.forEach((it) => {
      const key = it.engineerName
        ? `${CATEGORY_SHORT[it.contract.category] || ''})${it.engineerName}`
        : '미배정';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => (a[0] === '미배정' ? -1 : b[0] === '미배정' ? 1 : a[0].localeCompare(b[0])));
  };

  const cells = [];
  const firstDow = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(toDateKey(new Date(year, month - 1, d)));

  const details = selectedDate ? byDate[selectedDate] || [] : [];

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      await contractApi.updateSchedule(editItem.contract.id, editItem.stepIndex, {
        date: editItem.date,
        time: editItem.time,
        engineerId: editItem.engineerId,
        memo: editItem.memo,
      });
      setEditItem(null);
      if (editItem.date !== selectedDate) setSelectedDate(editItem.date);
      load();
    } catch (err) {
      handleError(err);
    }
  };

  const exportDay = () =>
    downloadExcel(
      details.map((it) => ({
        날짜: it.date,
        시간: it.time,
        구분: it.contract.category,
        회차: `${it.stepIndex + 1}차`,
        시공기사: it.engineerName || '미배정',
        계약자: it.contract.customerName,
        연락처: it.contract.customerPhone,
        현장: formatAddress(it.contract),
        시공내용: it.contract.items,
        ...(showAmount ? { 잔액: calcAmounts(it.contract).balance } : {}),
        메모: it.memo,
      })),
      '일정',
      `기사일정_${selectedDate}`,
    );

  return (
    <div className="page-card">
      <div className="page-header">
        <h2>기사일정관리</h2>
        <ul className="notice-list">
          <li>계약서에 입력된 시공일정(1~3차)과 배정 기사가 날짜별로 표시됩니다.</li>
          <li>날짜를 클릭하면 우측에 상세 일정이 표시되며, 일정/기사 변경은 계약서에 바로 반영됩니다.</li>
        </ul>
      </div>

      <div className="schedule-filter-bar">
        <select className="schedule-select" value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })}>
          <option value="">전체 구분</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="schedule-select" value={filter.engineerId} onChange={(e) => setFilter({ ...filter, engineerId: e.target.value })}>
          <option value="">기사선택</option>
          <option value="none">미배정</option>
          {engineers.map((en) => <option key={en.id} value={en.id}>{en.name}({en.category})</option>)}
        </select>
        <select className="schedule-select" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <option value="">시공상태</option>
          {WORK_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="sub-text" style={{ alignSelf: 'center' }}>
          이번 달 일정 {items.length}건
        </span>
      </div>

      <div className="schedule-split-layout">
        <div className="calendar-left-section">
          <div className="calendar-header-control">
            <button type="button" className="btn-month-nav" onClick={() => moveMonth(-1)}>&lt;</button>
            <span className="current-year-month">
              {year}. {String(month).padStart(2, '0')}
            </span>
            <button type="button" className="btn-month-nav" onClick={() => moveMonth(1)}>&gt;</button>
            <button type="button" className="btn-preset" onClick={goToday}>오늘</button>
          </div>

          <div className="calendar-grid-wrapper">
            <div className="calendar-weekdays">
              {WEEKDAYS.map((w, i) => (
                <div key={w} className={`weekday ${i === 0 ? 'sunday' : ''} ${i === 6 ? 'saturday' : ''}`}>{w}</div>
              ))}
            </div>
            <div className="calendar-days-grid">
              {cells.map((dateKey, idx) => {
                if (!dateKey) return <div key={idx} className="calendar-cell empty-cell" />;
                const list = byDate[dateKey] || [];
                const dow = idx % 7;
                return (
                  <div
                    key={dateKey}
                    className={`calendar-cell ${dateKey === selectedDate ? 'selected-cell' : ''} ${dateKey === today() ? 'today-cell' : ''}`}
                    onClick={() => setSelectedDate(dateKey)}
                  >
                    <div className={`day-number ${dow === 0 ? 'sunday' : ''} ${dow === 6 ? 'saturday' : ''}`}>
                      {Number(dateKey.slice(8))}
                      {list.length > 0 && <span className="day-total">{list.length}건</span>}
                    </div>
                    <div className="schedule-tag-list">
                      {cellSummary(list).slice(0, 6).map(([k, n]) => (
                        <div key={k} className={`schedule-badge ${k === '미배정' ? 'unassigned' : ''}`}>
                          {k} : {n}건
                        </div>
                      ))}
                      {cellSummary(list).length > 6 && <div className="schedule-badge more">…</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {selectedDate && (
          <div className="detail-right-section mobile-bottom-sheet">
            <div className="detail-panel-header">
              <div className="left-title">
                <button type="button" className="btn-reload" title="새로고침" onClick={load}>🔄</button>
                <span className="selected-date-text">{formatKoreanDate(selectedDate)} 상세일정 ({details.length}건)</span>
              </div>
              <div className="right-btn-group">
                {can('excel.export') && (
                  <button type="button" className="btn-excel-download" onClick={exportDay}>엑셀 다운로드</button>
                )}
                <button type="button" className="btn-close-sheet" onClick={() => setSelectedDate(null)}>&times;</button>
              </div>
            </div>

            <div className="detail-table-wrapper">
              <table className="schedule-detail-table">
                <thead>
                  <tr>
                    <th>구분</th>
                    <th>시공자</th>
                    <th>회차</th>
                    <th>시간</th>
                    <th>계약자</th>
                    <th>아파트/동호수</th>
                    <th>상태</th>
                    {showAmount && <th>잔액</th>}
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {details.length === 0 ? (
                    <tr>
                      <td colSpan={showAmount ? 9 : 8} className="no-data">
                        {selectedDate} 일자에 배정된 시공 일정이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    details.map((row) => (
                      <tr key={`${row.contract.id}-${row.stepIndex}`}>
                        <td>{row.contract.category}</td>
                        <td>{row.engineerName || <span className="text-red">미배정</span>}</td>
                        <td>{row.stepIndex + 1}차</td>
                        <td>{row.time || '-'}</td>
                        <td>
                          {row.contract.customerName}
                          <div className="sub-text">{row.contract.customerPhone}</div>
                        </td>
                        <td className="text-left">
                          {formatAddress(row.contract)}
                          {row.memo && <div className="sub-text">메모: {row.memo}</div>}
                        </td>
                        <td>{row.contract.status}</td>
                        {showAmount && <td className="text-right">{won(calcAmounts(row.contract).balance)}</td>}
                        <td>
                          <div className="row-actions">
                            {can('notify.send') && (
                              <button type="button" className="btn-talk-yellow" title="담당기사 알림톡" onClick={() => setNotifyItem(row)}>
                                💬
                              </button>
                            )}
                            {can('schedule.edit') && (
                              <button
                                type="button"
                                className="btn-dark-action"
                                onClick={() => setEditItem({ ...row, engineerId: row.engineerId ? String(row.engineerId) : '' })}
                              >
                                수정
                              </button>
                            )}
                            {can('contract.view') && (
                              <button type="button" className="btn-outline-action" onClick={() => setViewId(row.contract.id)}>
                                계약서
                              </button>
                            )}
                          </div>
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

      {editItem && (
        <div className="modal-overlay" onMouseDown={() => setEditItem(null)}>
          <div className="customer-reg-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-top-bar">
              <h3>
                &gt; 일정/기사 변경 — {editItem.contract.customerName} {editItem.stepIndex + 1}차
              </h3>
              <button type="button" className="modal-close-x" onClick={() => setEditItem(null)}>&times;</button>
            </div>
            <form onSubmit={handleSaveEdit} className="reg-table-form">
              <table className="form-grid-table">
                <tbody>
                  <tr>
                    <td className="label-col">현장</td>
                    <td className="input-col">{formatAddress(editItem.contract)}</td>
                  </tr>
                  <tr>
                    <td className="label-col">시공일 / 시간</td>
                    <td className="input-col inline-fields">
                      <input type="date" value={editItem.date} onChange={(e) => setEditItem({ ...editItem, date: e.target.value })} className="input-text" required />
                      <input type="time" value={editItem.time} onChange={(e) => setEditItem({ ...editItem, time: e.target.value })} className="input-text" />
                    </td>
                  </tr>
                  <tr>
                    <td className="label-col">담당 기사</td>
                    <td className="input-col">
                      <select value={editItem.engineerId} onChange={(e) => setEditItem({ ...editItem, engineerId: e.target.value })} className="input-text">
                        <option value="">미배정</option>
                        {engineers.map((en) => <option key={en.id} value={en.id}>{en.name}({en.category}) {en.phone}</option>)}
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td className="label-col">메모</td>
                    <td className="input-col">
                      <input type="text" value={editItem.memo} onChange={(e) => setEditItem({ ...editItem, memo: e.target.value })} className="input-text full" />
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

      {notifyItem && (
        <KakaoModal
          contract={notifyItem.contract}
          initialTarget="기사"
          initialStep={notifyItem.stepIndex}
          onClose={() => setNotifyItem(null)}
        />
      )}
      {viewId && <ContractViewModal contractId={viewId} onClose={() => setViewId(null)} onChanged={load} />}
    </div>
  );
}
