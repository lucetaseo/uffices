import React, { useState } from 'react';
import { OFF_PERIODS } from '../constants.js';
import { formatKoreanDate } from '../utils/date.js';
import { backdrop } from '../utils/backdrop.js';
import { useAuth } from '../auth/AuthContext.jsx';

// 기사 휴무 등록/취소 팝업 (직원용 일정관리 + 기사모바일 공용)
//  engineers 가 주어지면 기사 선택 가능 (직원용), 없으면 본인 휴무 (기사용)
//  오류·확인 문구는 창 안에 표시합니다. 카카오톡 등 앱 안 브라우저는 alert/confirm 창을
//  막는 경우가 있어, 막히면 "눌러도 아무 반응이 없는" 것처럼 보이기 때문입니다.
export default function OffModal({ date, engineers, initialEngineerId = '', existingFor, onSave, onCancelOff, onClose }) {
  const [engineerId, setEngineerId] = useState(String(initialEngineerId || ''));
  const existing = existingFor(engineerId);
  const [period, setPeriod] = useState(existing?.period || 'DAY');
  const [reason, setReason] = useState(existing?.reason || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const { handleError } = useAuth();

  const changeEngineer = (id) => {
    setEngineerId(id);
    setError('');
    setConfirmCancel(false);
    const ex = existingFor(id);
    setPeriod(ex?.period || 'DAY');
    setReason(ex?.reason || '');
  };

  const run = async (fn) => {
    setSaving(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      if (e?.code === 'UNAUTHORIZED') handleError(e);
      else setError(e?.message || '처리 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (engineers && !engineerId) return setError('기사를 선택해 주세요.');
    if (!reason.trim()) return setError('휴가사유를 입력해 주세요.');
    run(() => onSave({ engineerId, period, reason }));
  };

  // 휴가취소: 한 번 누르면 확인 문구, 한 번 더 누르면 취소
  const cancelOff = () => {
    if (!confirmCancel) {
      setError('');
      return setConfirmCancel(true);
    }
    run(() => onCancelOff(engineerId));
  };

  return (
    <div className="modal-overlay" {...backdrop(onClose)}>
      <div className="modal-content talk-modal off-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="off-modal-head">
          <h3>{formatKoreanDate(date)}</h3>
          {existing && (
            <button type="button" className="btn-off-cancel" disabled={saving} onClick={cancelOff}>
              {confirmCancel ? '취소 확인' : '휴가취소'}
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
              <input type="radio" name="offPeriod" checked={period === p.value} onChange={() => { setPeriod(p.value); setConfirmCancel(false); }} />
              {p.label}
            </label>
          ))}
        </div>
        <input
          className="input-text full"
          placeholder="휴가사유 입력"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError('');
          }}
        />

        {confirmCancel && <p className="off-error">이 날짜의 휴무를 취소하려면 [취소 확인]을 한 번 더 눌러 주세요.</p>}
        {error && <p className="off-error" role="alert">{error}</p>}

        <div className="modal-actions center">
          <button
            type="button"
            className="btn-dark-lg sm"
            disabled={saving}
            onClick={save}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
          <button type="button" className="btn-dark-lg sm cancel" onClick={onClose}>
            창닫기
          </button>
        </div>
      </div>
    </div>
  );
}
