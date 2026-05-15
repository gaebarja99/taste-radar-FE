/**
 * 고객 입맛 선호 설정
 */
;(function () {
  'use strict'

  document.addEventListener('DOMContentLoaded', init)

  async function init() {
    if (!window.api?.auth?.isLoggedIn()) {
      window.location.href = '/'
      return
    }
    const role = (localStorage.getItem('role') || '').toUpperCase()
    if (role !== 'CUSTOMER') {
      window.location.href = '/'
      return
    }

    window.CustomerMenu?.init({
      onLoginClick: () => (window.location.href = '/'),
      onLogout: async () => {
        try {
          await api.auth.logout()
        } catch {
          /* ignore */
        }
        ;['userId', 'email', 'nickname', 'role'].forEach((k) => localStorage.removeItem(k))
        window.location.href = '/'
      },
    })

    setupAuthUi()
    refreshCartBadge()
    window.CustomerNotifications?.refreshBadge()

    try {
      const me = await api.users.me()
      if (me?.nickname) {
        localStorage.setItem('nickname', me.nickname)
        setupAuthUi()
      }
      const prefs = me?.tastePreferences
      if (ReviewUi.hasAnyTastePreference(prefs)) {
        fillForm(prefs)
      }
    } catch {
      /* ignore */
    }

    const form = document.getElementById('tasteForm')
    form?.addEventListener('change', updateTastePickCount)
    updateTastePickCount()

    document.getElementById('btnSaveTaste')?.addEventListener('click', saveTastes)
  }

  function updateTastePickCount() {
    const form = document.getElementById('tasteForm')
    const el = document.getElementById('tastePickCount')
    if (!form || !el) return
    const keys = ['sweet', 'salty', 'sour', 'bitter', 'umami']
    const n = keys.filter((k) => form.elements[k]?.checked).length
    if (n === 0) {
      el.textContent = '아직 선택하지 않았어요'
      el.classList.add('taste-pick-count--empty')
    } else {
      el.textContent = `${n}개 선택됨`
      el.classList.remove('taste-pick-count--empty')
    }
  }

  function fillForm(prefs) {
    const form = document.getElementById('tasteForm')
    if (!form || !prefs) return
    ;['sweet', 'salty', 'sour', 'bitter', 'umami'].forEach((k) => {
      const el = form.elements[k]
      if (el) el.checked = !!prefs[k]
    })
    updateTastePickCount()
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

  async function saveTastes() {
    const form = document.getElementById('tasteForm')
    const body = {
      sweet: !!form.sweet.checked,
      salty: !!form.salty.checked,
      sour: !!form.sour.checked,
      bitter: !!form.bitter.checked,
      umami: !!form.umami.checked,
    }
    if (!Object.values(body).some(Boolean)) {
      alert('입맛을 한 가지 이상 선택해 주세요.')
      return
    }
    const btn = document.getElementById('btnSaveTaste')
    btn.disabled = true
    try {
      await api.users.updateTastes(body)
      window.location.href = '/'
    } catch (e) {
      alert(e?.message || '저장에 실패했어요.')
      btn.disabled = false
    }
  }
})()
