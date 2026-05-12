/**
 * Taste Radar — 백엔드 API 클라이언트
 *
 * 사용 예:
 *   <script src="/assets/js/api.js"></script>
 *   const page = await window.api.stores.search({ q: '치킨' })
 *   const me   = await window.api.users.me()
 *
 * 토큰은 localStorage("accessToken" / "refreshToken")에 저장합니다.
 * 카카오 로그인 콜백 응답을 받으면 `api.auth.setTokens(...)`로 저장해 주세요.
 */
(function () {
  'use strict'

  const COMMON_URL = 'http://localhost:8080'
  const TOKEN_KEY = 'accessToken'
  const REFRESH_KEY = 'refreshToken'

  /* ----------------------------- 토큰 저장소 ----------------------------- */
  const tokenStore = {
    getAccess() {
      return localStorage.getItem(TOKEN_KEY)
    },
    getRefresh() {
      return localStorage.getItem(REFRESH_KEY)
    },
    setTokens(accessToken, refreshToken) {
      if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken)
      if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
    },
    clear() {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(REFRESH_KEY)
    },
  }

  /* ------------------------------ 공통 요청 ------------------------------ */
  function buildUrl(path, query) {
    const base = path.startsWith('http') ? path : COMMON_URL + path
    if (!query) return base
    const usp = new URLSearchParams()
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return
      usp.set(k, String(v))
    })
    const qs = usp.toString()
    return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base
  }

  async function parseBody(res) {
    const text = await res.text()
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }

  /**
   * 핵심 fetch 래퍼.
   * @param {string} method
   * @param {string} path
   * @param {{ query?: object, body?: any, auth?: boolean, headers?: object }} [opts]
   */
  async function request(method, path, opts = {}) {
    const { query, body, auth = true, headers = {} } = opts
    const url = buildUrl(path, query)

    const finalHeaders = { Accept: 'application/json', ...headers }
    let payload
    if (body !== undefined && body !== null) {
      if (body instanceof FormData) {
        payload = body
      } else {
        finalHeaders['Content-Type'] = 'application/json'
        payload = JSON.stringify(body)
      }
    }
    if (auth) {
      const token = tokenStore.getAccess()
      if (token) finalHeaders['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch(url, { method, headers: finalHeaders, body: payload })

    if (res.status === 204) return null
    const data = await parseBody(res)
    if (!res.ok) {
      const message =
        (data && typeof data === 'object' && (data.message || data.error)) ||
        (typeof data === 'string' ? data : null) ||
        `${res.status} ${res.statusText}`
      const err = new Error(message)
      err.status = res.status
      err.body = data
      throw err
    }
    return data
  }

  /* ============================== 0. Auth ============================== */
  const auth = {
    /** 카카오 로그인 페이지로 브라우저 이동 */
    startKakaoLogin() {
      window.location.href = `${COMMON_URL}/oauth2/authorization/kakao`
    },
    /** 카카오 로그인 콜백에서 받은 토큰을 저장 */
    setTokens: tokenStore.setTokens,
    getAccessToken: tokenStore.getAccess,
    getRefreshToken: tokenStore.getRefresh,
    isLoggedIn() {
      return !!tokenStore.getAccess()
    },
    /** 토큰 재발급 (Refresh Rotation) */
    async refresh() {
      const refreshToken = tokenStore.getRefresh()
      const data = await request('POST', '/api/auth/refresh', {
        body: { refreshToken },
        auth: false,
      })
      if (data && data.refreshToken) {
        tokenStore.setTokens(data.accessToken, data.refreshToken)
      }
      return data
    },
    /** 로그아웃 (서버 Refresh 폐기 + 로컬 토큰 삭제) */
    async logout() {
      try {
        await request('POST', '/api/auth/logout')
      } finally {
        tokenStore.clear()
      }
    },
  }

  /* ============================ 1. Users ============================ */
  const users = {
    me() {
      return request('GET', '/api/users/me')
    },
    updateNickname(nickname) {
      return request('PATCH', '/api/users/me/nickname', { body: { nickname } })
    },
    /** body: { sweet, salty, sour, bitter, umami } (CUSTOMER 전용) */
    updateTastes(tastes) {
      return request('PUT', '/api/users/me/tastes', { body: tastes })
    },
    withdraw() {
      return request('DELETE', '/api/users/me')
    },
  }

  /* ============================ 2. Stores =========================== */
  const stores = {
    /** GET /api/stores?q=&page=&size= */
    search({ q = '', page = 0, size = 20 } = {}) {
      return request('GET', '/api/stores', { query: { q, page, size }, auth: false })
    },
    detail(storeId) {
      return request('GET', `/api/stores/${storeId}`, { auth: false })
    },
    /** 사장: 가게 등록 */
    create(payload) {
      return request('POST', '/api/owner/stores', { body: payload })
    },
    /** 사장: 영업 상태 변경 — status: 'PREPARING' | 'OPEN' | 'CLOSE' */
    updateStatus(storeId, status) {
      return request('PATCH', `/api/owner/stores/${storeId}/status`, { body: { status } })
    },
    /** 추후: 내 주변 가게 조회 */
    nearby({ lat, lng, radiusKm = 3, page = 0, size = 20 } = {}) {
      return request('GET', '/api/stores/nearby', {
        query: { lat, lng, radiusKm, page, size },
        auth: false,
      })
    },
  }

  /* ============================= 3. Menus =========================== */
  const menus = {
    create(storeId, payload) {
      return request('POST', `/api/owner/stores/${storeId}/menus`, { body: payload })
    },
    update(storeId, menuId, payload) {
      return request('PUT', `/api/owner/stores/${storeId}/menus/${menuId}`, { body: payload })
    },
    remove(storeId, menuId) {
      return request('DELETE', `/api/owner/stores/${storeId}/menus/${menuId}`)
    },
  }

  /* ============================== 4. Cart =========================== */
  const cart = {
    get() {
      return request('GET', '/api/cart')
    },
    /** body: { storeId, menuId, quantity }  (가게 변경 시 서버에서 초기화) */
    addItem({ storeId, menuId, quantity }) {
      return request('POST', '/api/cart/items', { body: { storeId, menuId, quantity } })
    },
    updateQuantity(itemId, quantity) {
      return request('PATCH', `/api/cart/items/${itemId}`, { body: { quantity } })
    },
    removeItem(itemId) {
      return request('DELETE', `/api/cart/items/${itemId}`)
    },
    clear() {
      return request('DELETE', '/api/cart')
    },
  }

  /* ============================ 5. Orders =========================== */
  const orders = {
    /** 고객: 주문 생성 — body: { storeId, zipCode, address, addressDetail } */
    create(payload) {
      return request('POST', '/api/orders', { body: payload })
    },
    myList(query) {
      return request('GET', '/api/orders/me', { query })
    },
    detail(orderId) {
      return request('GET', `/api/orders/${orderId}`)
    },
    /** 고객: PENDING 일 때만 가능 */
    cancel(orderId) {
      return request('POST', `/api/orders/${orderId}/cancel`)
    },
    owner: {
      accept(orderId) {
        return request('POST', `/api/owner/orders/${orderId}/accept`)
      },
      /** body: { rejectionReason } */
      reject(orderId, rejectionReason) {
        return request('POST', `/api/owner/orders/${orderId}/reject`, {
          body: { rejectionReason },
        })
      },
      /** status: 'COOKING' | 'DELIVERING' | 'DELIVERED' */
      updateStatus(orderId, status) {
        return request('PATCH', `/api/owner/orders/${orderId}/status`, { body: { status } })
      },
      todayStats() {
        return request('GET', '/api/owner/orders/stats/today')
      },
      todayStatsByStore() {
        return request('GET', '/api/owner/orders/stats/today/stores')
      },
    },
  }

  /* ============================ 6. Reviews ========================== */
  const reviews = {
    /** 주문에 리뷰 작성 (고객) */
    createForOrder(orderId, payload) {
      return request('POST', `/api/orders/${orderId}/reviews`, { body: payload })
    },
    /** 가게 리뷰 목록 (비로그인 OK) */
    listByStore(storeId, { page = 0, size = 20 } = {}) {
      return request('GET', `/api/stores/${storeId}/reviews`, {
        query: { page, size },
        auth: false,
      })
    },
    myList(query) {
      return request('GET', '/api/reviews/me', { query })
    },
    update(reviewId, payload) {
      return request('PUT', `/api/reviews/${reviewId}`, { body: payload })
    },
    remove(reviewId) {
      return request('DELETE', `/api/reviews/${reviewId}`)
    },
    /** 사장 답글 */
    ownerReply(reviewId, ownerReply) {
      return request('POST', `/api/owner/reviews/${reviewId}/reply`, { body: { ownerReply } })
    },
  }

  /* ============================== 7. AI ============================= */
  const ai = {
    /** 내 오각형 맛 통계 (10분 캐시) */
    myTastePentagon() {
      return request('GET', '/api/ai/me/taste-pentagon')
    },
    /** 가게 메뉴 추천 (5분 캐시) */
    storeRecommendations(storeId) {
      return request('GET', `/api/ai/stores/${storeId}/recommendations`)
    },
  }

  /* ============================ 8. Payment ========================== */
  const payment = {
    kakaoPay: {
      /** body: { orderId } */
      ready(orderId) {
        return request('POST', '/api/payments/kakaopay/ready', { body: { orderId } })
      },
      /** body: { orderId, pgToken } */
      approve({ orderId, pgToken }) {
        return request('POST', '/api/payments/kakaopay/approve', { body: { orderId, pgToken } })
      },
      /** body: { orderId, reason } */
      cancel({ orderId, reason }) {
        return request('POST', '/api/payments/kakaopay/cancel', { body: { orderId, reason } })
      },
    },
  }

  /* ========================== 9. Notifications ====================== */
  const notifications = {
    list(query) {
      return request('GET', '/api/notifications', { query })
    },
    markRead(notificationId) {
      return request('PATCH', `/api/notifications/${notificationId}/read`)
    },
  }

  /* ============================== Export ============================ */
  window.api = {
    COMMON_URL,
    request,
    tokens: tokenStore,
    auth,
    users,
    stores,
    menus,
    cart,
    orders,
    reviews,
    ai,
    payment,
    notifications,
  }
})()
