/**
 * 고객 헤더 — 장바구니 옆 알림 벨 + 읽지 않음 배지
 */
;(function () {
  'use strict'

  function isCustomer() {
    return (
      window.api?.auth?.isLoggedIn?.() &&
      (localStorage.getItem('role') || '').toUpperCase() === 'CUSTOMER'
    )
  }

  function findCartControl() {
    return (
      document.getElementById('btnCart') ||
      document.querySelector('.store-topbar-actions a[href="/pages/cart.html"]') ||
      document.querySelector('.header-actions a[href="/pages/cart.html"]')
    )
  }

  function bellClassName() {
    return document.querySelector('.site-header') ? 'icon-btn' : 'store-icon-btn'
  }

  function ensureBell() {
    let btn = document.getElementById('btnNotifications')
    if (btn) return btn

    const cart = findCartControl()
    if (!cart?.parentNode) return null

    btn = document.createElement('a')
    btn.id = 'btnNotifications'
    btn.className = bellClassName()
    btn.href = '/pages/notifications.html'
    btn.setAttribute('aria-label', '알림')
    btn.innerHTML =
      '<i class="ti ti-bell" aria-hidden="true"></i><span id="notificationBadge" class="icon-badge" hidden>0</span>'

    if (window.location.pathname.endsWith('/notifications.html')) {
      btn.classList.add('is-active')
      btn.setAttribute('aria-current', 'page')
    }

    cart.parentNode.insertBefore(btn, cart)
    return btn
  }

  function setBadge(count) {
    const btn = document.getElementById('btnNotifications')
    const badge = document.getElementById('notificationBadge')
    if (!btn) return

    if (!isCustomer()) {
      btn.hidden = true
      return
    }

    btn.hidden = false
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

  async function refreshBadge() {
    ensureBell()
    if (!isCustomer()) {
      setBadge(0)
      return
    }
    try {
      const data = await api.notifications.unreadCount()
      setBadge(data?.count ?? 0)
    } catch {
      setBadge(0)
    }
  }

  function init() {
    ensureBell()
    refreshBadge()
  }

  document.addEventListener('DOMContentLoaded', init)

  window.CustomerNotifications = { init, refreshBadge, setBadge }
})()
