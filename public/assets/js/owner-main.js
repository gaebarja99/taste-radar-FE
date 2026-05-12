/**
 * 사장 메인 대시보드
 * - 사이드바 + 가게 목록은 owner-shared.js로 공통화
 * - 오늘 주문 합계: GET /api/owner/orders/stats/today
 * - 가게 정보 + 영업 상태 토글: GET /api/stores/{id}, PATCH /api/owner/stores/{id}/status
 */
;(function () {
  'use strict'

  document.addEventListener('DOMContentLoaded', init)

  async function init() {
    const subtitleEl = document.getElementById('todaySummaryTotal')
    const titleEl = document.getElementById('storeStatusTitle')
    const labelEl = document.getElementById('storeStatusLabel')
    const inputEl = document.getElementById('storeStatusInput')
    const cardEl = document.getElementById('storeStatusCard')

    const ctx = await OwnerShared.bootstrap()
    if (!ctx) {
      subtitleEl.textContent = '로그인 또는 권한이 필요합니다.'
      return
    }

    try {
      const data = await api.orders.owner.todayStats()
      const total = Number(data?.totalCount ?? 0)
      subtitleEl.textContent = `총 ${total.toLocaleString('ko-KR')}건`
    } catch (e) {
      subtitleEl.textContent = OwnerShared.errorMessage(e, '통계를 불러올 수 없습니다.')
    }

    await renderStoreCard(ctx.storeList, { cardEl, titleEl, labelEl, inputEl })
    inputEl.addEventListener('change', () => handleToggle({ cardEl, inputEl, labelEl }))
  }

  async function renderStoreCard(storeList, { cardEl, titleEl, labelEl, inputEl }) {
    if (!storeList || storeList.length === 0) {
      titleEl.textContent = '등록된 가게가 없습니다'
      labelEl.textContent = '먼저 가게를 등록해 주세요'
      return
    }
    const first = storeList[0]
    cardEl.dataset.storeId = String(first.storeId)
    titleEl.textContent = first.storeName ?? '가게'

    try {
      const detail = await api.stores.detail(first.storeId)
      applyStatusToToggle(detail.status, { inputEl, labelEl })
    } catch (e) {
      labelEl.textContent = OwnerShared.errorMessage(e, '영업 상태를 불러올 수 없습니다.')
      inputEl.checked = false
      inputEl.disabled = true
    }
  }

  function applyStatusToToggle(status, { inputEl, labelEl }) {
    inputEl.checked = status === 'OPEN'
    inputEl.disabled = false
    labelEl.textContent = OwnerShared.statusLabel(status)
  }

  async function handleToggle({ cardEl, inputEl, labelEl }) {
    const storeId = cardEl.dataset.storeId
    if (!storeId) return
    const nextStatus = inputEl.checked ? 'OPEN' : 'CLOSE'
    inputEl.disabled = true
    try {
      await api.stores.updateStatus(storeId, nextStatus)
      labelEl.textContent = OwnerShared.statusLabel(nextStatus)
    } catch (e) {
      alert(OwnerShared.errorMessage(e, '영업 상태를 바꾸지 못했습니다.'))
      inputEl.checked = !inputEl.checked
    } finally {
      inputEl.disabled = false
    }
  }
})()
