import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'

/**
 * 공개 API `GET /api/stores`로 백엔드 연결을 확인하는 최소 예시 (fetch / AJAX).
 */
export default function BackendPing() {
  const [state, setState] = useState({ loading: true, ok: null, detail: '' })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch('/api/stores?page=0&size=1')
        const text = await res.text()
        if (cancelled) return
        if (!res.ok) {
          setState({ loading: false, ok: false, detail: `${res.status} ${text.slice(0, 120)}` })
          return
        }
        setState({ loading: false, ok: true, detail: 'GET /api/stores 응답 수신' })
      } catch (e) {
        if (!cancelled) {
          setState({ loading: false, ok: false, detail: e instanceof Error ? e.message : String(e) })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (state.loading) {
    return <p className="backend-ping">백엔드 연결 확인 중…</p>
  }
  return (
    <p className="backend-ping" data-ok={state.ok}>
      {state.ok ? '백엔드 연결됨' : '백엔드 연결 실패'} — {state.detail}
    </p>
  )
}
