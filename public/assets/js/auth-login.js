;(function () {
  'use strict'

  document.addEventListener('DOMContentLoaded', init)

  function init() {
    if (!window.api?.auth) {
      alert('API를 불러오지 못했습니다.')
      return
    }

    const role = AuthShared.getRoleFromQuery()
    const roleBadge = document.getElementById('roleBadge')
    const registerLink = document.getElementById('registerLink')
    const kakaoLink = document.getElementById('kakaoLink')

    if (roleBadge) roleBadge.textContent = AuthShared.roleLabel(role)
    if (registerLink) registerLink.href = `./register.html?role=${role}`
    if (kakaoLink) kakaoLink.href = AuthShared.kakaoStartUrl(role)

    if (api.auth.isLoggedIn()) {
      AuthShared.redirectAfterAuth(localStorage.getItem('role') || role)
      return
    }

    document.getElementById('loginForm')?.addEventListener('submit', handleSubmit)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const form = e.currentTarget
    const errEl = document.getElementById('formError')
    const btn = document.getElementById('btnSubmit')
    const email = form.email.value.trim()
    const password = form.password.value

    AuthShared.showError(errEl, '')
    if (!email || !password) {
      AuthShared.showError(errEl, '이메일과 비밀번호를 입력해 주세요.')
      return
    }

    btn.disabled = true
    try {
      const data = await api.auth.login({ email, password })
      await AuthShared.redirectAfterAuth(data.role)
    } catch (err) {
      AuthShared.showError(errEl, err.message || '로그인에 실패했습니다.')
    } finally {
      btn.disabled = false
    }
  }
})()
