import React, { useEffect, useState } from 'react';
import { reports } from '../api/index.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { ESIGN_STATUS, WORK_STATUS } from '../constants.js';
import { addDays, formatKoreanDate, today } from '../utils/date.js';
import { formatAddress } from '../utils/format.js';
import { timeLabel } from '../utils/contract.js';

// 진행상황: 오늘 기준 앞으로 7일 시공 예정 + 상태별/서명상태별 현황
export default function ProgressStatus() {
  const { handleError } = useAuth();
  const [upcoming, setUpcoming] = useState([]);
  const [all, setAll] = useState([]);
  const t = today();

  useEffect(() => {
    Promise.all([
      reports.contracts({ dateType: 'scheduleDate', from: t, to: addDays(t, 6) }),
      reports.contracts({}),
    ])
      .then(([u, a]) => {
        setUpcoming(u);
        setAll(a);
      })
      .catch(handleError);
  }, [t, handleError]);

  const countBy = (fn) => all.reduce((m, c) => ({ ...m, [fn(c)]: (m[fn(c)] || 0) + 1 }), {});
  const byStatus = countBy((c) => c.status);
  const byEsign = countBy((c) => c.esign?.status);
  const unassigned = all.filter(
    (c) => c.status !== '취소' && c.status !== '시공완료' && c.schedules.some((s) => s.date && !s.assigneeName),
  );

  const upcomingRows = upcoming
    .flatMap((c) =>
      c.schedules
        .map((s, i) => ({ ...s, step: i + 1, c }))
        .filter((s) => s.date >= t && s.date <= addDays(t, 6)),
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return (
    <div className="page-card">
      <h2>진행상황</h2>

      <div className="stat-cards">
        {WORK_STATUS.map((s) => (
          <div key={s} className="stat-card">
            <div className="stat-label">{s}</div>
            <div className="stat-value">{byStatus[s] || 0}</div>
          </div>
        ))}
        {Object.values(ESIGN_STATUS).map((s) => (
          <div key={s} className="stat-card esign">
            <div className="stat-label">전자계약 {s}</div>
            <div className="stat-value">{byEsign[s] || 0}</div>
          </div>
        ))}
        <div className="stat-card warn">
          <div className="stat-label">기사 미배정</div>
          <div className="stat-value">{unassigned.length}</div>
        </div>
      </div>

      <h3 className="section-title">앞으로 7일 시공 예정 ({upcomingRows.length}건)</h3>
      <div className="table-responsive">
        <table className="customer-table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>시간</th>
              <th>구분</th>
              <th>회차</th>
              <th>기사</th>
              <th>계약자</th>
              <th>현장</th>
              <th>상태</th>
              <th>전자계약</th>
            </tr>
          </thead>
          <tbody>
            {upcomingRows.length === 0 && (
              <tr>
                <td colSpan={9} className="no-data">예정된 시공이 없습니다.</td>
              </tr>
            )}
            {upcomingRows.map((r) => (
              <tr key={`${r.c.id}-${r.step}`}>
                <td>{formatKoreanDate(r.date)}</td>
                <td>{timeLabel(r) || '-'}</td>
                <td>{r.c.category}</td>
                <td>{r.step}차</td>
                <td>{r.assigneeName || <span className="text-red">미배정</span>}</td>
                <td>{r.c.customerName}</td>
                <td className="text-left">{formatAddress(r.c)}</td>
                <td>{r.c.status}</td>
                <td>{r.c.esign?.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
