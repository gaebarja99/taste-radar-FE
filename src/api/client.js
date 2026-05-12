/**
 * 백엔드 호출용 fetch 래퍼.
 * - 개발: Vite 프록시가 `/api` 등을 `http://localhost:8080`으로 넘김 → 상대 경로만 쓰면 됨.
 * - 배포: `.env.production`에 `VITE_API_ORIGIN=https://api.example.com` 형태로 두고 절대 URL 사용.
 */
const origin =
  import.meta.env.VITE_API_ORIGIN?.replace(/\/$/, '') ?? ''

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${origin}${p}`
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('accessToken')
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const res = await fetch(apiUrl(path), { ...options, headers })
  return res
}
