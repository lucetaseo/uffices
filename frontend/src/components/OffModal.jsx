import React, { useState } from 'react';
import { OFF_PERIODS } from '../constants.js';
import { formatKoreanDate } from '../utils/date.js';
import { backdrop } from '../utils/backdrop.js';

// 기사 휴무 등록/취소 팝업 (직원용 일정관리 + 기사모바일 공용)
//  engineers 가 주어지면 기사 선택 가능 (직원용), 없으면 본인 휴무 (기사용)
export default function OffModal({ date, engineers, initialEngineerId = '', existingFor, onSave, onCancelOff, onClose }) {
  const [engineerId, setEngineerId] = useState(String(initialEngineerId || ''));
  const existing = existingFor(engineerId);
  const [period, setPeriod] = useState(existing?.period || 'DAY');
  const [reason, setReason] = useState(existing?.reason || '');
  const [saving, setSaving] = useState(false);

  const changeEngineer = (id) => {
    setEngineerId(id);
    const ex = existingFor(id);
    setPeriod(ex?.period || 'DAY');
    setReason(ex?.reason || '');
  };

  const run = async (fn) => {
    setSaving(true);
    try {
      await fn();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" {...backdrop(onClose)}>
      <div className="modal-content talk-modal off-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="off-modal-head">
          <h3>{formatKoreanDate(date)}</h3>
          {existing && (
            <button type="button" className="btn-off-cancel" disabled={saving} onClick={() => run(() => onCancelOff(engineerId))}>
              휴가취소
            </button>
          )}
        </div>
        <p className="off-guide">
          - 휴가종류 선택 후 아래 사유를 반드시 입력
          <br />- 등록한 휴가를 취소할 경우 휴가취소 버튼 클릭
          <br />- 휴무 시간대에는 일정을 배정할 수 없습니다 (배정된 일정이 있으면 휴무 등록 불가)
        </p>

        {engineers && (
          <select className="input-text full" value={engineerId} onChange={(e) => changeEngineer(e.target.value)}>
            <option value="">기사 선택</option>
            {engineers.map((en) => (
              <option key={en.id} value={en.id}>
                {en.name}({en.category}){existingFor(String(en.id)) ? ' — 휴무 등록됨' : ''}
              </option>
            ))}
          </select>
        )}

        <div className="radio-btn-group off-periods">
          {OFF_PERIODS.map((p) => (
            <label key={p.value} className={`radio-tag ${period === p.value ? 'selected' : ''}`}>
              <input type="radio" name="offPeriod" checked={period === p.value} onChange={() => setPeriod(p.value)} />
              {p.label}
            </label>
          ))}
        </div>
        <input className="input-text full" placeholder="휴가사유 입력" value={reason} onChange={(e) => setReason(e.target.value)} />

        <div className="modal-actions center">
          <button
            type="button"
            className="btn-dark-lg sm"
            disabled={saving || (engineers && !engineerId)}
            onClick={() => run(() => onSave({ engineerId, period, reason }))}
          >
            저장
          </button>
          <button type="button" className="btn-dark-lg sm cancel" onClick={onClose}>
            창닫기
          </button>
        </div>
      </div>
    </div>
  );
}
