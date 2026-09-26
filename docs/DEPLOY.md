# 배포 가이드 (Vercel)

저장소 루트의 `vercel.json` 에 빌드 설정이 들어 있어서, Vercel 대시보드에서 따로 입력할 값은 없습니다.

```json
{
  "installCommand": "npm install --prefix frontend",
  "buildCommand": "npm run build --prefix frontend",
  "outputDirectory": "frontend/dist"
}
```

## 1. 처음 연결하기

1. https://vercel.com 에 GitHub 계정으로 로그인
2. **Add New… → Project** → `lucetaseo/uffices` 옆 **Import**
   - 목록에 없으면 "Adjust GitHub App Permissions" 를 눌러 Vercel 앱에 이 저장소 접근을 허용
3. 설정 화면에서 **Root Directory 는 그대로(`./`)** 두고 **Deploy**
4. 1~2분 뒤 `uffices-xxxx.vercel.app` 주소가 생깁니다

## 2. 브랜치와 배포

| 브랜치 | 배포 종류 | 주소 |
|--------|-----------|------|
| `main` | Production (실서비스) | `프로젝트명.vercel.app` / 연결한 도메인 |
| 그 외 (`claude/...` 등) | Preview (미리보기) | 푸시할 때마다 별도 주소 생성 |

→ 작업 브랜치를 푸시하면 미리보기 주소로 먼저 확인하고, PR 을 `main` 에 머지하면 실서비스에 반영됩니다.

## 3. 다른 Vercel 계정/프로젝트로 다시 연결하기

- **프로젝트만 새로 만들기**: 위 1번을 반복하면 같은 저장소로 프로젝트를 하나 더 만들 수 있습니다 (예: 테스트용/실서비스용 분리).
- **연결 해제 후 재연결**: 프로젝트 → Settings → Git → **Disconnect** → 다시 **Connect Git Repository** 에서 저장소 선택.
- **다른 계정(또는 팀)으로 옮기기**: 프로젝트 → Settings → General → **Transfer Project**. 새 계정에서 GitHub 저장소 접근 허용이 다시 필요합니다.

## 4. 요금 — 결정 전에 확인할 점

- **Hobby(무료)**: 개인·**비상업** 용도로만 허용됩니다. 업체에 돈을 받고 제공하는 서비스라면 약관상 **Pro 요금제**가 필요합니다 (팀원 1명당 월 과금, 가격은 vercel.com/pricing 에서 확인).
  - 프로젝트를 여러 개 만드는 것 자체는 무료 요금제에서도 됩니다. 결제가 필요한 기준은 "개수"보다 **상업적 사용 여부와 팀원 수**입니다.
- 비용을 아끼려면 대안: **Cloudflare Pages** (무료 요금제도 상업 사용 가능, 설정은 거의 동일: 빌드 명령 `npm run build --prefix frontend`, 출력 폴더 `frontend/dist`).
- 추천: 개발·시연 기간에는 Hobby 로 쓰고, 실제 업체에 판매/운영을 시작할 때 Pro 로 올리거나 Cloudflare 로 옮기는 방식.

## 5. 도메인 연결 (구입 시)

1. 가비아·카페24·Cloudflare 등에서 도메인 구입 (예: `uffice.co.kr`)
2. Vercel 프로젝트 → Settings → **Domains** → 도메인 입력
3. 화면에 나오는 DNS 값(보통 `A 76.76.21.21` 또는 `CNAME cname.vercel-dns.com`)을 도메인 구입처 DNS 설정에 입력
4. HTTPS 인증서는 자동 발급됩니다

업체별 주소가 필요해지면 `더좋은집.uffice.co.kr` 처럼 서브도메인을 업체마다 붙이는 방식으로 확장할 수 있습니다.

## 6. 주의 — 지금 배포하면 "데모"입니다

백엔드가 연결되기 전까지 데이터는 **각 사용자의 브라우저에만** 저장됩니다. 다른 PC에서 보면 데이터가 다르고, 브라우저 데이터를 지우면 사라집니다. 화면 상단에 "데모 모드 · 브라우저 저장" 표시가 뜨는 이유입니다. 실제 고객 정보는 백엔드 연결 후에 입력하세요.
