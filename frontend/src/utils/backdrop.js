// 팝업 창 바깥(어두운 배경)을 눌렀을 때 닫기
//
// 휴대폰·카카오톡 앱 안 브라우저에서는 한 번 터치에 클릭이 두 번 들어오는 경우가 있어,
// 창이 열리자마자 두 번째 클릭이 배경에 닿아 바로 닫히는 문제가 생깁니다. 그래서
//   - 배경에서 시작해 배경에서 끝난 터치만 닫기로 인정하고
//   - 창이 열린 직후(0.4초)의 배경 터치는 무시합니다.
// 사용: <div className="modal-overlay" {...backdrop(onClose)}>
export function backdrop(onClose) {
  return {
    ref: (el) => {
      if (el && !el.dataset.openedAt) el.dataset.openedAt = String(Date.now());
    },
    onPointerDown: (e) => {
      e.currentTarget.dataset.downOnBackdrop = e.target === e.currentTarget ? '1' : '';
    },
    onClick: (e) => {
      const el = e.currentTarget;
      if (e.target !== el || el.dataset.downOnBackdrop !== '1') return;
      if (Date.now() - Number(el.dataset.openedAt || 0) < 400) return;
      onClose();
    },
  };
}
