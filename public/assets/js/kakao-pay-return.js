/**
 * 카카오페이 결제 승인 콜백 페이지
 * approval_url 로 리다이렉트된 뒤 pg_token 으로 승인 API 호출
 */
;(function () {
  'use strict'

  document.addEventListener('DOMContentLoaded', init)

  async function init() {
    const host = document.getElementById('payReturnHost')
    if (!window.api) {
      host.innerHTML = errorBox('API 스크립트를 불러오지 못했습니다.')
      return
    }

    if (!api.auth.isLoggedIn()) {
      host.innerHTML = errorBox('로그인이 필요합니다.', '/')
      return
    }

    const params = new URLSearchParams(window.location.search)
    const pgToken = params.get('pg_token')
    const orderId =
      params.get('orderId') || sessionStorage.getItem('tasteRadar.pendingOrderId')

    if (!pgToken || !orderId) {
      host.innerHTML = errorBox('결제 정보가 올바르지 않아요.', '/pages/cart.html')
      return
    }

    try {
      const result = await api.payment.kakaoPay.approve({
        orderId: Number(orderId),
        pgToken,
      })
      sessionStorage.removeItem('tasteRadar.pendingOrderId')
      host.innerHTML = `
        <div class="checkout-success-card">
          <i class="ti ti-circle-check checkout-success-icon" aria-hidden="true"></i>
          <h1 class="checkout-success-title">결제가 완료되었어요</h1>
          <p class="checkout-success-desc">
            주문 번호 #${escapeHtml(String(result.orderId ?? orderId))}<br />
            결제 금액 ${formatWon(result.totalAmount)}
          </p>
          <a href="/" class="btn-primary cart-checkout-btn" style="display:inline-flex;align-items:center;justify-content:center;text-decoration:none;min-width:160px;height:40px;border-radius:10px">홈으로</a>
        </div>
      `
    } catch (e) {
      host.innerHTML = errorBox(
        e?.message || '결제 승인에 실패했어요.',
        '/pages/checkout.html',
      )
    }
  }

  function errorBox(message, href = '/') {
    return `
      <div class="checkout-success-card">
        <i class="ti ti-alert-circle checkout-success-icon" style="color:var(--color-cancel)" aria-hidden="true"></i>
        <h1 class="checkout-success-title">결제를 완료하지 못했어요</h1>
        <p class="checkout-success-desc">${escapeHtml(message)}</p>
        <a href="${escapeHtml(href)}" class="btn-outline-sm" style="display:inline-flex;text-decoration:none">돌아가기</a>
      </div>
    `
  }

  function formatWon(v) {
    return `${Number(v ?? 0).toLocaleString('ko-KR')}원`
  }

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
})()
