/**
 * 내 리뷰 목록 — GET /api/reviews/me, 수정·삭제
 */
;(function () {
  'use strict'

  document.addEventListener('DOMContentLoaded', init)

  async function init() {
    if (!window.api || !window.ReviewUi) {
      renderError('API 스크립트를 불러오지 못했습니다.')
      return
    }

    document.getElementById('btnKakaoLogin')?.addEventListener('click', () => {
      window.location.href = '/'
    })

    window.CustomerMenu?.init({
      onLoginClick: () => { window.location.href = '/' },
      onLogout: async () => {
        try { await api.auth.logout() } catch { /* ignore */ }
        ;['userId', 'email', 'nickname', 'role'].forEach((k) => localStorage.removeItem(k))
        window.location.href = '/'
      },
    })

    setupAuthUi()
    refreshCartBadge()

    if (!api.auth.isLoggedIn()) {
      renderGuest()
      return
    }
    if ((localStorage.getItem('role') || '').toUpperCase() !== 'CUSTOMER') {
      renderWrongRole()
      return
    }

    await loadReviews()
  }

  function setupAuthUi() {
    const loggedIn = api.auth.isLoggedIn()
    const loginBtn = document.getElementById('btnKakaoLogin')
    const nickEl = document.getElementById('userNickname')
    if (!loginBtn || !nickEl) return
    loginBtn.hidden = loggedIn
    nickEl.hidden = !loggedIn
    if (loggedIn) nickEl.textContent = localStorage.getItem('nickname') || '회원'
  }

  async function refreshCartBadge() {
    if (!api.auth.isLoggedIn() || (localStorage.getItem('role') || '').toUpperCase() !== 'CUSTOMER') {
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

  function setReviewsCount(count) {
    const el = document.getElementById('reviewsCount')
    if (!el) return
    const n = Number(count) || 0
    el.hidden = false
    el.textContent = `총 ${n}건`
  }

  async function loadReviews() {
    const host = document.getElementById('reviewsHost')
    host.innerHTML = '<p class="empty-state">불러오는 중…</p>'
    try {
      const reviews = await api.reviews.myList()
      const list = Array.isArray(reviews) ? reviews : []
      if (list.length === 0) {
        setReviewsCount(0)
        host.innerHTML = `
          <section class="table-section">
            <p class="empty-state">작성한 리뷰가 없어요.</p>
            <p style="padding:0 18px 16px;margin:0">
              <a href="/pages/my-orders.html" class="btn-outline-sm" style="display:inline-flex;text-decoration:none">내 주문 보기</a>
            </p>
          </section>`
        return
      }
      setReviewsCount(list.length)
      host.innerHTML = `<div class="my-review-list">${list.map(renderCard).join('')}</div>`
      host.querySelectorAll('[data-edit-review]').forEach((btn) => {
        btn.addEventListener('click', () => toggleEdit(Number(btn.dataset.editReview)))
      })
      host.querySelectorAll('[data-delete-review]').forEach((btn) => {
        btn.addEventListener('click', () => deleteReview(Number(btn.dataset.deleteReview)))
      })
      host.querySelectorAll('form[data-review-form]').forEach((form) => {
        ReviewUi.bindStarInputs(form)
        form.addEventListener('submit', (e) => saveReview(e, Number(form.dataset.reviewForm)))
      })
    } catch (e) {
      renderError(e?.message || '리뷰를 불러오지 못했습니다.')
    }
  }

  function renderCard(r) {
    const id = Number(r.id)
    const storeId = Number(r.storeId)
    const storeName = r.storeName ?? '가게'
    const storeLink =
      storeId > 0
        ? `<a class="my-order-store-link" href="/pages/store.html?storeId=${storeId}">${ReviewUi.escapeHtml(storeName)}</a>`
        : ReviewUi.escapeHtml(storeName)

    const ratingNum = Number(r.rating)
    const ratingLabel = Number.isFinite(ratingNum) ? ratingNum.toFixed(1) : '0.0'

    return `
      <article class="my-review-card" id="review-card-${id}">
        <div class="my-review-top">
          <div class="my-review-top-left">
            ${storeLink}
            <div class="my-review-rating-row">
              ${ReviewUi.renderStars(r.rating)}
              <span class="my-review-rating-num">${ratingLabel}</span>
            </div>
          </div>
          <div class="my-review-actions">
            <button type="button" class="my-review-btn-edit" data-edit-review="${id}">수정</button>
            <button type="button" class="my-review-btn-delete" data-delete-review="${id}">삭제</button>
          </div>
        </div>
        <p class="my-review-content">${ReviewUi.escapeHtml(r.content)}</p>
        ${r.ownerReply ? `<p class="my-review-reply">사장님: ${ReviewUi.escapeHtml(r.ownerReply)}</p>` : ''}
        <div class="my-review-footer">
          ${ReviewUi.renderMenuTasteSummary(r.menuTastes, r.taste)}
          <time class="my-review-date" datetime="${ReviewUi.escapeHtml(r.createdAt ?? '')}">${formatDate(r.createdAt)}</time>
        </div>
        <div id="review-edit-${id}" class="my-review-edit-form" hidden>
          <form data-review-form="${id}">
            <div class="review-form-field"><label>별점</label>${ReviewUi.renderStars(r.rating, { interactive: true })}</div>
            <div class="review-form-field">
              <label>내용</label>
              <textarea name="content" required maxlength="2000">${ReviewUi.escapeHtml(r.content)}</textarea>
            </div>
            ${ReviewUi.renderMenuTastePickers(
              (r.menuTastes || []).map((mt) => ({ menuId: mt.menuId, menuName: mt.menuName })),
              r.menuTastes,
            )}
            <div class="review-form-actions">
              <button type="submit" class="btn-primary" style="flex:1">저장</button>
              <button type="button" class="btn-outline-sm" data-edit-review="${id}">닫기</button>
            </div>
          </form>
        </div>
      </article>`
  }

  function toggleEdit(id) {
    const el = document.getElementById(`review-edit-${id}`)
    if (!el) return
    const open = el.hidden
    el.hidden = !open
    if (open) {
      const form = el.querySelector('form')
      ReviewUi.bindStarInputs(form)
    }
  }

  async function saveReview(e, reviewId) {
    e.preventDefault()
    const form = e.target
    const rating = ReviewUi.readRatingFromRoot(form)
    const content = form.content.value.trim()
    const menuTastes = ReviewUi.readMenuTastesFromRoot(form)
    const menus = [...form.querySelectorAll('.menu-taste-row[data-menu-id]')].map((row) => ({
      menuId: Number(row.dataset.menuId),
    }))
    if (!rating || !content) {
      alert('별점과 내용을 입력해 주세요.')
      return
    }
    if (!ReviewUi.validateMenuTastes(menus, menuTastes)) {
      alert('모든 메뉴에 대해 특화 맛을 하나씩 선택해 주세요.')
      return
    }
    const btn = form.querySelector('button[type="submit"]')
    btn.disabled = true
    try {
      await api.reviews.update(reviewId, { rating, content, menuTastes })
      await loadReviews()
    } catch (err) {
      alert(err?.message || '수정에 실패했어요.')
      btn.disabled = false
    }
  }

  async function deleteReview(reviewId) {
    if (!confirm('리뷰를 삭제할까요?')) return
    try {
      await api.reviews.remove(reviewId)
      await loadReviews()
    } catch (err) {
      alert(err?.message || '삭제에 실패했어요.')
    }
  }

  function formatDate(v) {
    if (!v) return '-'
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  function renderGuest() {
    document.getElementById('reviewsHost').innerHTML = `
      <section class="table-section">
        <p class="empty-state">로그인 후 리뷰를 확인할 수 있어요.</p>
        <a href="/" class="btn-outline-sm" style="display:inline-flex;text-decoration:none;margin:0 18px 16px">홈에서 로그인</a>
      </section>`
  }

  function renderWrongRole() {
    document.getElementById('reviewsHost').innerHTML = `
      <section class="table-section">
        <p class="empty-state">리뷰는 고객 계정에서만 이용할 수 있어요.</p>
      </section>`
  }

  function renderError(msg) {
    document.getElementById('reviewsHost').innerHTML = `
      <section class="table-section"><p class="empty-state">${ReviewUi.escapeHtml(msg)}</p></section>`
  }

  function setCartBadge(count) {
    const badge = document.getElementById('cartBadge')
    if (!badge) return
    const n = Number(count) || 0
    badge.hidden = n <= 0
    badge.textContent = n > 99 ? '99+' : String(n)
  }
})()
