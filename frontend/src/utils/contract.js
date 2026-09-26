// 계약 금액 계산. 저장하지 않고 항상 원본값에서 계산해 불일치를 막습니다.
//   실계약금 = 시공총액 - 할인 - 상품권
//   잔액     = 실계약금 - 입금합계

export function calcAmounts(c) {
  const total = Number(c.totalAmount) || 0;
  const discount = Number(c.discount) || 0;
  const voucher = Number(c.voucher) || 0;
  const actual = total - discount - voucher;
  const payments = c.payments || [];
  const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const paidBy = {};
  payments.forEach((p) => {
    paidBy[p.method] = (paidBy[p.method] || 0) + (Number(p.amount) || 0);
  });
  return { total, discount, voucher, actual, paid, paidBy, balance: actual - paid };
}

export function summarize(contracts) {
  const sum = {
    count: contracts.length,
    completed: 0,
    canceled: 0,
    total: 0,
    discount: 0,
    voucher: 0,
    actual: 0,
    paid: 0,
    paidBy: {},
    balance: 0,
    canceledAmount: 0,
  };
  contracts.forEach((c) => {
    const a = calcAmounts(c);
    if (c.status === '시공완료') sum.completed += 1;
    if (c.status === '취소') {
      sum.canceled += 1;
      sum.canceledAmount += a.actual;
      return; // 취소 건은 매출 합계에서 제외
    }
    sum.total += a.total;
    sum.discount += a.discount;
    sum.voucher += a.voucher;
    sum.actual += a.actual;
    sum.paid += a.paid;
    sum.balance += a.balance;
    Object.entries(a.paidBy).forEach(([k, v]) => {
      sum.paidBy[k] = (sum.paidBy[k] || 0) + v;
    });
  });
  return sum;
}

// 가장 이른 시공예정일 (정렬용)
export const firstScheduleDate = (c) =>
  (c.schedules || []).map((s) => s.date).filter(Boolean).sort()[0] || '';
