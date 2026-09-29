import React, { useEffect, useRef, useState } from 'react';
import { apartments as apartmentApi } from '../api/index.js';

// 현장(아파트) 검색 입력칸: 글자 일부만 쳐도 등록된 아파트가 아래에 뜸 (휴대폰·PC 동일)
//   ↑↓ 로 고르고 Enter, 또는 눌러서 선택. 목록에 없는 이름도 그대로 입력 가능
const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
let cache = null; // 화면을 옮겨 다녀도 한 번만 불러옴

export default function AptSearchInput({ value, onChange, onPick, className = 'input-text addr-input', placeholder = '현장검색 (아파트명)', required, ...rest }) {
  const [list, setList] = useState(cache || []);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef(null);

  useEffect(() => {
    if (cache) return;
    apartmentApi
      .list()
      .then((rows) => {
        cache = rows;
        setList(rows);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const q = norm(value);
  const matches = q ? list.filter((a) => norm(a.name).includes(q) || norm(`${a.sido}${a.sigungu}${a.name}`).includes(q)).slice(0, 12) : [];
  const exact = matches.length === 1 && norm(matches[0].name) === q;

  const pick = (a) => {
    onChange(a.name);
    onPick?.(a);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open || !matches.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(matches[active] || matches[0]);
    } else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <span className="apt-search" ref={box}>
      <input
        className={className}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
        {...rest}
      />
      {open && matches.length > 0 && !exact && (
        <ul className="apt-suggest" role="listbox">
          {matches.map((a, i) => (
            <li
              key={a.id}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onPointerDown={(e) => {
                e.preventDefault();
                pick(a);
              }}
            >
              <b>{a.name}</b>
              {(a.sido || a.sigungu) && <span>{[a.sido, a.sigungu].filter(Boolean).join(' ')}</span>}
            </li>
          ))}
        </ul>
      )}
      {open && q && !matches.length && list.length > 0 && <div className="apt-suggest empty">등록된 아파트 중 일치하는 곳이 없습니다 (그대로 입력 가능)</div>}
    </span>
  );
}

// 아파트관리에서 목록이 바뀌면 다시 불러오도록
export const resetAptCache = () => {
  cache = null;
};
