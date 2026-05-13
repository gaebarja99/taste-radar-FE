/**
 * 주문 관리 페이지 (사장)
 *
 * 사용 API
 *  - GET    /api/owner/orders                       (목록 + 상태별 합계, ?storeId&status&page&size)
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
    const scope = OwnerShared.ensureOwnerStoreScope(state.storeList, 'owner-order-manage.html')
    if (!scope.success) return
    if (scope.store) {
      state.storeId = String(scope.store.storeId)
      const titleEl = document.querySelector('.page-title')
      if (titleEl) titleEl.textContent = `오늘의 주문 요약 · ${scope.store.storeName ?? '가게'}`
    } else {
      state.storeId = null
    }

    document.getElementById('btnRefresh').addEventListener('click', loadAll)
    document.getElementById('statusFilter').addEventListener('change', (e) => {
      state.status = e.target.value
      state.page = 0
      loadOrders()
    })

    document.getElementById('btnLookup').addEventListener('click', handleLookup)
    document.getElementById('btnReject').addEventListener('click', handleRejectFromPanel)
    document.getElementById('orderIdInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLookup()
    })
    document.getElementById('orderIdInput').addEventListener('input', updateRejectButtonEnabled)
    document.getElementById('rejectReason').addEventListener('input', updateRejectButtonEnabled)

    updateRejectButtonEnabled()
    showTodayDate()
    await loadAll()
  }

  async function loadAll() {
    await Promise.all([loadStatusCounts(), loadOrders()])
  }

  function showTodayDate() {
    const d = new Date()
    document.getElementById('todayDate').textContent = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
  }

  /* ------------------ 상태별 합계 카드 ------------------ */
  const STATUS_CARDS = [
    { status: 'PENDING',    elId: 'cntPending' },
    { status: 'COOKING',    elId: 'cntCooking' },
    { status: 'DELIVERING', elId: 'cntDelivering' },
    { status: 'DELIVERED',  elId: 'cntDelivered' },
  ]

  async function loadStatusCounts() {
    STATUS_CARDS.forEach(({ elId }) => {
      const el = document.getElementById(elId)
      if (el) el.textContent = '…'
    })

    const results = await Promise.all(
      STATUS_CARDS.map(({ status }) =>
        api.orders.owner
          .list({ storeId: state.storeId || undefined, status, page: 0, size: 1 })
          .catch(() => null),
      ),
    )

    STATUS_CARDS.forEach(({ elId }, i) => {
      const el = document.getElementById(elId)
      if (!el) return
      const page = results[i]
      const cnt = page ? Number(page.totalElements ?? 0) : 0
      el.textContent = page ? cnt.toLocaleString('ko-KR') : '-'
    })
  }

  /* ------------------ 주문 목록 ------------------ */
  async function loadOrders() {
    const body = document.getElementById('orderTableBody')
    const totalLabel = document.getElementById('orderTotalLabel')
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
    const isRejected = status === 'REJECTED' || status === 'CANCELED'
    const reason = o.rejectionReason ?? o.rejection_reason ?? ''

    const mainRow = `
      <tr data-status="${status}" data-order-id="${o.id}" ${isRejected ? 'class="is-rejected" data-toggle-reason' : ''}>
        <td><span class="order-id" title="${o.id}">${o.id}</span></td>
        <td><span class="order-price">${OwnerShared.formatWon(total)}</span></td>
        <td><span class="order-time">${OwnerShared.escapeHtml(time)}</span></td>
        <td>${renderStatusCell(o.id, status)}</td>
        <td style="text-align:right">
          <button type="button" class="btn-outline-sm" data-act="pick" data-order-id="${o.id}">선택</button>
        </td>
      </tr>
    `

    if (!isRejected) return mainRow

    const reasonHtml = reason
      ? `<span class="reason-label">거절 사유 ·</span> ${OwnerShared.escapeHtml(reason)}`
      : `<span class="reason-label">거절 사유 ·</span> 등록된 사유가 없습니다.`

    const reasonRow = `
      <tr class="reason-row" data-reason-for="${o.id}" hidden>
        <td colspan="5">
          <div class="reason-block">
            <i class="ti ti-alert-triangle" aria-hidden="true"></i>
            <div>${reasonHtml}</div>
          </div>
        </td>
      </tr>
    `
    return mainRow + reasonRow
  }

  /** 상태 칸 렌더링: 전이 가능한 상태가 있으면 select, 없으면 badge */
  function renderStatusCell(orderId, status) {
    const transitions = nextTransitions(status)
    if (transitions.length === 0) {
      return statusBadge(status)
    }
    const cls = statusSelectClass(status)
    const currentLabel = statusKor(status)
    const options = [
      `<option value="" selected disabled>${OwnerShared.escapeHtml(currentLabel)}</option>`,
      ...transitions.map(
        (t) => `<option value="${t.value}">${OwnerShared.escapeHtml(t.label)}</option>`,
      ),
    ].join('')
    return `
      <select class="status-select ${cls}"
              data-status-select
              data-order-id="${orderId}"
              data-current="${status}"
              aria-label="주문 상태 변경">
        ${options}
      </select>
    `
  }

  function nextTransitions(status) {
    switch (status) {
      case 'PENDING':
        return [
          { value: 'COOKING', label: '→ 수락 (조리 시작)' },
          { value: 'REJECTED', label: '→ 거절' },
        ]
      case 'COOKING':
        return [{ value: 'DELIVERING', label: '→ 배달 중' }]
      case 'DELIVERING':
        return [{ value: 'DELIVERED', label: '→ 배달 완료' }]
      default:
        return []
    }
  }

  function statusKor(status) {
    return (
      {
        PENDING: '신규',
        COOKING: '조리 중',
        DELIVERING: '배달 중',
        DELIVERED: '배달 완료',
        REJECTED: '거절됨',
        CANCELED: '취소됨',
      }[status] || status || '-'
    )
  }

  function statusSelectClass(status) {
    return (
      {
        PENDING: 'status-select--new',
        COOKING: 'status-select--cooking',
        DELIVERING: 'status-select--delivering',
        DELIVERED: 'status-select--done',
        REJECTED: 'status-select--cancel',
        CANCELED: 'status-select--cancel',
      }[status] || ''
    )
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
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const id = btn.dataset.orderId || ''
        const input = document.getElementById('orderIdInput')
        input.value = id
        input.focus()
        handleLookup()
      })
    })

    document.querySelectorAll('#orderTableBody [data-status-select]').forEach((select) => {
      select.addEventListener('change', () => handleStatusSelectChange(select))
      select.addEventListener('click', (e) => e.stopPropagation())
      select.addEventListener('mousedown', (e) => e.stopPropagation())
    })

    document.querySelectorAll('#orderTableBody [data-toggle-reason]').forEach((tr) => {
      tr.addEventListener('click', () => {
        const id = tr.dataset.orderId
        if (!id) return
        const reasonRow = document.querySelector(
          `#orderTableBody tr.reason-row[data-reason-for="${id}"]`,
        )
        if (reasonRow) reasonRow.hidden = !reasonRow.hidden
      })
    })
  }

  async function handleStatusSelectChange(select) {
    const orderId = select.dataset.orderId
    const current = (select.dataset.current || '').toUpperCase()
    const next = select.value
    if (!orderId || !next) return

    const confirmText = confirmMessageFor(current, next)
    if (confirmText && !confirm(confirmText)) {
      select.value = ''
      return
    }

    select.disabled = true
    try {
      if (current === 'PENDING' && next === 'COOKING') {
        await api.orders.owner.accept(orderId)
      } else if (current === 'PENDING' && next === 'REJECTED') {
        const reason = prompt('거절 사유를 입력하세요.', '')
        if (!reason || !reason.trim()) {
          select.value = ''
          select.disabled = false
          return
        }
        await api.orders.owner.reject(orderId, reason.trim())
      } else {
        await api.orders.owner.updateStatus(orderId, next)
      }
      await loadAll()
      const idInput = document.getElementById('orderIdInput')
      if (idInput && idInput.value && String(idInput.value).trim() === String(orderId)) {
        handleLookup()
      }
    } catch (e) {
      alert(OwnerShared.errorMessage(e, '상태 변경 실패'))
      select.value = ''
      select.disabled = false
    }
  }

  function confirmMessageFor(current, next) {
    if (current === 'PENDING' && next === 'COOKING') return '이 주문을 수락하고 조리를 시작할까요?'
    if (current === 'PENDING' && next === 'REJECTED') return null
    if (current === 'COOKING' && next === 'DELIVERING') return '배달 중 상태로 변경할까요?'
    if (current === 'DELIVERING' && next === 'DELIVERED') return '배달 완료로 처리할까요?'
    return null
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
    const hintEl = document.getElementById('rejectHint')
    info.hidden = false
    info.style.color = ''
    info.textContent = '불러오는 중…'
    try {
      const data = await api.orders.detail(id)
      info.innerHTML = renderOrderInfo(data)
      const status = String(data.status ?? data.orderStatus ?? '').toUpperCase()
      if (hintEl) {
        hintEl.style.color = ''
        hintEl.textContent =
          status === 'PENDING'
            ? '신규(PENDING) 주문이에요. 사유를 입력하고 거절 버튼을 누르세요.'
            : `현재 상태: ${OwnerShared.statusLabel(status)} — 거절은 신규(PENDING) 주문에만 가능합니다.`
      }
    } catch (e) {
      info.textContent = OwnerShared.errorMessage(e, '주문 정보를 가져오지 못했습니다.')
      info.style.color = 'var(--color-cancel)'
      if (hintEl) {
        hintEl.style.color = 'var(--color-text-muted)'
        hintEl.textContent =
          '상세 조회는 실패했지만, 사유 입력 후 거절을 시도할 수 있어요.'
      }
    }
    updateRejectButtonEnabled()
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

  function updateRejectButtonEnabled() {
    const btn = document.getElementById('btnReject')
    if (!btn) return
    const id = (document.getElementById('orderIdInput')?.value || '').trim()
    const reason = (document.getElementById('rejectReason')?.value || '').trim()
    btn.disabled = !(id && reason)
  }

  async function handleRejectFromPanel() {
    const id = (document.getElementById('orderIdInput').value || '').trim()
    const textarea = document.getElementById('rejectReason')
    const reason = (textarea.value || '').trim()
    if (!id) {
      alert('주문 ID를 입력하세요.')
      return
    }
    if (!reason) {
      alert('거절 사유를 입력해 주세요.')
      textarea.focus()
      return
    }
    if (!confirm(`주문 #${id}를 거절할까요? 처리 후에는 되돌릴 수 없습니다.`)) return

    const btn = document.getElementById('btnReject')
    btn.disabled = true
    textarea.disabled = true
    try {
      await api.orders.owner.reject(id, reason)
      textarea.value = ''
      alert('주문이 거절되었습니다.')
      handleLookup().catch(() => {})
      await loadAll()
    } catch (e) {
      alert(OwnerShared.errorMessage(e, '거절 실패'))
    } finally {
      textarea.disabled = false
      updateRejectButtonEnabled()
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
