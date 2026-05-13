/**
 * 고객 페이지 공통 — 햄버거 사이드 메뉴
 * CustomerMenu.init({ onLoginClick, onLogout })
 */
;(function () {
  'use strict'

  let options = {}

  function init(opts = {}) {
    options = opts
    const btnMenu = document.getElementById('btnMenu')
    if (!btnMenu || !document.getElementById('menuDrawer')) return
    btnMenu.addEventListener('click', openMenuDrawer)
    setupDrawers()
  }

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
    if (!list) return

    const loggedIn = window.api?.auth?.isLoggedIn?.() ?? false
    const role = (localStorage.getItem('role') || '').toUpperCase()

    if (loggedIn && userBox && nick && roleEl) {
      userBox.hidden = false
      nick.textContent = localStorage.getItem('nickname') || '회원'
      roleEl.textContent = role === 'OWNER' ? '사장' : '고객'
    } else if (userBox) {
      userBox.hidden = true
    }

    const items = []
    items.push({ icon: 'ti-home', label: '홈', href: '/' })

    if (!loggedIn) {
      items.push({
        icon: 'ti-brand-kakao-talk',
        label: '카카오 로그인',
        action: () => {
          closeDrawer(document.getElementById('menuDrawer'))
          if (typeof options.onLoginClick === 'function') options.onLoginClick()
          else window.location.href = '/'
        },
      })
    }

    if (loggedIn && role === 'CUSTOMER') {
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
        const cls = `${it.danger ? 'item-danger' : ''}`
        if (it.href) {
          return `
            <li>
              <a class="${cls}" href="${it.href}">
                <i class="ti ${it.icon}" aria-hidden="true"></i>
                <span>${escapeHtml(it.label)}</span>
              </a>
            </li>`
        }
        return `
          <li>
            <button type="button" class="${cls}" data-menu-idx="${idx}" ${
          it.disabled ? 'disabled' : ''
        }>
              <i class="ti ${it.icon}" aria-hidden="true"></i>
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

  function goToCartPage() {
    if (!api.auth.isLoggedIn()) {
      if (typeof options.onLoginClick === 'function') options.onLoginClick()
      else window.location.href = '/'
      return
    }
    const role = (localStorage.getItem('role') || '').toUpperCase()
    if (role !== 'CUSTOMER') {
      alert('장바구니는 고객 계정에서만 사용할 수 있어요.')
      return
    }
    window.location.href = '/pages/cart.html'
  }

  async function handleLogout() {
    if (typeof options.onLogout === 'function') {
      await options.onLogout()
      return
    }
    try {
      await api.auth.logout()
    } catch {
      /* ignore */
    }
    ;['userId', 'email', 'nickname', 'role'].forEach((k) => localStorage.removeItem(k))
    closeAllDrawers()
    window.location.href = '/'
  }

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  window.CustomerMenu = { init, openMenuDrawer, closeAllDrawers }
})()
