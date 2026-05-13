/**
 * 리뷰 작성 페이지 — POST /api/orders/{orderId}/reviews
 */
;(function () {
  'use strict'

  let orderId = null

  document.addEventListener('DOMContentLoaded', init)

  async function init() {
    if (!window.api || !window.ReviewUi) {
      alert('스크립트를 불러오지 못했습니다.')
      return
    }
    if (!api.auth.isLoggedIn()) {
      window.location.href = '/'
      return
    }
    const role = (localStorage.getItem('role') || '').toUpperCase()
    if (role !== 'CUSTOMER') {
      window.location.href = '/'
      return
    }

    window.CustomerMenu?.init({
      onLoginClick: () => { window.location.href = '/' },
      onLogout: async () => {
        try { await api.auth.logout() } catch { /* ignore */ }
        ;['userId', 'email', 'nickname', 'role'].forEach((k) => localStorage.removeItem(k))
        window.location.href = '/'
      },
    })

    const params = new URLSearchParams(window.location.search)
    orderId = Number(params.get('orderId'))
    if (!Number.isFinite(orderId)) {
      document.getElementById('writeReviewLead').textContent = '주문 정보가 없어요.'
      return
    }

    document.getElementById('starHost').innerHTML = ReviewUi.renderStars(5, { interactive: true })
    document.getElementById('tasteHost').innerHTML = ReviewUi.renderTasteInputs()
    const form = document.getElementById('reviewForm')
    ReviewUi.bindStarInputs(form)
    ReviewUi.bindTasteInputs(form)

    try {
      const order = await api.orders.detail(orderId)
      document.getElementById('writeReviewLead').textContent =
        `${order.storeName ?? '가게'} · 배달 완료 주문`
      if (String(order.orderStatus).toUpperCase() !== 'DELIVERED') {
        document.getElementById('writeReviewLead').textContent = '배달 완료된 주문만 리뷰를 작성할 수 있어요.'
        form.querySelector('button[type="submit"]').disabled = true
      }
    } catch (e) {
      document.getElementById('writeReviewLead').textContent = e?.message || '주문을 불러오지 못했어요.'
    }

    form.addEventListener('submit', onSubmit)
  }

  async function onSubmit(e) {
    e.preventDefault()
    const form = document.getElementById('reviewForm')
    const rating = ReviewUi.readRatingFromRoot(form)
    const content = form.content.value.trim()
    const taste = ReviewUi.readTasteFromRoot(form)
    if (!rating || rating < 1) {
      alert('별점을 선택해 주세요.')
      return
    }
    if (!content) {
      alert('리뷰 내용을 입력해 주세요.')
      return
    }
    if (!ReviewUi.hasAnyTasteSpecialty(taste)) {
      alert('특화된 맛을 한 가지 이상 선택해 주세요.')
      return
    }
    const btn = form.querySelector('button[type="submit"]')
    btn.disabled = true
    try {
      await api.reviews.createForOrder(orderId, { rating, content, taste })
      window.location.href = '/pages/my-reviews.html'
    } catch (err) {
      alert(err?.message || '리뷰 등록에 실패했어요.')
      btn.disabled = false
    }
  }
})()
