/**
 * 이메일 로그인/회원가입 공통 — 역할·리다이렉트
 */
;(function () {
  'use strict'

  function getRoleFromQuery() {
    try {
      const r = new URLSearchParams(window.location.search).get('role')
      const upper = (r || 'CUSTOMER').toUpperCase()
      return upper === 'OWNER' ? 'OWNER' : 'CUSTOMER'
    } catch {
      return 'CUSTOMER'
    }
  }

  function roleLabel(role) {
    return role === 'OWNER' ? '사장' : '고객'
  }

  function kakaoStartUrl(role) {
    const base = window.api?.COMMON_URL || 'http://localhost:8080'
    return `${base}/api/auth/kakao/start?role=${encodeURIComponent(role)}`
  }

  async function redirectAfterAuth(role) {
    const upper = (role || '').toUpperCase()
    if (upper === 'OWNER') {
      window.location.replace('/pages/owner/owner-main.html')
      return
    }
    if (!window.api?.users?.me) {
      window.location.replace('/')
      return
    }
    try {
      const me = await api.users.me()
      const p = me?.tastePreferences
      const hasTaste = p && (p.sweet || p.salty || p.sour || p.bitter || p.umami)
      window.location.replace(hasTaste ? '/' : '/pages/taste-onboarding.html')
    } catch {
      window.location.replace('/')
    }
  }

  function showError(el, message) {
    if (!el) return
    if (!message) {
      el.hidden = true
      el.textContent = ''
      return
    }
    el.hidden = false
    el.textContent = message
  }

  window.AuthShared = {
    getRoleFromQuery,
    roleLabel,
    kakaoStartUrl,
    redirectAfterAuth,
    showError,
  }
})()
