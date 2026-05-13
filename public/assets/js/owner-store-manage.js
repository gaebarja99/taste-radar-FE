/**
 * 가게 관리 페이지 (지점 단일 스코프)
 * - 사이드바에서 선택한 가게(URL ?storeId=)만 표시
 * - 영업 상태 변경 (PATCH /api/owner/stores/{id}/status) — PREPARING/OPEN/CLOSE
 * - 가게 정보 수정 (PUT /api/owner/stores/{id})
 */
;(function () {
  'use strict'

  const state = {
    detailsById: new Map(),
    /** 현재 페이지가 보여줄 가게 ID (가게가 0개면 null) */
    scopedStoreId: null,
  }

  document.addEventListener('DOMContentLoaded', init)

  async function init() {
    const ctx = await OwnerShared.bootstrap()
    if (!ctx) return

    const list = ctx.storeList || []
    if (list.length > 0) {
      const scope = OwnerShared.ensureOwnerStoreScope(list, 'owner-store-manage.html')
      if (!scope.success) return
      state.scopedStoreId = String(scope.store.storeId)
      const titleEl = document.querySelector('.page-title')
      if (titleEl) titleEl.textContent = `가게 관리 · ${scope.store.storeName ?? '가게'}`
    } else {
      state.scopedStoreId = null
    }

    document.getElementById('btnRefresh').addEventListener('click', () => loadStores())
    await loadStores()
  }

  async function loadStores() {
    const stackEl = document.getElementById('storeStack')
    const emptyEl = document.getElementById('storeEmpty')
    stackEl.innerHTML = '<p class="empty-state">불러오는 중…</p>'
    emptyEl.hidden = true

    try {
      const list = await api.stores.ownerMine()
      let items = (Array.isArray(list) ? list : []).map((s) => ({
        storeId: s.storeId,
        storeName: s.storeName,
        status: s.storeStatus ?? s.status,
        isDeleted: !!s.isDeleted,
        totalCount: Number(s.todayOrderCount ?? 0),
      }))
      if (state.scopedStoreId) {
        items = items.filter((s) => String(s.storeId) === state.scopedStoreId)
      }
      if (items.length === 0) {
        stackEl.innerHTML = ''
        emptyEl.hidden = false
        return
      }
      // 폐업 가게는 ownerDetail (인증 필요) 로, 활성 가게는 기존 public detail 사용
      const details = await Promise.all(
        items.map((s) =>
          (s.isDeleted ? api.stores.ownerDetail(s.storeId) : api.stores.detail(s.storeId)).catch(() => null),
        ),
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
    return `
      <article class="card store-detail-card${store.isDeleted ? ' is-closed' : ''}" data-store-id="${store.storeId}"${store.isDeleted ? ' data-closed="true"' : ''}>
        <div data-view>${renderViewBody(store, detail)}</div>
      </article>
    `
  }

  function statusPillCls(status) {
    return status === 'OPEN' ? 'status-pill--open'
      : status === 'PREPARING' ? 'status-pill--preparing'
      : 'status-pill--close'
  }

  function getThumbUrl(detail) {
    return detail?.imgUrl ?? detail?.images?.[0]?.imgUrl ?? ''
  }

  function renderViewBody(store, detail) {
    const status = (detail?.status || 'PREPARING').toUpperCase()
    const pillCls = statusPillCls(status)
    const isClosed = !!store.isDeleted

    const minOrder = OwnerShared.formatWon(detail?.minOrderAmount ?? 0)
    const cookingMin = Number(detail?.requiredTimeMinutes ?? 30)
    const addressStr = [detail?.address, detail?.addressDetail]
      .filter(Boolean)
      .join(' ')
      .trim() || '주소 정보가 없습니다.'
    const thumbUrl = getThumbUrl(detail)

    const closedBanner = isClosed
      ? `<div class="store-closed-banner">
           <div class="store-closed-banner-text">
             <strong><i class="ti ti-archive" aria-hidden="true"></i> 폐업한 가게입니다</strong>
             <span>아래 정보는 참고용이며, 다시 영업하려면 「재오픈」을 눌러 주세요.</span>
           </div>
           <button type="button" class="btn-primary" data-act="reopen-store">
             <i class="ti ti-refresh" aria-hidden="true"></i> 재오픈
           </button>
         </div>`
      : ''

    const activeControls = isClosed
      ? ''
      : `<div class="store-status-bar">
           <span class="store-status-bar-label">영업 상태 변경</span>
           <button type="button" class="btn-outline-sm ${status === 'PREPARING' ? 'is-current' : ''}"
                   data-act="status" data-status="PREPARING">준비 중</button>
           <button type="button" class="btn-outline-sm ${status === 'OPEN' ? 'is-current' : ''}"
                   data-act="status" data-status="OPEN">영업 시작</button>
           <button type="button" class="btn-outline-sm is-danger ${status === 'CLOSE' ? 'is-current' : ''}"
                   data-act="status" data-status="CLOSE">영업 종료</button>
           <button type="button" class="btn-text-danger store-close-link" data-act="close-store">
             <i class="ti ti-trash" aria-hidden="true"></i> 가게 폐업
           </button>
         </div>`

    const editBtn = isClosed
      ? ''
      : `<button type="button" class="btn-outline-sm" data-act="edit">
           <i class="ti ti-edit" aria-hidden="true"></i> 가게 정보 수정
         </button>`

    return `
      ${closedBanner}
      <header class="store-detail-head">
        ${renderThumb(thumbUrl)}
        <div class="store-detail-title">
          <h2 class="card-title">${OwnerShared.escapeHtml(store.storeName ?? '가게')}</h2>
          <p class="store-detail-address">
            <i class="ti ti-map-pin" aria-hidden="true"></i>
            ${OwnerShared.escapeHtml(addressStr)}
          </p>
        </div>
        <div class="store-detail-meta">
          <span class="status-pill ${pillCls}">${OwnerShared.statusLabel(status)}</span>
          ${editBtn}
        </div>
      </header>

      <div class="store-stat-grid">
        <div class="store-stat">
          <p class="store-stat-label">최소 주문</p>
          <p class="store-stat-value">${minOrder}</p>
        </div>
        <div class="store-stat">
          <p class="store-stat-label">평균 조리</p>
          <p class="store-stat-value">${cookingMin}<span class="store-stat-unit">분</span></p>
        </div>
        <div class="store-stat">
          <p class="store-stat-label">오픈 시간</p>
          <p class="store-stat-value store-stat-value--sm">${OwnerShared.escapeHtml(detail?.openTime ?? '-')}</p>
        </div>
        <div class="store-stat">
          <p class="store-stat-label">마감 시간</p>
          <p class="store-stat-value store-stat-value--sm">${OwnerShared.escapeHtml(detail?.closeTime ?? '-')}</p>
        </div>
      </div>

      ${activeControls}
    `
  }

  function renderThumb(thumbUrl) {
    return thumbUrl
      ? `<div class="store-detail-thumb"><img src="${OwnerShared.escapeHtml(thumbUrl)}" alt="" onerror="this.parentNode.classList.add('is-broken')"/></div>`
      : `<div class="store-detail-thumb store-detail-thumb--placeholder"><i class="ti ti-building-store" aria-hidden="true"></i></div>`
  }

  /* ---------------- 인라인 수정 모드 ---------------- */
  function renderEditBody(store, detail) {
    const status = (detail?.status || 'PREPARING').toUpperCase()
    const pillCls = statusPillCls(status)
    const thumbUrl = getThumbUrl(detail)

    return `
      <form data-edit-form class="store-detail-edit-form" novalidate>
        <header class="store-detail-head">
          <div class="store-detail-thumb-edit">
            ${renderThumb(thumbUrl)}
            <label class="field-label" for="editImgUrl">대표 이미지 URL</label>
            <input id="editImgUrl" class="store-edit-thumb-input" type="url"
                   name="imgUrl" value="${OwnerShared.escapeHtml(thumbUrl)}"
                   placeholder="https://..." data-act="thumb-url" />
          </div>
          <div class="store-detail-title">
            <input class="store-edit-name" type="text" name="name"
                   value="${OwnerShared.escapeHtml(detail?.name ?? store.storeName ?? '')}"
                   placeholder="가게명" required />
            <div class="store-edit-address-row">
              <div class="store-edit-address-search">
                <input class="store-edit-input" type="text" name="address"
                       value="${OwnerShared.escapeHtml(detail?.address ?? '')}"
                       placeholder="주소 검색 버튼을 눌러주세요" required readonly />
                <button type="button" class="btn-outline-sm" data-act="address-search">
                  <i class="ti ti-search" aria-hidden="true"></i> 주소 검색
                </button>
              </div>
              <input class="store-edit-input" type="text" name="addressDetail"
                     value="${OwnerShared.escapeHtml(detail?.addressDetail ?? '')}"
                     placeholder="상세 주소" required />
            </div>
          </div>
          <div class="store-detail-meta">
            <span class="status-pill ${pillCls}">${OwnerShared.statusLabel(status)}</span>
          </div>
        </header>

        <div class="store-stat-grid">
          <div class="store-stat">
            <p class="store-stat-label">최소 주문 (원)</p>
            <input class="store-stat-input" type="number" name="minOrderAmount" min="0"
                   value="${Number(detail?.minOrderAmount ?? 0)}" required />
          </div>
          <div class="store-stat">
            <p class="store-stat-label">평균 조리 (분)</p>
            <input class="store-stat-input" type="number" name="requiredTimeMinutes" min="1"
                   value="${Number(detail?.requiredTimeMinutes ?? 30)}" required />
          </div>
          <div class="store-stat">
            <p class="store-stat-label">오픈 시간</p>
            <input class="store-stat-input" type="time" name="openTime"
                   value="${OwnerShared.escapeHtml(detail?.openTime ?? '10:00')}" required />
          </div>
          <div class="store-stat">
            <p class="store-stat-label">마감 시간</p>
            <input class="store-stat-input" type="time" name="closeTime"
                   value="${OwnerShared.escapeHtml(detail?.closeTime ?? '22:00')}" required />
          </div>
          <div class="store-stat">
            <p class="store-stat-label">위도 (선택)</p>
            <input class="store-stat-input" type="number" step="any" name="latitude"
                   value="${detail?.latitude ?? ''}" placeholder="37.49" />
          </div>
          <div class="store-stat">
            <p class="store-stat-label">경도 (선택)</p>
            <input class="store-stat-input" type="number" step="any" name="longitude"
                   value="${detail?.longitude ?? ''}" placeholder="126.97" />
          </div>
        </div>

        <div class="store-edit-bar">
          <p data-edit-msg class="store-edit-msg" hidden></p>
          <div class="store-edit-actions">
            <button type="button" class="btn-outline-sm" data-act="edit-cancel">취소</button>
            <button type="submit" class="btn-primary store-edit-save">저장</button>
          </div>
        </div>
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
        const detail = state.detailsById.get(String(storeId)) || {}
        const storeStat = { storeId, storeName: detail.name ?? '가게', totalCount: 0 }
        const viewBox = card.querySelector('[data-view]')
        viewBox.innerHTML = renderEditBody(storeStat, detail)
        bindEditHandlers(card, storeId, storeStat, detail)
      })
    })

    document.querySelectorAll('[data-act="close-store"]').forEach((btn) => {
      btn.addEventListener('click', () => handleCloseStore(btn))
    })

    document.querySelectorAll('[data-act="reopen-store"]').forEach((btn) => {
      btn.addEventListener('click', () => handleReopenStore(btn))
    })
  }

  async function handleCloseStore(btn) {
    const card = btn.closest('[data-store-id]')
    const storeId = card?.dataset.storeId
    if (!storeId) return
    const detail = state.detailsById.get(String(storeId)) || {}
    const storeName = detail?.name ?? '이 가게'
    const expected = String(storeName).trim()
    const typed = prompt(`계속하려면 가게명을 정확히 입력하세요:\n${expected}`)
    if (typed == null) return
    if (typed.trim() !== expected) {
      alert('입력한 가게명이 일치하지 않아 취소되었습니다.')
      return
    }

    btn.disabled = true
    try {
      await api.stores.close(storeId)
      alert('가게가 폐업 처리되었습니다. 사이드바에서 「폐업」 표시로 남아 있어요.')
      await loadStores()
    } catch (e) {
      alert(OwnerShared.errorMessage(e, '가게 폐업에 실패했습니다.'))
      btn.disabled = false
    }
  }

  async function handleReopenStore(btn) {
    const card = btn.closest('[data-store-id]')
    const storeId = card?.dataset.storeId
    if (!storeId) return
    if (!confirm('이 가게를 다시 열까요? 영업 상태는 「준비 중」으로 설정됩니다.')) return

    btn.disabled = true
    try {
      await api.stores.reopen(storeId)
      alert('가게가 재오픈되었습니다.')
      await loadStores()
    } catch (e) {
      alert(OwnerShared.errorMessage(e, '재오픈에 실패했습니다.'))
      btn.disabled = false
    }
  }

  function bindEditHandlers(card, storeId, storeStat, detail) {
    const form = card.querySelector('[data-edit-form]')
    if (!form) return

    form.addEventListener('submit', (e) => handleEdit(e, storeId, card))
    card.querySelector('[data-act="edit-cancel"]').addEventListener('click', () => loadStores())

    // 대표 이미지 URL 미리보기 갱신
    const urlInput = card.querySelector('[data-act="thumb-url"]')
    const thumbWrap = card.querySelector('.store-detail-thumb-edit .store-detail-thumb')
    if (urlInput && thumbWrap) {
      urlInput.addEventListener('input', () => {
        const v = (urlInput.value || '').trim()
        thumbWrap.classList.remove('is-broken')
        if (v) {
          thumbWrap.classList.remove('store-detail-thumb--placeholder')
          thumbWrap.innerHTML = `<img src="${OwnerShared.escapeHtml(v)}" alt="" onerror="this.parentNode.classList.add('is-broken')"/>`
        } else {
          thumbWrap.classList.add('store-detail-thumb--placeholder')
          thumbWrap.innerHTML = '<i class="ti ti-building-store" aria-hidden="true"></i>'
        }
      })
    }

    // 다음(카카오) 우편번호 — 주소 검색
    const addressSearchBtn = card.querySelector('[data-act="address-search"]')
    if (addressSearchBtn) {
      addressSearchBtn.addEventListener('click', () => openAddressSearch(card))
    }
  }

  function openAddressSearch(card) {
    if (typeof daum === 'undefined' || !daum.Postcode) {
      alert('주소 검색 스크립트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      return
    }
    const addressInput = card.querySelector('input[name="address"]')
    const detailInput = card.querySelector('input[name="addressDetail"]')
    const latInput = card.querySelector('input[name="latitude"]')
    const lngInput = card.querySelector('input[name="longitude"]')
    new daum.Postcode({
      oncomplete(data) {
        const picked = data.roadAddress || data.jibunAddress || data.address || ''
        if (addressInput) addressInput.value = picked
        if (detailInput) {
          detailInput.value = ''
          detailInput.focus()
        }
        if (picked) fillCoordinates(picked, latInput, lngInput)
      },
    }).open()
  }

  /**
   * 백엔드 프록시(`GET /api/owner/geocode`)로 주소→좌표 변환을 호출해서
   * 위도/경도 input 을 자동으로 채웁니다.
   * - 카카오 REST API 키는 서버(application.yml) 에만 보관됩니다.
   */
  async function fillCoordinates(address, latInput, lngInput) {
    if (!latInput || !lngInput) return
    try {
      const result = await api.stores.ownerGeocode(address)
      if (Number.isFinite(result?.latitude)) latInput.value = result.latitude
      if (Number.isFinite(result?.longitude)) lngInput.value = result.longitude
    } catch (e) {
      console.warn('[geocode] failed:', OwnerShared.errorMessage(e, 'geocode 실패'))
    }
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

  function showMsg(el, text, isError) {
    el.hidden = false
    el.textContent = text
    el.style.color = isError ? 'var(--color-cancel)' : 'var(--color-delivering)'
    el.style.borderColor = isError ? 'var(--color-cancel)' : 'var(--color-delivering)'
  }
})()
