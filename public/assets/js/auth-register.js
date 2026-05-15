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
    const roleInput = document.getElementById('role')
    const loginLink = document.getElementById('loginLink')
    const kakaoLink = document.getElementById('kakaoLink')

    if (roleBadge) roleBadge.textContent = AuthShared.roleLabel(role)
    if (roleInput) roleInput.value = role
    if (loginLink) loginLink.href = `./login.html?role=${role}`
    if (kakaoLink) kakaoLink.href = AuthShared.kakaoStartUrl(role)

    if (api.auth.isLoggedIn()) {
      AuthShared.redirectAfterAuth(localStorage.getItem('role') || role)
      return
    }

    document.getElementById('registerForm')?.addEventListener('submit', handleSubmit)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const form = e.currentTarget
    const errEl = document.getElementById('formError')
    const btn = document.getElementById('btnSubmit')

    const email = form.email.value.trim()
    const nickname = form.nickname.value.trim()
    const password = form.password.value
    const passwordConfirm = form.passwordConfirm.value
    const role = form.role.value

    AuthShared.showError(errEl, '')

    if (!email || !nickname || !password) {
      AuthShared.showError(errEl, '모든 항목을 입력해 주세요.')
      return
    }
    if (password !== passwordConfirm) {
      AuthShared.showError(errEl, '비밀번호 확인이 일치하지 않아요.')
      return
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/.test(password)) {
      AuthShared.showError(errEl, '비밀번호는 8자 이상이며 영문과 숫자를 포함해야 해요.')
      return
    }
    if (!/^[가-힣a-zA-Z0-9]{2,10}$/.test(nickname)) {
      AuthShared.showError(errEl, '닉네임은 2~10자의 한글·영문·숫자만 사용할 수 있어요.')
      return
    }

    btn.disabled = true
    try {
      const data = await api.auth.register({ email, password, nickname, role })
      await AuthShared.redirectAfterAuth(data.role)
    } catch (err) {
      AuthShared.showError(errEl, err.message || '회원가입에 실패했습니다.')
    } finally {
      btn.disabled = false
    }
  }
})()
