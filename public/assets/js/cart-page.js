/**
 * 장바구니 페이지
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
      onLoginClick: () => {
        window.location.href = '/'
      },
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

    if (!api.auth.isLoggedIn()) {
      renderGuest()
      return
    }

    const role = (localStorage.getItem('role') || '').toUpperCase()
    if (role !== 'CUSTOMER') {
      renderWrongRole()
      return
    }

    await loadCart()
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

  async function loadCart() {
    const host = document.getElementById('cartHost')
    host.innerHTML = '<p class="empty-state">불러오는 중…</p>'

    try {
      cartData = await api.cart.get()
      setCartBadge(itemTotalQuantity(cartData))
      updateStoreLink(cartData)
      renderCart(cartData)
    } catch (e) {
      cartData = null
      setCartBadge(0)
      renderError(errorMessage(e))
    }
  }

  function updateStoreLink(data) {
    const el = document.getElementById('cartStoreLink')
    if (!el) return
    if (data?.storeId && data?.storeName) {
      el.innerHTML = `<a href="/pages/store.html?storeId=${data.storeId}">${escapeHtml(data.storeName)}</a> · 메뉴 더 담기`
    } else {
      el.textContent = '담긴 가게가 없어요.'
    }
  }

  function renderCart(data) {
    const host = document.getElementById('cartHost')
    const items = Array.isArray(data?.items) ? data.items : []
    const totalQty = itemTotalQuantity(data)
    const totalAmount = itemTotalAmount(items)

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

    host.innerHTML = `
      <section class="table-section">
        <div class="section-head cart-section-head">
          <h2 class="section-head-title">담은 메뉴</h2>
          <span class="cart-summary-pill">${totalQty}개</span>
        </div>
        <div class="customer-menu-list cart-item-list">
          ${items.map(renderCartItem).join('')}
        </div>
        <div class="cart-foot">
          <div class="cart-total-row">
            <span>합계</span>
            <strong>${formatWon(totalAmount)}</strong>
          </div>
          <div class="cart-actions">
            <button type="button" class="btn-primary cart-checkout-btn" id="btnCartCheckout">주문하기</button>
            <button
              type="button"
              class="cart-clear-btn"
              id="btnCartClear"
              aria-label="장바구니 비우기"
              title="장바구니 비우기"
            >
              <i class="ti ti-trash" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </section>
    `

    host.querySelectorAll('[data-cart-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.cartAct
        const itemId = Number(btn.dataset.itemId)
        const qty = Number(btn.dataset.qty)
        handleCartAction(action, itemId, qty)
      })
    })

    document.getElementById('btnCartClear')?.addEventListener('click', handleCartClear)
    document.getElementById('btnCartCheckout')?.addEventListener('click', () => {
      window.location.href = '/pages/checkout.html'
    })
  }

  function renderCartItem(item) {
    const qty = Number(item.quantity ?? 1)
    const unit = Number(item.unitPrice ?? 0)
    const line = unit * qty
    return `
      <article class="cart-item-card">
        <div class="cart-item-main">
          <p class="cart-item-name">${escapeHtml(item.menuName ?? '메뉴')}</p>
          <p class="cart-item-unit">단가 ${formatWon(unit)}</p>
        </div>
        <p class="cart-item-line-total">${formatWon(line)}</p>
        <div class="cart-item-controls">
          <div class="qty-stepper" role="group" aria-label="수량 조절">
            <button type="button" class="qty-btn" data-cart-act="dec" data-item-id="${item.id}" data-qty="${qty}" ${qty <= 1 ? 'disabled' : ''} aria-label="수량 감소">−</button>
            <span class="qty-value">${qty}</span>
            <button type="button" class="qty-btn" data-cart-act="inc" data-item-id="${item.id}" data-qty="${qty}" aria-label="수량 증가">+</button>
          </div>
          <button type="button" class="cart-item-remove" data-cart-act="remove" data-item-id="${item.id}" data-qty="0">삭제</button>
        </div>
      </article>
    `
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
      alert(errorMessage(e))
    }
  }

  async function handleCartClear() {
    if (!confirm('장바구니를 비울까요?')) return
    try {
      await api.cart.clear()
      await loadCart()
    } catch (e) {
      alert(errorMessage(e))
    }
  }

  function renderGuest() {
    setCartBadge(0)
    const storeLink = document.getElementById('cartStoreLink')
    if (storeLink) storeLink.textContent = '로그인 후 장바구니를 이용할 수 있어요.'
    document.getElementById('cartHost').innerHTML = `
      <section class="table-section cart-guest-box">
        <p class="empty-state">로그인 후 장바구니를 확인할 수 있어요.</p>
        <a href="/" class="btn-outline-sm" style="display:inline-flex;text-decoration:none">홈에서 로그인</a>
      </section>
    `
  }

  function renderWrongRole() {
    setCartBadge(0)
    document.getElementById('cartStoreLink').textContent = '고객 계정 전용 기능이에요.'
    document.getElementById('cartHost').innerHTML = `
      <section class="table-section">
        <p class="empty-state">장바구니는 고객 계정에서만 이용할 수 있어요.</p>
        <a href="/" class="btn-outline-sm" style="display:inline-flex;text-decoration:none;margin:0 18px 16px">홈으로</a>
      </section>
    `
  }

  function renderError(message) {
    document.getElementById('cartHost').innerHTML = `
      <section class="table-section">
        <p class="empty-state">${escapeHtml(message)}</p>
        <a href="/" class="btn-outline-sm" style="display:inline-flex;text-decoration:none;margin:0 18px 16px">홈으로</a>
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
