// 업무 코드값 모음. 추후 '설정' 메뉴에서 업체별로 관리하도록 확장할 값들입니다.

export const BRANDS = ['더좋은집', '더스타트'];

export const CATEGORIES = ['청소', '줄눈', '나노코팅', '탄성', '코팅', '기타'];

export const RECEPTION_TYPES = ['음성', '박람회', '온라인', '소개', '기타'];

// 시공상태
export const WORK_STATUS = ['미정', '확정', '시공중', '시공완료', '취소'];

// 전자계약(서명) 상태
export const ESIGN_STATUS = {
  NONE: '미발송',
  WAITING: '서명대기',
  SIGNED: '서명완료',
};

export const PAYMENT_METHODS = ['카드', '현금', '계좌이체'];

// 계약목록 날짜검색 기준
export const DATE_TYPES = [
  { value: 'contractDate', label: '계약일' },
  { value: 'scheduleDate', label: '시공예정일' },
  { value: 'completedDate', label: '시공완료일' },
  { value: 'canceledDate', label: '취소일' },
  { value: 'createdAt', label: '등록일' },
];

export const SORT_OPTIONS = [
  { value: 'contractDate_desc', label: '계약일순(최신)' },
  { value: 'contractDate_asc', label: '계약일순(과거)' },
  { value: 'scheduleDate_asc', label: '시공예정일순' },
  { value: 'no_desc', label: '번호순' },
];

export const MAX_SCHEDULE_STEPS = 3;
