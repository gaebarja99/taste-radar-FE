# 🍽️ Taste Radar | HTML · CSS · JavaScript 기반 UI

**Taste Radar**는 고객이 입맛 프로필에 맞는 가게를 찾고, 장바구니에 메뉴를 담아 주문하며, 사장님이 가게·메뉴·주문·리뷰를 관리할 수 있는 배달 주문 서비스입니다.

## 📍 목차

[![화면](https://img.shields.io/badge/화면-FF6B6B?style=for-the-badge)](#화면)
[![기술 스택](https://img.shields.io/badge/기술%20스택-4DABF7?style=for-the-badge)](#기술-스택)
[![프로젝트 구조](https://img.shields.io/badge/프로젝트%20구조-ADB5BD?style=for-the-badge)](#프로젝트-구조)

---

## 화면
<details>
  <summary>🔍 고객</summary>

  ### 메인 화면(가게 검색) -> 가게·메뉴 검색
<img width="1956" height="1897" alt="image" src="https://github.com/user-attachments/assets/1e115104-afc4-4a2d-b8a9-65413a9aeb7c" />



  ### 가게 상세 -> 메뉴 조회, 장바구니 담기, 입맛 레이더 비교
  <img width="1763" height="1873" alt="image" src="https://github.com/user-attachments/assets/7e29dfa6-898e-4356-a371-1b21bfd29c77" />



  ### 장바구니 -> 담은 메뉴 확인·수량 변경
  <img width="1736" height="792" alt="image" src="https://github.com/user-attachments/assets/d4e3eedc-d826-4171-9b4c-7bbe732c50ec" />



  ### 주문/결제 -> 주문 생성, 카카오페이 결제
  <img width="1745" height="1203" alt="image" src="https://github.com/user-attachments/assets/8cea14fd-8920-457b-9f78-e58eab64b88f" />
  <img width="726" height="731" alt="image" src="https://github.com/user-attachments/assets/4254d745-aad2-4c88-b4bd-63f999bf7c3e" />



  ### 결제 완료 -> 카카오페이 결제 결과
  <img width="1058" height="396" alt="image" src="https://github.com/user-attachments/assets/b40125bb-d09a-4691-8490-6fc58f947fad" />



  ### 주문 내역 -> 주문 목록·상세
  <img width="1748" height="1207" alt="image" src="https://github.com/user-attachments/assets/92a9db0f-0ec9-43db-b43a-d39562887525" />



  ### 리뷰 작성 -> 주문 후 리뷰·별점·입맛 태그
  <img width="1760" height="1660" alt="image" src="https://github.com/user-attachments/assets/f339a2dc-2d2f-4183-9d8f-c3e9b3089d24" />



  ### 입맛 온보딩 -> 입맛 프로필 설정
  <img width="763" height="577" alt="image" src="https://github.com/user-attachments/assets/09e48526-e227-4fb5-b244-8de827d2d48f" />



  ### 내 프로필 -> 닉네임·비밀번호 등 계정 정보
  <img width="1519" height="1236" alt="제목 없음" src="https://github.com/user-attachments/assets/f26cf147-1ac4-43d9-b35f-8111b84dd983" />



  ### 알림 -> 주문·리뷰 등 알림 목록
  <img width="760" height="878" alt="image" src="https://github.com/user-attachments/assets/bfeb50be-1776-45a2-884f-a358fc9b5f18" />
</details>
<details>
  <summary>🔍 사장</summary>
  
  ### 대시보드 -> 매출·주문 요약
  <img width="1777" height="1185" alt="image" src="https://github.com/user-attachments/assets/e2d9b836-bc42-4832-9506-d42b5e06b721" />

  ### 가게 관리 -> 가게 정보·영업 설정
  <img width="1753" height="1353" alt="image" src="https://github.com/user-attachments/assets/b7243cda-f750-4094-a142-17cd106d942d" />

  ### 메뉴 관리 -> 메뉴 CRUD
  <img width="1752" height="1400" alt="image" src="https://github.com/user-attachments/assets/c7499a28-b206-4d07-9e35-b7c0aa9ab969" />

  ### 주문 관리 -> 주문 접수·상태 변경
  <img width="1752" height="1405" alt="image" src="https://github.com/user-attachments/assets/8f8c8d80-9b30-4247-9391-0dc3c7eb3492" />

  ### 리뷰 관리 -> 고객 리뷰 조회·응답
  <img width="1722" height="1619" alt="image" src="https://github.com/user-attachments/assets/4cc2210e-32ae-4746-a30e-5d46d68ebfe1" />

</details>
<details>
  <summary>🔍 로그인</summary>
  
   ### 역할 분기
   <img width="639" height="650" alt="image" src="https://github.com/user-attachments/assets/69b2e673-9f4d-4b0a-befe-532a80ae6705" />
   
   ### 이메일 로그인
   <img width="715" height="800" alt="image" src="https://github.com/user-attachments/assets/7365a2e9-c991-44e5-a25b-8573f0c23573" />
   
   ### 회원가입
   <img width="692" height="1101" alt="image" src="https://github.com/user-attachments/assets/89724c8e-9fd2-44dd-b552-7f4da81fd375" />


</details>

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

## 프로젝트 구조

```text
.
├── .gitignore
├── index.html                 # 메인(가게 검색·지도)
├── package.json
├── package-lock.json
├── vite.config.js
├── eslint.config.js
├── README.md
│
├── public/
│   ├── favicon.svg
│   ├── icons.svg
│   │
│   ├── assets/
│   │   ├── css/
│   │   │   ├── auth-local.css
│   │   │   ├── cart-pages.css
│   │   │   ├── checkout-pages.css
│   │   │   ├── customer-buttons.css
│   │   │   ├── customer-drawer.css
│   │   │   ├── index.css
│   │   │   ├── kakao-auth.css
│   │   │   ├── my-orders-pages.css
│   │   │   ├── notification-dropdown.css
│   │   │   ├── notifications-pages.css
│   │   │   ├── owner-main.css
│   │   │   ├── owner-order-manage.css
│   │   │   ├── owner-pages.css
│   │   │   ├── profile-pages.css
│   │   │   ├── review-pages.css
│   │   │   ├── store-pages.css
│   │   │   ├── tabler-icons.min.css
│   │   │   └── taste-onboarding.css
│   │   │
│   │   ├── fonts/
│   │   │   ├── tabler-icons.woff
│   │   │   └── tabler-icons.woff2
│   │   │
│   │   └── js/
│   │       ├── api.js                 # 백엔드 API 클라이언트
│   │       ├── auth-login.js
│   │       ├── auth-register.js
│   │       ├── auth-shared.js
│   │       ├── cart-page.js
│   │       ├── checkout-page.js
│   │       ├── customer-menu.js
│   │       ├── customer-notifications.js
│   │       ├── index.js                 # 메인 페이지
│   │       ├── kakao-brand.js
│   │       ├── kakao-pay-return.js
│   │       ├── my-orders-page.js
│   │       ├── my-profile-page.js
│   │       ├── my-reviews-page.js
│   │       ├── owner-main.js
│   │       ├── owner-menu-manage.js
│   │       ├── owner-order-manage.js
│   │       ├── owner-review-manage.js
│   │       ├── owner-shared.js
│   │       ├── owner-store-manage.js
│   │       ├── review-shared.js
│   │       ├── store.js
│   │       ├── taste-onboarding-page.js
│   │       └── write-review-page.js
│   │
│   └── pages/
│       ├── auth/
│       │   ├── callback.html
│       │   ├── login.html
│       │   └── register.html
│       │
│       ├── owner/
│       │   ├── owner-main.html
│       │   ├── owner-menu-manage.html
│       │   ├── owner-order-manage.html
│       │   ├── owner-review-manage.html
│       │   └── owner-store-manage.html
│       │
│       ├── payment/
│       │   └── kakao-success.html
│       │
│       ├── cart.html
│       ├── checkout.html
│       ├── my-orders.html
│       ├── my-profile.html
│       ├── my-reviews.html
│       ├── notifications.html
│       ├── store.html
│       ├── taste-onboarding.html
│       └── write-review.html
│
└── src/                         # Vite + React (보조·개발용)
    ├── main.jsx
    ├── App.jsx
    ├── App.css
    ├── index.css
    ├── load-kakao-map.js
    ├── api/
    │   └── client.js
    ├── assets/
    │   ├── hero.png
    │   ├── react.svg
    │   └── vite.svg
    └── components/
        └── BackendPing.jsx
```
```

