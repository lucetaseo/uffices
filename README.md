# UFFICE — 전자계약 · 시공일정 관리

## 두 가지 실행 모드

| 모드 | 데이터 저장 | 용도 |
|---|---|---|
| **서버 모드** (`VITE_API_MODE=server`) | Supabase(PostgreSQL) — 모든 PC가 같은 데이터 | 실서비스 |
| **데모 모드** (기본) | 각 브라우저(localStorage) | 화면 시연·개발 |

업무 로직(권한 검사, 휴무 규칙 등)은 두 모드가 **같은 코드**를 사용합니다 (`frontend/src/api/`).

## 배포 · 서버 연결

👉 [docs/DEPLOY.md](docs/DEPLOY.md) — Supabase + Vercel 연결 방법 (웹 화면 설정만으로 가능)

## 빠른 실행 (데모 모드)

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

데모 계정: `super / super1234` (운영자), `admin / admin1234` (업체 관리자), `manager / manager1234` (실장), `gong / gong1234` (기사모바일)

## 문서

- [docs/REVIEW.md](docs/REVIEW.md) — 점검 결과 · 권한 구조 · 휴무 규칙 · 남은 작업
- [docs/DEPLOY.md](docs/DEPLOY.md) — 배포 · 서버 연결 · 요금 · 도메인

## 폴더 구조

```
api/rpc.js          Vercel 서버 함수 (POST /api/rpc)
server/             서버: 요청 처리, PostgreSQL 연결, 로그인 쿠키, 비밀번호 암호화, DB 자동 준비
frontend/           화면 (React + Vite)
  src/api/          업무 로직 (브라우저·서버 공용)
```
