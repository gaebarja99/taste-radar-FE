/**
 * 가게 관리 페이지
 * - 내 가게 목록 (todayStatsByStore + 각 가게 detail 병렬 로드)
 * - 영업 상태 변경 (PATCH /api/owner/stores/{id}/status) — PREPARING/OPEN/CLOSE
 * - 가게 정보 수정 (PUT /api/owner/stores/{id})
 * - 새 가게 등록 (POST /api/owner/stores)
 */
;(function () {
  'use strict'

  const state = {
    detailsById: new Map(),
  }

  document.addEventListener('DOMContentLoaded', init)

  async function init() {
    const ctx = await OwnerShared.bootstrap()
    if (!ctx) return

    document.getElementById('btnRefresh').addEventListener('click', () => loadStores())
    document.getElementById('newStoreForm').addEventListener('submit', handleCreate)
    // 새 가게 등록 섹션 헤더에 있는 빠른 등록 버튼 → 폼 submit 트리거
    const headerSubmitBtn = document.getElementById('btnNewStoreSubmit')
    if (headerSubmitBtn) {
      headerSubmitBtn.addEventListener('click', () => {
        const form = document.getElementById('newStoreForm')
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit()
        } else {
          form.dispatchEvent(new Event('submit', { cancelable: true }))
        }
      })
    }
    await loadStores()
  }

  async function loadStores() {
    const stackEl = document.getElementById('storeStack')
    const emptyEl = document.getElementById('storeEmpty')
    stackEl.innerHTML = '<p class="empty-state">불러오는 중…</p>'
    emptyEl.hidden = true

    try {
      const list = await api.orders.owner.todayStatsByStore()
      const items = Array.isArray(list) ? list : []
      if (items.length === 0) {
        stackEl.innerHTML = ''
        emptyEl.hidden = false
        return
      }
      const details = await Promise.all(
        items.map((s) => api.stores.detail(s.storeId).catch(() => null)),
      )
      state.detailsById.clear()
      items.forEach((s, i) => state.detailsById.set(String(s.storeId), details[i]))

      stackEl.innerHTML = items.map((s, i) => renderCard(s, details[i])).join('')
      attachCardHandlers()
    } catch (e) {
      stackEl.innerHTML = `<p class="empty-state is-error" style="color:var(--color-cancel)">${OwnerShared.escapeHtml(
        OwnerShared.errorMessage(e, '가게 목록을 불러오지 못했습니다.'),
      )}</p>`
    }
  }

  function renderCard(store, detail) {
    const status = (detail?.status || 'PREPARING').toUpperCase()
    const pillCls =
      status === 'OPEN' ? 'status-pill--open' :
      status === 'PREPARING' ? 'status-pill--preparing' : 'status-pill--close'

    return `
      <article class="card" data-store-id="${store.storeId}">
        <header class="card-header">
          <h2 class="card-title">${OwnerShared.escapeHtml(store.storeName ?? '가게')}</h2>
          <span class="status-pill ${pillCls}">${OwnerShared.statusLabel(status)}</span>
        </header>
        <div data-view>
          <dl style="margin:8px 0 14px">
            <div class="kv-row"><dt>오픈</dt><dd>${OwnerShared.escapeHtml(detail?.openTime ?? '-')}</dd></div>
            <div class="kv-row"><dt>마감</dt><dd>${OwnerShared.escapeHtml(detail?.closeTime ?? '-')}</dd></div>
            <div class="kv-row"><dt>최소주문</dt><dd>${OwnerShared.formatWon(detail?.minOrderAmount)}</dd></div>
            <div class="kv-row"><dt>평점</dt><dd>★ ${
              detail?.averageRating != null ? Number(detail.averageRating).toFixed(1) : '-'
            } <small style="color:var(--color-text-muted);font-weight:400">(리뷰 ${Number(
      detail?.reviewCount ?? 0,
    ).toLocaleString('ko-KR')})</small></dd></div>
            <div class="kv-row"><dt>오늘 주문</dt><dd>${Number(store?.totalCount ?? 0).toLocaleString('ko-KR')}건</dd></div>
          </dl>
          <div class="btn-row">
            <button type="button" class="btn-outline-sm" data-act="status" data-status="PREPARING">준비 중</button>
            <button type="button" class="btn-outline-sm" data-act="status" data-status="OPEN">영업 시작</button>
            <button type="button" class="btn-outline-sm is-danger" data-act="status" data-status="CLOSE">영업 종료</button>
            <button type="button" class="btn-outline-sm" data-act="edit" style="margin-left:auto">
              <i class="ti ti-edit" aria-hidden="true"></i> 수정
            </button>
          </div>
        </div>
      </article>
    `
  }

  function renderEditForm(storeId) {
    const detail = state.detailsById.get(String(storeId)) || {}
    return `
      <form data-edit-form class="form-grid" style="padding:8px 0 4px">
        <label>가게명
          <input type="text" name="name" value="${OwnerShared.escapeHtml(detail.name ?? '')}" required />
        </label>
        <label>최소 주문 금액
          <input type="number" name="minOrderAmount" min="0" value="${Number(detail.minOrderAmount ?? 0)}" required />
        </label>
        <label class="col-span-2">주소
          <input type="text" name="address" value="${OwnerShared.escapeHtml(detail.address ?? '')}" required />
        </label>
        <label class="col-span-2">상세 주소
          <input type="text" name="addressDetail" value="${OwnerShared.escapeHtml(detail.addressDetail ?? '')}" required />
        </label>
        <label>오픈 시간
          <input type="time" name="openTime" value="${OwnerShared.escapeHtml(detail.openTime ?? '10:00')}" required />
        </label>
        <label>마감 시간
          <input type="time" name="closeTime" value="${OwnerShared.escapeHtml(detail.closeTime ?? '22:00')}" required />
        </label>
        <label>평균 조리 시간(분)
          <input type="number" name="requiredTimeMinutes" min="1" value="${Number(detail.requiredTimeMinutes ?? 30)}" required />
        </label>
        <label>대표 이미지 URL
          <input type="url" name="imgUrl" value="${OwnerShared.escapeHtml(detail.imgUrl ?? detail.images?.[0]?.imgUrl ?? '')}" />
        </label>
        <label>위도
          <input type="number" name="latitude" step="any" value="${detail.latitude ?? ''}" />
        </label>
        <label>경도
          <input type="number" name="longitude" step="any" value="${detail.longitude ?? ''}" />
        </label>
        <div class="col-span-2 btn-row" style="justify-content:flex-end">
          <button type="button" class="btn-outline-sm" data-act="edit-cancel">취소</button>
          <button type="submit" class="btn-primary" style="width:auto;padding:8px 18px;margin-top:0">저장</button>
        </div>
        <p data-edit-msg class="empty-state" hidden style="grid-column:1 / -1;margin:0"></p>
      </form>
    `
  }

  function attachCardHandlers() {
    document.querySelectorAll('[data-act="status"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const card = btn.closest('[data-store-id]')
        const storeId = card?.dataset.storeId
        const next = btn.dataset.status
        if (!storeId || !next) return
        btn.disabled = true
        try {
          await api.stores.updateStatus(storeId, next)
          await loadStores()
        } catch (e) {
          alert(OwnerShared.errorMessage(e, '상태 변경 실패'))
        } finally {
          btn.disabled = false
        }
      })
    })

    document.querySelectorAll('[data-act="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = btn.closest('[data-store-id]')
        const storeId = card?.dataset.storeId
        if (!storeId) return
        const viewBox = card.querySelector('[data-view]')
        viewBox.innerHTML = renderEditForm(storeId)
        const form = viewBox.querySelector('[data-edit-form]')
        form.addEventListener('submit', (e) => handleEdit(e, storeId, card))
        viewBox.querySelector('[data-act="edit-cancel"]').addEventListener('click', () => loadStores())
      })
    })
  }

  async function handleEdit(e, storeId, card) {
    e.preventDefault()
    const form = e.currentTarget
    const msgEl = form.querySelector('[data-edit-msg]')
    msgEl.hidden = true

    const data = Object.fromEntries(new FormData(form).entries())
    const payload = {
      name: data.name?.trim(),
      address: data.address?.trim(),
      addressDetail: data.addressDetail?.trim(),
      minOrderAmount: Number(data.minOrderAmount),
      openTime: data.openTime,
      closeTime: data.closeTime,
      requiredTimeMinutes: Number(data.requiredTimeMinutes),
      latitude: data.latitude ? Number(data.latitude) : null,
      longitude: data.longitude ? Number(data.longitude) : null,
    }
    if (data.imgUrl?.trim()) {
      payload.images = [
        {
          fileName: 'thumbnail',
          imgUrl: data.imgUrl.trim(),
          imgKey: `thumbnail-${Date.now()}`,
        },
      ]
    }

    const submit = form.querySelector('button[type="submit"]')
    submit.disabled = true
    try {
      await api.stores.update(storeId, payload)
      await loadStores()
    } catch (err) {
      showMsg(msgEl, OwnerShared.errorMessage(err, '가게 수정에 실패했습니다.'), true)
      submit.disabled = false
    }
  }

  /* --------------------- 새 가게 등록 --------------------- */
  async function handleCreate(e) {
    e.preventDefault()
    const form = e.currentTarget
    const msgEl = document.getElementById('newStoreMsg')
    const submit = document.getElementById('btnNewStoreSubmit')
    msgEl.hidden = true

    const data = Object.fromEntries(new FormData(form).entries())
    const payload = {
      name: data.name?.trim(),
      address: data.address?.trim(),
      addressDetail: data.addressDetail?.trim(),
      minOrderAmount: Number(data.minOrderAmount),
      openTime: data.openTime,
      closeTime: data.closeTime,
      requiredTimeMinutes: Number(data.requiredTimeMinutes),
      latitude: data.latitude ? Number(data.latitude) : null,
      longitude: data.longitude ? Number(data.longitude) : null,
      images: [
        {
          fileName: 'thumbnail',
          imgUrl: data.imgUrl?.trim(),
          imgKey: `thumbnail-${Date.now()}`,
        },
      ],
    }

    if (submit) submit.disabled = true
    try {
      const res = await api.stores.create(payload)
      showMsg(msgEl, `가게가 등록되었습니다. (id: ${res?.id ?? '-'})`, false)
      form.reset()
      await loadStores()
    } catch (err) {
      showMsg(msgEl, OwnerShared.errorMessage(err, '가게 등록에 실패했습니다.'), true)
    } finally {
      if (submit) submit.disabled = false
    }
  }

  function showMsg(el, text, isError) {
    el.hidden = false
    el.textContent = text
    el.style.color = isError ? 'var(--color-cancel)' : 'var(--color-delivering)'
    el.style.borderColor = isError ? 'var(--color-cancel)' : 'var(--color-delivering)'
  }
})()
