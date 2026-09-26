import React from 'react';

export default function Pagination({ page, total, pageSize, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const start = Math.max(1, Math.min(page - 4, pages - 9));
  const nums = Array.from({ length: Math.min(10, pages) }, (_, i) => start + i);
  return (
    <div className="pagination">
      <button type="button" disabled={page === 1} onClick={() => onChange(page - 1)}>
        &lt;
      </button>
      {nums.map((n) => (
        <button key={n} type="button" className={n === page ? 'active' : ''} onClick={() => onChange(n)}>
          {n}
        </button>
      ))}
      <button type="button" disabled={page === pages} onClick={() => onChange(page + 1)}>
        &gt;
      </button>
    </div>
  );
}
