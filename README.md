# Taste Radar — 프론트엔드 (React + Vite)

백엔드(`taste-radar-BE`)와 함께 쓰는 입맛·배달 서비스 프론트엔드입니다.

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 터미널에 표시된 주소(보통 `http://localhost:5173`)로 접속합니다.

```bash
npm run build   # 프로덕션 빌드
npm run preview # 빌드 결과 미리보기
```

개발 시 API는 Vite 프록시를 통해 `http://localhost:8080`(Spring Boot)으로 전달됩니다.

---

이 템플릿은 Vite에서 React를 쓰기 위한 최소 구성이며, HMR과 ESLint 규칙이 포함되어 있습니다.

현재 공식 플러그인은 두 가지입니다.

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) — [Oxc](https://oxc.rs) 사용
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) — [SWC](https://swc.rs/) 사용

## React Compiler

개발·빌드 성능 영향 때문에 이 템플릿에는 React Compiler가 켜져 있지 않습니다. 추가하려면 [공식 문서](https://react.dev/learn/react-compiler/installation)를 참고하세요.

## ESLint 설정 확장하기

프로덕션 수준으로 개발할 때는 TypeScript와 타입 인지(type-aware) 린트 규칙 사용을 권장합니다. TypeScript와 [`typescript-eslint`](https://typescript-eslint.io) 통합 방법은 [TS 템플릿](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts)을 참고하세요.
