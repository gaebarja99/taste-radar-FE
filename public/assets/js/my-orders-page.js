/**
 * 내 주문 목록 페이지
 * - GET /api/orders/me
 */
;(function () {
  'use strict'

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
    refreshCartBadge()

    if (!api.auth.isLoggedIn()) {
      renderGuest()
      return
    }

    const role = (localStorage.getItem('role') || '').toUpperCase()
    if (role !== 'CUSTOMER') {
      renderWrongRole()
      return
    }

    await loadOrders()
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
      setCartBadge(itemTotalQuantity(data))
    } catch {
      setCartBadge(0)
    }
  }

  async function loadOrders() {
    const host = document.getElementById('ordersHost')
    host.innerHTML = '<p class="empty-state">불러오는 중…</p>'

    try {
      const page = await api.orders.myList({ page: 0, size: 50 })
      const orders = Array.isArray(page?.content) ? page.content : []

      if (orders.length === 0) {
        host.innerHTML = `
          <section class="table-section">
            <p class="empty-state">아직 주문 내역이 없어요.</p>
            <p style="padding:0 18px 16px;margin:0">
              <a href="/" class="btn-outline-sm" style="display:inline-flex;text-decoration:none">가게 둘러보기</a>
            </p>
          </section>
        `
        return
      }

      host.innerHTML = `
        <section class="table-section">
          <div class="my-orders-host">
            ${orders.map(renderOrderCard).join('')}
          </div>
        </section>
      `

      host.querySelectorAll('[data-order-cancel]').forEach((btn) => {
        btn.addEventListener('click', () => handleOrderCancel(Number(btn.dataset.orderCancel)))
      })
    } catch (e) {
      renderError(errorMessage(e))
    }
  }

  async function handleOrderCancel(orderId) {
    if (!Number.isFinite(orderId)) return
    if (!confirm('주문을 취소하고 결제를 환불할까요?\n(주문 접수 상태에서만 가능합니다)')) return

    const btn = document.querySelector(`[data-order-cancel="${orderId}"]`)
    if (btn) btn.disabled = true

    try {
      await api.orders.cancel(orderId)
      await loadOrders()
    } catch (e) {
      alert(cancelErrorMessage(e))
      if (btn) btn.disabled = false
    }
  }

  function cancelErrorMessage(e) {
    const msg = String(e?.message || e?.body?.detail || '')
    if (e?.status === 409 && msg.toLowerCase().includes('pending')) {
      return '주문 접수 상태에서만 취소할 수 있어요.'
    }
    if (msg.includes('KakaoPay')) {
      return msg.replace(/^KakaoPay API error(?:\s*\([^)]+\))?:\s*/i, '카카오페이: ')
    }
    return msg || '주문 취소에 실패했어요.'
  }

  function renderOrderCard(order) {
    const storeId = Number(order.storeId)
    const storeName = order.storeName ?? '가게'
    const menuSummary = order.menuSummary ?? '메뉴 정보 없음'
    const status = String(order.orderStatus ?? order.status ?? '').toUpperCase()
    const amount = Number(order.totalAmount ?? 0)
    const createdAt = formatDateTime(order.createdAt)

    const storeHtml =
      Number.isFinite(storeId) && storeId > 0
        ? `<a class="my-order-store-link" href="/pages/store.html?storeId=${storeId}">${escapeHtml(storeName)}</a>`
        : `<p class="my-order-store-link" style="color:var(--color-text-main)">${escapeHtml(storeName)}</p>`

    const cancelBtn =
      status === 'PENDING'
        ? `<button type="button" class="my-order-cancel-btn" data-order-cancel="${Number(order.id)}">결제 취소</button>`
        : ''

    const reviewBtn =
      status === 'DELIVERED' && !order.hasReview
        ? `<a href="/pages/write-review.html?orderId=${Number(order.id)}" class="btn-outline-sm" style="display:inline-flex;text-decoration:none;margin-top:8px">리뷰 작성</a>`
        : ''

    return `
      <article class="my-order-card">
        <div class="my-order-top">
          ${storeHtml}
          <span class="my-order-status ${statusClass(status)}">${escapeHtml(statusLabel(status))}</span>
        </div>
        <p class="my-order-menu">${escapeHtml(menuSummary)}</p>
        <div class="my-order-meta">
          <span>${escapeHtml(createdAt)}</span>
          <span class="my-order-amount">${formatWon(amount)}</span>
        </div>
        ${cancelBtn}
        ${reviewBtn}
      </article>
    `
  }

  function statusClass(status) {
    if (status === 'PENDING') return 'is-pending'
    if (status === 'COOKING') return 'is-cooking'
    if (status === 'DELIVERING') return 'is-delivering'
    if (status === 'DELIVERED') return 'is-delivered'
    if (status === 'REJECTED' || status === 'CANCELED') return 'is-rejected'
    return ''
  }

  function statusLabel(status) {
    switch (status) {
      case 'PENDING':
        return '주문 접수'
      case 'COOKING':
        return '조리 중'
      case 'DELIVERING':
        return '배달 중'
      case 'DELIVERED':
        return '배달 완료'
      case 'REJECTED':
        return '주문 거절'
      case 'CANCELED':
        return '주문 취소'
      default:
        return status || '-'
    }
  }

  function formatDateTime(value) {
    if (!value) return '-'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function renderGuest() {
    document.getElementById('ordersHost').innerHTML = `
      <section class="table-section">
        <p class="empty-state">로그인 후 주문 내역을 확인할 수 있어요.</p>
        <a href="/" class="btn-outline-sm" style="display:inline-flex;text-decoration:none;margin:0 18px 16px">홈에서 로그인</a>
      </section>
    `
  }

  function renderWrongRole() {
    document.getElementById('ordersHost').innerHTML = `
      <section class="table-section">
        <p class="empty-state">주문 내역은 고객 계정에서만 확인할 수 있어요.</p>
        <a href="/" class="btn-outline-sm" style="display:inline-flex;text-decoration:none;margin:0 18px 16px">홈으로</a>
      </section>
    `
  }

  function renderError(message) {
    document.getElementById('ordersHost').innerHTML = `
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

  function errorMessage(e) {
    if (!e) return '주문 내역을 불러오지 못했습니다.'
    if (e.status === 401) return '로그인이 필요합니다.'
    return e.message || '주문 내역을 불러오지 못했습니다.'
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
