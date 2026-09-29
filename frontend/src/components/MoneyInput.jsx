import React from 'react';

// 금액 입력칸: 숫자만 받고 10,000 처럼 쉼표를 붙여 보여줌 (값은 숫자 문자열 '10000')
export default function MoneyInput({ value, onChange, className = 'input-text money', ...rest }) {
  const shown = value === '' || value == null ? '' : Number(value).toLocaleString('ko-KR');
  return (
    <span className="money-input">
      <input
        type="text"
        inputMode="numeric"
        className={className}
        value={shown}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, ''))}
        {...rest}
      />
      <span className="money-unit">원</span>
    </span>
  );
}
