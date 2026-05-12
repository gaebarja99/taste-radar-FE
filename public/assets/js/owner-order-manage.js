/**
 * 주문 관리 페이지 (사장)
 *
 * 백엔드에 사장용 주문 목록 API는 없습니다. 본 페이지는 다음 API를 사용합니다.
 *  - GET    /api/owner/orders/stats/today          (요약 카운트)
 *  - GET    /api/owner/orders/stats/today/stores   (가게별 카운트)
 *  - GET    /api/orders/{id}                       (주문 상세)
 *  - POST   /api/owner/orders/{id}/accept          (수락)
 *  - POST   /api/owner/orders/{id}/reject          (거절, body: { rejectionReason })
 *  - PATCH  /api/owner/orders/{id}/status          (COOKING|DELIVERING|DELIVERED)
 *
 * 좌측 표는 데모 행이며, 우측 패널에서 주문 ID 단위로 실제 처리합니다.
 */
;(function () {
  'use strict'

  const state = {
    storeId: null,
    storeList: [],
    lastOrder: null,
  }

  const DEMO_ROWS = [
    { id: 'e2f3a4b5…', total: 12500, time: '12:05', status: '신규 주문' },
    { id: 'c3a10cc1…', total: 18000, time: '11:32', status: '주문 취소' },
    { id: 'a7f2e9d1…', total: 24000, time: '10:15', status: '배달 완료' },
    { id: 'b1c4d6e8…', total: 9200,  time: '09:50', status: '배달 완료' },
    { id: 'd9e8f7a6…', total: 31000, time: '09:12', status: '배달 완료' },
  ]

  document.addEventListener('DOMContentLoaded', init)

  async function init() {
    const ctx = await OwnerShared.bootstrap()
    if (!ctx) return

    state.storeList = ctx.storeList || []
    populateStoreSelect()

    document.getElementById('btnRefresh').addEventListener('click', loadSummary)
    document.getElementById('storeSelect').addEventListener('change', (e) => {
      state.storeId = e.target.value || null
      applyStoreCard()
    })
    document.getElementById('statusFilter').addEventListener('change', applyFilter)

    document.getElementById('btnLookup').addEventListener('click', handleLookup)
    document.getElementById('btnAccept').addEventListener('click', handleAccept)
    document.getElementById('btnReject').addEventListener('click', handleReject)
    document.getElementById('btnApplyStatus').addEventListener('click', handleApplyStatus)

    renderDemoTable()
    showTodayDate()
    await loadSummary()
  }

  function showTodayDate() {
    const d = new Date()
    document.getElementById('todayDate').textContent = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
  }

  function populateStoreSelect() {
    const select = document.getElementById('storeSelect')
    if (state.storeList.length === 0) {
      select.innerHTML = '<option value="">가게 없음</option>'
      select.disabled = true
      return
    }
    select.innerHTML = state.storeList
      .map((s) => `<option value="${s.storeId}">${OwnerShared.escapeHtml(s.storeName ?? '가게')}</option>`)
      .join('')
    state.storeId = String(state.storeList[0].storeId)
    select.value = state.storeId
    applyStoreCard()
  }

  function applyStoreCard() {
    const s = state.storeList.find((x) => String(x.storeId) === String(state.storeId))
    document.getElementById('storeName').textContent = s?.storeName ?? '—'
    document.getElementById('storeOrderCount').textContent = `오늘 ${Number(
      s?.totalCount ?? 0,
    ).toLocaleString('ko-KR')}건`
  }

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
  }

  /* --------------------- 데모 표 --------------------- */
  function renderDemoTable() {
    const body = document.getElementById('orderTableBody')
    body.innerHTML = DEMO_ROWS.map(
      (r) => `
        <tr data-status="${r.status}">
          <td><span class="order-id">${r.id}</span></td>
          <td><span class="order-price">${OwnerShared.formatWon(r.total)}</span></td>
          <td><span class="order-time">${r.time}</span></td>
          <td>${statusBadge(r.status)}</td>
          <td style="text-align:right">
            <button type="button" class="btn-outline-sm" data-act="pick" data-order-id="${r.id.replace('…','')}">
              ID 채우기
            </button>
          </td>
        </tr>`,
    ).join('')
    body.querySelectorAll('[data-act="pick"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('orderIdInput')
        input.value = btn.dataset.orderId || ''
        input.focus()
      })
    })
    document.getElementById('orderTotalLabel').textContent = `샘플 ${DEMO_ROWS.length}건`
  }

  function statusBadge(s) {
    const m = {
      '신규 주문': 'badge--new',
      '조리 중': 'badge--cooking',
      '배달 중': 'badge--delivering',
      '배달 완료': 'badge--done',
      '주문 취소': 'badge--cancel',
    }
    return `<span class="badge ${m[s] || ''}">${s}</span>`
  }

  function applyFilter() {
    const v = document.getElementById('statusFilter').value
    document.querySelectorAll('#orderTableBody tr').forEach((tr) => {
      tr.hidden = !(v === 'all' || tr.dataset.status === v)
    })
  }

  /* --------------------- 단건 처리 --------------------- */
  async function handleLookup() {
    const id = getOrderId()
    if (!id) return
    const info = document.getElementById('orderInfo')
    info.hidden = false
    info.textContent = '불러오는 중…'
    try {
      const data = await api.orders.detail(id)
      state.lastOrder = data
      info.innerHTML = renderOrderInfo(data)
    } catch (e) {
      state.lastOrder = null
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
      await handleLookup()
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
      await handleLookup()
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
      await handleLookup()
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
