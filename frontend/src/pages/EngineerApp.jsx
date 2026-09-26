import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { engineerApp } from '../api/index.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { MOBILE_STATUS, OFF_LABEL } from '../constants.js';
import { timeLabel } from '../utils/contract.js';
import { WEEKDAYS, addDays, formatKoreanDate, toDateKey, today } from '../utils/date.js';
import { won } from '../utils/format.js';
import OffModal from '../components/OffModal.jsx';

// 기사모바일: 기사 계정으로 로그인하면 이 화면만 보입니다 (휴대폰 화면 기준).
export default function EngineerApp() {
  const { user, company, logout } = useAuth();
  const [tab, setTab] = useState('schedule');

  return (
    <div className="engineer-app">
      <header className="engineer-header">
        <div>
          <strong>{company?.name} 기사모바일</strong>
          <div className="sub-text light">{user.name} 기사님</div>
        </div>
        <button type="button" className="btn-logout" onClick={logout}>로그아웃</button>
      </header>
      <nav className="engineer-tabs">
        <button type="button" className={tab === 'schedule' ? 'active' : ''} onClick={() => setTab('schedule')}>내 일정</button>
        <button type="button" className={tab === 'off' ? 'active' : ''} onClick={() => setTab('off')}>휴무 설정</button>
      </nav>
      {tab === 'schedule' ? <MySchedules /> : <MyOffs />}
    </div>
  );
}

