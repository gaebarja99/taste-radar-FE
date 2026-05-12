/**
 * 가게 관리 페이지
 * - 내 가게 목록 (todayStatsByStore + 각 가게 detail 병렬 로드)
 * - 영업 상태 변경 (PATCH /api/owner/stores/{id}/status) — PREPARING/OPEN/CLOSE
 * - 새 가게 등록 (POST /api/owner/stores)
 */
;(function () {
  'use strict'

  document.addEventListener('DOMContentLoaded', init)

  async function init() {
    const ctx = await OwnerShared.bootstrap()
    if (!ctx) return

    document.getElementById('btnRefresh').addEventListener('click', () => loadStores())
    document.getElementById('newStoreForm').addEventListener('submit', handleCreate)
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
        </div>
      </article>
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
  }

  /* --------------------- 새 가게 등록 --------------------- */
  async function handleCreate(e) {
    e.preventDefault()
    const form = e.currentTarget
    const msgEl = document.getElementById('newStoreMsg')
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

    try {
      const submit = form.querySelector('button[type="submit"]')
      submit.disabled = true
      const res = await api.stores.create(payload)
      showMsg(msgEl, `가게가 등록되었습니다. (id: ${res?.id ?? '-'})`, false)
      form.reset()
      await loadStores()
    } catch (err) {
      showMsg(msgEl, OwnerShared.errorMessage(err, '가게 등록에 실패했습니다.'), true)
    } finally {
      form.querySelector('button[type="submit"]').disabled = false
    }
  }

  function showMsg(el, text, isError) {
    el.hidden = false
    el.textContent = text
    el.style.color = isError ? 'var(--color-cancel)' : 'var(--color-delivering)'
    el.style.borderColor = isError ? 'var(--color-cancel)' : 'var(--color-delivering)'
  }
})()
