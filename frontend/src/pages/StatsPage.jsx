import React, { useEffect, useMemo, useState } from 'react';
import { reports } from '../api/index.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { DATE_TYPES } from '../constants.js';
import { calcAmounts, firstScheduleDate } from '../utils/contract.js';
import { presetRange, isoToDateKey } from '../utils/date.js';
import { won } from '../utils/format.js';
import { downloadExcel } from '../utils/excel.js';

const GROUPS = [
  { key: 'month', label: '월별', fn: null },
  { key: 'category', label: '구분별', fn: (c) => c.category },
  { key: 'brand', label: '브랜드별', fn: (c) => c.brand },
  { key: 'receptionType', label: '접수형태별', fn: (c) => c.receptionType },
  { key: 'owner', label: '작성자별', fn: (c) => c.ownerName || '-' },
];

const dateOf = (c, dateType) =>
  dateType === 'scheduleDate'
    ? firstScheduleDate(c)
    : dateType === 'createdAt'
      ? isoToDateKey(c.createdAt)
      : c[dateType] || '';

export default function StatsPage() {
  const { can, handleError } = useAuth();
  const showAmount = can('contract.amount');
  const [dateType, setDateType] = useState('contractDate');
  const [range, setRange] = useState(() => presetRange('3months'));
  const [group, setGroup] = useState('month');
  const [rows, setRows] = useState([]);

  useEffect(() => {
    reports.contracts({ dateType, from: range[0], to: range[1] }).then(setRows).catch(handleError);
  }, [dateType, range, handleError]);

  const table = useMemo(() => {
    const g = GROUPS.find((x) => x.key === group);
    const keyFn = g.fn || ((c) => dateOf(c, dateType).slice(0, 7) || '미정');
    const map = {};
    rows.forEach((c) => {
      const k = keyFn(c);
      const r = (map[k] = map[k] || { key: k, count: 0, done: 0, canceled: 0, actual: 0, paid: 0, balance: 0 });
      r.count += 1;
      if (c.status === '시공완료') r.done += 1;
      if (c.status === '취소') {
        r.canceled += 1;
        return;
      }
      const a = calcAmounts(c);
      r.actual += a.actual;
      r.paid += a.paid;
      r.balance += a.balance;
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [rows, group, dateType]);

  const total = table.reduce(
    (s, r) => ({
      count: s.count + r.count,
      done: s.done + r.done,
      canceled: s.canceled + r.canceled,
      actual: s.actual + r.actual,
      paid: s.paid + r.paid,
      balance: s.balance + r.balance,
    }),
    { count: 0, done: 0, canceled: 0, actual: 0, paid: 0, balance: 0 },
  );
  const maxCount = Math.max(1, ...table.map((r) => r.count));

  return (
    <div className="page-card">
      <h2>통계정보</h2>
      <div className="filter-row">
        <select className="input-select" value={dateType} onChange={(e) => setDateType(e.target.value)}>
          {DATE_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label} 기준</option>)}
        </select>
        <input type="date" className="input-date" value={range[0]} onChange={(e) => setRange([e.target.value, range[1]])} />
        <span>~</span>
        <input type="date" className="input-date" value={range[1]} onChange={(e) => setRange([range[0], e.target.value])} />
        {['month', 'lastMonth', '3months'].map((p) => (
          <button key={p} type="button" className="btn-preset" onClick={() => setRange(presetRange(p))}>
            {{ month: '이번달', lastMonth: '지난달', '3months': '3개월' }[p]}
          </button>
        ))}
        <div className="radio-btn-group" style={{ marginLeft: 12 }}>
          {GROUPS.map((g) => (
            <label key={g.key} className={`radio-tag ${group === g.key ? 'selected' : ''}`}>
              <input type="radio" checked={group === g.key} onChange={() => setGroup(g.key)} />
              {g.label}
            </label>
          ))}
        </div>
        {can('excel.export') && (
          <button
            type="button"
            className="btn-dark-lg sm"
            style={{ marginLeft: 'auto' }}
            onClick={() =>
              downloadExcel(
                table.map((r) => ({
                  구분: r.key,
                  계약건수: r.count,
                  시공완료: r.done,
                  취소: r.canceled,
                  ...(showAmount ? { 실계약금: r.actual, 입금: r.paid, 잔액: r.balance } : {}),
                })),
                '통계',
                '통계정보',
              )
            }
          >
            📄 엑셀다운로드
          </button>
        )}
      </div>

      <div className="table-responsive">
        <table className="customer-table">
          <thead>
            <tr>
              <th>{GROUPS.find((g) => g.key === group).label.replace('별', '')}</th>
              <th>계약건수</th>
              <th style={{ width: '25%' }} />
              <th>시공완료</th>
              <th>취소</th>
              {showAmount && (
                <>
                  <th>실계약금(취소제외)</th>
                  <th>입금</th>
                  <th>잔액</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {table.length === 0 && (
              <tr>
                <td colSpan={showAmount ? 8 : 5} className="no-data">해당 기간에 데이터가 없습니다.</td>
              </tr>
            )}
            {table.map((r) => (
              <tr key={r.key}>
                <td className="bold-text">{r.key}</td>
                <td>{r.count}</td>
                <td>
                  <div className="bar" style={{ width: `${(r.count / maxCount) * 100}%` }} />
                </td>
                <td>{r.done}</td>
                <td>{r.canceled}</td>
                {showAmount && (
                  <>
                    <td className="text-right">{won(r.actual)}</td>
                    <td className="text-right">{won(r.paid)}</td>
                    <td className="text-right">{won(r.balance)}</td>
                  </>
                )}
              </tr>
            ))}
            {table.length > 0 && (
              <tr className="total-row">
                <td>합계</td>
                <td>{total.count}</td>
                <td />
                <td>{total.done}</td>
                <td>{total.canceled}</td>
                {showAmount && (
                  <>
                    <td className="text-right">{won(total.actual)}</td>
                    <td className="text-right">{won(total.paid)}</td>
                    <td className="text-right">{won(total.balance)}</td>
                  </>
                )}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
