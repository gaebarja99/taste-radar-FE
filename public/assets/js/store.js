/**
 * 고객용 가게 상세 (비로그인·로그인 공통)
 * - GET /api/stores/{storeId}
 * - URL: /pages/store.html?storeId=
 */
;(function () {
  'use strict'

  let currentStoreId = null

  document.addEventListener('DOMContentLoaded', init)

  async function init() {
    if (!window.api) {
      renderError('API 스크립트를 불러오지 못했습니다.')
      return
    }

    const params = new URLSearchParams(window.location.search)
    const storeId = params.get('storeId')
    if (!storeId || !/^\d+$/.test(storeId)) {
      renderError('가게 정보가 없어요. 홈에서 가게를 선택해 주세요.')
      return
    }

    currentStoreId = storeId
    setupAuthUi()
    setupCartButton()
    refreshCartBadge()

    document.getElementById('btnKakaoLogin')?.addEventListener('click', () => {
      window.location.href = '/'
    })

    await loadStore(storeId)
  }

  async function confirmReplaceCartForOtherStore(storeId) {
    try {
      const cart = await api.cart.get()
      const items = Array.isArray(cart?.items) ? cart.items : []
      if (items.length === 0) return true
      const cartStoreId = Number(cart.storeId)
      if (!cartStoreId || cartStoreId === Number(storeId)) return true
      return confirm(
        '다른 음식점에서 이미 담은 메뉴가 있습니다. 담긴 메뉴를 취소하고 새로운 음식점에서 메뉴를 담을까요?',
      )
    } catch {
      return true
    }
  }

  function setupCartButton() {
    document.getElementById('btnCart')?.addEventListener('click', () => {
      if (!api.auth.isLoggedIn()) {
        alert('로그인 후 이용 가능합니다.')
        return
      }
      const role = (localStorage.getItem('role') || '').toUpperCase()
      if (role !== 'CUSTOMER') {
        alert('장바구니는 고객 계정에서만 이용할 수 있어요.')
        return
      }
      window.location.href = '/pages/cart.html'
    })
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

  async function loadStore(storeId) {
    const host = document.getElementById('storeHost')
    host.innerHTML = '<p class="empty-state">불러오는 중…</p>'

    try {
      const store = await api.stores.detail(storeId)
      document.title = `${store.name} — Taste Radar`
      host.innerHTML = renderStorePage(store)
      bindMenuActions(host, store)
    } catch (e) {
      renderError(errorMessage(e))
    }
  }

  function bindMenuActions(host, store) {
    host.querySelectorAll('.customer-menu-row').forEach((row) => {
      const qtyEl = row.querySelector('[data-qty-value]')
      const decBtn = row.querySelector('[data-qty-act="dec"]')
      const incBtn = row.querySelector('[data-qty-act="inc"]')
      const addBtn = row.querySelector('[data-add-cart]')

      const getQty = () => Math.max(1, Number(qtyEl?.textContent) || 1)
      const setQty = (n) => {
        const next = Math.min(99, Math.max(1, n))
        if (qtyEl) qtyEl.textContent = String(next)
        if (decBtn) decBtn.disabled = next <= 1
      }

      decBtn?.addEventListener('click', () => setQty(getQty() - 1))
      incBtn?.addEventListener('click', () => setQty(getQty() + 1))
      setQty(1)

      addBtn?.addEventListener('click', async () => {
        if (!api.auth.isLoggedIn()) {
          alert('로그인 후 이용 가능합니다.')
          return
        }
        const role = (localStorage.getItem('role') || '').toUpperCase()
        if (role !== 'CUSTOMER') {
          alert('주문하려면 고객 계정으로 로그인해 주세요.')
          return
        }
        const menuId = Number(addBtn.dataset.menuId)
        if (!menuId) return
        const quantity = getQty()

        const canAdd = await confirmReplaceCartForOtherStore(store.id)
        if (!canAdd) return

        addBtn.disabled = true
        try {
          await api.cart.addItem({ storeId: store.id, menuId, quantity })
          addBtn.textContent = '담김'
          await refreshCartBadge()
          setTimeout(() => {
            addBtn.textContent = '담기'
            addBtn.disabled = false
          }, 1200)
        } catch (err) {
          alert(errorMessage(err))
          addBtn.disabled = false
        }
      })
    })
  }

  function renderStorePage(store) {
    const status = String(store.status || '').toUpperCase()
    const statusCls = statusPillCls(status)
    const statusLabel = statusLabelKo(status)
    const thumbUrl = store.images?.[0]?.imgUrl ?? ''
    const addressLine = [store.address, store.addressDetail].filter(Boolean).join(' ')
    const menus = Array.isArray(store.menus) ? store.menus : []
    const isClosed = status === 'CLOSE'

    return `
      <article class="card store-hero">
        ${isClosed ? '<p class="store-closed-banner">현재 영업 종료된 가게예요.</p>' : ''}
        <div class="store-hero-head">
          <div class="store-hero-thumb">
            ${
              thumbUrl
                ? `<img src="${escapeAttr(thumbUrl)}" alt="" onerror="this.parentElement.innerHTML='<i class=\\'ti ti-building-store\\'></i>'" />`
                : '<i class="ti ti-building-store" aria-hidden="true"></i>'
            }
          </div>
          <div class="store-hero-body">
            <div class="store-hero-title-row">
              <h1 class="store-hero-title">${escapeHtml(store.name)}</h1>
              <span class="status-pill ${statusCls}">${statusLabel}</span>
            </div>
            <p class="store-hero-address">
              <i class="ti ti-map-pin" aria-hidden="true"></i>
              <span>${escapeHtml(addressLine || '주소 정보 없음')}</span>
            </p>
            <div class="store-hero-meta">
              <span>★ <strong>${formatRating(store.averageRating)}</strong> (${Number(store.reviewCount ?? 0).toLocaleString('ko-KR')})</span>
              <span>최소 주문 <strong>${formatWon(store.minOrderAmount)}</strong></span>
              <span>예상 <strong>${Number(store.requiredTimeMinutes ?? 0)}분</strong></span>
              <span>${escapeHtml(store.openTime ?? '')} ~ ${escapeHtml(store.closeTime ?? '')}</span>
            </div>
          </div>
        </div>
      </article>

      <section class="table-section store-menu-section" aria-labelledby="menuSectionTitle">
        <div class="section-head">
          <h2 id="menuSectionTitle" class="section-head-title">메뉴</h2>
        </div>
        <div class="customer-menu-list">
          ${
            menus.length === 0
              ? '<p class="empty-state">등록된 메뉴가 없어요.</p>'
              : menus.map((m) => renderMenuRow(m, isClosed)).join('')
          }
        </div>
      </section>
    `
  }

  function renderMenuRow(menu, isClosed) {
    const img = menu.imageUrl ?? menu.imgUrl ?? ''
    const thumb = img
      ? `<img class="menu-item-thumb" src="${escapeAttr(img)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=\\'menu-item-thumb menu-item-thumb--placeholder\\'><i class=\\'ti ti-photo\\'></i></span>'" />`
      : `<span class="menu-item-thumb menu-item-thumb--placeholder" aria-hidden="true"><i class="ti ti-photo"></i></span>`

    const cartControls = !isClosed
      ? `
        <div class="customer-menu-cart-row">
          <div class="qty-stepper" role="group" aria-label="담을 수량">
            <button type="button" class="qty-btn" data-qty-act="dec" aria-label="수량 감소">−</button>
            <span class="qty-value" data-qty-value>1</span>
            <button type="button" class="qty-btn" data-qty-act="inc" aria-label="수량 증가">+</button>
          </div>
          <button type="button" class="btn-outline-sm" data-add-cart data-menu-id="${menu.id}">담기</button>
        </div>
      `
      : ''

    return `
      <div class="customer-menu-row">
        ${thumb}
        <div class="customer-menu-info">
          <p class="menu-item-name">${escapeHtml(menu.name)}</p>
          ${menu.menuDescription ? `<p class="menu-item-desc">${escapeHtml(menu.menuDescription)}</p>` : ''}
        </div>
        <div class="customer-menu-actions">
          <span class="menu-item-price">${formatWon(menu.price)}</span>
          ${cartControls}
        </div>
      </div>
    `
  }

  function renderError(message) {
    const host = document.getElementById('storeHost')
    if (!host) return
    host.innerHTML = `
      <section class="table-section">
        <p class="empty-state is-error">${escapeHtml(message)}</p>
        <p style="padding:0 18px 16px;margin:0">
          <a href="/" class="btn-outline-sm" style="display:inline-flex;text-decoration:none">홈으로</a>
        </p>
      </section>
    `
  }

  function statusPillCls(status) {
    if (status === 'OPEN') return 'status-pill--open'
    if (status === 'PREPARING') return 'status-pill--preparing'
    return 'status-pill--close'
  }

  function statusLabelKo(status) {
    if (status === 'OPEN') return '영업 중'
    if (status === 'PREPARING') return '준비 중'
    return '영업 종료'
  }

  function errorMessage(e) {
    if (!e) return '가게 정보를 불러오지 못했습니다.'
    const msg = e.message || ''
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      return '백엔드 서버(http://localhost:8080)에 연결할 수 없습니다.'
    }
    if (e.status === 404) return '가게를 찾을 수 없어요.'
    return msg || '가게 정보를 불러오지 못했습니다.'
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
