/**
 * 메인 페이지: 내 주변 가게 + 가게/메뉴 검색 (카카오맵)
 * - GET /api/stores/nearby?lat=&lng=&radiusKm=
 * - GET /api/stores?q=
 */
;(function () {
  'use strict'

  const state = {
    cart: null,
    map: null,
    userMarker: null,
    storeMarkers: [],
    userPos: null,
    /** null = 주변 검색 모드, 문자열 = 키워드 검색 모드 */
    searchQuery: null,
  }

  const NEARBY_SESSION_KEY = 'tasteRadar.nearbySession'

  document.addEventListener('DOMContentLoaded', init)

  async function init() {
    if (!window.api) {
      setNearbyStatus('API 스크립트를 불러오지 못했습니다.', true)
      return
    }

    const logoutBtn = document.getElementById('btnLogout')
    const loginBtn = document.getElementById('btnKakaoLogin')
    const cartBtn = document.getElementById('btnCart')
    const menuBtn = document.getElementById('btnMenu')

    loginBtn.addEventListener('click', openRoleModal)
    cartBtn.addEventListener('click', goToCartPage)
    menuBtn.addEventListener('click', openMenuDrawer)
    logoutBtn.addEventListener('click', handleLogout)

    setupRoleModal()
    setupDrawers()
    setupCartActions()
    setupNearby()
    setupSearch()

    applyAuthUi()
    refreshCartBadge()
    if (new URLSearchParams(window.location.search).get('openCart') === '1') {
      window.location.replace('/pages/cart.html')
      return
    }
    await initKakaoMap()
  }

  /* ----------------------------- 인증 UI ----------------------------- */
  function applyAuthUi() {
    const loggedIn = api.auth.isLoggedIn()
    const role = (localStorage.getItem('role') || '').toUpperCase()
    const loginBtn = document.getElementById('btnKakaoLogin')
    const userMenu = document.getElementById('userMenu')
    const nicknameEl = document.getElementById('userNickname')
    const cartBtn = document.getElementById('btnCart')

    loginBtn.hidden = loggedIn
    userMenu.hidden = !loggedIn

    cartBtn.hidden = !(loggedIn && role === 'CUSTOMER')

    if (loggedIn) {
      const nickname = localStorage.getItem('nickname') || '회원'
      nicknameEl.textContent = nickname
    } else {
      nicknameEl.textContent = ''
      setCartBadge(0)
    }
  }

  async function handleLogout() {
    try {
      await api.auth.logout()
    } catch {
      /* 서버 실패 여부와 무관하게 로컬은 정리 */
    }
    ;['userId', 'email', 'nickname', 'role'].forEach((k) => localStorage.removeItem(k))
    state.cart = null
    applyAuthUi()
    closeAllDrawers()
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

  /* ----------------------------- 사이드 드로어 공통 ----------------------------- */
  function setupDrawers() {
    document.querySelectorAll('.side-drawer').forEach((drawer) => {
      drawer.querySelectorAll('[data-drawer-close]').forEach((el) => {
        el.addEventListener('click', () => closeDrawer(drawer))
      })
    })
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return
      document.querySelectorAll('.side-drawer').forEach((drawer) => {
        if (!drawer.hidden) closeDrawer(drawer)
      })
    })
  }

  function openDrawer(drawer) {
    if (!drawer) return
    drawer.hidden = false
    drawer.setAttribute('aria-hidden', 'false')
    document.body.style.overflow = 'hidden'
  }

  function closeDrawer(drawer) {
    if (!drawer) return
    drawer.hidden = true
    drawer.setAttribute('aria-hidden', 'true')
    if (!document.querySelector('.side-drawer:not([hidden])')) {
      document.body.style.overflow = ''
    }
  }

  function closeAllDrawers() {
    document.querySelectorAll('.side-drawer').forEach(closeDrawer)
  }

  /* ----------------------------- 햄버거 메뉴 ----------------------------- */
  function openMenuDrawer() {
    const drawer = document.getElementById('menuDrawer')
    renderMenuDrawer()
    openDrawer(drawer)
  }

  function renderMenuDrawer() {
    const userBox = document.getElementById('menuDrawerUser')
    const nick = document.getElementById('menuDrawerNickname')
    const roleEl = document.getElementById('menuDrawerRole')
    const list = document.getElementById('menuDrawerList')

    const loggedIn = api.auth.isLoggedIn()
    const role = (localStorage.getItem('role') || '').toUpperCase()

    if (loggedIn) {
      userBox.hidden = false
      if (userBox.tagName === 'A') {
        userBox.href = role === 'CUSTOMER' ? '/pages/my-profile.html' : '/'
      }
      nick.textContent = localStorage.getItem('nickname') || '회원'
      roleEl.textContent = role === 'OWNER' ? '사장' : '고객'
    } else {
      userBox.hidden = true
    }

    const items = []
    items.push({
      icon: 'ti-home',
      label: '홈',
      href: '/',
    })

    if (!loggedIn) {
      items.push({
        icon: 'ti-brand-kakao-talk',
        label: '카카오 로그인',
        kakao: true,
        action: () => {
          closeDrawer(document.getElementById('menuDrawer'))
          openRoleModal()
        },
      })
    }

    if (loggedIn && role === 'CUSTOMER') {
      items.push({
        icon: 'ti-user-circle',
        label: '내 프로필',
        href: '/pages/my-profile.html',
      })
      items.push({
        icon: 'ti-shopping-cart',
        label: '장바구니',
        action: () => {
          closeDrawer(document.getElementById('menuDrawer'))
          goToCartPage()
        },
      })
      items.push({
        icon: 'ti-receipt',
        label: '내 주문',
        href: '/pages/my-orders.html',
      })
    }

    if (loggedIn && role === 'OWNER') {
      items.push({
        icon: 'ti-layout-dashboard',
        label: '사장 대시보드',
        href: '/pages/owner/owner-main.html',
      })
    }

    if (loggedIn) {
      items.push({
        icon: 'ti-logout',
        label: '로그아웃',
        action: handleLogout,
        danger: true,
      })
    }

    list.innerHTML = items
      .map((it, idx) => {
        const cls = `${it.danger ? 'item-danger' : ''} ${it.kakao ? 'item-kakao' : ''}`.trim()
        const iconMarkup = it.kakao
          ? (window.KakaoBrand?.iconHtml?.() ||
              '<svg class="kakao-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3c5.523 0 10 3.582 10 8 0 2.558-1.294 4.832-3.333 6.274L19 22l-5.2-2.86C14.89 19.378 13.47 19.5 12 19.5 6.477 19.5 2 15.918 2 11.5 2 7.082 6.477 3.5 12 3.5z"/></svg>')
          : `<i class="ti ${it.icon}" aria-hidden="true"></i>`
        if (it.href) {
          return `
            <li>
              <a class="${cls}" href="${it.href}">
                ${iconMarkup}
                <span>${escapeHtml(it.label)}</span>
              </a>
            </li>`
        }
        return `
          <li>
            <button type="button" class="${cls}" data-menu-idx="${idx}" ${
          it.disabled ? 'disabled' : ''
        }>
              ${iconMarkup}
              <span>${escapeHtml(it.label)}</span>
            </button>
          </li>`
      })
      .join('')

    list.querySelectorAll('button[data-menu-idx]').forEach((btn) => {
      const idx = Number(btn.dataset.menuIdx)
      const item = items[idx]
      if (item && typeof item.action === 'function') {
        btn.addEventListener('click', item.action)
      }
    })
  }

  /* ----------------------------- 장바구니 ----------------------------- */
  function setupCartActions() {
    document.getElementById('btnCartClear').addEventListener('click', handleCartClear)
    document.getElementById('btnCartCheckout').addEventListener('click', () => {
      alert('주문하기 화면은 아직 준비 중입니다.')
    })
  }

  function goToCartPage() {
    if (!api.auth.isLoggedIn()) {
      openRoleModal()
      return
    }
    const role = (localStorage.getItem('role') || '').toUpperCase()
    if (role !== 'CUSTOMER') {
      alert('장바구니는 고객 계정에서만 사용할 수 있어요.')
      return
    }
    window.location.href = '/pages/cart.html'
  }

  async function openCartDrawer() {
    if (!api.auth.isLoggedIn()) {
      openRoleModal()
      return
    }
    const role = (localStorage.getItem('role') || '').toUpperCase()
    if (role !== 'CUSTOMER') {
      alert('장바구니는 고객 계정에서만 사용할 수 있어요.')
      return
    }
    const drawer = document.getElementById('cartDrawer')
    openDrawer(drawer)
    await loadCart()
  }

  async function loadCart() {
    const body = document.getElementById('cartBody')
    body.innerHTML = '<p class="drawer-empty">불러오는 중…</p>'

    try {
      const data = await api.cart.get()
      state.cart = data
      renderCart()
      setCartBadge(itemTotalQuantity(data))
    } catch (e) {
      state.cart = null
      const msg =
        e?.status === 401
          ? '로그인이 필요합니다.'
          : e?.message || '장바구니를 불러오지 못했습니다.'
      body.innerHTML = `<p class="drawer-empty is-error">${escapeHtml(msg)}</p>`
      setCartFooter([], 0, true)
    }
  }

  function renderCart() {
    const body = document.getElementById('cartBody')
    const storeNameEl = document.getElementById('cartStoreName')
    const countEl = document.getElementById('cartItemCount')
    const data = state.cart
    const items = Array.isArray(data?.items) ? data.items : []

    storeNameEl.textContent = data?.storeName || '담긴 가게 없음'
    countEl.textContent = `${itemTotalQuantity(data)}개`

    if (items.length === 0) {
      body.innerHTML = '<p class="drawer-empty">장바구니가 비어 있어요.</p>'
      setCartFooter([], 0, true)
      return
    }

    body.innerHTML = items.map(renderCartItem).join('')

    body.querySelectorAll('[data-cart-act]').forEach((btn) => {
      const itemId = Number(btn.dataset.itemId)
      const quantity = Number(btn.dataset.qty)
      const action = btn.dataset.cartAct
      btn.addEventListener('click', () => handleCartAction(action, itemId, quantity))
    })

    setCartFooter(items, itemTotalAmount(items), false)
  }

  function renderCartItem(item) {
    const qty = Number(item.quantity ?? 1)
    const unit = Number(item.unitPrice ?? 0)
    const line = unit * qty
    return `
      <div class="cart-item">
        <div>
          <p class="cart-item-name">${escapeHtml(item.menuName ?? '메뉴')}</p>
          <p class="cart-item-price">${formatWon(unit)} · 합계 ${formatWon(line)}</p>
        </div>
        <button
          type="button"
          class="cart-item-remove"
          data-cart-act="remove"
          data-item-id="${item.id}"
          data-qty="0"
          aria-label="삭제"
        >삭제</button>
        <div class="cart-item-line">
          <div class="qty-stepper" role="group" aria-label="수량 조절">
            <button
              type="button"
              class="qty-btn"
              data-cart-act="dec"
              data-item-id="${item.id}"
              data-qty="${qty}"
              ${qty <= 1 ? 'disabled' : ''}
              aria-label="수량 감소"
            >−</button>
            <span class="qty-value">${qty}</span>
            <button
              type="button"
              class="qty-btn"
              data-cart-act="inc"
              data-item-id="${item.id}"
              data-qty="${qty}"
              aria-label="수량 증가"
            >+</button>
          </div>
          <strong>${formatWon(line)}</strong>
        </div>
      </div>
    `
  }

  function setCartFooter(items, total, disabled) {
    document.getElementById('cartTotal').textContent = formatWon(total)
    document.getElementById('btnCartClear').disabled = disabled || items.length === 0
    document.getElementById('btnCartCheckout').disabled = disabled || items.length === 0
  }

  async function handleCartAction(action, itemId, currentQty) {
    try {
      if (action === 'inc') {
        await api.cart.updateQuantity(itemId, currentQty + 1)
      } else if (action === 'dec') {
        if (currentQty <= 1) return
        await api.cart.updateQuantity(itemId, currentQty - 1)
      } else if (action === 'remove') {
        await api.cart.removeItem(itemId)
      }
      await loadCart()
    } catch (e) {
      alert(e?.message || '장바구니를 수정하지 못했어요.')
    }
  }

  async function handleCartClear() {
    if (!confirm('장바구니를 비울까요?')) return
    try {
      await api.cart.clear()
      await loadCart()
    } catch (e) {
      alert(e?.message || '장바구니를 비우지 못했어요.')
    }
  }

  async function refreshCartBadge() {
    if (!api.auth.isLoggedIn()) {
      setCartBadge(0)
      return
    }
    const role = (localStorage.getItem('role') || '').toUpperCase()
    if (role !== 'CUSTOMER') {
      setCartBadge(0)
      return
    }
    try {
      const data = await api.cart.get()
      state.cart = data
      setCartBadge(itemTotalQuantity(data))
    } catch {
      setCartBadge(0)
    }
  }

  function setCartBadge(count) {
    const badge = document.getElementById('cartBadge')
    if (!badge) return
    const n = Number(count) || 0
    if (n <= 0) {
      badge.hidden = true
      badge.textContent = '0'
    } else {
      badge.hidden = false
      badge.textContent = n > 99 ? '99+' : String(n)
    }
  }

  function itemTotalQuantity(cart) {
    const items = Array.isArray(cart?.items) ? cart.items : []
    return items.reduce((sum, it) => sum + Number(it.quantity ?? 0), 0)
  }

  function itemTotalAmount(items) {
    return items.reduce(
      (sum, it) => sum + Number(it.unitPrice ?? 0) * Number(it.quantity ?? 0),
      0,
    )
  }

  /* ----------------------------- 가게/메뉴 검색 ----------------------------- */
  function setupSearch() {
    const form = document.getElementById('searchForm')
    const input = document.getElementById('searchInput')
    if (!form || !input) return

    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const q = input.value.trim()
      if (!q) {
        clearSearchMode()
        if (state.userPos) loadNearbyStores()
        else resetNearbyPanel()
        return
      }
      loadSearchStores(q)
    })
  }

  function clearSearchMode() {
    state.searchQuery = null
    const titleEl = document.getElementById('panelTitle')
    const leadEl = document.getElementById('pageLead')
    if (titleEl) titleEl.textContent = '내 주변 가게'
    if (leadEl) leadEl.textContent = '현재 위치를 기준으로 가까운 가게를 보여드려요.'
  }

  function resetNearbyPanel() {
    clearSearchMode()
    document.getElementById('nearbyCount').textContent = '위치를 알려주세요'
    document.getElementById('nearbyList').innerHTML = ''
    document.getElementById('nearbyEmpty').hidden = true
    clearStoreMarkers()
    setNearbyStatus('"내 위치로 검색"을 눌러 주세요.')
  }

  async function loadSearchStores(q) {
    state.searchQuery = q
    const countEl = document.getElementById('nearbyCount')
    const listEl = document.getElementById('nearbyList')
    const emptyEl = document.getElementById('nearbyEmpty')
    const titleEl = document.getElementById('panelTitle')
    const leadEl = document.getElementById('pageLead')

    if (titleEl) titleEl.textContent = '검색 결과'
    if (leadEl) leadEl.textContent = '가게명·메뉴명으로 찾은 가게예요.'

    setNearbyStatus(`「${q}」 검색 중…`)
    listEl.setAttribute('aria-busy', 'true')
    listEl.innerHTML = renderSkeletons(4)
    emptyEl.hidden = true
    clearStoreMarkers()

    try {
      const page = await api.stores.search({ q, page: 0, size: 20 })
      const content = Array.isArray(page?.content) ? page.content : []
      const total = Number(page?.totalElements ?? content.length)
      countEl.textContent = `「${q}」 · ${total.toLocaleString('ko-KR')}곳`

      if (content.length === 0) {
        listEl.innerHTML = ''
        emptyEl.hidden = false
        emptyEl.textContent = `「${q}」에 맞는 가게가 없어요.`
        setNearbyStatus('검색을 완료했어요.')
      } else {
        listEl.innerHTML = content.map(renderCard).join('')
        plotStoreMarkers(content)
        setNearbyStatus(`「${q}」 검색 결과 ${content.length}곳을 찾았어요.`)
      }
    } catch (e) {
      listEl.innerHTML = ''
      countEl.textContent = ''
      setNearbyStatus(errorMessage(e), true)
    } finally {
      listEl.removeAttribute('aria-busy')
    }
  }

  /* ----------------------------- 카카오맵 ----------------------------- */
  function setupNearby() {
    document.getElementById('btnUseMyLocation').addEventListener('click', useMyLocation)
    document.getElementById('nearbyRadius').addEventListener('change', () => {
      if (state.userPos) loadNearbyStores()
    })
  }

  async function initKakaoMap() {
    if (state.map) return

    if (window.__kakaoMapLoadError === 'missing-key') {
      showMapPlaceholderError(
        '카카오맵 키가 없어요. 프로젝트 루트에 .env 파일을 만들고 VITE_KAKAO_JS_KEY=JavaScript키 를 넣은 뒤 npm run dev 를 다시 실행하세요.',
      )
      setNearbyStatus('VITE_KAKAO_JS_KEY 가 설정되지 않았습니다.', true)
      tryRestoreNearbySession()
      return
    }

    if (window.__kakaoMapReady) {
      try {
        await window.__kakaoMapReady
      } catch {
        /* handled below */
      }
    }

    if (!window.kakao || !window.kakao.maps) {
      showMapPlaceholderError(
        '카카오맵 SDK를 불러오지 못했어요. .env 의 VITE_KAKAO_JS_KEY 와 카카오 디벨로퍼스 → 플랫폼(Web 도메인: http://localhost:5173) 등록을 확인하세요.',
      )
      setNearbyStatus(
        '카카오맵 SDK 로드 실패. 브라우저 콘솔(F12)의 에러를 확인하세요.',
        true,
      )
      tryRestoreNearbySession()
      return
    }
    kakao.maps.load(() => {
      const container = document.getElementById('mapContainer')
      const placeholder = document.getElementById('mapPlaceholder')
      if (placeholder) placeholder.style.display = 'none'

      // 기본 중심: 서울 시청
      const defaultCenter = new kakao.maps.LatLng(37.5666103, 126.9783882)
      state.map = new kakao.maps.Map(container, {
        center: defaultCenter,
        level: 5,
      })
      tryRestoreNearbySession()
    })
  }

  function saveNearbySession() {
    if (!state.userPos) return
    const radiusKm = Number(document.getElementById('nearbyRadius')?.value) || 3
    try {
      sessionStorage.setItem(
        NEARBY_SESSION_KEY,
        JSON.stringify({
          lat: state.userPos.lat,
          lng: state.userPos.lng,
          radiusKm,
          savedAt: Date.now(),
        }),
      )
    } catch {
      /* quota / private mode */
    }
  }

  function readNearbySession() {
    try {
      const raw = sessionStorage.getItem(NEARBY_SESSION_KEY)
      if (!raw) return null
      const data = JSON.parse(raw)
      const lat = Number(data.lat)
      const lng = Number(data.lng)
      const radiusKm = Number(data.radiusKm) || 3
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return { lat, lng, radiusKm }
    } catch {
      return null
    }
  }

  function tryRestoreNearbySession() {
    const saved = readNearbySession()
    if (!saved) return
    state.userPos = { lat: saved.lat, lng: saved.lng }
    const radiusEl = document.getElementById('nearbyRadius')
    if (radiusEl) radiusEl.value = String(saved.radiusKm)
    applyUserLocationToMap()
    loadNearbyStores({ restored: true })
  }

  function showMapPlaceholderError(message) {
    const ph = document.getElementById('mapPlaceholder')
    if (!ph) return
    ph.innerHTML = `
      <i class="ti ti-alert-triangle" aria-hidden="true"
         style="font-size:36px;color:var(--color-warn);opacity:0.85"></i>
      <p style="color:var(--color-warn);font-weight:600;margin:0">${escapeHtml(message)}</p>
    `
    ph.style.display = 'flex'
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setNearbyStatus('이 브라우저에서는 위치 기능을 사용할 수 없어요.', true)
      return
    }
    setNearbyStatus('현재 위치를 가져오는 중…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        state.userPos = { lat: latitude, lng: longitude }
        applyUserLocationToMap()
        loadNearbyStores()
      },
      (err) => {
        let msg = '현재 위치를 가져오지 못했어요.'
        if (err.code === err.PERMISSION_DENIED) msg = '위치 권한이 거부되었어요. 브라우저 설정에서 허용해 주세요.'
        else if (err.code === err.POSITION_UNAVAILABLE) msg = '위치 정보를 사용할 수 없어요.'
        else if (err.code === err.TIMEOUT) msg = '위치 요청이 시간 초과되었어요.'
        setNearbyStatus(msg, true)
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    )
  }

  function applyUserLocationToMap() {
    if (!state.map || !state.userPos) return
    const center = new kakao.maps.LatLng(state.userPos.lat, state.userPos.lng)
    state.map.setCenter(center)
    state.map.setLevel(4)

    if (state.userMarker) state.userMarker.setMap(null)
    state.userMarker = new kakao.maps.Marker({
      position: center,
      map: state.map,
      title: '내 위치',
      image: makeUserMarkerImage(),
    })
  }

  function makeUserMarkerImage() {
    const svg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="10" fill="#ff6b47" fill-opacity="0.25"/>
        <circle cx="14" cy="14" r="6" fill="#ff6b47" stroke="#fff" stroke-width="2"/>
      </svg>`,
    )
    return new kakao.maps.MarkerImage(
      `data:image/svg+xml;charset=utf-8,${svg}`,
      new kakao.maps.Size(28, 28),
      { offset: new kakao.maps.Point(14, 14) },
    )
  }

  async function loadNearbyStores(options = {}) {
    if (!state.userPos) return
    state.searchQuery = null
    const input = document.getElementById('searchInput')
    if (input) input.value = ''
    clearSearchMode()

    const radiusKm = Number(document.getElementById('nearbyRadius').value) || 3
    saveNearbySession()
    const countEl = document.getElementById('nearbyCount')
    const listEl = document.getElementById('nearbyList')
    const emptyEl = document.getElementById('nearbyEmpty')

    setNearbyStatus(
      options.restored
        ? '이전에 검색한 위치 기준으로 주변 가게를 불러오는 중…'
        : '내 주변 가게를 검색하는 중…',
    )
    listEl.setAttribute('aria-busy', 'true')
    listEl.innerHTML = renderSkeletons(4)
    emptyEl.hidden = true
    clearStoreMarkers()

    try {
      const page = await api.stores.nearby({
        lat: state.userPos.lat,
        lng: state.userPos.lng,
        radiusKm,
        page: 0,
        size: 20,
      })
      const content = Array.isArray(page?.content) ? page.content : []
      const total = Number(page?.totalElements ?? content.length)
      countEl.textContent = `반경 ${radiusKm}km · ${total.toLocaleString('ko-KR')}곳`

      if (content.length === 0) {
        listEl.innerHTML = ''
        emptyEl.hidden = false
        emptyEl.textContent =
          '아직 주변 가게가 없어요. (백엔드의 /api/stores/nearby가 구현되면 결과가 표시됩니다.)'
        setNearbyStatus('검색을 완료했어요.')
      } else {
        listEl.innerHTML = content.map(renderCard).join('')
        plotStoreMarkers(content)
        setNearbyStatus(
          options.restored
            ? `이전 위치 기준 ${radiusKm}km 내 가게 ${content.length}곳을 찾았어요.`
            : `내 위치 기준 ${radiusKm}km 내 가게 ${content.length}곳을 찾았어요.`,
        )
      }
    } catch (e) {
      listEl.innerHTML = ''
      countEl.textContent = ''
      setNearbyStatus(errorMessage(e), true)
    } finally {
      listEl.removeAttribute('aria-busy')
    }
  }

  function plotStoreMarkers(stores) {
    if (!state.map) return
    const bounds = new kakao.maps.LatLngBounds()
    if (state.userPos) bounds.extend(new kakao.maps.LatLng(state.userPos.lat, state.userPos.lng))

    stores.forEach((s) => {
      const lat = Number(s.latitude ?? s.lat)
      const lng = Number(s.longitude ?? s.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return // 좌표 없는 가게는 스킵

      const pos = new kakao.maps.LatLng(lat, lng)
      const marker = new kakao.maps.Marker({
        position: pos,
        map: state.map,
        title: s.name,
      })
      const info = new kakao.maps.InfoWindow({
        content: `<div style="padding:6px 10px;font-size:12px;font-weight:700">${escapeHtml(
          s.name,
        )}</div>`,
      })
      kakao.maps.event.addListener(marker, 'click', () => info.open(state.map, marker))
      state.storeMarkers.push(marker)
      bounds.extend(pos)
    })

    if (state.storeMarkers.length > 0) state.map.setBounds(bounds)
  }

  function clearStoreMarkers() {
    state.storeMarkers.forEach((m) => m.setMap(null))
    state.storeMarkers = []
  }

  function setNearbyStatus(message, isError = false) {
    const el = document.getElementById('nearbyStatus')
    if (!el) return
    el.textContent = message || ''
    el.classList.toggle('is-error', !!isError)
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

    const tasteTags =
      window.ReviewUi && Array.isArray(store.tasteHighlights) && store.tasteHighlights.length
        ? ReviewUi.renderTasteMiniTags(store.tasteHighlights)
        : ''

    return `
      <li>
        <a class="store-card" href="/pages/store.html?storeId=${store.id}">
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
            ${tasteTags}
            <p class="store-min-order">최소 주문 ${formatWon(store.minOrderAmount)}</p>
          </div>
        </a>
      </li>
    `
  }

  /* ----------------------------- 상태/유틸 ----------------------------- */
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
