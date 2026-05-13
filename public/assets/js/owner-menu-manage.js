/**
 * 메뉴 관리 페이지
 * - 가게 선택 → GET /api/stores/{id} 의 menus 사용
 * - POST   /api/owner/stores/{id}/menus            (메뉴 추가)
 * - PUT    /api/owner/stores/{id}/menus/{menuId}   (메뉴 수정)
 * - DELETE /api/owner/stores/{id}/menus/{menuId}   (메뉴 삭제)
 */
;(function () {
  'use strict'

  const state = { storeId: null, menusById: new Map() }

  document.addEventListener('DOMContentLoaded', init)

  async function init() {
    const ctx = await OwnerShared.bootstrap()
    if (!ctx) return

    const list = ctx.storeList || []
    const scope = OwnerShared.ensureOwnerStoreScope(list, 'owner-menu-manage.html')
    if (!scope.success) return

    if (scope.store) {
      state.storeId = String(scope.store.storeId)
      const titleEl = document.querySelector('.page-title')
      if (titleEl) titleEl.textContent = `메뉴 관리 · ${scope.store.storeName ?? '가게'}`
    } else {
      state.storeId = null
    }

    document.getElementById('btnRefresh').addEventListener('click', () => state.storeId && loadMenus())
    document.getElementById('newMenuForm').addEventListener('submit', handleCreate)
    document.getElementById('newMenuImageFile').addEventListener('change', handleImageFileSelected)
    document.getElementById('newMenuImageClear').addEventListener('click', clearImageUrl)

    if (state.storeId) {
      await loadMenus()
    } else {
      document.getElementById('menuEmpty').hidden = false
      document.getElementById('menuEmpty').textContent =
        '먼저 가게를 등록해 주세요. (가게 관리 페이지)'
    }
  }

  async function loadMenus() {
    const listEl = document.getElementById('menuList')
    const emptyEl = document.getElementById('menuEmpty')
    listEl.innerHTML = '<p class="empty-state">불러오는 중…</p>'
    emptyEl.hidden = true

    try {
      // 폐업 가게도 접근 가능하도록 owner 전용 detail 사용 (실패 시 공개 detail 폴백)
      const detail = await api.stores.ownerDetail(state.storeId).catch(() => api.stores.detail(state.storeId))
      const menus = Array.isArray(detail?.menus) ? detail.menus : []
      state.menusById.clear()
      menus.forEach((m) => state.menusById.set(String(m.id), m))
      if (menus.length === 0) {
        listEl.innerHTML = ''
        emptyEl.hidden = false
        emptyEl.textContent = '등록된 메뉴가 없어요. 아래에서 새 메뉴를 추가해 주세요.'
        return
      }
      listEl.innerHTML = menus.map(renderRow).join('')
      attachRowHandlers()
    } catch (e) {
      listEl.innerHTML = `<p class="empty-state" style="color:var(--color-cancel)">${OwnerShared.escapeHtml(
        OwnerShared.errorMessage(e, '메뉴를 불러오지 못했습니다.'),
      )}</p>`
    }
  }

  function renderRow(m) {
    const desc = m.menuDescription ?? m.description ?? ''
    const img = m.imageUrl ?? m.imgUrl ?? ''
    const thumb = img
      ? `<img class="menu-item-thumb" src="${OwnerShared.escapeHtml(img)}" alt="" onerror="this.style.display='none'"/>`
      : `<div class="menu-item-thumb menu-item-thumb--placeholder"><i class="ti ti-photo" aria-hidden="true"></i></div>`
    return `
      <div class="menu-item-row" data-menu-id="${m.id}">
        ${thumb}
        <div>
          <p class="menu-item-name">${OwnerShared.escapeHtml(m.name)}</p>
          ${desc ? `<p class="menu-item-desc">${OwnerShared.escapeHtml(desc)}</p>` : ''}
        </div>
        <span class="menu-item-price">${OwnerShared.formatWon(m.price)}</span>
        <button type="button" class="btn-outline-sm" data-act="edit">수정</button>
        <button type="button" class="btn-outline-sm is-danger" data-act="remove">삭제</button>
      </div>
    `
  }

  function attachRowHandlers() {
    document.querySelectorAll('.menu-item-row [data-act]').forEach((btn) => {
      const row = btn.closest('.menu-item-row')
      const menuId = row?.dataset.menuId
      btn.addEventListener('click', () => {
        const act = btn.dataset.act
        if (act === 'edit') enterEditMode(menuId, row)
        else if (act === 'remove') handleRemove(menuId)
        else if (act === 'edit-cancel') exitEditMode(menuId, row)
        else if (act === 'edit-save') handleSaveEdit(menuId, row)
        else if (act === 'edit-clear-image') clearRowImage(row)
      })
    })
    document.querySelectorAll('.menu-item-row [data-act="edit-image"]').forEach((input) => {
      input.addEventListener('change', (e) => handleRowImageSelected(e, input.closest('.menu-item-row')))
    })
  }

  async function handleRemove(menuId) {
    if (!menuId || !state.storeId) return
    if (!confirm('이 메뉴를 삭제할까요?')) return
    try {
      await api.menus.remove(state.storeId, menuId)
      await loadMenus()
    } catch (e) {
      alert(OwnerShared.errorMessage(e, '메뉴 삭제 실패'))
    }
  }

  /* ---------------- 인라인 수정 ---------------- */

  function enterEditMode(menuId, row) {
    const menu = state.menusById.get(String(menuId))
    if (!menu) return
    row.outerHTML = renderEditRow(menu)
    attachRowHandlers()
  }

  function exitEditMode(menuId, row) {
    const menu = state.menusById.get(String(menuId))
    if (!menu) return
    row.outerHTML = renderRow(menu)
    attachRowHandlers()
  }

  function renderEditRow(m) {
    const desc = m.menuDescription ?? m.description ?? ''
    const img = m.imageUrl ?? m.imgUrl ?? ''
    const thumb = img
      ? `<img class="menu-item-thumb" data-thumb src="${OwnerShared.escapeHtml(img)}" alt="" onerror="this.style.display='none'"/>`
      : `<div class="menu-item-thumb menu-item-thumb--placeholder" data-thumb><i class="ti ti-photo" aria-hidden="true"></i></div>`
    return `
      <div class="menu-item-row is-editing" data-menu-id="${m.id}">
        ${thumb}
        <div class="menu-edit-fields">
          <input class="menu-edit-input" type="text" data-field="name"
                 value="${OwnerShared.escapeHtml(m.name ?? '')}" placeholder="메뉴명" required />
          <textarea class="menu-edit-input menu-edit-desc" data-field="menuDescription"
                    placeholder="설명 (선택)">${OwnerShared.escapeHtml(desc)}</textarea>
          <div class="menu-edit-image-row">
            <input type="file" accept="image/*" data-act="edit-image" />
            <button type="button" class="btn-outline-sm" data-act="edit-clear-image">이미지 제거</button>
            <input class="menu-edit-input menu-edit-image-url" type="text" data-field="imageUrl"
                   value="${OwnerShared.escapeHtml(img)}" placeholder="이미지 주소" readonly />
          </div>
          <p class="menu-edit-msg" data-edit-msg hidden></p>
        </div>
        <div class="menu-edit-price-cell">
          <input class="menu-edit-input menu-edit-price" type="number" min="0" data-field="price"
                 value="${Number(m.price ?? 0)}" required />
          <span class="menu-edit-price-unit">원</span>
        </div>
        <button type="button" class="btn-outline-sm" data-act="edit-save">저장</button>
        <button type="button" class="btn-outline-sm" data-act="edit-cancel">취소</button>
      </div>
    `
  }

  async function handleSaveEdit(menuId, row) {
    if (!menuId || !state.storeId) return
    const name = row.querySelector('[data-field="name"]')?.value.trim() ?? ''
    const priceStr = row.querySelector('[data-field="price"]')?.value ?? ''
    const desc = row.querySelector('[data-field="menuDescription"]')?.value.trim() ?? ''
    const imageUrl = row.querySelector('[data-field="imageUrl"]')?.value.trim() ?? ''
    const msgEl = row.querySelector('[data-edit-msg]')

    if (!name) return showRowMsg(msgEl, '메뉴명을 입력해 주세요.', true)
    const price = Number(priceStr)
    if (!Number.isFinite(price) || price < 0) return showRowMsg(msgEl, '가격을 올바르게 입력해 주세요.', true)

    const saveBtn = row.querySelector('[data-act="edit-save"]')
    saveBtn.disabled = true
    try {
      await api.menus.update(state.storeId, menuId, {
        name,
        price,
        menuDescription: desc,
        imageUrl,
      })
      await loadMenus()
    } catch (e) {
      showRowMsg(msgEl, OwnerShared.errorMessage(e, '메뉴 수정 실패'), true)
    } finally {
      saveBtn.disabled = false
    }
  }

  async function handleRowImageSelected(e, row) {
    const fileInput = e.currentTarget
    const file = fileInput.files?.[0]
    if (!file || !row) return
    const urlInput = row.querySelector('[data-field="imageUrl"]')
    const msgEl = row.querySelector('[data-edit-msg]')

    if (!file.type.startsWith('image/')) {
      showRowMsg(msgEl, '이미지 파일만 업로드할 수 있어요.', true)
      fileInput.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showRowMsg(msgEl, '5MB 이하 파일만 업로드할 수 있어요.', true)
      fileInput.value = ''
      return
    }

    showRowMsg(msgEl, '업로드 중…', false)
    try {
      const res = await api.uploads.image(file)
      urlInput.value = res?.url ?? ''
      const thumb = row.querySelector('[data-thumb]')
      if (thumb && res?.url) {
        const safe = OwnerShared.escapeHtml(res.url)
        thumb.outerHTML = `<img class="menu-item-thumb" data-thumb src="${safe}" alt=""/>`
      }
      showRowMsg(msgEl, '이미지 업로드 완료. 저장을 눌러 적용하세요.', false)
    } catch (err) {
      showRowMsg(msgEl, OwnerShared.errorMessage(err, '업로드 실패'), true)
      fileInput.value = ''
    }
  }

  function clearRowImage(row) {
    const urlInput = row.querySelector('[data-field="imageUrl"]')
    const fileInput = row.querySelector('[data-act="edit-image"]')
    const thumb = row.querySelector('[data-thumb]')
    if (urlInput) urlInput.value = ''
    if (fileInput) fileInput.value = ''
    if (thumb) {
      thumb.outerHTML = `<div class="menu-item-thumb menu-item-thumb--placeholder" data-thumb><i class="ti ti-photo" aria-hidden="true"></i></div>`
    }
  }

  function showRowMsg(el, text, isError) {
    if (!el) return
    el.hidden = false
    el.textContent = text
    el.style.color = isError ? 'var(--color-cancel)' : 'var(--color-delivering)'
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!state.storeId) {
      alert('대상 가게를 먼저 선택해 주세요.')
      return
    }
    const form = e.currentTarget
    const msgEl = document.getElementById('newMenuMsg')
    msgEl.hidden = true

    const data = Object.fromEntries(new FormData(form).entries())
    const payload = {
      name: data.name?.trim(),
      price: Number(data.price),
      menuDescription: data.menuDescription?.trim() ?? '',
      imageUrl: data.imageUrl?.trim() ?? '',
    }

    const submit = form.querySelector('button[type="submit"]')
    submit.disabled = true
    try {
      await api.menus.create(state.storeId, payload)
      showMsg(msgEl, '메뉴가 추가되었습니다.', false)
      form.reset()
      clearImageUrl()
      await loadMenus()
    } catch (err) {
      showMsg(msgEl, OwnerShared.errorMessage(err, '메뉴 추가 실패'), true)
    } finally {
      submit.disabled = false
    }
  }

  async function handleImageFileSelected(e) {
    const fileInput = e.currentTarget
    const file = fileInput.files?.[0]
    const urlInput = document.getElementById('newMenuImageUrl')
    const hintEl = document.getElementById('newMenuImageMsg')
    if (!file) return

    if (!file.type.startsWith('image/')) {
      hintEl.textContent = '이미지 파일만 업로드할 수 있어요.'
      hintEl.style.color = 'var(--color-cancel)'
      fileInput.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      hintEl.textContent = '5MB 이하 파일만 업로드할 수 있어요.'
      hintEl.style.color = 'var(--color-cancel)'
      fileInput.value = ''
      return
    }

    hintEl.textContent = '업로드 중…'
    hintEl.style.color = 'var(--color-text-muted)'
    try {
      const res = await api.uploads.image(file)
      urlInput.value = res?.url ?? ''
      hintEl.textContent = '업로드 완료. 메뉴를 추가하면 이 이미지가 사용돼요.'
      hintEl.style.color = 'var(--color-delivering)'
    } catch (err) {
      hintEl.textContent = OwnerShared.errorMessage(err, '업로드 실패')
      hintEl.style.color = 'var(--color-cancel)'
      fileInput.value = ''
    }
  }

  function clearImageUrl() {
    const fileInput = document.getElementById('newMenuImageFile')
    const urlInput = document.getElementById('newMenuImageUrl')
    const hintEl = document.getElementById('newMenuImageMsg')
    if (fileInput) fileInput.value = ''
    if (urlInput) urlInput.value = ''
    if (hintEl) {
      hintEl.textContent = '파일을 선택하면 서버에 업로드되고 주소가 자동으로 채워져요.'
      hintEl.style.color = 'var(--color-text-muted)'
    }
  }

  function showMsg(el, text, isError) {
    el.hidden = false
    el.textContent = text
    el.style.color = isError ? 'var(--color-cancel)' : 'var(--color-delivering)'
    el.style.borderColor = isError ? 'var(--color-cancel)' : 'var(--color-delivering)'
  }
})()
