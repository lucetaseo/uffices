import { useEffect } from 'react';

// 화면으로 돌아올 때(앱 전환·탭 전환 후) 최신 내용으로 다시 불러오기
//  사무실 PC에서 바꾼 휴무·일정이 열려 있던 휴대폰 화면에도 반영되도록
export function useRefreshOnReturn(load) {
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [load]);
}
