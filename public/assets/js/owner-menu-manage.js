/**
 * 메뉴 관리 페이지
 * - 가게 선택 → GET /api/stores/{id} 의 menus 사용
 * - POST   /api/owner/stores/{id}/menus            (메뉴 추가)
 * - PUT    /api/owner/stores/{id}/menus/{menuId}   (메뉴 수정)
 * - DELETE /api/owner/stores/{id}/menus/{menuId}   (메뉴 삭제)
 */
;(function () {
  'use strict'

  const state = { storeId: null }

  document.addEventListener('DOMContentLoaded', init)

  async function init() {
    const ctx = await OwnerShared.bootstrap()
    if (!ctx) return

    const select = document.getElementById('storeSelect')
    populateStoreSelect(select, ctx.storeList)
    select.addEventListener('change', () => {
      state.storeId = select.value || null
      if (state.storeId) loadMenus()
    })

    document.getElementById('btnRefresh').addEventListener('click', () => state.storeId && loadMenus())
    document.getElementById('newMenuForm').addEventListener('submit', handleCreate)

    if (ctx.storeList.length > 0) {
      state.storeId = String(ctx.storeList[0].storeId)
      select.value = state.storeId
      await loadMenus()
    } else {
      document.getElementById('menuEmpty').hidden = false
      document.getElementById('menuEmpty').textContent =
        '먼저 가게를 등록해 주세요. (가게 관리 페이지)'
    }
  }

  function populateStoreSelect(select, list) {
    if (!list || list.length === 0) {
      select.innerHTML = '<option value="">가게 없음</option>'
      select.disabled = true
      return
    }
    select.disabled = false
    select.innerHTML = list
      .map(
        (s) =>
          `<option value="${s.storeId}">${OwnerShared.escapeHtml(s.storeName ?? '가게')}</option>`,
      )
      .join('')
  }

  async function loadMenus() {
    const listEl = document.getElementById('menuList')
    const emptyEl = document.getElementById('menuEmpty')
    listEl.innerHTML = '<p class="empty-state">불러오는 중…</p>'
    emptyEl.hidden = true

    try {
      const detail = await api.stores.detail(state.storeId)
      const menus = Array.isArray(detail?.menus) ? detail.menus : []
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
    return `
      <div class="menu-item-row" data-menu-id="${m.id}">
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
      btn.addEventListener('click', () =>
        btn.dataset.act === 'edit' ? handleEdit(menuId, row) : handleRemove(menuId),
      )
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

  async function handleEdit(menuId, row) {
    if (!menuId || !state.storeId) return
    const currentName = row.querySelector('.menu-item-name')?.textContent ?? ''
    const currentPriceText = row.querySelector('.menu-item-price')?.textContent ?? '0'
    const currentPrice = Number(currentPriceText.replace(/[^\d]/g, '')) || 0
    const currentDesc = row.querySelector('.menu-item-desc')?.textContent ?? ''

    const name = prompt('메뉴명', currentName)
    if (name == null) return
    const priceStr = prompt('가격(원)', String(currentPrice))
    if (priceStr == null) return
    const desc = prompt('설명 (선택)', currentDesc) ?? ''

    try {
      await api.menus.update(state.storeId, menuId, {
        name: name.trim(),
        price: Number(priceStr),
        menuDescription: desc.trim(),
      })
      await loadMenus()
    } catch (e) {
      alert(OwnerShared.errorMessage(e, '메뉴 수정 실패'))
    }
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
      menuDescription: data.menuDescription?.trim() || null,
      imageUrl: data.imageUrl?.trim() || null,
    }

    const submit = form.querySelector('button[type="submit"]')
    submit.disabled = true
    try {
      await api.menus.create(state.storeId, payload)
      showMsg(msgEl, '메뉴가 추가되었습니다.', false)
      form.reset()
      await loadMenus()
    } catch (err) {
      showMsg(msgEl, OwnerShared.errorMessage(err, '메뉴 추가 실패'), true)
    } finally {
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
