/**
 * 사장 메인 대시보드
 * - GET /api/owner/orders/stats/today      : 오늘 전체 주문 합계
 * - GET /api/owner/stores/mine             : 사장 본인 가게(폐업 포함) + storeStatus + 오늘 주문 수
 * - PATCH /api/owner/stores/{id}/status    : 영업 상태 변경 (PREPARING/OPEN/CLOSE)
 *
 * 폐업 가게(isDeleted=true) 는 별도 「폐업」 표시와 함께 노출되며 토글은 비활성화됩니다.
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
    renderStoreStatusList(ctx.storeList)
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
      .map((s) => {
        const dotCls = s.isDeleted
          ? 'status-dot--closed'
          : statusDotClass(s.status)
        const closedBadge = s.isDeleted
          ? ' <span class="inline-badge inline-badge--closed">폐업</span>'
          : ''
        return `
        <li${s.isDeleted ? ' class="is-closed"' : ''}>
          <span class="order-summary-label">
            <span class="status-dot ${dotCls}" aria-hidden="true"></span>
            ${OwnerShared.escapeHtml(s.storeName ?? '가게')}${closedBadge}
          </span>
          <span class="order-summary-count">
            ${Number(s.totalCount ?? 0).toLocaleString('ko-KR')}
            <span class="order-summary-count-unit">건</span>
          </span>
        </li>
      `
      })
      .join('')
  }

  function statusDotClass(status) {
    switch ((status || '').toUpperCase()) {
      case 'OPEN':       return 'status-dot--open'
      case 'PREPARING':  return 'status-dot--new'
      case 'CLOSE':      return 'status-dot--closed'
      default:           return 'status-dot--new'
    }
  }

  /* ------------------ 각 가게 영업 상태 카드 ------------------ */
  function renderStoreStatusList(storeList) {
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

    wrap.innerHTML = storeList.map(renderStoreStatusRow).join('')

    wrap.querySelectorAll('input[data-store-id]').forEach((input) => {
      input.addEventListener('change', () => handleToggle(input))
    })
  }

  function renderStoreStatusRow(store) {
    const status = (store.status || '').toUpperCase()
    const isOpen = status === 'OPEN'
    const isClosed = !!store.isDeleted

    const label = isClosed
      ? '폐업 처리됨'
      : OwnerShared.statusLabel(status || 'PREPARING')
    const labelCls = isClosed
      ? ' style="color:var(--color-cancel);font-weight:700"'
      : ''
    const closedBadge = isClosed
      ? ' <span class="inline-badge inline-badge--closed">폐업</span>'
      : ''
    const switchEl = isClosed
      ? `<a href="./owner-store-manage.html?storeId=${encodeURIComponent(store.storeId)}"
            class="btn-outline-sm" style="text-decoration:none">
           <i class="ti ti-refresh" aria-hidden="true"></i> 재오픈
         </a>`
      : `<label class="switch">
           <input type="checkbox" data-store-id="${store.storeId}" ${isOpen ? 'checked' : ''}
                  aria-label="영업 상태 켜기/끄기" />
           <span class="switch-slider"></span>
         </label>`

    return `
      <div data-store-row="${store.storeId}"${isClosed ? ' class="is-closed"' : ''}>
        <div class="store-status-row">
          <div>
            <div style="font-weight:700">${OwnerShared.escapeHtml(store.storeName ?? '가게')}${closedBadge}</div>
            <div class="store-status-label" data-status-label${labelCls}>${OwnerShared.escapeHtml(label)}</div>
          </div>
          ${switchEl}
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
