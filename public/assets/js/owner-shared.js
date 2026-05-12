/**
 * Owner 페이지 공통 헬퍼
 * - 사이드바 동적 렌더링 (가게별 그룹 + 토글)
 * - 로그인/권한 가드, 가게 목록 fetch, 공용 에러 메시지
 *
 * 페이지에서 사용:
 *   const ctx = await OwnerShared.bootstrap()
 *   if (!ctx) return  // 로그인/권한 부족 시 자동 안내 후 종료
 *   const { storeList } = ctx
 */
;(function () {
  'use strict'

  // 사이드바 각 가게 그룹에 표시할 메뉴
  // (대시보드는 상단바의 "Taste Radar" 로고로 이동하므로 사이드바에선 제외)
  const PAGE_LINKS = [
    { file: 'owner-store-manage.html', label: '가게 관리' },
    { file: 'owner-order-manage.html', label: '주문 관리' },
    { file: 'owner-review-manage.html',label: '리뷰 관리' },
    { file: 'owner-menu-manage.html',  label: '메뉴 관리' },
  ]

  async function bootstrap() {
    if (!window.api) {
      showFatal('API 스크립트를 불러오지 못했습니다.')
      return null
    }
    if (!api.auth.isLoggedIn()) {
      showFatal('로그인이 필요합니다. 메인에서 카카오 로그인 후 다시 시도해 주세요.')
      return null
    }
    let storeList = []
    try {
      const data = await api.orders.owner.todayStatsByStore()
      storeList = Array.isArray(data) ? data : []
    } catch (e) {
      const m = errorMessage(e, '가게 목록을 불러올 수 없습니다.')
      if (e?.status === 403) {
        showFatal('사장 권한이 필요한 페이지입니다.')
        return null
      }
      // 가게 목록만 실패한 경우엔 빈 사이드바로 진행 가능
      console.warn('[owner] storeList fetch failed:', m)
    }
    renderSidebar(storeList)
    return { storeList }
  }

  /* --------------------- 사이드바 --------------------- */
  function renderSidebar(storeList) {
    const sidebar = document.querySelector('aside.sidebar')
    if (!sidebar) return

    if (!storeList || storeList.length === 0) {
      sidebar.innerHTML = `
        <div class="sidebar-group" data-collapsed="false">
          <div class="sidebar-group-label">내 가게 없음</div>
          <ul class="sidebar-nav">
            ${PAGE_LINKS.map(
              (l) => `<li><a href="./${l.file}"${activeAttr(l.file, true)}>${l.label}</a></li>`,
            ).join('')}
          </ul>
        </div>
      `
      attachToggle(sidebar)
      return
    }

    const currentPage = currentPageFile()
    sidebar.innerHTML = `
      ${storeList
        .map((store, i) => {
          const isFirst = i === 0
          return `
            <div class="sidebar-group" data-collapsed="${isFirst ? 'false' : 'true'}" data-store-id="${store.storeId}">
              <div class="sidebar-group-label" role="button" tabindex="0" aria-expanded="${isFirst}">
                <i class="ti ti-chevron-right" aria-hidden="true"></i>
                <span class="sidebar-group-name">${escapeHtml(store.storeName ?? '가게')}</span>
              </div>
              <ul class="sidebar-nav">
                ${PAGE_LINKS.map(
                  (l) =>
                    `<li><a href="./${l.file}"${activeAttr(l.file, isFirst, currentPage)}>${l.label}</a></li>`,
                ).join('')}
              </ul>
            </div>
          `
        })
        .join('')}
    `
    attachToggle(sidebar)
  }

  function attachToggle(sidebar) {
    sidebar.querySelectorAll('.sidebar-group-label[role="button"]').forEach((label) => {
      label.addEventListener('click', () => toggleGroup(label))
      label.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggleGroup(label)
        }
      })
    })
  }

  function toggleGroup(label) {
    const group = label.closest('.sidebar-group')
    if (!group) return
    const collapsed = group.dataset.collapsed === 'true'
    group.dataset.collapsed = collapsed ? 'false' : 'true'
    label.setAttribute('aria-expanded', String(collapsed))
  }

  function activeAttr(file, isFirstGroup, currentPage) {
    const cur = currentPage ?? currentPageFile()
    return file === cur && isFirstGroup ? ' class="is-active"' : ''
  }

  function currentPageFile() {
    const last = window.location.pathname.split('/').filter(Boolean).pop()
    return last || ''
  }

  /* --------------------- 공용 유틸 --------------------- */
  function showFatal(message) {
    const main = document.querySelector('.main') || document.body
    main.innerHTML = `
      <section class="card" style="padding:32px;text-align:center">
        <h2 class="card-title" style="margin:0 0 8px">동작할 수 없는 페이지</h2>
        <p style="margin:0;color:var(--color-text-muted)">${escapeHtml(message)}</p>
        <p style="margin:18px 0 0">
          <a href="/" style="color:var(--color-primary);font-weight:700">메인으로 돌아가기</a>
        </p>
      </section>
    `
  }

  function errorMessage(e, fallback) {
    if (!e) return fallback
    if (e.status === 401) return '로그인이 필요합니다.'
    if (e.status === 403) return '사장 권한이 필요합니다.'
    return e.message || fallback
  }

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function formatWon(v) {
    return `${Number(v ?? 0).toLocaleString('ko-KR')}원`
  }

  function statusLabel(status) {
    switch (status) {
      case 'OPEN':       return '영업 중'
      case 'PREPARING':  return '준비 중'
      case 'CLOSE':      return '영업 종료'
      case 'PENDING':    return '신규 주문'
      case 'ACCEPTED':   return '수락됨'
      case 'COOKING':    return '조리 중'
      case 'DELIVERING': return '배달 중'
      case 'DELIVERED':  return '배달 완료'
      case 'REJECTED':   return '주문 거절'
      case 'CANCELED':   return '주문 취소'
      default:           return status || '-'
    }
  }

  window.OwnerShared = {
    bootstrap,
    renderSidebar,
    errorMessage,
    escapeHtml,
    formatWon,
    statusLabel,
  }
})()
