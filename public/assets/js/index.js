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
    activeStoreOverlay: null,
    userPos: null,
    /** null = 근처 검색 모드, 문자열 = 키워드 검색 모드 */
    searchQuery: null,
    allStores: [],
    tasteFilters: new Set(),
    nearbyRadiusKm: 3,
    nearbyTotal: 0,
  }

  const TASTE_COLORS = {
    sweetness: '#ec4899',
    saltiness: '#3b82f6',
    sourness: '#84cc16',
    bitterness: '#78716c',
    umami: '#f97316',
  }

  /** \uce69 \ubc84\ud2bc data-taste \u2194 API tasteHighlights.key */
  const TASTE_FILTER_ALIASES = {
    sweetness: ['sweetness', 'sweet'],
    saltiness: ['saltiness', 'salty'],
    sourness: ['sourness', 'sour'],
    bitterness: ['bitterness', 'bitter'],
    umami: ['umami'],
  }

  const NEARBY_SESSION_KEY = 'tasteRadar.nearbySession'
  let roleModalSelectedRole = 'CUSTOMER'

  document.addEventListener('DOMContentLoaded', init)

  async function init() {
    if (!window.api) {
      setNearbyStatus('API 스크립트를 불러오지 못했습니다.', true)
      return
    }

    const logoutBtn = document.getElementById('btnLogout')
    const loginBtn = document.getElementById('btnKakaoLogin')
    const cartBtn = document.getElementById('btnCart')
    loginBtn?.addEventListener('click', openRoleModal)
    cartBtn?.addEventListener('click', goToCartPage)
    logoutBtn?.addEventListener('click', handleLogout)

    setupRoleModal()
    setupMenuDrawerGuest()
    setupDrawers()
    window.CustomerMenu?.init({
      onLoginClick: openRoleModal,
      onLogout: handleLogout,
    })
    setupCartActions()
    setupNearby()
    setupSearch()
    setupTasteFilters()

    applyAuthUi()
    refreshCartBadge()
    window.CustomerNotifications?.refreshBadge()
    if (new URLSearchParams(window.location.search).get('openCart') === '1') {
      window.location.replace('/pages/cart.html')
      return
    }
    const params = new URLSearchParams(window.location.search)
    if (params.get('openNotifications') === '1') {
      window.history.replaceState(null, '', window.location.pathname)
      if (api.auth.isLoggedIn() && (localStorage.getItem('role') || '').toUpperCase() === 'CUSTOMER') {
        window.CustomerNotifications?.openPanel?.()
      }
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

    cartBtn.hidden = loggedIn && role !== 'CUSTOMER'

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
      /* 서버 로그아웃 실패해도 클라이언트 세션은 정리 */
    }
    if (api.auth.clearSession) api.auth.clearSession()
    else {
      ;['userId', 'email', 'nickname', 'role', 'accessToken', 'refreshToken'].forEach((k) =>
        localStorage.removeItem(k),
      )
    }
    state.cart = null
    applyAuthUi()
    closeAllDrawers()
    window.CustomerNotifications?.closePanel?.()
    window.CustomerNotifications?.refreshBadge?.()
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

    modal.querySelectorAll('.role-picker-btn').forEach((btn) => {
      btn.addEventListener('click', () => setRoleModalRole(btn.dataset.role))
    })

    setRoleModalRole('CUSTOMER')
  }

  function setRoleModalRole(role) {
    roleModalSelectedRole = role === 'OWNER' ? 'OWNER' : 'CUSTOMER'
    const modal = document.getElementById('roleModal')
    if (!modal) return

    modal.querySelectorAll('.role-picker-btn').forEach((btn) => {
      const active = btn.dataset.role === roleModalSelectedRole
      btn.classList.toggle('is-active', active)
      btn.setAttribute('aria-selected', active ? 'true' : 'false')
    })

    const kakaoUrl = window.AuthShared?.kakaoStartUrl
      ? AuthShared.kakaoStartUrl(roleModalSelectedRole)
      : `${api?.COMMON_URL || ''}/api/auth/kakao/start?role=${encodeURIComponent(roleModalSelectedRole)}`

    const kakao = document.getElementById('roleModalKakao')
    const login = document.getElementById('roleModalEmailLogin')
    const register = document.getElementById('roleModalEmailRegister')
    if (kakao) kakao.href = kakaoUrl
    if (login) login.href = `/pages/auth/login.html?role=${roleModalSelectedRole}`
    if (register) register.href = `/pages/auth/register.html?role=${roleModalSelectedRole}`
  }

  function openRoleModal() {
    const modal = document.getElementById('roleModal')
    if (!modal) return
    setRoleModalRole(roleModalSelectedRole)
    modal.hidden = false
    document.body.style.overflow = 'hidden'
    document.getElementById('roleModalKakao')?.focus()
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

  function setupMenuDrawerGuest() {
    const openLogin = () => {
      closeDrawer(document.getElementById('menuDrawer'))
      openRoleModal()
    }
    document.getElementById('menuDrawerLoginStart')?.addEventListener('click', openLogin)
  }

  function setupCartActions() {
    document.getElementById('btnCartClear').addEventListener('click', handleCartClear)
    document.getElementById('btnCartCheckout').addEventListener('click', () => {
      alert('결제하기 기능은 준비 중이에요.')
    })
  }

  function goToCartPage() {
    if (!api.auth.isLoggedIn()) {
      openRoleModal()
      return
    }
    const role = (localStorage.getItem('role') || '').toUpperCase()
    if (role !== 'CUSTOMER') {
      alert('고객 계정으로 로그인한 뒤 장바구니를 이용할 수 있어요.')
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
      alert('고객 계정으로 로그인한 뒤 장바구니를 이용할 수 있어요.')
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
          ? '로그인이 필요해요.'
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

    storeNameEl.textContent = data?.storeName || '가게 미선택'
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
          <p class="cart-item-price">${formatWon(unit)} × ${qty}개 = ${formatWon(line)}</p>
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
      alert(e?.message || '장바구니 수량을 변경하지 못했습니다.')
    }
  }

  async function handleCartClear() {
    if (!confirm('장바구니를 비울까요?')) return
    try {
      await api.cart.clear()
      await loadCart()
    } catch (e) {
      alert(e?.message || '장바구니를 비우지 못했습니다.')
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
    window.CustomerNotifications?.refreshBadge()
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

  /* ----------------------------- 검색/근처 가게 ----------------------------- */
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
    if (titleEl) titleEl.textContent = '내 주변 맛집'
    if (leadEl) leadEl.textContent = '지도에서 가게를 눌러 메뉴를 확인하고, 입맛 레이더로 나에게 맞는 맛집을 찾아보세요.'
  }

  function resetNearbyPanel() {
    clearSearchMode()
    state.allStores = []
    state.tasteFilters.clear()
    document.querySelectorAll('.taste-chip.is-active').forEach((b) => b.classList.remove('is-active'))
    showTasteFilterBar(false)
    document.getElementById('nearbyCount').textContent = '위치를 알려주세요'
    document.getElementById('nearbyList').innerHTML = ''
    document.getElementById('nearbyEmpty').hidden = true
    clearStoreMarkers()
    setNearbyStatus('「내 위치로 검색」을 눌러 주변 가게를 찾아보세요.')
  }

  async function loadSearchStores(q) {
    state.searchQuery = q
    const countEl = document.getElementById('nearbyCount')
    const listEl = document.getElementById('nearbyList')
    const emptyEl = document.getElementById('nearbyEmpty')
    const titleEl = document.getElementById('panelTitle')
    const leadEl = document.getElementById('pageLead')

    if (titleEl) titleEl.textContent = '검색 결과'
    if (leadEl) leadEl.textContent = '키워드로 찾은 가게입니다. 입맛 레이더로 더 좁혀 보세요.'

    setNearbyStatus(`「${q}」 검색 중…`)
    listEl.setAttribute('aria-busy', 'true')
    listEl.innerHTML = renderSkeletons(4)
    emptyEl.hidden = true
    clearStoreMarkers()

    try {
      const page = await api.stores.search({ q, page: 0, size: 20 })
      const content = Array.isArray(page?.content) ? page.content : []
      const total = Number(page?.totalElements ?? content.length)
      state.allStores = content
      state.nearbyTotal = total
      showTasteFilterBar(content.length > 0)
      refreshStoreView()
      if (content.length > 0) {
        setNearbyStatus(`「${q}」 검색 결과를 불러왔어요.`)
      } else {
        setNearbyStatus('검색 결과가 없어요.')
      }
    } catch (e) {
      listEl.innerHTML = ''
      countEl.textContent = ''
      setNearbyStatus(errorMessage(e), true)
    } finally {
      listEl.removeAttribute('aria-busy')
    }
  }

  /* ----------------------------- 지도/근처 ----------------------------- */
  function setupNearby() {
    document.getElementById('btnUseMyLocation').addEventListener('click', useMyLocation)
    document.getElementById('btnDemoGangnam')?.addEventListener('click', useDemoLocation)
    document.getElementById('nearbyRadius').addEventListener('change', () => {
      if (state.userPos) loadNearbyStores()
    })
  }

  /**
   * 포트폴리오 데모: BE /api/demo/locations 프리셋(강남역)으로 주변 가게 조회.
   * 면접관이 어디에 있든 동일한 샘플 데이터를 볼 수 있게 합니다.
   */
  async function useDemoLocation(locationId = 'gangnam-station') {
    const btn = document.getElementById('btnDemoGangnam')
    if (!window.api?.demo?.locations) {
      setNearbyStatus('데모 API를 사용할 수 없습니다. 백엔드를 최신 버전으로 배포했는지 확인해 주세요.', true)
      return
    }
    if (btn) btn.disabled = true
    setNearbyStatus('데모 위치(강남역)를 불러오는 중…')
    try {
      const locations = await api.demo.locations()
      const list = Array.isArray(locations) ? locations : []
      const loc =
        list.find((l) => l.id === locationId) ||
        list.find((l) => l.recommended) ||
        list[0]
      if (!loc) {
        setNearbyStatus('데모 위치 정보가 없습니다. 서버에 DEMO_SEED_ENABLED=true 로 샘플 가게를 넣었는지 확인해 주세요.', true)
        return
      }
      const lat = Number(loc.lat)
      const lng = Number(loc.lng)
      const radiusKm = Number(loc.radiusKm) || 3
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setNearbyStatus('데모 좌표 형식이 올바르지 않습니다.', true)
        return
      }
      state.userPos = { lat, lng }
      const radiusEl = document.getElementById('nearbyRadius')
      if (radiusEl) radiusEl.value = String(radiusKm)
      saveNearbySession()
      if (state.map) {
        applyUserLocationToMap()
      }
      await loadNearbyStores()
      setNearbyStatus(`데모: ${loc.label || '강남역 주변'} (${radiusKm}km) — 샘플 가게를 표시합니다.`)
    } catch (e) {
      setNearbyStatus(errorMessage(e), true)
    } finally {
      if (btn) btn.disabled = false
    }
  }

  async function initKakaoMap() {
    if (state.map) return

    if (window.__kakaoMapLoadError === 'missing-key') {
      showMapPlaceholderError(
        '카카오 지도 키가 없습니다. 프론트 루트 .env 파일에 VITE_KAKAO_JS_KEY=JavaScript키 를 넣고 npm run dev 로 다시 실행해 주세요.',
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
        '카카오맵 SDK를 불러오지 못했습니다. .env 의 VITE_KAKAO_JS_KEY 와 카카오 개발자 콘솔 도메인(Web: http://localhost:5173) 설정을 확인해 주세요.',
      )
      setNearbyStatus(
        '카카오맵 SDK 로드에 실패했습니다. 브라우저 콘솔(F12)의 오류를 확인해 주세요.',
        true,
      )
      tryRestoreNearbySession()
      return
    }
    kakao.maps.load(() => {
      const container = document.getElementById('mapContainer')
      const placeholder = document.getElementById('mapPlaceholder')
      if (placeholder) placeholder.style.display = 'none'

      // 초기 중심: 서울 시청 부근
      const defaultCenter = new kakao.maps.LatLng(37.5666103, 126.9783882)
      state.map = new kakao.maps.Map(container, {
        center: defaultCenter,
        level: 5,
      })
      kakao.maps.event.addListener(state.map, 'click', closeStoreOverlay)
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
      setNearbyStatus('이 브라우저에서는 위치 정보를 사용할 수 없어요. 데모 버튼을 이용해 주세요.', true)
      return
    }
    setNearbyStatus('현재 위치를 확인하는 중…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        state.userPos = { lat: latitude, lng: longitude }
        applyUserLocationToMap()
        loadNearbyStores()
      },
      (err) => {
        let msg = '위치 정보를 가져오지 못했습니다.'
        if (err.code === err.PERMISSION_DENIED) {
          msg = '위치 권한이 거부되었어요. 브라우저 설정에서 위치 접근을 허용해 주세요.'
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = '위치 정보를 사용할 수 없습니다.'
        } else if (err.code === err.TIMEOUT) {
          msg = '위치 요청 시간이 초과되었습니다.'
        }
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
    const { image } = makeUserMarkerImage()
    state.userMarker = new kakao.maps.Marker({
      position: center,
      map: state.map,
      title: '\ub0b4 \uc704\uce58',
      image,
      zIndex: 100,
    })
  }

  /** \uac00\uac8c \uc6d0\ud615 \ub9c8\ucee4\uc640 \uad6c\ubd84: \ud540 \ud615\ud0c1 \ub9c8\ucee4 */
  function makeUserMarkerImage() {
    const w = 36
    const h = 44
    const svg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 36 44">
        <circle cx="18" cy="18" r="15" fill="#2563EB" fill-opacity="0.14"/>
        <circle cx="18" cy="18" r="10" fill="#2563EB" fill-opacity="0.22"/>
        <path d="M18 5c-5.2 0-9.5 4.1-9.5 9.5 0 7.2 9.5 20.5 9.5 20.5s9.5-13.3 9.5-20.5C27.5 9.1 23.2 5 18 5z" fill="#2563EB" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/>
        <circle cx="18" cy="14.5" r="4.2" fill="#fff"/>
      </svg>`,
    )
    return {
      image: new kakao.maps.MarkerImage(
        `data:image/svg+xml;charset=utf-8,${svg}`,
        new kakao.maps.Size(w, h),
        { offset: new kakao.maps.Point(w / 2, h) },
      ),
      size: h,
    }
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
        ? '이전에 검색한 위치로 주변 가게를 다시 불러오는 중…'
        : '내 주변 가게를 불러오는 중…',
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
      state.allStores = content
      state.nearbyRadiusKm = radiusKm
      state.nearbyTotal = total
      showTasteFilterBar(content.length > 0)
      refreshStoreView()
      if (content.length > 0) {
        setNearbyStatus(
          options.restored
            ? `이전 위치 기준 ${radiusKm}km 안의 가게를 다시 표시했어요.`
            : `내 주변 ${radiusKm}km 안의 가게를 불러왔어요.`,
        )
      } else {
        setNearbyStatus('근처에 표시할 가게가 없어요.')
      }
    } catch (e) {
      listEl.innerHTML = ''
      countEl.textContent = ''
      setNearbyStatus(errorMessage(e), true)
    } finally {
      listEl.removeAttribute('aria-busy')
    }
  }

  function setupTasteFilters() {
    const bar = document.getElementById('tasteFilterChips')
    if (!bar) return
    bar.querySelectorAll('[data-taste]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.taste
        if (state.tasteFilters.has(key)) state.tasteFilters.delete(key)
        else state.tasteFilters.add(key)
        btn.classList.toggle('is-active', state.tasteFilters.has(key))
        refreshStoreView()
      })
    })
  }

  function showTasteFilterBar(show) {
    const el = document.getElementById('tasteFilterBar')
    if (el) el.hidden = !show
  }

  function filterStores(stores) {
    const list = Array.isArray(stores) ? stores : []
    if (state.tasteFilters.size === 0) return list
    return list.filter(storeMatchesTasteFilters)
  }

  function highlightMatchesFilter(highlightKey) {
    const hk = String(highlightKey)
    for (const filterKey of state.tasteFilters) {
      const aliases = TASTE_FILTER_ALIASES[filterKey] || [filterKey]
      if (aliases.includes(hk)) return true
    }
    return false
  }

  function storeMatchesTasteFilters(store) {
    const highlights = Array.isArray(store.tasteHighlights) ? store.tasteHighlights : []
    if (!highlights.length) return false
    return highlights.some((h) => highlightMatchesFilter(h.key) && Number(h.score) >= 3)
  }

  function isRadarMatch(store) {
    return state.tasteFilters.size > 0 && storeMatchesTasteFilters(store)
  }

  function refreshStoreView() {
    const listEl = document.getElementById('nearbyList')
    const emptyEl = document.getElementById('nearbyEmpty')
    const filtered = filterStores(state.allStores)

    updateRadarHeading({
      searchQuery: state.searchQuery,
      total: state.nearbyTotal,
      visible: filtered.length,
      radiusKm: state.nearbyRadiusKm,
    })

    if (!listEl || !emptyEl) return

    if (state.allStores.length === 0) {
      listEl.innerHTML = ''
      emptyEl.hidden = false
      emptyEl.textContent = state.searchQuery
        ? `「${state.searchQuery}」 검색 결과가 없어요. 다른 키워드로 검색해 보세요.`
        : '이 반경 안에 가게가 없어요.'
      clearStoreMarkers()
      return
    }

    if (filtered.length === 0) {
      listEl.innerHTML = ''
      emptyEl.hidden = false
      emptyEl.textContent =
        '입맛 레이더 조건에 맞는 가게가 없어요. 필터를 조정하거나 해제해 보세요.'
      clearStoreMarkers()
      return
    }

    emptyEl.hidden = true
    listEl.innerHTML = filtered
      .map((s) => renderCard(s, isRadarMatch(s)))
      .join('')
    plotStoreMarkers(filtered)
  }

  function updateRadarHeading({ searchQuery, total, visible, radiusKm }) {
    const el = document.getElementById('nearbyCount')
    if (!el) return
    const n = Number(visible ?? total ?? 0)
    const t = Number(total ?? n)

    if (searchQuery) {
      el.textContent = state.tasteFilters.size
        ? `\u201c${searchQuery}\u201d \uac80\uc0c9 \uacb0\uacfc \uc911 \uc785\ub9db\uc5d0 \ub9de\ub294 ${n.toLocaleString('ko-KR')}\uac1c \ub9db\uc9d1\uc744 \ub808\uc774\ub354\uc5d0 \ud3ec\ucc29\ud588\uc5b4\uc694!`
        : `\u201c${searchQuery}\u201d\uc5d0\uc11c ${t.toLocaleString('ko-KR')}\uac1c\uc758 \ub9db\uc9d1\uc744 \ucc3e\uc558\uc5b4\uc694!`
      return
    }

    const km = radiusKm ?? state.nearbyRadiusKm ?? 3
    el.textContent = state.tasteFilters.size
      ? `\ub0b4 \uc8fc\ubcc0 ${km}km \uc548\uc5d0 ${n.toLocaleString('ko-KR')}\uac1c \ub9db\uc9d1 \uc911 \uc785\ub9db\uc5d0 \ub9de\ub294 \uac00\uac8c\ub97c \ub808\uc774\ub354\uc5d0 \ud3ec\ucc29\ud588\uc5b4\uc694!`
      : `\ub0b4 \uc8fc\ubcc0 ${km}km \uc548\uc5d0 ${t.toLocaleString('ko-KR')}\uac1c \uac00\uac8c\uac00 \ub808\uc774\ub354\uc5d0 \uac78\ub838\uc5b4\uc694!`
  }

  function dominantTasteKey(store) {
    const highlights = Array.isArray(store.tasteHighlights) ? store.tasteHighlights : []
    if (!highlights.length) return null
    const top = [...highlights].sort((a, b) => Number(b.score) - Number(a.score))[0]
    return top?.key ? String(top.key) : null
  }

  function inferCategoryColor(name) {
    const n = String(name || '')
    if (/\uce74\ud398|coffee|\ubca0\uc774\ud130\ub9ac|\ube0c\ub7f0\uce58|\ub514\uc800\ud2b8/i.test(n)) return '#8B5E3C'
    if (/\ud55c\uc2dd|\ubc31\ubc18|\uad6d\ubb34|\ucc0c\uac1c|\uae40\uce58|\ube44\ube48/i.test(n)) return '#DC2626'
    if (/\uc911\uc2dd|\uc9dc\uc7a5|\uc9ec\ubf55|\ub9c8\ub77c|\ud0d5\uc218/i.test(n)) return '#EA580C'
    if (/\uc77c\uc2dd|\ucd08\ubc25|\ub77c\uba58|\ub3c8\uae4c\uc2a4|\ud68c\ub367/i.test(n)) return '#2563EB'
    if (/\uc591\uc2dd|\ud30c\uc2a4\ud0c0|\ud53c\uc790|\uc2a4\ud14c\uc774\ud06c|\ubc84\uac70/i.test(n)) return '#7C3AED'
    if (/\uc0d4\ub7ec\ub4dc|\ud3ec\ucf00|\ub2e4\uc774\uc5b4\ud2b8/i.test(n)) return '#16A34A'
    return '#6366F1'
  }

  function markerColorForStore(store) {
    const key = dominantTasteKey(store)
    if (key && TASTE_COLORS[key]) return TASTE_COLORS[key]
    return inferCategoryColor(store.name)
  }

  function createMarkerImage(color, isRadar) {
    const size = isRadar ? 44 : 32
    const ring = isRadar
      ? `<circle cx="20" cy="20" r="17" fill="none" stroke="${color}" stroke-width="2" opacity="0.45"/><circle cx="20" cy="20" r="13" fill="${color}" opacity="0.18"/>`
      : ''
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">${ring}<circle cx="20" cy="20" r="9" fill="${color}" stroke="#fff" stroke-width="3"/></svg>`
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    return {
      image: new kakao.maps.MarkerImage(
        url,
        new kakao.maps.Size(size, size),
        { offset: new kakao.maps.Point(size / 2, size / 2) },
      ),
      size,
    }
  }

  function plotStoreMarkers(stores) {
    if (!state.map) return
    clearStoreMarkers()
    const bounds = new kakao.maps.LatLngBounds()
    if (state.userPos) bounds.extend(new kakao.maps.LatLng(state.userPos.lat, state.userPos.lng))

    stores.forEach((s) => {
      const lat = Number(s.latitude ?? s.lat)
      const lng = Number(s.longitude ?? s.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return // 좌표 없는 가게는 마커 생략

      const pos = new kakao.maps.LatLng(lat, lng)
      const radar = isRadarMatch(s)
      const color = markerColorForStore(s)
      const { image } = createMarkerImage(color, radar)
      const marker = new kakao.maps.Marker({
        position: pos,
        map: state.map,
        title: s.name,
        image,
        zIndex: radar ? 3 : 2,
      })
      kakao.maps.event.addListener(marker, 'click', () => openStoreOverlay(s, marker))
      state.storeMarkers.push(marker)
      bounds.extend(pos)
    })

    if (state.storeMarkers.length > 0) state.map.setBounds(bounds)
    if (state.userMarker && state.userPos) {
      state.userMarker.setMap(state.map)
      state.userMarker.setZIndex(100)
    }
  }

  function clearStoreMarkers() {
    closeStoreOverlay()
    state.storeMarkers.forEach((m) => m.setMap(null))
    state.storeMarkers = []
  }

  function closeStoreOverlay() {
    if (!state.activeStoreOverlay) return
    state.activeStoreOverlay.setMap(null)
    state.activeStoreOverlay = null
  }

  function openStoreOverlay(store, marker) {
    if (!state.map || !marker) return
    closeStoreOverlay()
    const overlay = new kakao.maps.CustomOverlay({
      position: marker.getPosition(),
      content: buildMapStoreCard(store),
      yAnchor: 1.08,
      xAnchor: 0.5,
      zIndex: 5,
    })
    overlay.setMap(state.map)
    state.activeStoreOverlay = overlay
  }

  function buildMapStoreCard(store) {
    const status = String(store.status || '').toUpperCase()
    const statusMod = status === 'OPEN' ? 'open' : status === 'PREPARING' ? 'preparing' : 'close'
    const statusLabel =
      status === 'OPEN' ? '\uc601\uc5c5 \uc911' : status === 'PREPARING' ? '\uc900\ube44 \uc911' : '\uc601\uc5c5 \uc885\ub8cc'

    const storeId = encodeURIComponent(store.id ?? '')
    const storeHref = `/pages/store.html?storeId=${storeId}`

    const card = document.createElement('article')
    card.className = 'map-store-card'
    card.setAttribute('role', 'dialog')
    card.setAttribute('aria-label', store.name || '\uac00\uac8c \uc815\ubcf4')
    card.innerHTML = `
      <button type="button" class="map-store-card__close" aria-label="\ub2eb\uae30">
        <i class="ti ti-x" aria-hidden="true"></i>
      </button>
      <div class="map-store-card__body">
        <h3 class="map-store-card__name">${escapeHtml(store.name)}</h3>
        <p class="map-store-card__meta">
          <span class="map-store-card__score">\u2605 ${formatRating(store.averageRating)}</span>
          <span>\ub9ac\ubdf0 ${Number(store.reviewCount ?? 0).toLocaleString('ko-KR')}</span>
          <span class="map-store-card__status map-store-card__status--${statusMod}">${statusLabel}</span>
        </p>
        <p class="map-store-card__min">\ucd5c\uc18c \uc8fc\ubb38 ${formatWon(store.minOrderAmount)}</p>
        <a class="map-store-card__cta" href="${storeHref}">\uac00\uac8c \ubcf4\uae30</a>
      </div>
    `

    card.querySelector('.map-store-card__close')?.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      closeStoreOverlay()
    })
    ;['mousedown', 'touchstart', 'wheel'].forEach((type) => {
      card.addEventListener(type, (e) => e.stopPropagation())
    })

    return card
  }

  function setNearbyStatus(message, isError = false) {
    const el = document.getElementById('nearbyStatus')
    if (!el) return
    el.textContent = message || ''
    el.classList.toggle('is-error', !!isError)
  }

  /* ----------------------------- 카드 UI ----------------------------- */
  function renderSkeletons(n) {
    return Array.from({ length: n })
      .map(() => '<li><div class="store-card-skeleton"></div></li>')
      .join('')
  }

  function renderCard(store, radarMatch = false) {
    const status = String(store.status || '').toUpperCase()
    const statusMod = status === 'OPEN' ? 'open' : status === 'PREPARING' ? 'preparing' : 'close'
    const statusLabel =
      status === 'OPEN' ? '\uc601\uc5c5 \uc911' : status === 'PREPARING' ? '\uc900\ube44 \uc911' : '\uc601\uc5c5 \uc885\ub8cc'

    const thumb = store.thumbnailUrl
      ? `<img src="${escapeAttr(store.thumbnailUrl)}" alt="" loading="lazy" />`
      : '<span aria-hidden="true">\ud83c\udf7d\ufe0f</span>'

    const tasteTags =
      window.ReviewUi && Array.isArray(store.tasteHighlights) && store.tasteHighlights.length
        ? ReviewUi.renderTasteMiniTags(store.tasteHighlights)
        : ''

    return `
      <li>
        <a class="store-card${radarMatch ? ' store-card--radar' : ''}" href="/pages/store.html?storeId=${store.id}">
          <div class="store-thumb">
            ${thumb}
            <span class="store-thumb-status store-thumb-status--${statusMod}">
              <span class="dot" aria-hidden="true"></span>${statusLabel}
            </span>
          </div>
          <div class="store-body">
            <h2 class="store-name">${escapeHtml(store.name)}</h2>
            <p class="store-meta">
              <span class="store-rating">\u2605 ${formatRating(store.averageRating)}</span>
              <span class="store-review-count">\ub9ac\ubdf0 ${Number(store.reviewCount ?? 0).toLocaleString('ko-KR')}</span>
            </p>
            ${tasteTags}
            <p class="store-min-order">\ucd5c\uc18c \uc8fc\ubb38 ${formatWon(store.minOrderAmount)}</p>
          </div>
        </a>
      </li>
    `
  }

  /* ----------------------------- 유틸/포맷 ----------------------------- */
  function errorMessage(e) {
    if (!e) return '요청을 처리하지 못했습니다.'
    const msg = e.message || ''
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      return '백엔드(http://localhost:8080)에 연결하지 못했습니다.'
    }
    if (e.status === 401) return '로그인이 필요해요.'
    return msg || '요청을 처리하지 못했습니다.'
  }

  function formatRating(v) {
    if (v == null || Number.isNaN(Number(v))) return '\u2014'
    return Number(v).toFixed(1)
  }

  function formatWon(v) {
    return `${Number(v ?? 0).toLocaleString('ko-KR')}\uc6d0`
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
