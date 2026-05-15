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
        btn.addEventListener('click', () =>
          handleOrderCancel(Number(btn.dataset.orderCancel), btn.dataset.paymentStatus),
        )
      })

      highlightOrderFromQuery()
    } catch (e) {
      renderError(errorMessage(e))
    }
  }

  async function handleOrderCancel(orderId, paymentStatus) {
    if (!Number.isFinite(orderId)) return
    const paid = String(paymentStatus || '').toUpperCase() === 'APPROVED'
    const msg = paid
      ? '카카오페이 결제를 취소하고 환불할까요?\n(가게 접수 전 주문만 가능합니다)'
      : '주문을 취소할까요?'
    if (!confirm(msg)) return

    const reason = paid
      ? window.prompt('취소 사유를 입력해 주세요 (선택)', '고객 변심') || '고객 주문 취소'
      : undefined

    const btn = document.querySelector(`[data-order-cancel="${orderId}"]`)
    if (btn) btn.disabled = true

    try {
      await api.orders.cancel(orderId, reason)
      applyOrderCanceledUi(orderId)
      alert('결제가 취소되었어요.')
      window.CustomerNotifications?.refreshBadge()
    } catch (e) {
      if (shouldTreatCancelAsDone(e, paid)) {
        applyOrderCanceledUi(orderId)
        alert('결제가 취소되었어요.')
        window.CustomerNotifications?.refreshBadge()
        return
      }
      alert(cancelErrorMessage(e))
      if (btn) btn.disabled = false
    }
  }

  function shouldTreatCancelAsDone(e, paid) {
    if (!paid) return false
    if (e?.status === 502) return true
    const msg = String(e?.message || e?.body?.detail || '').toLowerCase()
    return (
      msg === 'bad gateway' ||
      (msg.includes('이미') && msg.includes('취소')) ||
      msg.includes('취소 가능한 금액')
    )
  }

  function applyOrderCanceledUi(orderId) {
    const card = document.querySelector(`[data-order-id="${orderId}"]`)
    if (!card) return

    const statusEl = card.querySelector('.my-order-status')
    if (statusEl) {
      statusEl.textContent = '주문 취소'
      statusEl.className = 'my-order-status is-rejected'
    }

    const payNote = card.querySelector('.my-order-pay-note')
    if (payNote) {
      payNote.textContent = ' · 결제 취소·환불 완료'
    } else {
      const dateEl = card.querySelector('.my-order-date')
      if (dateEl) {
        const span = document.createElement('span')
        span.className = 'my-order-pay-note'
        span.textContent = ' · 결제 취소·환불 완료'
        dateEl.after(span)
      }
    }

    const cancelBtn = card.querySelector('[data-order-cancel]')
    if (cancelBtn) {
      cancelBtn.replaceWith(renderCanceledDoneLabel())
    }

    card.classList.add('my-order-card--canceled')
    const amountEl = card.querySelector('.my-order-amount')
    if (amountEl) amountEl.classList.add('my-order-amount--canceled')
  }

  function renderCanceledDoneLabel() {
    const el = document.createElement('span')
    el.className = 'my-order-muted-action'
    el.textContent = '취소 완료'
    return el
  }

  function cancelErrorMessage(e) {
    const msg = String(e?.message || e?.body?.detail || '')
    if (e?.status === 409 && msg.toLowerCase().includes('pending')) {
      return '주문 접수 상태에서만 취소할 수 있어요.'
    }
    if (e?.status === 502 || msg.includes('KakaoPay')) {
      if (msg.includes('이미') && msg.includes('취소')) {
        return '이미 환불된 주문이에요. 잠시 후 목록을 새로고침해 주세요.'
      }
      return msg.replace(/^KakaoPay API error(?:\s*\([^)]+\))?:\s*/i, '카카오페이: ')
        || '카카오페이 취소 요청에 실패했어요.'
    }
    if (msg.toLowerCase() === 'bad gateway') {
      return '결제 취소 처리 중 오류가 났어요. 이미 환불됐다면 새로고침 후 상태를 확인해 주세요.'
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
        : `<p class="my-order-store-name">${escapeHtml(storeName)}</p>`

    const paymentStatus = String(order.paymentStatus ?? '').toUpperCase()
    const paid = paymentStatus === 'APPROVED'

    const isCanceledOrder = status === 'CANCELED' || status === 'REJECTED'

    let payNoteHtml = ''
    if (paid && status === 'PENDING') {
      payNoteHtml = '<span class="my-order-pay-note"> · 카카오페이</span>'
    } else if (paymentStatus === 'CANCELED' || status === 'CANCELED') {
      payNoteHtml = '<span class="my-order-pay-note"> · 결제 취소·환불 완료</span>'
    }

    const cancelBlock =
      status === 'CANCELED'
        ? '<span class="my-order-muted-action">취소 완료</span>'
        : status === 'PENDING'
          ? `<button type="button" class="my-order-cancel-btn" data-order-cancel="${Number(order.id)}" data-payment-status="${escapeHtml(paymentStatus)}">${paid ? '결제 취소·환불' : '주문 취소'}</button>`
          : ''

    const reviewBlock =
      status === 'DELIVERED' && !order.hasReview
        ? `<a href="/pages/write-review.html?orderId=${Number(order.id)}" class="my-order-review-btn">리뷰 작성</a>`
        : ''

    const actA = reviewBlock ? `<div class="my-order-act-a">${reviewBlock}</div>` : ''
    const actB = cancelBlock ? `<div class="my-order-act-b">${cancelBlock}</div>` : ''
    const actionsRow = actA || actB ? `<div class="my-order-actions">${actA}${actB}</div>` : ''

    const cardExtraClass = isCanceledOrder ? ' my-order-card--canceled' : ''

    return `
      <article class="my-order-card${cardExtraClass}" data-order-id="${Number(order.id)}">
        <div class="my-order-top">
          ${storeHtml}
          <span class="my-order-status ${statusClass(status)}">${escapeHtml(statusLabel(status))}</span>
        </div>
        <p class="my-order-menu">${escapeHtml(menuSummary)}</p>
        <div class="my-order-meta">
          <div class="my-order-meta-left">
            <span class="my-order-date">${escapeHtml(createdAt)}</span>${payNoteHtml}
          </div>
          <span class="my-order-amount${isCanceledOrder ? ' my-order-amount--canceled' : ''}">${formatWon(amount)}</span>
        </div>
        ${actionsRow}
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

  function highlightOrderFromQuery() {
    const params = new URLSearchParams(window.location.search)
    const orderId = Number(params.get('orderId'))
    if (!Number.isFinite(orderId) || orderId <= 0) return

    const card = document.querySelector(`[data-order-id="${orderId}"]`)
    if (!card) return

    card.classList.add('is-highlighted')
    card.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => card.classList.remove('is-highlighted'), 2400)
  }
})()
