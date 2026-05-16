# 🍽️ Taste Radar | HTML · CSS · JavaScript 기반 UI

**Taste Radar**는 고객이 입맛 프로필에 맞는 가게를 찾고, 장바구니에 메뉴를 담아 주문하며, 사장님이 가게·메뉴·주문·리뷰를 관리할 수 있는 배달 주문 서비스입니다.

멀티 페이지 HTML과 바닐라 JavaScript로 UI를 구현했으며, `fetch` 기반 API 클라이언트(`api.js`)로 **Spring Boot** REST API 서버와 연동합니다. 로컬 개발 시 **Vite** 개발 서버와 프록시로 CORS 없이 백엔드(`http://localhost:8080`)에 요청합니다.

| 항목 | 내용 |
| --- | --- |
| **Project** | Taste Radar FE |
| **Service** | 입맛 기반 배달 주문 · 가게/메뉴/주문/리뷰 관리 |
| **Team** | — |
| **Period** | — |

---

## 📍 목차

- [화면](#화면)
- [기술 스택](#기술-스택)
- [설계](#설계)
- [역할 분담](#역할-분담)
- [프로젝트 구조](#프로젝트-구조)
- [실행 방법](#실행-방법)

---

## 화면

### 고객

| 화면 | 경로 | 설명 |
| --- | --- | --- |
| 메인(가게 검색) | `/index.html` | 가게·메뉴 검색, 장바구니 드로어, 알림 |
| 가게 상세 | `/pages/store.html` | 메뉴 조회, 장바구니 담기, 입맛 레이더 비교 |
| 장바구니 | `/pages/cart.html` | 담은 메뉴 확인·수량 변경 |
| 주문/결제 | `/pages/checkout.html` | 주문 생성, 카카오페이 결제 |
| 결제 완료 | `/pages/payment/kakao-success.html` | 카카오페이 결제 결과 |
| 주문 내역 | `/pages/my-orders.html` | 주문 목록·상세 |
| 리뷰 작성 | `/pages/write-review.html` | 주문 후 리뷰·별점·입맛 태그 |
| 내 리뷰 | `/pages/my-reviews.html` | 작성한 리뷰 목록 |
| 입맛 온보딩 | `/pages/taste-onboarding.html` | 입맛 프로필 설정 |
| 내 프로필 | `/pages/my-profile.html` | 닉네임·비밀번호 등 계정 정보 |
| 알림 | `/pages/notifications.html` | 주문·리뷰 등 알림 목록 |

### 인증

| 화면 | 경로 | 설명 |
| --- | --- | --- |
| 로그인 | `/pages/auth/login.html` | 이메일·카카오 로그인 |
| 회원가입 | `/pages/auth/register.html` | 이메일 회원가입 |
| OAuth 콜백 | `/pages/auth/callback.html` | 카카오 로그인 토큰 처리 |

### 사장님(Owner)

| 화면 | 경로 | 설명 |
| --- | --- | --- |
| 대시보드 | `/pages/owner/owner-main.html` | 매출·주문 요약 |
| 가게 관리 | `/pages/owner/owner-store-manage.html` | 가게 정보·영업 설정 |
| 메뉴 관리 | `/pages/owner/owner-menu-manage.html` | 메뉴 CRUD |
| 주문 관리 | `/pages/owner/owner-order-manage.html` | 주문 접수·상태 변경 |
| 리뷰 관리 | `/pages/owner/owner-review-manage.html` | 고객 리뷰 조회·응답 |

---

## 기술 스택

| 구분 | 기술 |
| --- | --- |
| 마크업·스타일 | HTML5, CSS3 |
| 스크립트 | JavaScript (ES Modules + IIFE 페이지 스크립트) |
| 빌드·개발 서버 | Vite |
| API 연동 | `fetch`, REST, JWT (`localStorage`) |
| 백엔드 | Spring Boot (`taste-radar-BE`) |
| 외부 연동 | 카카오 로그인(OAuth2), 카카오페이, 카카오맵 |
| UI 리소스 | Tabler Icons, Noto Sans KR |
| 보조 | React (`src/`) — 개발용·확장 영역 |

---

## 설계

### API 클라이언트 (`public/assets/js/api.js`)

- `window.api` 네임스페이스로 인증, 가게, 메뉴, 장바구니, 주문, 리뷰, 결제, 알림 등 REST 엔드포인트를 래핑합니다.
- `accessToken` / `refreshToken`은 `localStorage`에 저장하며, 요청 시 `Authorization` 헤더를 붙입니다.

### 페이지 구성

- **고객**: `index.html` + `public/pages/` 하위 HTML, 페이지별 JS·CSS 분리
- **사장님**: `public/pages/owner/` + `owner-shared.js`의 `bootstrap()`으로 공통 인증·사이드바·가게 컨텍스트 로드

### 로컬 개발 프록시 (`vite.config.js`)

브라우저는 Vite(`5173`)에만 요청하고, `/api`, `/oauth2`, `/login` 경로는 Spring Boot(`8080`)로 프록시됩니다.

### 입맛(Taste) 기능

- 온보딩·리뷰·가게 상세에서 **입맛 레이더 차트**로 사용자·가게 프로필을 시각화합니다 (`review-shared.js`, `store.js`).

---

## 역할 분담

| 구분 | 담당 | 주요 작업 |
| --- | --- | --- |
| FE | — | 고객/사장님 UI, `api.js`, 페이지별 JS·CSS |
| BE | — | REST API, 인증, 주문·결제·리뷰 도메인 |
| 기획·디자인 | — | 화면 정의, UX 플로우 |

> 팀·기간·담당자는 프로젝트에 맞게 표를 수정해 주세요.

---

## 프로젝트 구조

```
.
├── .gitignore
├── index.html                 # 메인(가게 검색)
├── package.json
├── vite.config.js
├── eslint.config.js
├── README.md
│
├── public/
│   ├── favicon.svg
│   ├── icons.svg
│   ├── assets/
│   │   ├── css/               # 페이지·컴포넌트별 스타일
│   │   └── js/
│   │       ├── api.js         # 백엔드 API 클라이언트
│   │       ├── auth-*.js      # 로그인·회원가입
│   │       ├── index.js       # 메인 페이지
│   │       ├── store.js       # 가게 상세
│   │       ├── cart-page.js
│   │       ├── checkout-page.js
│   │       ├── owner-*.js     # 사장님 화면 공통·개별
│   │       └── ...
│   └── pages/
│       ├── auth/              # login, register, callback
│       ├── cart.html
│       ├── checkout.html
│       ├── store.html
│       ├── my-orders.html
│       ├── my-reviews.html
│       ├── my-profile.html
│       ├── write-review.html
│       ├── taste-onboarding.html
│       ├── notifications.html
│       ├── payment/
│       │   └── kakao-success.html
│       └── owner/             # 사장님 관리 화면
│
└── src/                       # Vite + React (보조)
    ├── main.jsx
    ├── App.jsx
    ├── api/client.js
    └── components/
```

---

## 실행 방법

### 사전 요구

- Node.js 18+
- [taste-radar-BE](https://github.com/) Spring Boot 서버 로컬 실행 (`http://localhost:8080`)

### 설치 및 개발 서버

```bash
npm install
npm run dev
```

브라우저에서 터미널에 표시된 주소(보통 `http://localhost:5173`)로 접속합니다.

### 빌드·미리보기

```bash
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기
npm run lint     # ESLint
```

### 환경 변수

API 기본 URL은 `public/assets/js/api.js`의 `COMMON_URL`(`http://localhost:8080`)을 사용합니다. 배포 환경에 맞게 수정하거나 빌드 단계에서 치환해 주세요.

---

## 관련 저장소

- **Backend**: `taste-radar-BE` (Spring Boot REST API)
