import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { contracts as contractApi, engineers as engineerApi, users as userApi } from '../api/index.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLES, isOwnScopeOnly } from '../auth/permissions.js';
import SearchFilter, { EMPTY_FILTER } from '../components/SearchFilter.jsx';
import ContractTable from '../components/ContractTable.jsx';
import ContractEditor from './ContractEditor.jsx';
import ContractDetail from './ContractDetail.jsx';
import ContractViewModal from '../components/ContractViewModal.jsx';
import KakaoModal from '../components/KakaoModal.jsx';
import Pagination from '../components/Pagination.jsx';
import { calcAmounts, itemsSummary, summarize, timeLabel } from '../utils/contract.js';
import { formatAddress, won } from '../utils/format.js';
import { downloadExcel } from '../utils/excel.js';

const PAGE_SIZE = 20;
const FILTER_KEY = 'uffice.contractFilter';

function loadSavedFilter() {
  try {
    return { ...EMPTY_FILTER, ...JSON.parse(sessionStorage.getItem(FILTER_KEY) || '{}') };
  } catch {
    return EMPTY_FILTER;
  }
}

export default function ContractPage({ trash, openNew, onOpenNewHandled }) {
  const { user, can, handleError } = useAuth();
  const showAmount = can('contract.amount');

  const [filter, setFilter] = useState(loadSavedFilter);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [engineers, setEngineers] = useState([]);
  const [staff, setStaff] = useState([]);

  // 화면 이동: 목록 → 상세(detailId) → 계약서 작성(editTarget)
  const [editTarget, setEditTarget] = useState(null); // null | { id } 수정 | { prefill } 새 시공
  const [detailId, setDetailId] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [kakaoTarget, setKakaoTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await contractApi.list({ ...filter, trash }));
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  }, [filter, trash, handleError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSelectedIds(new Set());
    setPage(1);
  }, [filter, trash]);

  // 휴지통 ↔ 목록을 실제로 전환했을 때만 상세/작성 화면 닫기 (처음 열릴 때는 제외)
  const prevTrash = useRef(trash);
  useEffect(() => {
    if (prevTrash.current === trash) return;
    prevTrash.current = trash;
    setDetailId(null);
    setEditTarget(null);
  }, [trash]);

  useEffect(() => {
    engineerApi.list().then(setEngineers).catch(() => {});
    // 본인 건만 보는 실장에게는 작성자 필터가 의미 없으므로 숨김
    if (!isOwnScopeOnly(user)) userApi.staffOptions().then(setStaff).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (openNew) {
      if (can('contract.create') && !trash) setEditTarget({ prefill: null });
      onOpenNewHandled();
    }
  }, [openNew]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (next) => {
    setFilter(next);
    sessionStorage.setItem(FILTER_KEY, JSON.stringify(next));
  };

  const summary = useMemo(() => summarize(rows), [rows]);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggle = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = (checked) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      pageRows.forEach((r) => (checked ? next.add(r.id) : next.delete(r.id)));
      return next;
    });

  const bulk = async (action, confirmMsg, ...args) => {
    if (!selectedIds.size) {
      alert('선택된 계약이 없습니다.');
      return;
    }
    if (!window.confirm(`${selectedIds.size}건을 ${confirmMsg}`)) return;
    try {
      await contractApi[action]([...selectedIds], ...args);
      await load();
    } catch (e) {
      handleError(e);
    }
  };

  // 저장하면 해당 계약 상세로, 취소하면 원래 화면(상세 또는 목록)으로
  const closeEditor = async (saved) => {
    setEditTarget(null);
    if (saved) setDetailId(saved.id);
    await load();
  };

  const handleExport = () => {
    downloadExcel(
      rows.map((c) => {
        const a = calcAmounts(c);
        const row = {
          번호: c.no,
          브랜드: c.brand,
          구분: c.category,
          접수형태: c.receptionType,
          시공상태: c.status,
          전자계약: c.esign?.status,
          계약일: c.contractDate,
          시공종류: c.workType,
          계약승인: c.approval,
          시공예정일: c.schedules.map((s) => s.date && `${s.date} ${timeLabel(s)}`.trim()).filter(Boolean).join(', ') || '미정',
          시공담당: c.schedules.map((s) => s.assigneeName).filter(Boolean).join(', ') || '미배정',
          모바일웹: c.schedules.map((s) => s.mobileStatus || '입력 전').join(', '),
          입주예정일: c.moveInDate,
          시공완료일: c.completedDate,
          취소일: c.canceledDate,
          계약자: c.customerName,
          연락처: c.customerPhone,
          연락처2: c.customerPhone2,
          '아파트명/현장': formatAddress(c),
          평수: c.area,
          시공내용: itemsSummary(c),
          취소사유: c.cancelReason,
          작성자: c.ownerName,
        };
        if (showAmount) {
          Object.assign(row, {
            시공총액: a.total,
            할인: a.discount,
            상품권: a.voucher,
            실계약금: a.actual,
            매출취소: a.canceled,
            입금: a.paid,
            환불: a.refund,
            잔액: a.balance,
          });
        }
        return row;
      }),
      '계약목록',
      trash ? '계약관리_휴지통' : '계약관리_목록',
    );
  };

  const renderActions = (item) =>
    trash ? (
      <span className="sub-text">삭제 {item.deletedAt?.slice(0, 10)}</span>
    ) : (
      <div className="row-actions">
        <button type="button" className="btn-dark-action" onClick={() => setViewId(item.id)}>
          계약서
        </button>
        {can('contract.edit') && (
          <button type="button" className="btn-outline-action" onClick={() => setEditTarget({ id: item.id })}>
            수정
          </button>
        )}
        {can('notify.send') && (
          <button type="button" className="btn-kakao-talk sm" onClick={() => setKakaoTarget(item)}>
            알림톡
          </button>
        )}
      </div>
    );

  if (editTarget) {
    return (
      <ContractEditor
        contractId={editTarget.id || null}
        prefill={editTarget.prefill}
        engineers={engineers}
        onClose={closeEditor}
      />
    );
  }

  if (detailId) {
    return (
      <ContractDetail
        key={detailId}
        contractId={detailId}
        onBack={() => {
          setDetailId(null);
          load();
        }}
        onEdit={(c) => setEditTarget({ id: c.id })}
        onNewWork={(prefill) => setEditTarget({ prefill })}
        onOpenGroup={(id) => setDetailId(id)}
      />
    );
  }

  return (
    <div className="page-card">
      <div className="page-title-row">
        <h2>{trash ? '🗑️ 휴지통' : '계약관리'}</h2>
        {user.role === ROLES.MANAGER && isOwnScopeOnly(user) && <span className="scope-badge">본인 작성 계약만 표시</span>}
      </div>

      <SearchFilter
        filter={filter}
        onSearch={handleSearch}
        staff={staff}
        engineers={engineers}
        actions={
          <>
            {!trash && can('contract.create') && (
              <button type="button" className="btn-dark-lg sm" onClick={() => setEditTarget({ prefill: null })}>
                + 계약등록
              </button>
            )}
            {can('excel.export') && (
              <button type="button" className="btn-dark-lg sm" onClick={handleExport}>
                📄 엑셀다운로드
              </button>
            )}
          </>
        }
      />

      <div className="summary-box">
        <div>
          <span className="summary-label">총 {summary.count}건</span>
          <span className="sub-text">(시공완료 {summary.completed}건 · 취소 {summary.canceled}건)</span>
        </div>
        {showAmount && (
          <>
            <div>
              <span className="summary-label">실계약금액</span>
              {won(summary.actual)}원 <span className="sub-text">(할인 {won(summary.discount)} · 상품권 {won(summary.voucher)})</span>
            </div>
            <div>
              <span className="summary-label">입금액</span>
              {won(summary.paid)}원{' '}
              <span className="sub-text">
                ({Object.entries(summary.paidBy).map(([k, v]) => `${k} ${won(v)}`).join(' · ') || '-'})
              </span>
            </div>
            <div>
              <span className="summary-label">매출취소총액</span>
              {won(summary.canceledAmount)}원 <span className="sub-text">(취소 건은 합계에서 제외)</span>
            </div>
            <div>
              <span className="summary-label">환불금액</span>
              {won(summary.refund)}원
            </div>
            <div>
              <span className="summary-label">남은금액</span>
              <strong>{won(summary.balance)}원</strong>
            </div>
          </>
        )}
      </div>

      {(can('contract.delete') || can('contract.approve')) && (
        <div className="bulk-bar">
          <span className="sub-text">선택 {selectedIds.size}건</span>
          {!trash && can('contract.approve') && (
            <>
              <button type="button" className="btn-outline-action" onClick={() => bulk('setApproval', '승인 처리하시겠습니까?', '승인')}>
                선택 승인
              </button>
              <button type="button" className="btn-outline-action" onClick={() => bulk('setApproval', '미승인 처리하시겠습니까?', '미승인')}>
                선택 미승인
              </button>
            </>
          )}
          {!can('contract.delete') ? null : trash ? (
            <>
              <button type="button" className="btn-outline-action" onClick={() => bulk('restore', '복구하시겠습니까?')}>
                복구
              </button>
              <button type="button" className="btn-text-danger" onClick={() => bulk('purge', '영구삭제하시겠습니까? 되돌릴 수 없습니다.')}>
                영구삭제
              </button>
            </>
          ) : (
            <button type="button" className="btn-text-danger" onClick={() => bulk('moveToTrash', '휴지통으로 이동하시겠습니까?')}>
              선택 삭제(휴지통)
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="page-loading">불러오는 중...</div>
      ) : (
        <>
          <ContractTable
            contracts={pageRows}
            selectedIds={selectedIds}
            onToggle={toggle}
            onToggleAll={toggleAll}
            showAmount={showAmount}
            renderActions={renderActions}
            onOpen={trash ? undefined : (c) => setDetailId(c.id)}
          />
          <Pagination page={page} total={rows.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
      )}

      {viewId && <ContractViewModal contractId={viewId} onClose={() => setViewId(null)} onChanged={load} />}
      {kakaoTarget && <KakaoModal contract={kakaoTarget} onClose={() => setKakaoTarget(null)} />}
    </div>
  );
}
