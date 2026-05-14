/**
 * 결제 페이지 — 주문 생성 후 카카오페이 결제
 */
;(function () {
  'use strict'

  let cartData = null

  document.addEventListener('DOMContentLoaded', init)

  async function init() {
    if (!window.api) {
      renderError('API 스크립트를 불러오지 못했습니다.')
      return
    }

    document.getElementById('btnKakaoLogin')?.addEventListener('click', () => {
      window.location.href = '/'
    })

    window.CustomerMenu?.init({
      onLoginClick: () => window.location.href = '/',
      onLogout: async () => {
        try {
          await api.auth.logout()
        } catch {
          /* ignore */
        }
        ;['userId', 'email', 'nickname', 'role'].forEach((k) =>
          localStorage.removeItem(k),
        )
        window.location.href = '/'
      },
    })

    setupAuthUi()
    showQueryBanner()

    if (!api.auth.isLoggedIn()) {
      renderGuest()
      return
    }

    const role = (localStorage.getItem('role') || '').toUpperCase()
    if (role !== 'CUSTOMER') {
      renderWrongRole()
      return
    }

    await loadCheckout()
  }

  function setupAuthUi() {
    const loggedIn = api.auth.isLoggedIn()
    const loginBtn = document.getElementById('btnKakaoLogin')
    const nickEl = document.getElementById('userNickname')
    if (!loginBtn || !nickEl) return
    loginBtn.hidden = loggedIn
    nickEl.hidden = !loggedIn
    if (loggedIn) {
      nickEl.textContent = localStorage.getItem('nickname') || '회원'
    }
  }

  async function abandonPendingOrder() {
    const pendingRaw = sessionStorage.getItem('tasteRadar.pendingOrderId')
    const orderId = pendingRaw ? Number(pendingRaw) : NaN
    if (!Number.isFinite(orderId) || !api.auth.isLoggedIn()) return
    try {
      await api.orders.cancel(orderId)
    } catch {
      /* 이미 취소됐거나 결제 완료된 주문이면 무시 */
    } finally {
      sessionStorage.removeItem('tasteRadar.pendingOrderId')
    }
  }

  function showQueryBanner() {
    const banner = document.getElementById('checkoutBanner')
    if (!banner) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('canceled') === '1') {
      banner.hidden = false
      banner.className = 'checkout-banner is-warn'
      banner.textContent = '결제가 취소되었어요. 다시 시도할 수 있어요.'
      abandonPendingOrder()
    } else if (params.get('failed') === '1') {
      banner.hidden = false
      banner.className = 'checkout-banner is-error'
      banner.textContent = '결제에 실패했어요. 잠시 후 다시 시도해 주세요.'
    }
  }

  async function loadCheckout() {
    const host = document.getElementById('checkoutHost')
    host.innerHTML = '<p class="empty-state">불러오는 중…</p>'

    try {
      cartData = await api.cart.get()
      const items = Array.isArray(cartData?.items) ? cartData.items : []
      setCartBadge(itemTotalQuantity(cartData))

      if (items.length === 0) {
        host.innerHTML = `
          <section class="table-section">
            <p class="empty-state">장바구니가 비어 있어요.</p>
            <p style="padding:0 18px 16px;margin:0">
              <a href="/" class="btn-outline-sm" style="display:inline-flex;text-decoration:none">가게 둘러보기</a>
            </p>
          </section>
        `
        return
      }

      const storeNameEl = document.getElementById('checkoutStoreName')
      if (storeNameEl) {
        storeNameEl.textContent = cartData.storeName
          ? `${cartData.storeName} · 배달 주소를 입력하고 결제해 주세요`
          : '배달 주소를 입력하고 결제해 주세요'
      }

      const totalAmount = itemTotalAmount(items)
      host.innerHTML = `
        <section class="table-section checkout-section">
          <div class="section-head">
            <h2 class="section-head-title">주문 내역</h2>
          </div>
          <div style="padding:0 18px">
            ${items.map(renderCheckoutItem).join('')}
          </div>
          <div class="checkout-total-row">
            <span>결제 금액</span>
            <strong>${formatWon(totalAmount)}</strong>
          </div>
        </section>

        <section class="table-section checkout-section">
          <div class="section-head">
            <h2 class="section-head-title">배달 주소</h2>
          </div>
          <form id="checkoutForm" class="checkout-form" novalidate>
            <div class="checkout-field">
              <label for="zipCode">우편번호</label>
              <input id="zipCode" name="zipCode" type="text" inputmode="numeric" placeholder="예: 21403" required maxlength="10" />
            </div>
            <div class="checkout-field">
              <label for="address">주소</label>
              <input id="address" name="address" type="text" placeholder="도로명 주소" required maxlength="200" />
            </div>
            <div class="checkout-field">
              <label for="addressDetail">상세 주소</label>
              <input id="addressDetail" name="addressDetail" type="text" placeholder="동·호수 등" required maxlength="100" />
            </div>
          </form>
        </section>

        <section class="table-section checkout-section">
          <div class="checkout-pay-area">
            <button type="button" id="btnKakaoPay" class="btn-kakaopay">
              <svg class="kakao-logo kakao-logo--lg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3c5.523 0 10 3.582 10 8 0 2.558-1.294 4.832-3.333 6.274L19 22l-5.2-2.86C14.89 19.378 13.47 19.5 12 19.5 6.477 19.5 2 15.918 2 11.5 2 7.082 6.477 3.5 12 3.5z"/></svg>
              카카오페이로 결제하기
            </button>
            <a href="/pages/cart.html" class="checkout-back-link">
              <i class="ti ti-arrow-left" aria-hidden="true"></i> 장바구니로 돌아가기
            </a>
          </div>
        </section>
      `

      document.getElementById('btnKakaoPay')?.addEventListener('click', handleKakaoPay)
      await prefillAddressFromProfile()
    } catch (e) {
      renderError(errorMessage(e))
    }
  }

  async function prefillAddressFromProfile() {
    const form = document.getElementById('checkoutForm')
    if (!form) return
    try {
      const me = await api.users.me()
      if (me?.zipCode && !form.zipCode.value) form.zipCode.value = me.zipCode
      if (me?.address && !form.address.value) form.address.value = me.address
      if (me?.addressDetail && !form.addressDetail.value) form.addressDetail.value = me.addressDetail
    } catch {
      /* ignore */
    }
  }

  function renderCheckoutItem(item) {
    const qty = Number(item.quantity ?? 1)
    const unit = Number(item.unitPrice ?? 0)
    return `
      <div class="checkout-item-row">
        <div>
          <p class="checkout-item-name">${escapeHtml(item.menuName ?? '메뉴')}</p>
          <p class="checkout-item-meta">${formatWon(unit)} × ${qty}</p>
        </div>
        <p class="checkout-item-price">${formatWon(unit * qty)}</p>
      </div>
    `
  }

  async function handleKakaoPay() {
    const form = document.getElementById('checkoutForm')
    const btn = document.getElementById('btnKakaoPay')
    if (!form || !btn || !cartData?.storeId) return

    const zipCode = form.zipCode.value.trim()
    const address = form.address.value.trim()
    const addressDetail = form.addressDetail.value.trim()

    if (!zipCode || !address || !addressDetail) {
      alert('배달 주소를 모두 입력해 주세요.')
      return
    }

    btn.disabled = true
    try {
      const pendingRaw = sessionStorage.getItem('tasteRadar.pendingOrderId')
      let orderId = pendingRaw ? Number(pendingRaw) : NaN

      if (!Number.isFinite(orderId)) {
        const order = await api.orders.create({
          storeId: Number(cartData.storeId),
          zipCode,
          address,
          addressDetail,
        })
        orderId = order.id
        sessionStorage.setItem('tasteRadar.pendingOrderId', String(orderId))
      }

      const ready = await api.payment.kakaoPay.ready(orderId)
      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
      const redirectUrl = isMobile
        ? ready.nextRedirectMobileUrl ||
          ready.next_redirect_mobile_url ||
          ready.nextRedirectPcUrl ||
          ready.next_redirect_pc_url
        : ready.nextRedirectPcUrl ||
          ready.next_redirect_pc_url ||
          ready.nextRedirectMobileUrl ||
          ready.next_redirect_mobile_url

      if (!redirectUrl) {
        throw new Error('카카오페이 결제 화면 URL을 받지 못했습니다.')
      }

      sessionStorage.setItem('tasteRadar.pendingOrderId', String(orderId))
      window.location.href = redirectUrl
    } catch (e) {
      alert(paymentErrorMessage(e))
      btn.disabled = false
    }
  }

  function renderGuest() {
    document.getElementById('checkoutHost').innerHTML = `
      <section class="table-section">
        <p class="empty-state">로그인 후 결제할 수 있어요.</p>
        <a href="/" class="btn-outline-sm" style="display:inline-flex;text-decoration:none;margin:0 18px 16px">홈에서 로그인</a>
      </section>
    `
  }

  function renderWrongRole() {
    document.getElementById('checkoutHost').innerHTML = `
      <section class="table-section">
        <p class="empty-state">결제는 고객 계정에서만 이용할 수 있어요.</p>
        <a href="/" class="btn-outline-sm" style="display:inline-flex;text-decoration:none;margin:0 18px 16px">홈으로</a>
      </section>
    `
  }

  function renderError(message) {
    document.getElementById('checkoutHost').innerHTML = `
      <section class="table-section">
        <p class="empty-state">${escapeHtml(message)}</p>
        <a href="/pages/cart.html" class="btn-outline-sm" style="display:inline-flex;text-decoration:none;margin:0 18px 16px">장바구니로</a>
      </section>
    `
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

  function paymentErrorMessage(e) {
    if (!e) return '결제를 시작하지 못했습니다.'
    const msg = String(e.message || e.body?.detail || '')
    if (e.status === 503 || msg.includes('admin key') || msg.includes('Secret Key')) {
      if (msg.includes('40-character') || msg.includes('developers.kakaopay')) {
        return '카카오페이 Secret Key(40자)가 필요해요. developers.kakaopay.com 에서 앱 등록 후 Secret Key(dev) 를 demo/.env 의 KAKAO_PAY_ADMIN_KEY 에 넣어 주세요. (developers.kakao.com REST 키는 사용 불가)'
      }
      return '카카오페이가 아직 설정되지 않았어요. demo/.env 에 KAKAO_PAY_ADMIN_KEY 를 등록해 주세요.'
    }
    if (e.status === 502 || msg.includes('KakaoPay')) {
      return msg.includes('KakaoPay API error')
        ? msg.replace(/^KakaoPay API error(?:\s*\([^)]+\))?:\s*/i, '카카오페이: ')
        : '카카오페이 연결에 실패했어요. Admin 키(40자)와 CID 설정을 확인해 주세요.'
    }
    if (e.status === 400 && msg.toLowerCase().includes('cart is empty')) {
      return '장바구니가 비었어요. 가게에서 메뉴를 다시 담은 뒤 결제해 주세요.'
    }
    if (e.status === 400 && msg.toLowerCase().includes('minimum')) {
      return '최소 주문 금액을 채우지 못했어요.'
    }
    return msg || '결제를 시작하지 못했습니다.'
  }

  function errorMessage(e) {
    if (!e) return '장바구니를 불러오지 못했습니다.'
    if (e.status === 401) return '로그인이 필요합니다.'
    return e.message || '장바구니를 불러오지 못했습니다.'
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
})()
