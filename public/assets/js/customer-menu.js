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

  function ensureProfileHost() {
    const drawer = document.getElementById('menuDrawer')
    if (!drawer) return null
    let host = document.getElementById('menuDrawerProfile')
    if (host) return host
    const body = drawer.querySelector('.drawer-body')
    if (!body) return null
    host = document.createElement('div')
    host.id = 'menuDrawerProfile'
    host.className = 'drawer-profile-host'
    body.parentNode.insertBefore(host, body)
    return host
  }

  function renderProfileSection(loggedIn, role) {
    const guestBox = document.getElementById('menuDrawerGuest')
    const userBox = document.getElementById('menuDrawerUser')

    if (guestBox) guestBox.hidden = loggedIn

    if (userBox) {
      if (!loggedIn) {
        userBox.hidden = true
      } else {
        userBox.hidden = false
        const nick = document.getElementById('menuDrawerNickname')
        if (nick) nick.textContent = localStorage.getItem('nickname') || '회원'
        if (userBox.tagName === 'A') {
          userBox.href =
            role === 'CUSTOMER'
              ? '/pages/my-profile.html'
              : role === 'OWNER'
                ? '/pages/owner/owner-main.html'
                : '/'
        }
      }
      const host = document.getElementById('menuDrawerProfile')
      if (host) {
        host.hidden = true
        host.innerHTML = ''
      }
      return
    }

    const host = ensureProfileHost()
    if (!host) return

    if (!loggedIn) {
      host.hidden = true
      host.innerHTML = ''
      return
    }

    const nickname = localStorage.getItem('nickname') || '회원'
    const profileHref =
      role === 'CUSTOMER'
        ? '/pages/my-profile.html'
        : role === 'OWNER'
          ? '/pages/owner/owner-main.html'
          : '/'

    host.hidden = false
    host.innerHTML = `
      <a class="drawer-user drawer-user-link" href="${profileHref}">
        <span class="drawer-user-avatar" aria-hidden="true">
          <i class="ti ti-user"></i>
        </span>
        <div class="drawer-user-text">
          <strong>${escapeHtml(nickname)}</strong>
        </div>
        <i class="ti ti-chevron-right drawer-user-chevron" aria-hidden="true"></i>
      </a>`
  }

  function renderMenuDrawer() {
    const list = document.getElementById('menuDrawerList')
    const foot = document.getElementById('menuDrawerFoot')
    if (!list) return

    const loggedIn = window.api?.auth?.isLoggedIn?.() ?? false
    const role = (localStorage.getItem('role') || '').toUpperCase()

    renderProfileSection(loggedIn, role)

    const items = []
    items.push({ icon: 'ti-home', label: '홈', href: '/' })

    if (!loggedIn) {
      const promptLogin = () => {
        closeDrawer(document.getElementById('menuDrawer'))
        if (typeof options.onLoginClick === 'function') options.onLoginClick()
        else window.location.href = '/'
      }
      const hasGuestCard = Boolean(document.getElementById('menuDrawerGuest'))
      if (hasGuestCard) {
        items.push(
          { icon: 'ti-user', label: '내 프로필', locked: true, action: promptLogin },
          { icon: 'ti-shopping-cart', label: '장바구니', locked: true, action: promptLogin },
          { icon: 'ti-clipboard-list', label: '내 주문', locked: true, action: promptLogin },
          { icon: 'ti-message-2', label: '내 리뷰', locked: true, action: promptLogin },
          { icon: 'ti-adjustments', label: '입맛 설정', locked: true, action: promptLogin },
        )
      } else {
        items.push({
          icon: 'ti-login',
          label: '로그인',
          href: '/pages/auth/login.html?role=CUSTOMER',
        })
      }
    }

    if (loggedIn && role === 'CUSTOMER') {
      items.push({
        icon: 'ti-user',
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
        icon: 'ti-clipboard-list',
        label: '내 주문',
        href: '/pages/my-orders.html',
      })
      items.push({
        icon: 'ti-message-2',
        label: '내 리뷰',
        href: '/pages/my-reviews.html',
      })
      items.push({
        icon: 'ti-adjustments',
        label: '입맛 설정',
        href: '/pages/taste-onboarding.html',
      })
    }

    list.innerHTML = items
      .map((it, idx) => {
        const cls = [
          it.danger ? 'item-danger' : '',
          it.kakao ? 'item-kakao' : '',
          it.locked ? 'item-locked' : '',
        ]
          .filter(Boolean)
          .join(' ')
        const iconMarkup = it.kakao
          ? (window.KakaoBrand?.iconHtml?.() ||
              '<svg class="kakao-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3c5.523 0 10 3.582 10 8 0 2.558-1.294 4.832-3.333 6.274L19 22l-5.2-2.86C14.89 19.378 13.47 19.5 12 19.5 6.477 19.5 2 15.918 2 11.5 2 7.082 6.477 3.5 12 3.5z"/></svg>')
          : `<i class="ti ${it.icon}" aria-hidden="true"></i>`
        const lockMarkup = it.locked
          ? '<i class="ti ti-lock drawer-item-lock" aria-hidden="true"></i>'
          : ''
        if (it.href) {
          return `
            <li>
              <a class="${cls}" href="${it.href}">
                ${iconMarkup}
                <span>${escapeHtml(it.label)}</span>
                ${lockMarkup}
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
              ${lockMarkup}
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

    if (foot) {
      if (loggedIn) {
        foot.hidden = false
        const ownerLink =
          role === 'OWNER'
            ? `<div class="drawer-owner-link-wrap">
            <a href="/pages/owner/owner-main.html" class="drawer-owner-link">사장 페이지로 이동</a>
          </div>`
            : ''
        foot.innerHTML = `
          ${ownerLink}
          <button type="button" class="drawer-logout-btn" id="menuDrawerLogout">
            <i class="ti ti-logout" aria-hidden="true"></i>
            <span>로그아웃</span>
          </button>`
        foot.querySelector('#menuDrawerLogout')?.addEventListener('click', handleLogout)
      } else {
        foot.hidden = true
        foot.innerHTML = ''
      }
    }
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
