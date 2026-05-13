/**
 * Owner 페이지 공통 헬퍼
 * - 사이드바 동적 렌더링 (가게별 그룹 + 토글, 각 링크에 `?storeId=` 포함)
 * - 로그인/권한 가드, 가게 목록 fetch, 공용 에러 메시지
 * - `ensureOwnerStoreScope` / `bindSingleStoreSelect` 로 지점별 관리 페이지 스코프 통일
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
      showFatalMessage('API 스크립트를 불러오지 못했습니다.')
      return null
    }
    if (!api.auth.isLoggedIn()) {
      showFatalMessage('로그인이 필요합니다. 메인에서 카카오 로그인 후 다시 시도해 주세요.')
      return null
    }
    let storeList = []
    try {
      const data = await api.stores.ownerMine()
      // 응답 정규화: storeStatus → status, todayOrderCount → totalCount 등 호환 키 유지
      storeList = (Array.isArray(data) ? data : []).map((s) => ({
        storeId: s.storeId,
        storeName: s.storeName,
        status: s.storeStatus ?? s.status ?? 'PREPARING',
        isDeleted: !!s.isDeleted,
        totalCount: Number(s.todayOrderCount ?? s.totalCount ?? 0),
      }))
    } catch (e) {
      const m = errorMessage(e, '가게 목록을 불러올 수 없습니다.')
      if (e?.status === 403) {
        showFatalMessage('사장 권한이 필요한 페이지입니다.')
        return null
      }
      console.warn('[owner] storeList fetch failed:', m)
    }
    renderSidebar(storeList)
    return { storeList }
  }

  /** URL 쿼리 `?storeId=` (지점별 관리 페이지용) */
  function getStoreIdFromUrl() {
    try {
      const v = new URLSearchParams(window.location.search).get('storeId')
      if (v == null || String(v).trim() === '') return null
      return String(v).trim()
    } catch {
      return null
    }
  }

  /** 사장 하위 페이지 링크 — 가게가 있으면 반드시 storeId 포함 */
  function buildOwnerPageHref(file, storeId) {
    const sid = storeId != null && storeId !== '' ? String(storeId) : ''
    if (!sid) return `./${file}`
    return `./${file}?storeId=${encodeURIComponent(sid)}`
  }

  /**
   * 가게가 1개 이상이면 URL 에 `?storeId=` 필수 (없으면 첫 가게로 리다이렉트).
   * 잘못된 id 면 fatal. 가게 없으면 `{ success:true, store:null }`.
   */
  function ensureOwnerStoreScope(storeList, pageFile) {
    if (!storeList || storeList.length === 0) {
      return { success: true, store: null }
    }
    const urlId = getStoreIdFromUrl()
    if (!urlId) {
      window.location.replace(buildOwnerPageHref(pageFile, storeList[0].storeId))
      return { success: false, store: null }
    }
    const store = storeList.find((s) => String(s.storeId) === String(urlId))
    if (!store) {
      showFatalMessage('해당 가게를 찾을 수 없거나 접근 권한이 없습니다.')
      return { success: false, store: null }
    }
    return { success: true, store }
  }

  function bindSingleStoreSelect(selectEl, store) {
    if (!selectEl || !store) return
    selectEl.innerHTML = `<option value="${store.storeId}">${escapeHtml(store.storeName ?? '가게')}</option>`
    selectEl.disabled = true
    selectEl.value = String(store.storeId)
  }

  function bindEmptyStoreSelect(selectEl) {
    if (!selectEl) return
    selectEl.innerHTML = '<option value="">가게 없음</option>'
    selectEl.disabled = true
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
              (l) => `<li><a href="./${l.file}"${activeAttr(l.file, null, currentPageFile(), null)}>${l.label}</a></li>`,
            ).join('')}
          </ul>
        </div>
      `
      attachToggle(sidebar)
      return
    }

    const currentPage = currentPageFile()
    const urlStoreId = getStoreIdFromUrl()
    sidebar.innerHTML = `
      ${storeList
        .map((store, i) => {
          const expanded = urlStoreId != null ? String(store.storeId) === String(urlStoreId) : i === 0
          const closedBadge = store.isDeleted
            ? '<span class="sidebar-group-badge" title="폐업한 가게">폐업</span>'
            : ''
          const closedCls = store.isDeleted ? ' is-closed' : ''
          return `
            <div class="sidebar-group${closedCls}" data-collapsed="${expanded ? 'false' : 'true'}" data-store-id="${store.storeId}"${store.isDeleted ? ' data-closed="true"' : ''}>
              <div class="sidebar-group-label" role="button" tabindex="0" aria-expanded="${expanded}">
                <i class="ti ti-chevron-right" aria-hidden="true"></i>
                <span class="sidebar-group-name">${escapeHtml(store.storeName ?? '가게')}</span>
                ${closedBadge}
              </div>
              <ul class="sidebar-nav">
                ${PAGE_LINKS.map(
                  (l) =>
                    `<li><a href="${buildOwnerPageHref(l.file, store.storeId)}"${activeAttr(
                      l.file,
                      store.storeId,
                      currentPage,
                      urlStoreId,
                    )}>${l.label}</a></li>`,
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

  /**
   * @param {string|null} groupStoreId 가게 없을 때는 null
   * @param {string|null} urlStoreId   현재 URL 의 storeId
   */
  function activeAttr(file, groupStoreId, currentPage, urlStoreId) {
    const cur = currentPage ?? currentPageFile()
    if (groupStoreId == null) {
      return file === cur ? ' class="is-active"' : ''
    }
    return file === cur && String(groupStoreId) === String(urlStoreId || '') ? ' class="is-active"' : ''
  }

  function currentPageFile() {
    const last = window.location.pathname.split('/').filter(Boolean).pop()
    return last || ''
  }

  /* --------------------- 공용 유틸 --------------------- */
  function showFatalMessage(message) {
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
    getStoreIdFromUrl,
    buildOwnerPageHref,
    ensureOwnerStoreScope,
    bindSingleStoreSelect,
    bindEmptyStoreSelect,
    showFatalMessage,
  }
})()
