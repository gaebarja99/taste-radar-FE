/**
 * 내 프로필 — 닉네임 / 배달 주소
 */
;(function () {
  'use strict'

  let profile = null

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
      onLoginClick: () => (window.location.href = '/'),
      onLogout: async () => {
        try {
          await api.auth.logout()
        } catch {
          /* ignore */
        }
        clearAuthStorage()
        window.location.href = '/'
      },
    })

    setupAuthUi()

    if (!api.auth.isLoggedIn()) {
      renderGuest()
      return
    }

    await loadProfile()
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

  async function loadProfile() {
    const host = document.getElementById('profileHost')
    if (!host) return
    host.innerHTML = '<p class="empty-state">불러오는 중…</p>'

    try {
      profile = await api.users.me()
      localStorage.setItem('nickname', profile.nickname || '회원')
      setupAuthUi()
      host.innerHTML = renderProfileForms(profile)
      bindForms()
    } catch (e) {
      renderError(errorMessage(e))
    }
  }

  function renderProfileForms(me) {
    return `
      <section class="table-section profile-card">
        <header class="profile-card-head">
          <i class="ti ti-user profile-card-head-icon" aria-hidden="true"></i>
          <div class="profile-card-head-text">
            <h2 class="profile-card-title">기본 정보</h2>
            <p class="profile-card-desc">카카오 계정 이메일은 변경할 수 없어요.</p>
          </div>
        </header>
        <form id="nicknameForm" class="profile-form">
          <div class="profile-field">
            <label for="profileEmail">이메일</label>
            <div class="profile-field-readonly" id="profileEmail">
              <i class="ti ti-lock profile-field-readonly-icon" aria-hidden="true"></i>
              <span class="profile-field-readonly-value">${escapeHtml(me?.email || '')}</span>
            </div>
          </div>
          <div class="profile-field">
            <label for="profileNickname">닉네임</label>
            <input id="profileNickname" name="nickname" type="text" maxlength="10" required
              value="${escapeAttr(me?.nickname || '')}" placeholder="2~10자 한글·영문·숫자" />
          </div>
          <div class="profile-actions">
            <button type="submit" class="profile-save-btn">닉네임 저장</button>
          </div>
          <p id="nicknameToast" class="profile-toast" hidden></p>
        </form>
      </section>

      <section class="table-section profile-card">
        <header class="profile-card-head">
          <i class="ti ti-map-pin profile-card-head-icon" aria-hidden="true"></i>
          <div class="profile-card-head-text">
            <h2 class="profile-card-title">배달 주소</h2>
            <p class="profile-card-desc">우편번호·도로명은 자동 입력돼요.</p>
          </div>
        </header>
        <form id="addressForm" class="profile-form">
          <div class="profile-address-row">
            <div class="profile-field">
              <label for="address">주소</label>
              <div class="profile-zip-row">
                <input id="address" name="address" type="text" maxlength="200" required readonly
                  value="${escapeAttr(me?.address || '')}" placeholder="주소 검색 버튼을 눌러주세요" />
                <button type="button" id="btnAddressSearch" class="profile-address-search-btn">
                  <i class="ti ti-search" aria-hidden="true"></i> 검색
                </button>
              </div>
            </div>
            <div class="profile-field">
              <label for="zipCode">우편번호</label>
              <div class="profile-field-readonly profile-field-readonly--input">
                <i class="ti ti-lock profile-field-readonly-icon" aria-hidden="true"></i>
                <input id="zipCode" name="zipCode" class="profile-input-readonly" type="text" inputmode="numeric" maxlength="10" required readonly
                  value="${escapeAttr(me?.zipCode || '')}" placeholder="주소 검색 시 자동 입력" />
              </div>
            </div>
            <div class="profile-field">
              <label for="addressDetail">상세 주소</label>
              <input id="addressDetail" name="addressDetail" type="text" maxlength="100" required
                value="${escapeAttr(me?.addressDetail || '')}" placeholder="동·호수 등" />
            </div>
          </div>
          <div id="postcodeOverlay" class="profile-postcode-overlay" hidden>
            <div class="profile-postcode-backdrop" data-postcode-close></div>
            <div class="profile-postcode-panel" role="dialog" aria-modal="true" aria-labelledby="postcodeTitle">
              <header class="profile-postcode-head">
                <h3 id="postcodeTitle" class="profile-postcode-title">주소 검색</h3>
                <button type="button" class="profile-postcode-close" data-postcode-close aria-label="닫기">
                  <i class="ti ti-x" aria-hidden="true"></i>
                </button>
              </header>
              <div id="postcodeLayer" class="profile-postcode-layer"></div>
            </div>
          </div>
          <div class="profile-actions">
            <button type="submit" class="profile-save-btn">주소 저장</button>
          </div>
          <p id="addressToast" class="profile-toast" hidden></p>
        </form>
      </section>
    `
  }

  function bindForms() {
    document.getElementById('nicknameForm')?.addEventListener('submit', handleNicknameSubmit)
    document.getElementById('addressForm')?.addEventListener('submit', handleAddressSubmit)
    document.getElementById('btnAddressSearch')?.addEventListener('click', openAddressSearch)
    document.getElementById('address')?.addEventListener('click', openAddressSearch)
    document.querySelectorAll('[data-postcode-close]').forEach((el) => {
      el.addEventListener('click', closeAddressSearch)
    })
  }

  async function handleNicknameSubmit(e) {
    e.preventDefault()
    const form = e.currentTarget
    const nickname = form.nickname.value.trim()
    const toast = document.getElementById('nicknameToast')
    try {
      profile = await api.users.updateNickname(nickname)
      localStorage.setItem('nickname', profile.nickname)
      setupAuthUi()
      showToast(toast, '닉네임을 저장했어요.', false)
    } catch (err) {
      showToast(toast, errorMessage(err), true)
    }
  }

  async function handleAddressSubmit(e) {
    e.preventDefault()
    const form = e.currentTarget
    const toast = document.getElementById('addressToast')
    const zipCode = form.zipCode.value.trim()
    const address = form.address.value.trim()
    const addressDetail = form.addressDetail.value.trim()
    if (!zipCode || !address) {
      showToast(toast, '주소 검색으로 우편번호와 주소를 먼저 선택해 주세요.', true)
      openAddressSearch()
      return
    }
    try {
      profile = await api.users.updateAddress({ zipCode, address, addressDetail })
      showToast(toast, '배달 주소를 저장했어요.', false)
    } catch (err) {
      showToast(toast, errorMessage(err), true)
    }
  }

  function openAddressSearch() {
    if (typeof daum === 'undefined' || !daum.Postcode) {
      alert('주소 검색 스크립트를 불러오지 못했어요.')
      return
    }
    const overlay = document.getElementById('postcodeOverlay')
    const layer = document.getElementById('postcodeLayer')
    if (!overlay || !layer) return

    overlay.hidden = false
    layer.innerHTML = ''

    new daum.Postcode({
      oncomplete(data) {
        const zipInput = document.getElementById('zipCode')
        const addressInput = document.getElementById('address')
        const detailInput = document.getElementById('addressDetail')
        const roadAddr = data.roadAddress || data.jibunAddress || data.address || ''
        let fullAddr = roadAddr
        let extraAddr = ''

        if (data.bname && /[동|로|가]$/g.test(data.bname)) {
          extraAddr += data.bname
        }
        if (data.buildingName !== '' && data.apartment === 'Y') {
          extraAddr += extraAddr ? `, ${data.buildingName}` : data.buildingName
        }
        if (extraAddr) fullAddr += ` (${extraAddr})`

        if (zipInput) zipInput.value = data.zonecode || ''
        if (addressInput) addressInput.value = fullAddr
        if (detailInput) {
          const buildingName = (data.buildingName || '').trim()
          if (buildingName && !detailInput.value.trim()) {
            detailInput.value = buildingName
          }
          detailInput.focus()
        }
        closeAddressSearch()
      },
      onresize(size) {
        layer.style.height = `${size.height}px`
      },
      width: '100%',
      height: '100%',
    }).embed(layer)
  }

  function closeAddressSearch() {
    const overlay = document.getElementById('postcodeOverlay')
    const layer = document.getElementById('postcodeLayer')
    if (overlay) overlay.hidden = true
    if (layer) layer.innerHTML = ''
  }

  function showToast(el, message, isError) {
    if (!el) return
    el.hidden = false
    el.textContent = message
    el.className = `profile-toast ${isError ? 'is-error' : 'is-success'}`
  }

  function renderGuest() {
    const host = document.getElementById('profileHost')
    if (!host) return
    host.innerHTML = `
      <section class="table-section" style="padding:18px">
        <p class="empty-state">로그인이 필요해요.</p>
        <p style="margin:12px 0 0"><a href="/" class="btn-outline-sm" style="display:inline-flex;text-decoration:none">홈으로</a></p>
      </section>
    `
  }

  function renderError(message) {
    const host = document.getElementById('profileHost')
    if (host) host.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`
  }

  function clearAuthStorage() {
    ;['userId', 'email', 'nickname', 'role'].forEach((k) => localStorage.removeItem(k))
  }

  function errorMessage(e) {
    if (e?.status === 404) {
      return '주소 저장 API를 찾을 수 없어요. 백엔드(http://localhost:8080)를 최신 코드로 다시 실행해 주세요.'
    }
    if (e?.status === 401) {
      return '로그인이 만료되었어요. 다시 로그인해 주세요.'
    }
    return e?.message || '요청을 처리하지 못했어요.'
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
    return escapeHtml(text).replace(/`/g, '&#96;')
  }
})()
