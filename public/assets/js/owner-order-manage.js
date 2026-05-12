/**
 * 주문 관리 페이지 (사장)
 *
 * 사용 API
 *  - GET    /api/owner/orders                       (목록, ?storeId&status&page&size)
 *  - GET    /api/owner/orders/stats/today           (오늘 전체 주문 합계)
 *  - GET    /api/owner/orders/stats/today/stores    (가게별 카운트 = 가게 셀렉트 옵션)
 *  - GET    /api/orders/{id}                        (상세)
 *  - POST   /api/owner/orders/{id}/accept           (PENDING → COOKING)
 *  - POST   /api/owner/orders/{id}/reject           (PENDING → REJECTED, body: { rejectionReason })
 *  - PATCH  /api/owner/orders/{id}/status           (COOKING → DELIVERING → DELIVERED)
 */
;(function () {
  'use strict'

  const PAGE_SIZE = 20

  const state = {
    storeList: [],
    storeId: null,   // null/"" 이면 전체
    status: '',      // '' 이면 전체
    page: 0,
    totalPages: 0,
    totalElements: 0,
  }

  document.addEventListener('DOMContentLoaded', init)

  async function init() {
    const ctx = await OwnerShared.bootstrap()
    if (!ctx) return

    state.storeList = ctx.storeList || []
    populateStoreSelect()

    document.getElementById('btnRefresh').addEventListener('click', loadAll)
    document.getElementById('storeSelect').addEventListener('change', (e) => {
      state.storeId = e.target.value || null
      state.page = 0
      loadOrders()
    })
    document.getElementById('statusFilter').addEventListener('change', (e) => {
      state.status = e.target.value
      state.page = 0
      loadOrders()
    })

    document.getElementById('btnLookup').addEventListener('click', handleLookup)
    document.getElementById('btnAccept').addEventListener('click', handleAccept)
    document.getElementById('btnReject').addEventListener('click', handleReject)
    document.getElementById('btnApplyStatus').addEventListener('click', handleApplyStatus)

    showTodayDate()
    await loadAll()
  }

  async function loadAll() {
    await Promise.all([loadSummary(), loadOrders()])
  }

  function showTodayDate() {
    const d = new Date()
    document.getElementById('todayDate').textContent = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
  }

  function populateStoreSelect() {
    const select = document.getElementById('storeSelect')
    if (!state.storeList || state.storeList.length === 0) {
      select.innerHTML = '<option value="">가게 없음</option>'
      select.disabled = true
      return
    }
    select.disabled = false
    select.innerHTML =
      '<option value="">전체 가게</option>' +
      state.storeList
        .map(
          (s) =>
            `<option value="${s.storeId}">${OwnerShared.escapeHtml(s.storeName ?? '가게')}</option>`,
        )
        .join('')
    select.value = ''
    state.storeId = null
    applyStoreCard()
  }

  function applyStoreCard() {
    const s = state.storeList.find((x) => String(x.storeId) === String(state.storeId))
    const nameEl = document.getElementById('storeName')
    const countEl = document.getElementById('storeOrderCount')
    if (!state.storeId) {
      nameEl.textContent = '전체'
      countEl.textContent = '모든 가게 합계'
      return
    }
    nameEl.textContent = s?.storeName ?? '—'
    countEl.textContent = `오늘 ${Number(s?.totalCount ?? 0).toLocaleString('ko-KR')}건`
  }

  /* ------------------ 오늘 합계 ------------------ */
  async function loadSummary() {
    const totalEl = document.getElementById('todayTotal')
    totalEl.textContent = '…'
    try {
      const data = await api.orders.owner.todayStats()
      const total = Number(data?.totalCount ?? 0)
      totalEl.textContent = total.toLocaleString('ko-KR')
    } catch (e) {
      totalEl.textContent = '-'
      console.warn(OwnerShared.errorMessage(e, '요약 불러오기 실패'))
    }
    applyStoreCard()
  }

  /* ------------------ 주문 목록 ------------------ */
  async function loadOrders() {
    const body = document.getElementById('orderTableBody')
    const totalLabel = document.getElementById('orderTotalLabel')
    const listCountEl = document.getElementById('orderListCount')
    body.innerHTML = `<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--color-text-muted)">불러오는 중…</td></tr>`

    try {
      const page = await api.orders.owner.list({
        storeId: state.storeId || undefined,
        status: state.status || undefined,
        page: state.page,
        size: PAGE_SIZE,
      })
      const items = Array.isArray(page?.content) ? page.content : []
      state.totalPages = Number(page?.totalPages ?? 0)
      state.totalElements = Number(page?.totalElements ?? items.length)

      totalLabel.textContent = `총 ${state.totalElements.toLocaleString('ko-KR')}건`
      listCountEl.textContent = items.length.toLocaleString('ko-KR')

      if (items.length === 0) {
        body.innerHTML = `<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--color-text-muted)">조건에 맞는 주문이 없어요.</td></tr>`
      } else {
        body.innerHTML = items.map(renderRow).join('')
        attachRowHandlers()
      }
      renderPagination()
    } catch (e) {
      body.innerHTML = `<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--color-cancel)">${OwnerShared.escapeHtml(
        OwnerShared.errorMessage(e, '주문 목록을 불러오지 못했습니다.'),
      )}</td></tr>`
      totalLabel.textContent = '총 0건'
      listCountEl.textContent = '0'
      renderPagination()
    }
  }

  function renderRow(o) {
    const status = String(o.orderStatus ?? o.status ?? '').toUpperCase()
    const created = o.createdAt ? new Date(o.createdAt) : null
    const time = created
      ? `${created.getMonth() + 1}/${created.getDate()} ${String(created.getHours()).padStart(2, '0')}:${String(
          created.getMinutes(),
        ).padStart(2, '0')}`
      : '-'
    const total = o.totalAmount ?? o.totalPrice ?? 0

    return `
      <tr data-status="${status}">
        <td><span class="order-id" title="${o.id}">${o.id}</span></td>
        <td><span class="order-price">${OwnerShared.formatWon(total)}</span></td>
        <td><span class="order-time">${OwnerShared.escapeHtml(time)}</span></td>
        <td>${statusBadge(status)}</td>
        <td style="text-align:right">
          <button type="button" class="btn-outline-sm" data-act="pick" data-order-id="${o.id}">선택</button>
        </td>
      </tr>
    `
  }

  function statusBadge(status) {
    const map = {
      PENDING: { cls: 'badge--new', label: '신규' },
      COOKING: { cls: 'badge--cooking', label: '조리 중' },
      DELIVERING: { cls: 'badge--delivering', label: '배달 중' },
      DELIVERED: { cls: 'badge--done', label: '배달 완료' },
      REJECTED: { cls: 'badge--cancel', label: '거절' },
      CANCELED: { cls: 'badge--cancel', label: '취소' },
    }
    const m = map[status] || { cls: '', label: status || '-' }
    return `<span class="badge ${m.cls}">${m.label}</span>`
  }

  function attachRowHandlers() {
    document.querySelectorAll('#orderTableBody [data-act="pick"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.orderId || ''
        const input = document.getElementById('orderIdInput')
        input.value = id
        input.focus()
        handleLookup()
      })
    })
  }

  function renderPagination() {
    const wrap = document.getElementById('pagination')
    if (!wrap) return
    const tp = state.totalPages
    if (tp <= 1) {
      wrap.innerHTML = ''
      return
    }
    const prevDisabled = state.page <= 0
    const nextDisabled = state.page >= tp - 1
    wrap.innerHTML = `
      <button type="button" class="btn-outline-sm" ${prevDisabled ? 'disabled' : ''} data-page-act="prev">이전</button>
      <span style="align-self:center;font-size:12px;color:var(--color-text-muted)">${state.page + 1} / ${tp}</span>
      <button type="button" class="btn-outline-sm" ${nextDisabled ? 'disabled' : ''} data-page-act="next">다음</button>
    `
    wrap.querySelectorAll('[data-page-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.pageAct === 'prev' && state.page > 0) state.page -= 1
        else if (btn.dataset.pageAct === 'next' && state.page < state.totalPages - 1) state.page += 1
        loadOrders()
      })
    })
  }

  /* ------------------ 단건 처리 ------------------ */
  async function handleLookup() {
    const id = getOrderId()
    if (!id) return
    const info = document.getElementById('orderInfo')
    info.hidden = false
    info.style.color = ''
    info.textContent = '불러오는 중…'
    try {
      const data = await api.orders.detail(id)
      info.innerHTML = renderOrderInfo(data)
    } catch (e) {
      info.textContent = OwnerShared.errorMessage(e, '주문 정보를 가져오지 못했습니다.')
      info.style.color = 'var(--color-cancel)'
    }
  }

  function renderOrderInfo(o) {
    const status = String(o.status ?? o.orderStatus ?? '').toUpperCase()
    const total = o.totalAmount ?? o.totalPrice ?? o.amount ?? 0
    const created = o.createdAt ?? o.created_at ?? ''
    return `
      <div class="kv-row"><dt>주문 ID</dt><dd>${OwnerShared.escapeHtml(String(o.id))}</dd></div>
      <div class="kv-row"><dt>가게</dt><dd>${OwnerShared.escapeHtml(o.storeName ?? '-')}</dd></div>
      <div class="kv-row"><dt>총액</dt><dd>${OwnerShared.formatWon(total)}</dd></div>
      <div class="kv-row"><dt>상태</dt><dd>${OwnerShared.statusLabel(status)}</dd></div>
      <div class="kv-row"><dt>생성</dt><dd>${OwnerShared.escapeHtml(
        created ? new Date(created).toLocaleString('ko-KR') : '-',
      )}</dd></div>
    `
  }

  async function handleAccept() {
    const id = getOrderId()
    if (!id) return
    try {
      await api.orders.owner.accept(id)
      await Promise.all([handleLookup(), loadOrders()])
    } catch (e) {
      alert(OwnerShared.errorMessage(e, '수락 실패'))
    }
  }

  async function handleReject() {
    const id = getOrderId()
    if (!id) return
    const reason = document.getElementById('rejectReason').value.trim()
    if (!reason) {
      alert('거절 사유를 입력해 주세요.')
      return
    }
    try {
      await api.orders.owner.reject(id, reason)
      await Promise.all([handleLookup(), loadOrders()])
    } catch (e) {
      alert(OwnerShared.errorMessage(e, '거절 실패'))
    }
  }

  async function handleApplyStatus() {
    const id = getOrderId()
    if (!id) return
    const next = document.getElementById('nextStatusSelect').value
    if (next === 'ACCEPTED') {
      await handleAccept()
      return
    }
    try {
      await api.orders.owner.updateStatus(id, next)
      await Promise.all([handleLookup(), loadOrders()])
    } catch (e) {
      alert(OwnerShared.errorMessage(e, '상태 변경 실패'))
    }
  }

  function getOrderId() {
    const v = document.getElementById('orderIdInput').value.trim()
    if (!v) {
      alert('주문 ID를 입력하세요.')
      return ''
    }
    return v
  }
})()
