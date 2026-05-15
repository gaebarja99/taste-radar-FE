/**
 * 고객 헤더 — 장바구니 옆 알림 벨 + 읽지 않음 배지
 * 모든 고객 페이지: 아이콘 아래 드롭다운 패널
 */
;(function () {
  'use strict'

  const STATUS_LABEL = {
    PENDING: '주문 확인',
    COOKING: '조리 중',
    DELIVERING: '배달 중',
    DELIVERED: '배달 완료',
    REJECTED: '주문 거절',
  }

  const STATUS_ICON = {
    PENDING: 'ti-clipboard-check',
    COOKING: 'ti-flame',
    DELIVERING: 'ti-truck-delivery',
    DELIVERED: 'ti-circle-check',
    REJECTED: 'ti-circle-x',
  }

  let panelOpen = false
  let outsideClickBound = false

  function isCustomer() {
    return (
      window.api?.auth?.isLoggedIn?.() &&
      (localStorage.getItem('role') || '').toUpperCase() === 'CUSTOMER'
    )
  }

  function isMainHeader() {
    return Boolean(document.querySelector('.site-header'))
  }

  function findCartControl() {
    return (
      document.getElementById('btnCart') ||
      document.querySelector('.store-topbar-actions a[href="/pages/cart.html"]') ||
      document.querySelector('.header-actions a[href="/pages/cart.html"]')
    )
  }

  function findInsertBefore() {
    return (
      findCartControl() ||
      document.getElementById('btnMenu') ||
      document.querySelector('.header-actions > :last-child, .store-topbar-actions > :last-child')
    )
  }

  function bellClassName() {
    return isMainHeader() ? 'icon-btn notification-bell-btn' : 'store-icon-btn notification-bell-btn'
  }

  function ensureBell() {
    let anchor = document.getElementById('notificationAnchor')
    if (anchor) return anchor

    const insertBefore = findInsertBefore()
    if (!insertBefore?.parentNode) return null

    anchor = document.createElement('div')
    anchor.id = 'notificationAnchor'
    anchor.className = 'notification-anchor'

    anchor.innerHTML = `
      <button
        type="button"
        id="btnNotifications"
        class="${bellClassName()}"
        aria-label="알림"
        aria-haspopup="true"
        aria-expanded="false"
        aria-controls="notificationPanel"
      >
        <i class="ti ti-bell" aria-hidden="true"></i>
        <span id="notificationBadge" class="icon-badge" hidden>0</span>
      </button>
      <div
        id="notificationPanel"
        class="notification-panel"
        role="dialog"
        aria-label="알림"
        hidden
      >
        <header class="notification-panel-head">
          <h2 class="notification-panel-title">알림</h2>
          <div class="notification-panel-actions">
            <span id="notificationsUnread" class="notification-panel-unread" hidden>읽지 않음 0</span>
            <button type="button" id="btnMarkAllRead" class="notification-panel-mark-all" disabled>
              모두 읽음
            </button>
          </div>
        </header>
        <p class="notification-panel-lead">주문 상태가 바뀔 때 알려드려요.</p>
        <div id="notificationsHost" class="notification-panel-body" aria-live="polite"></div>
      </div>`

    const btn = anchor.querySelector('#btnNotifications')
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      togglePanel()
    })
    anchor.querySelector('#btnMarkAllRead')?.addEventListener('click', handleMarkAllRead)

    insertBefore.parentNode.insertBefore(anchor, insertBefore)
    return anchor
  }

  function getPanel() {
    return document.getElementById('notificationPanel')
  }

  function getBellBtn() {
    return document.getElementById('btnNotifications')
  }

  function setBadge(count) {
    const btn = getBellBtn()
    const badge = document.getElementById('notificationBadge')
    if (!btn) return

    if (!isCustomer()) {
      btn.hidden = true
      closePanel()
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

  function setUnreadLabel(count) {
    const el = document.getElementById('notificationsUnread')
    const markAllBtn = document.getElementById('btnMarkAllRead')
    const n = Number(count) || 0
    if (el) {
      el.hidden = false
      el.textContent = `읽지 않음 ${n}`
    }
    if (markAllBtn) {
      markAllBtn.disabled = n <= 0
    }
  }

  function bindOutsideClick() {
    if (outsideClickBound) return
    outsideClickBound = true
    document.addEventListener('click', (e) => {
      const anchor = document.getElementById('notificationAnchor')
      if (!panelOpen || !anchor || anchor.contains(e.target)) return
      closePanel()
    })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panelOpen) closePanel()
    })
  }

  function togglePanel() {
    if (panelOpen) closePanel()
    else openPanel()
  }

  async function openPanel() {
    if (!isCustomer()) return

    const panel = getPanel()
    const btn = getBellBtn()
    if (!panel || !btn) return

    panel.hidden = false
    btn.setAttribute('aria-expanded', 'true')
    btn.classList.add('is-active')
    panelOpen = true
    bindOutsideClick()
    await loadNotifications()
  }

  function closePanel() {
    const panel = getPanel()
    const btn = getBellBtn()
    if (!panel) return

    panel.hidden = true
    btn?.setAttribute('aria-expanded', 'false')
    btn?.classList.remove('is-active')
    panelOpen = false
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
      setUnreadLabel(data?.count ?? 0)
    } catch {
      setBadge(0)
    }
  }

  async function handleMarkAllRead() {
    const btn = document.getElementById('btnMarkAllRead')
    if (btn?.disabled) return
    if (btn) btn.disabled = true
    try {
      await api.notifications.markAllRead()
      document.querySelectorAll('.notification-row:not(.is-read)').forEach((row) => {
        row.classList.add('is-read')
        row.querySelector('.notification-unread-dot')?.remove()
      })
      setUnreadLabel(0)
      setBadge(0)
    } catch (e) {
      alert(errorMessage(e))
      setUnreadLabel(
        document.querySelectorAll('.notification-row:not(.is-read)').length,
      )
    }
  }

  async function loadNotifications() {
    const host = document.getElementById('notificationsHost')
    if (!host) return

    host.innerHTML = '<p class="notification-panel-empty">불러오는 중…</p>'

    try {
      const [list, unread] = await Promise.all([
        api.notifications.list(),
        api.notifications.unreadCount(),
      ])
      const items = Array.isArray(list) ? list : []
      setUnreadLabel(unread?.count ?? items.filter((n) => !n.read).length)

      if (items.length === 0) {
        host.innerHTML =
          '<p class="notification-panel-empty">아직 알림이 없어요.<br />주문 후 상태가 바뀌면 여기에 표시돼요.</p>'
        return
      }

      host.innerHTML = items.map(renderNotificationRow).join('')
      host.querySelectorAll('[data-notification-id]').forEach((row) => {
        row.addEventListener('click', () => handleNotificationClick(row))
      })
      await refreshBadge()
    } catch (e) {
      host.innerHTML = `<p class="notification-panel-empty is-error">${escapeHtml(errorMessage(e))}</p>`
    }
  }

  async function handleNotificationClick(btn) {
    const notificationId = Number(btn.dataset.notificationId)
    const orderId = Number(btn.dataset.orderId)
    if (!Number.isFinite(notificationId)) return

    btn.disabled = true
    try {
      if (!btn.classList.contains('is-read')) {
        await api.notifications.markRead(notificationId)
        btn.classList.add('is-read')
        btn.querySelector('.notification-unread-dot')?.remove()
        const unreadEl = document.getElementById('notificationsUnread')
        if (unreadEl && !unreadEl.hidden) {
          const m = unreadEl.textContent.match(/(\d+)/)
          const n = Math.max(0, (Number(m?.[1]) || 1) - 1)
          setUnreadLabel(n)
        }
        await refreshBadge()
      }
    } catch {
      /* ignore mark-read failure; still navigate */
    }

    closePanel()

    if (Number.isFinite(orderId) && orderId > 0) {
      window.location.href = `/pages/my-orders.html?orderId=${orderId}`
    } else {
      window.location.href = '/pages/my-orders.html'
    }
  }

  function renderNotificationRow(n) {
    const id = Number(n.id)
    const orderId = Number(n.orderId)
    const status = String(n.orderStatus ?? '').toUpperCase()
    const read = Boolean(n.read)
    const message = escapeHtml(n.message ?? '')
    const createdAt = formatDateTime(n.createdAt)
    const statusLabel = STATUS_LABEL[status] || status
    const icon = STATUS_ICON[status] || 'ti-bell'

    return `
      <button
        type="button"
        class="notification-row${read ? ' is-read' : ''}"
        data-notification-id="${id}"
        data-order-id="${Number.isFinite(orderId) ? orderId : ''}"
      >
        <span class="notification-icon" aria-hidden="true">
          <i class="ti ${icon}"></i>
        </span>
        <span class="notification-body">
          <span class="notification-meta">
            <span class="notification-status">${escapeHtml(statusLabel)}</span>
            <time class="notification-time" datetime="${escapeHtml(n.createdAt ?? '')}">${escapeHtml(createdAt)}</time>
          </span>
          <span class="notification-message">${message}</span>
        </span>
        ${read ? '' : '<span class="notification-unread-dot" aria-hidden="true"></span>'}
      </button>
    `
  }

  function errorMessage(e) {
    return String(e?.message || e?.body?.detail || '알림을 불러오지 못했어요.')
  }

  function formatDateTime(value) {
    if (!value) return ''
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function init() {
    ensureBell()
    refreshBadge()
  }

  document.addEventListener('DOMContentLoaded', init)

  window.CustomerNotifications = {
    init,
    refreshBadge,
    setBadge,
    openPanel,
    closePanel,
  }
})()
