/**
 * 알림 목록 — GET /api/notifications, 클릭 시 내 주문으로 이동
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

    await loadNotifications()
    setupMarkAllRead()
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
      setCartBadge((data?.items || []).reduce((s, it) => s + Number(it.quantity ?? 0), 0))
    } catch {
      setCartBadge(0)
    }
  }

  function setCartBadge(n) {
    const el = document.getElementById('cartBadge')
    if (!el) return
    const count = Number(n) || 0
    el.hidden = count <= 0
    el.textContent = String(count)
  }

  function setUnreadBadge(count) {
    const el = document.getElementById('notificationsUnread')
    const markAllBtn = document.getElementById('btnMarkAllRead')
    const n = Number(count) || 0
    if (el) {
      el.hidden = false
      el.textContent = `읽지 않음 ${n}`
    }
    if (markAllBtn) {
      markAllBtn.hidden = false
      markAllBtn.disabled = n <= 0
    }
  }

  function setupMarkAllRead() {
    const btn = document.getElementById('btnMarkAllRead')
    if (!btn || btn.dataset.bound) return
    btn.dataset.bound = '1'
    btn.addEventListener('click', handleMarkAllRead)
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
      setUnreadBadge(0)
      window.CustomerNotifications?.refreshBadge()
    } catch (e) {
      alert(errorMessage(e))
      setUnreadBadge(
        document.querySelectorAll('.notification-row:not(.is-read)').length,
      )
    }
  }

  async function loadNotifications() {
    const host = document.getElementById('notificationsHost')
    host.innerHTML = '<p class="empty-state">불러오는 중…</p>'

    try {
      const [list, unread] = await Promise.all([
        api.notifications.list(),
        api.notifications.unreadCount(),
      ])
      const items = Array.isArray(list) ? list : []
      setUnreadBadge(unread?.count ?? items.filter((n) => !n.read).length)

      if (items.length === 0) {
        host.innerHTML =
          '<p class="empty-state">아직 알림이 없어요.<br />주문 후 상태가 바뀌면 여기에 표시돼요.</p>'
        return
      }

      host.innerHTML = items.map(renderNotificationRow).join('')

      host.querySelectorAll('[data-notification-id]').forEach((btn) => {
        btn.addEventListener('click', () => handleNotificationClick(btn))
      })

      window.CustomerNotifications?.refreshBadge()
    } catch (e) {
      renderError(errorMessage(e))
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
          setUnreadBadge(n)
        }
        window.CustomerNotifications?.refreshBadge()
      }
    } catch {
      /* ignore mark-read failure; still navigate */
    }

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

  function renderGuest() {
    const host = document.getElementById('notificationsHost')
    host.innerHTML =
      '<p class="empty-state">로그인하면 주문 알림을 확인할 수 있어요.</p>'
  }

  function renderWrongRole() {
    const host = document.getElementById('notificationsHost')
    host.innerHTML =
      '<p class="empty-state">고객 계정으로 로그인해 주세요.</p>'
  }

  function renderError(msg) {
    const host = document.getElementById('notificationsHost')
    host.innerHTML = `<p class="empty-state is-error">${escapeHtml(msg)}</p>`
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
})()
