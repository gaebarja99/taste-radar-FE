/**
 * 사장 메인 대시보드
 * - GET /api/owner/orders/stats/today           : 오늘 전체 주문 합계
 * - GET /api/owner/orders/stats/today/stores    : 가게별 오늘 주문 카운트 (= 사이드바/목록 소스)
 * - GET /api/stores/{id}                        : 각 가게 상세 + 영업 상태
 * - PATCH /api/owner/stores/{id}/status         : 영업 상태 변경 (PREPARING/OPEN/CLOSE)
 */
;(function () {
  'use strict'

  document.addEventListener('DOMContentLoaded', init)

  async function init() {
    const subtitleEl = document.getElementById('todaySummaryTotal')

    const ctx = await OwnerShared.bootstrap()
    if (!ctx) return

    loadTodayTotal(subtitleEl)
    renderStoreBreakdown(ctx.storeList)
    await renderStoreStatusList(ctx.storeList)
  }

  /* ------------------ 오늘 전체 합계 ------------------ */
  async function loadTodayTotal(subtitleEl) {
    try {
      const data = await api.orders.owner.todayStats()
      const total = Number(data?.totalCount ?? 0)
      subtitleEl.textContent = `총 ${total.toLocaleString('ko-KR')}건`
    } catch (e) {
      subtitleEl.textContent = OwnerShared.errorMessage(e, '통계를 불러올 수 없습니다.')
    }
  }

  /* ------------------ 가게별 오늘 주문 카운트 ------------------ */
  function renderStoreBreakdown(storeList) {
    const listEl = document.getElementById('storeBreakdownList')
    if (!storeList || storeList.length === 0) {
      listEl.innerHTML = `
        <li>
          <span class="order-summary-label">등록된 가게가 없어요</span>
          <a href="./owner-store-manage.html" class="order-summary-count" style="color:var(--color-primary);text-decoration:none">
            가게 등록 →
          </a>
        </li>
      `
      return
    }

    listEl.innerHTML = storeList
      .map(
        (s) => `
        <li>
          <span class="order-summary-label">
            <span class="status-dot status-dot--new" aria-hidden="true"></span>
            ${OwnerShared.escapeHtml(s.storeName ?? '가게')}
          </span>
          <span class="order-summary-count">
            ${Number(s.totalCount ?? 0).toLocaleString('ko-KR')}
            <span class="order-summary-count-unit">건</span>
          </span>
        </li>
      `,
      )
      .join('')
  }

  /* ------------------ 각 가게 영업 상태 카드 ------------------ */
  async function renderStoreStatusList(storeList) {
    const wrap = document.getElementById('storeStatusList')

    if (!storeList || storeList.length === 0) {
      wrap.innerHTML = `
        <p class="empty-state" style="margin:0">
          먼저
          <a href="./owner-store-manage.html" style="color:var(--color-primary);font-weight:700">가게 등록</a>
          을 진행해 주세요.
        </p>
      `
      return
    }

    const details = await Promise.all(
      storeList.map((s) => api.stores.detail(s.storeId).catch(() => null)),
    )

    wrap.innerHTML = storeList
      .map((s, i) => renderStoreStatusRow(s, details[i]))
      .join('')

    wrap.querySelectorAll('input[data-store-id]').forEach((input) => {
      input.addEventListener('change', () => handleToggle(input))
    })
  }

  function renderStoreStatusRow(store, detail) {
    const status = (detail?.status || '').toUpperCase()
    const isOpen = status === 'OPEN'
    const label = OwnerShared.statusLabel(status || 'CLOSE')
    const disabled = detail ? '' : 'disabled'

    return `
      <div data-store-row="${store.storeId}">
        <div class="store-status-row">
          <div>
            <div style="font-weight:700">${OwnerShared.escapeHtml(store.storeName ?? '가게')}</div>
            <div class="store-status-label" data-status-label>${OwnerShared.escapeHtml(label)}</div>
          </div>
          <label class="switch">
            <input type="checkbox" data-store-id="${store.storeId}" ${isOpen ? 'checked' : ''} ${disabled}
                   aria-label="영업 상태 켜기/끄기" />
            <span class="switch-slider"></span>
          </label>
        </div>
      </div>
    `
  }

  async function handleToggle(input) {
    const storeId = input.dataset.storeId
    const next = input.checked ? 'OPEN' : 'CLOSE'
    const row = input.closest('[data-store-row]')
    const labelEl = row?.querySelector('[data-status-label]')
    input.disabled = true
    try {
      await api.stores.updateStatus(storeId, next)
      if (labelEl) labelEl.textContent = OwnerShared.statusLabel(next)
    } catch (e) {
      alert(OwnerShared.errorMessage(e, '영업 상태를 바꾸지 못했습니다.'))
      input.checked = !input.checked
    } finally {
      input.disabled = false
    }
  }
})()
