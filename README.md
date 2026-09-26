# UFFICE — 전자계약 · 시공일정 관리

## 실행

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # 배포용 빌드 (frontend/dist)
```

테스트 계정: `super / super1234` (운영자), `admin / admin1234` (업체 관리자), `manager / manager1234` (실장)

> 현재는 백엔드 없이 브라우저(localStorage)에 데이터를 저장하는 단계입니다.
> 점검 결과·권한 구조·백엔드 선택·남은 작업: [docs/REVIEW.md](docs/REVIEW.md)
> 배포(Vercel)·도메인: [docs/DEPLOY.md](docs/DEPLOY.md)
