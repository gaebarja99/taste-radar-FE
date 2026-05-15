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

  const OWNER_TOP_NAV = [
    { file: 'owner-main.html', label: '대시보드', icon: 'ti-layout-dashboard', scoped: false },
    { file: 'owner-store-manage.html', label: '가게 관리', icon: 'ti-building-store', scoped: true },
    { file: 'owner-order-manage.html', label: '주문 관리', icon: 'ti-clipboard-list', scoped: true },
    { file: 'owner-review-manage.html', label: '리뷰 관리', icon: 'ti-message-2', scoped: true },
    { file: 'owner-menu-manage.html', label: '메뉴 관리', icon: 'ti-tools-kitchen-2', scoped: true },
  ]

  function isScopedOwnerPage(page = currentPageFile()) {
    return OWNER_TOP_NAV.some((p) => p.scoped && p.file === page)
  }

  async function bootstrap(options = {}) {
    const skipSidebar = !!options.skipSidebar
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
    if (!skipSidebar) renderSidebar(storeList)
    renderOwnerTopNav()
    return { storeList }
  }

  function resolveNavStoreId() {
    const urlId = getStoreIdFromUrl()
    if (urlId) return urlId
    const first = sidebarState.stores.find((s) => !s.isDeleted) ?? sidebarState.stores[0]
    return first?.storeId ?? null
  }

  function renderOwnerTopNav() {
    const inner = document.querySelector('.topbar-inner')
    if (!inner) return

    const currentPage = currentPageFile()
    const storeId = resolveNavStoreId()

    let nav = inner.querySelector('.owner-topnav')
    if (!nav) {
      nav = document.createElement('nav')
      nav.className = 'owner-topnav'
      nav.setAttribute('aria-label', '사장 관리 메뉴')
      const homeBtn = inner.querySelector('.topbar-menu')
      if (homeBtn) inner.insertBefore(nav, homeBtn)
      else inner.appendChild(nav)
    }

    nav.innerHTML = OWNER_TOP_NAV.map((item) => {
      const href = item.scoped
        ? buildOwnerPageHref(item.file, storeId)
        : `./${item.file}`
      const isActive = item.file === currentPage
      return `
        <a
          href="${href}"
          class="owner-topnav-link${isActive ? ' is-active' : ''}"
          ${isActive ? ' aria-current="page"' : ''}
        >
          <i class="ti ${item.icon}" aria-hidden="true"></i>
          <span>${escapeHtml(item.label)}</span>
        </a>
      `
    }).join('')
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
   * 가게가 1개 이상이면 URL 에 `?storeId=` 필수 (없으면 첫 운영 가게로 리다이렉트).
   * 잘못된 id 면 fatal. 가게 없으면 `{ success:true, store:null }`.
   */
  function ensureOwnerStoreScope(storeList, pageFile) {
    if (!storeList || storeList.length === 0) {
      return { success: true, store: null }
    }
    const urlId = getStoreIdFromUrl()
    if (!urlId) {
      const first = storeList.find((s) => !s.isDeleted) ?? storeList[0]
      window.location.replace(buildOwnerPageHref(pageFile, first.storeId))
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
  const sidebarState = {
    stores: [],
    filter: 'all',
    search: '',
    chromeReady: false,
  }

  function renderSidebar(storeList) {
    sidebarState.stores = Array.isArray(storeList) ? storeList : []
    const sidebar = document.querySelector('aside.sidebar')
    if (!sidebar) return

    if (!sidebarState.stores.length) {
      sidebarState.chromeReady = false
      sidebar.innerHTML = `
        <p class="sidebar-empty" style="margin:16px 12px">등록된 가게가 없어요.<br />상단 「가게 관리」에서 새 가게를 추가해 보세요.</p>
      `
      return
    }

    ensureSidebarChrome(sidebar)
    paintSidebarStores(sidebar)
  }

  function ensureSidebarChrome(sidebar) {
    if (sidebarState.chromeReady) return

    sidebar.innerHTML = `
      <div class="sidebar-toolbar">
        <label class="visually-hidden" for="sidebarStoreSearch">가게명 검색</label>
        <input
          id="sidebarStoreSearch"
          class="sidebar-search"
          type="search"
          placeholder="가게명 검색"
          autocomplete="off"
        />
        <div class="sidebar-filter" role="tablist" aria-label="가게 목록 필터">
          <button type="button" class="sidebar-filter-btn is-active" data-filter="all" role="tab" aria-selected="true">전체</button>
          <button type="button" class="sidebar-filter-btn" data-filter="active" role="tab" aria-selected="false">운영 중</button>
          <button type="button" class="sidebar-filter-btn" data-filter="closed" role="tab" aria-selected="false">폐업</button>
        </div>
      </div>
      <div class="sidebar-stores" aria-live="polite"></div>
    `

    const searchEl = sidebar.querySelector('#sidebarStoreSearch')
    searchEl?.addEventListener('input', () => {
      sidebarState.search = searchEl.value
      paintSidebarStores(sidebar)
    })

    sidebar.querySelectorAll('.sidebar-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        sidebarState.filter = btn.dataset.filter || 'all'
        sidebar.querySelectorAll('.sidebar-filter-btn').forEach((b) => {
          const on = b === btn
          b.classList.toggle('is-active', on)
          b.setAttribute('aria-selected', String(on))
        })
        paintSidebarStores(sidebar)
      })
    })

    sidebar.addEventListener('click', (e) => {
      const sectionLabel = e.target.closest('.sidebar-section-label[role="button"]')
      if (sectionLabel) toggleSection(sectionLabel)
    })

    sidebar.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      const sectionLabel = e.target.closest('.sidebar-section-label[role="button"]')
      if (sectionLabel) {
        e.preventDefault()
        toggleSection(sectionLabel)
      }
    })

    sidebarState.chromeReady = true
  }

  function filterSidebarStores(stores) {
    const q = sidebarState.search.trim().toLowerCase()
    return stores.filter((s) => {
      if (sidebarState.filter === 'active' && s.isDeleted) return false
      if (sidebarState.filter === 'closed' && !s.isDeleted) return false
      if (!q) return true
      return String(s.storeName ?? '가게').toLowerCase().includes(q)
    })
  }

  function paintSidebarStores(sidebar) {
    const host = sidebar.querySelector('.sidebar-stores')
    if (!host) return

    const searchEl = sidebar.querySelector('#sidebarStoreSearch')
    if (searchEl && searchEl.value !== sidebarState.search) {
      searchEl.value = sidebarState.search
    }

    const filtered = filterSidebarStores(sidebarState.stores)
    const activeStores = filtered.filter((s) => !s.isDeleted)
    const closedStores = filtered.filter((s) => s.isDeleted)
    const urlStoreId = getStoreIdFromUrl()
    const currentStore = urlStoreId
      ? sidebarState.stores.find((s) => String(s.storeId) === String(urlStoreId))
      : null
    const currentIsClosed = !!currentStore?.isDeleted
    const hasSearch = !!sidebarState.search.trim()

    const toolbar = sidebar.querySelector('.sidebar-toolbar')
    if (toolbar) toolbar.hidden = !isScopedOwnerPage()

    if (!isScopedOwnerPage()) {
      host.innerHTML = `<p class="sidebar-empty sidebar-hint">가게별 관리는 상단 탭(가게·주문·리뷰·메뉴)에서 할 수 있어요.</p>`
      return
    }

    const sections = []
    if (sidebarState.filter !== 'closed' && activeStores.length) {
      sections.push(
        renderSidebarSection('운영 중', activeStores, {
          sectionKey: 'active',
          collapsed: currentIsClosed && !hasSearch,
          urlStoreId,
        }),
      )
    }
    if (sidebarState.filter !== 'active' && closedStores.length) {
      sections.push(
        renderSidebarSection('폐업', closedStores, {
          sectionKey: 'closed',
          sectionClass: 'sidebar-section--closed',
          collapsed: !currentIsClosed && !hasSearch && sidebarState.filter === 'all',
          urlStoreId,
        }),
      )
    }

    host.innerHTML = sections.length
      ? sections.join('')
      : '<p class="sidebar-empty">조건에 맞는 가게가 없어요.</p>'
  }

  function renderSidebarSection(title, stores, opts) {
    const { sectionKey, sectionClass = '', collapsed = false, urlStoreId } = opts
    const urlStoreInSection = urlStoreId && stores.some((s) => String(s.storeId) === String(urlStoreId))
    const sectionCollapsed = collapsed && !urlStoreInSection && !sidebarState.search.trim()
    const sectionCls = ['sidebar-section', sectionClass].filter(Boolean).join(' ')

    return `
      <section class="${sectionCls}" data-section="${sectionKey}" data-collapsed="${sectionCollapsed ? 'true' : 'false'}">
        <div class="sidebar-section-label" role="button" tabindex="0" aria-expanded="${!sectionCollapsed}">
          <span class="sidebar-section-title">
            <i class="ti ti-chevron-right" aria-hidden="true"></i>
            ${escapeHtml(title)}
          </span>
          <span class="sidebar-section-count">${stores.length}</span>
        </div>
        <div class="sidebar-section-body sidebar-store-list">
          ${stores.map((store) => renderStoreListItem(store, urlStoreId)).join('')}
        </div>
      </section>
    `
  }

  function renderStoreListItem(store, urlStoreId) {
    const page = currentPageFile()
    const href = buildOwnerPageHref(page, store.storeId)
    const isActive = urlStoreId != null && String(store.storeId) === String(urlStoreId)
    const closedBadge = store.isDeleted
      ? '<span class="sidebar-group-badge" title="폐업한 가게">폐업</span>'
      : ''
    const closedCls = store.isDeleted ? ' is-closed' : ''

    return `
      <a
        href="${href}"
        class="sidebar-store-item${isActive ? ' is-active' : ''}${closedCls}"
        data-store-id="${store.storeId}"
        ${isActive ? ' aria-current="page"' : ''}
      >
        <span class="sidebar-store-item-name">${escapeHtml(store.storeName ?? '가게')}</span>
        ${closedBadge}
      </a>
    `
  }

  function toggleSection(label) {
    const section = label.closest('.sidebar-section')
    if (!section) return
    const collapsed = section.dataset.collapsed === 'true'
    section.dataset.collapsed = collapsed ? 'false' : 'true'
    label.setAttribute('aria-expanded', String(collapsed))
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