function MySchedules() {
  const { handleError } = useAuth();
  const [range, setRange] = useState('upcoming');
  const [list, setList] = useState([]);
  const [drafts, setDrafts] = useState({});

  const load = useCallback(() => {
    const t = today();
    const [from, to] = range === 'upcoming' ? [t, addDays(t, 30)] : [addDays(t, -30), addDays(t, -1)];
    engineerApp.mySchedules({ from, to }).then(setList).catch(handleError);
  }, [range, handleError]);

  useEffect(() => {
    load();
  }, [load]);

  const key = (s) => `${s.contractId}-${s.stepIndex}`;
  const draftOf = (s) => drafts[key(s)] || { mobileStatus: s.mobileStatus, memo: s.mobileMemo };

  const report = async (s) => {
    const d = draftOf(s);
    try {
      await engineerApp.report({ contractId: s.contractId, stepIndex: s.stepIndex, mobileStatus: d.mobileStatus, memo: d.memo });
      alert('보고되었습니다. 사무실 계약서에 바로 표시됩니다.');
      load();
    } catch (e) {
      handleError(e);
    }
  };

  const grouped = useMemo(() => {
    const map = {};
    list.forEach((s) => (map[s.date] = map[s.date] || []).push(s));
    return Object.entries(map);
  }, [list]);

  return (
    <div className="engineer-body">
      <div className="radio-btn-group">
        <label className={`radio-tag ${range === 'upcoming' ? 'selected' : ''}`}>
          <input type="radio" checked={range === 'upcoming'} onChange={() => setRange('upcoming')} /> 오늘 이후 30일
        </label>
        <label className={`radio-tag ${range === 'past' ? 'selected' : ''}`}>
          <input type="radio" checked={range === 'past'} onChange={() => setRange('past')} /> 지난 30일
        </label>
      </div>

      {grouped.length === 0 && <p className="no-data">배정된 일정이 없습니다.</p>}
      {grouped.map(([date, rows]) => (
        <section key={date}>
          <h4 className={`engineer-date ${date === today() ? 'is-today' : ''}`}>
            {formatKoreanDate(date)} {date === today() && '· 오늘'}
          </h4>
          {rows.map((s) => {
            const d = draftOf(s);
            return (
              <div key={key(s)} className="engineer-card">
                <div className="engineer-card-top">
                  <strong>{timeLabel(s) || '시간미정'}</strong>
                  <span className="status-chip st-blue">{s.category} {s.workType !== '시공' ? `· ${s.workType}` : ''}</span>
                  <span className="sub-text">{s.stepIndex + 1}차{s.viaTeam ? ` · ${s.teamName}` : ''}</span>
                </div>
                <div className="bold-text">{s.address}</div>
                <div>
                  {s.customerName} · <a href={`tel:${s.customerPhone}`}>{s.customerPhone}</a>
                </div>
                {s.items && <div className="sub-text pre-wrap">{s.items}</div>}
                {s.memo && <div className="sub-text">메모: {s.memo}</div>}
                {s.engineerNote && <div className="engineer-note">📌 전달사항: {s.engineerNote}</div>}
                <div className="engineer-balance">현장 수령 잔액 <strong>{won(s.balance)}원</strong></div>

                <div className="engineer-report">
                  <select
                    className="input-text"
                    value={d.mobileStatus}
                    onChange={(e) => setDrafts({ ...drafts, [key(s)]: { ...d, mobileStatus: e.target.value } })}
                  >
                    <option value="">입력 전</option>
                    {MOBILE_STATUS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input
                    className="input-text"
                    placeholder="보고 메모 (선택)"
                    value={d.memo}
                    onChange={(e) => setDrafts({ ...drafts, [key(s)]: { ...d, memo: e.target.value } })}
                  />
                  <button type="button" className="btn-confirm" onClick={() => report(s)}>보고</button>
                </div>
                {s.reportedAt && <div className="sub-text">마지막 보고: {new Date(s.reportedAt).toLocaleString('ko-KR')}</div>}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function MyOffs() {
  const { handleError } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [offs, setOffs] = useState([]);
  const [busy, setBusy] = useState({});
  const [target, setTarget] = useState(null);

  const from = toDateKey(new Date(year, month - 1, 1));
  const to = toDateKey(new Date(year, month, 0));

  const load = useCallback(() => {
    Promise.all([engineerApp.myOffs({ from, to }), engineerApp.mySchedules({ from, to })])
      .then(([o, s]) => {
        setOffs(o);
        const counts = {};
        s.forEach((x) => (counts[x.date] = (counts[x.date] || 0) + 1));
        setBusy(counts);
      })
      .catch(handleError);
  }, [from, to, handleError]);

  useEffect(() => {
    load();
  }, [load]);

  const move = (delta) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const cells = [];
  for (let i = 0; i < new Date(year, month - 1, 1).getDay(); i++) cells.push(null);
  for (let d = 1; d <= new Date(year, month, 0).getDate(); d++) cells.push(toDateKey(new Date(year, month - 1, d)));

  const offOn = (date) => offs.find((o) => o.date === date);

  const save = async ({ period, reason }) => {
    try {
      await engineerApp.setMyOff({ date: target, period, reason });
      setTarget(null);
      load();
    } catch (e) {
      handleError(e);
    }
  };

  const cancel = async () => {
    if (!window.confirm('휴무를 취소하시겠습니까?')) return;
    try {
      await engineerApp.cancelMyOff(target);
      setTarget(null);
      load();
    } catch (e) {
      handleError(e);
    }
  };

  return (
    <div className="engineer-body">
      <div className="calendar-header-control">
        <button type="button" className="btn-month-nav" onClick={() => move(-1)}>&lt;</button>
        <span className="current-year-month">{year}. {String(month).padStart(2, '0')}</span>
        <button type="button" className="btn-month-nav" onClick={() => move(1)}>&gt;</button>
      </div>
      <p className="sub-text">날짜를 눌러 휴무(오전/오후/종일)를 등록하세요. 일정이 배정된 시간대는 휴무를 등록할 수 없습니다.</p>
      <div className="calendar-grid-wrapper">
        <div className="calendar-weekdays">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={`weekday ${i === 0 ? 'sunday' : ''} ${i === 6 ? 'saturday' : ''}`}>{w}</div>
          ))}
        </div>
        <div className="calendar-days-grid">
          {cells.map((date, idx) => {
            if (!date) return <div key={idx} className="calendar-cell empty-cell" />;
            const off = offOn(date);
            const past = date < today();
            return (
              <div
                key={date}
                className={`calendar-cell mini ${date === today() ? 'today-cell' : ''} ${past ? 'past-cell' : ''}`}
                onClick={() => !past && setTarget(date)}
              >
                <div className="day-number">{Number(date.slice(8))}</div>
                {off && <span className={`off-chip off-${off.period}`}>{OFF_LABEL[off.period]}</span>}
                {busy[date] && <div className="schedule-badge">일정 {busy[date]}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {target && (
        <OffModal
          date={target}
          existingFor={() => offOn(target)}
          onSave={save}
          onCancelOff={cancel}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
}
