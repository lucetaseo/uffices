// ============================================================
// 화면 주소(URL) 관리 — 브라우저 뒤로가기/앞으로가기가 사이트 안에서 동작하도록
//
//   /contracts            계약 목록        /contracts/12        계약 상세
//   /contracts/trash      휴지통           /contracts/12/edit   계약 수정
//   /contracts/new        계약 등록        /contracts/new?from=12  같은 현장 시공 추가
//   /customers  /schedule  /progress  /stats  /admin (운영자)
//   /settings/users|engineers|teams|products|apartments|schedule   /me (내 정보)
//   /engineer  /engineer/off   (기사모바일)
//   /sign/:token           고객 전자서명 (로그인 불필요)
// ============================================================

import { useEffect, useState } from 'react';

const EVENT = 'uffice:navigate';

const current = () => ({
  path: window.location.pathname.replace(/\/+$/, '') || '/',
  query: new URLSearchParams(window.location.search),
  state: window.history.state || {},
});

// options.replace: 현재 기록을 바꿈(뒤로가기 대상이 되지 않음), options.state: 기록에 함께 저장할 값
export function navigate(to, { replace = false, state = {} } = {}) {
  const target = new URL(to, window.location.origin);
  const same = target.pathname + target.search === window.location.pathname + window.location.search;
  if (same && !replace) return;
  window.history[replace ? 'replaceState' : 'pushState'](state, '', target.pathname + target.search);
  window.dispatchEvent(new Event(EVENT));
  if (!replace) window.scrollTo(0, 0);
}

// 이전 화면이 사이트 안이면 뒤로가기, 아니면 지정한 주소로 이동
export function goBack(fallback) {
  if (window.history.state?.canGoBack) window.history.back();
  else navigate(fallback, { replace: true });
}

// 다른 화면으로 이동하면서, 그 화면에서 "뒤로" 누르면 여기로 돌아오게 표시
export const navigateForward = (to) => navigate(to, { state: { canGoBack: true } });

export function useRoute() {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const update = () => setRoute(current());
    window.addEventListener('popstate', update);
    window.addEventListener(EVENT, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(EVENT, update);
    };
  }, []);
  return route;
}

// '/contracts/:id/edit' 같은 패턴과 주소 비교 → { id: '12' } 또는 null
export function match(pattern, path) {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

// <Link to="/contracts">목록</Link> — 새 탭 열기(Ctrl/휠 클릭)도 지원
export function linkProps(to, onNavigate = navigate) {
  return {
    href: to,
    onClick: (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      onNavigate(to);
    },
  };
}
