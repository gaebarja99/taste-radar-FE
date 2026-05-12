/**
 * 메인 페이지: 가게 목록 백엔드 연동
 * - GET /api/stores?q=&page=&size=
 */
;(function () {
  'use strict'

  const SIZE = 12

  const state = {
    query: '',
    page: 0,
    totalPages: 1,
  }

  document.addEventListener('DOMContentLoaded', init)

  function init() {
    if (!window.api) {
      setStatus('API 스크립트를 불러오지 못했습니다.', true)
      return
    }

    const form = document.getElementById('searchForm')
    const input = document.getElementById('searchInput')
    const prevBtn = document.getElementById('pagePrev')
    const nextBtn = document.getElementById('pageNext')
    const logoutBtn = document.getElementById('btnLogout')
    const loginBtn = document.getElementById('btnKakaoLogin')

    loginBtn.addEventListener('click', openRoleModal)
    setupRoleModal()

    form.addEventListener('submit', (e) => {
      e.preventDefault()
      state.query = input.value.trim()
      state.page = 0
      load()
    })

    prevBtn.addEventListener('click', () => {
      if (state.page > 0) {
        state.page -= 1
        load()
      }
    })

    nextBtn.addEventListener('click', () => {
      if (state.page < state.totalPages - 1) {
        state.page += 1
        load()
      }
    })

    logoutBtn.addEventListener('click', handleLogout)

    applyAuthUi()
    load()
  }

  /* ----------------------------- 인증 UI ----------------------------- */
  function applyAuthUi() {
    const loggedIn = api.auth.isLoggedIn()
    const loginBtn = document.getElementById('btnKakaoLogin')
    const userMenu = document.getElementById('userMenu')
    const nicknameEl = document.getElementById('userNickname')

    loginBtn.hidden = loggedIn
    userMenu.hidden = !loggedIn

    if (loggedIn) {
      const nickname = localStorage.getItem('nickname') || '회원'
      nicknameEl.textContent = nickname
    } else {
      nicknameEl.textContent = ''
    }
  }

  async function handleLogout() {
    try {
      await api.auth.logout()
    } catch {
      /* 서버 실패 여부와 무관하게 로컬은 정리 */
    }
    ;['userId', 'email', 'nickname', 'role'].forEach((k) => localStorage.removeItem(k))
    applyAuthUi()
  }

  /* ----------------------------- 역할 선택 모달 ----------------------------- */
  function setupRoleModal() {
    const modal = document.getElementById('roleModal')
    const closeBtn = document.getElementById('roleModalClose')
    if (!modal || !closeBtn) return

    closeBtn.addEventListener('click', closeRoleModal)
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeRoleModal()
    })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) closeRoleModal()
    })
  }

  function openRoleModal() {
    const modal = document.getElementById('roleModal')
    if (!modal) return
    modal.hidden = false
    document.body.style.overflow = 'hidden'
    const firstCard = modal.querySelector('.role-card')
    if (firstCard) firstCard.focus()
  }

  function closeRoleModal() {
    const modal = document.getElementById('roleModal')
    if (!modal) return
    modal.hidden = true
    document.body.style.overflow = ''
  }

  async function load() {
    const grid = document.getElementById('storeGrid')
    const count = document.getElementById('storeCount')

    grid.setAttribute('aria-busy', 'true')
    grid.innerHTML = renderSkeletons(6)
    setStatus(null)

    try {
      const result = await api.stores.search({ q: state.query, page: state.page, size: SIZE })
      const content = Array.isArray(result?.content) ? result.content : []
      state.totalPages = Math.max(1, Number(result?.totalPages ?? 1))

      const total = Number(result?.totalElements ?? content.length)
      count.textContent = `총 ${total.toLocaleString('ko-KR')}곳`

      if (content.length === 0) {
        grid.innerHTML = ''
        setStatus(
          state.query
            ? `'${state.query}' 검색 결과가 없습니다.`
            : '아직 등록된 가게가 없습니다.',
        )
      } else {
        grid.innerHTML = content.map(renderCard).join('')
      }

      updatePagination()
    } catch (e) {
      grid.innerHTML = ''
      count.textContent = ''
      setStatus(errorMessage(e), true)
      hidePagination()
    } finally {
      grid.removeAttribute('aria-busy')
    }
  }

  /* ----------------------------- 렌더링 ----------------------------- */
  function renderSkeletons(n) {
    return Array.from({ length: n })
      .map(() => '<li><div class="store-card-skeleton"></div></li>')
      .join('')
  }

  function renderCard(store) {
    const status = String(store.status || '').toUpperCase()
    const statusMod = status === 'OPEN' ? 'open' : status === 'PREPARING' ? 'preparing' : 'close'
    const statusLabel = status === 'OPEN' ? '영업 중' : status === 'PREPARING' ? '준비 중' : '영업 종료'

    const thumb = store.thumbnailUrl
      ? `<img src="${escapeAttr(store.thumbnailUrl)}" alt="" loading="lazy" />`
      : '<span aria-hidden="true">🍽️</span>'

    return `
      <li>
        <a class="store-card" href="#" data-store-id="${store.id}">
          <div class="store-thumb">
            ${thumb}
            <span class="store-thumb-status store-thumb-status--${statusMod}">
              <span class="dot" aria-hidden="true"></span>${statusLabel}
            </span>
          </div>
          <div class="store-body">
            <h2 class="store-name">${escapeHtml(store.name)}</h2>
            <p class="store-meta">
              <span class="store-rating">★ ${formatRating(store.averageRating)}</span>
              <span>리뷰 ${Number(store.reviewCount ?? 0).toLocaleString('ko-KR')}</span>
            </p>
            <p class="store-min-order">최소 주문 ${formatWon(store.minOrderAmount)}</p>
          </div>
        </a>
      </li>
    `
  }

  /* ----------------------------- 페이지네이션 ----------------------------- */
  function updatePagination() {
    const nav = document.getElementById('pagination')
    const info = document.getElementById('pageInfo')
    const prevBtn = document.getElementById('pagePrev')
    const nextBtn = document.getElementById('pageNext')

    if (state.totalPages <= 1) {
      hidePagination()
      return
    }

    nav.hidden = false
    info.textContent = `${state.page + 1} / ${state.totalPages}`
    prevBtn.disabled = state.page <= 0
    nextBtn.disabled = state.page >= state.totalPages - 1
  }

  function hidePagination() {
    const nav = document.getElementById('pagination')
    nav.hidden = true
  }

  /* ----------------------------- 상태/유틸 ----------------------------- */
  function setStatus(message, isError = false) {
    const el = document.getElementById('storeStatus')
    if (!el) return
    if (!message) {
      el.hidden = true
      el.textContent = ''
      el.classList.remove('is-error')
      return
    }
    el.hidden = false
    el.textContent = message
    el.classList.toggle('is-error', !!isError)
  }

  function errorMessage(e) {
    if (!e) return '가게 목록을 불러오지 못했습니다.'
    const msg = e.message || ''
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      return '백엔드 서버(http://localhost:8080)에 연결할 수 없습니다.'
    }
    if (e.status === 401) return '로그인이 필요합니다.'
    return msg || '가게 목록을 불러오지 못했습니다.'
  }

  function formatRating(v) {
    if (v == null || Number.isNaN(Number(v))) return '—'
    return Number(v).toFixed(1)
  }

  function formatWon(v) {
    return `${Number(v ?? 0).toLocaleString('ko-KR')}원`
  }

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function escapeAttr(text) {
    return escapeHtml(text)
  }
})()
