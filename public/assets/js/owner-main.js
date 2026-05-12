/**
 * 사장 메인 대시보드 연동
 * - 오늘 주문 합계 (GET /api/owner/orders/stats/today)
 * - 가게 정보 + 영업 상태 토글 (GET /api/owner/orders/stats/today/stores, GET /api/stores/{id}, PATCH /api/owner/stores/{id}/status)
 *
 * 명세서의 상태별(신규/조리중/배달중/배달완료/주문거절) 카운트는 현재 백엔드가 합계만 반환하므로
 * 합계는 카드 부제에 표시하고, 상태별 항목은 "—"(미지원)로 표시합니다.
 */
;(function () {
  'use strict'

  document.addEventListener('DOMContentLoaded', init)

  async function init() {
    const subtitleEl = document.getElementById('todaySummaryTotal')
    const titleEl = document.getElementById('storeStatusTitle')
    const labelEl = document.getElementById('storeStatusLabel')
    const inputEl = document.getElementById('storeStatusInput')
    const cardEl = document.getElementById('storeStatusCard')

    if (!window.api) {
      subtitleEl.textContent = 'API 스크립트를 불러오지 못했습니다.'
      return
    }

    if (!api.auth.isLoggedIn()) {
      subtitleEl.textContent = '로그인이 필요합니다.'
      titleEl.textContent = '로그인이 필요합니다'
      labelEl.textContent = '카카오 로그인 후 사용해 주세요'
      return
    }

    const [totalRes, storesRes] = await Promise.allSettled([
      api.orders.owner.todayStats(),
      api.orders.owner.todayStatsByStore(),
    ])

    if (totalRes.status === 'fulfilled') {
      const total = totalRes.value && typeof totalRes.value.totalCount === 'number' ? totalRes.value.totalCount : 0
      subtitleEl.textContent = `총 ${total.toLocaleString('ko-KR')}건`
    } else {
      subtitleEl.textContent = errorMessage(totalRes.reason, '통계를 불러올 수 없습니다.')
    }

    const storeList = storesRes.status === 'fulfilled' && Array.isArray(storesRes.value) ? storesRes.value : []
    renderSidebar(storeList)
    await renderStoreCard(storeList, { cardEl, titleEl, labelEl, inputEl })

    inputEl.addEventListener('change', () => handleToggle({ cardEl, inputEl, labelEl }))
  }

  /* ----------------- 사이드바 ----------------- */
  function renderSidebar(storeList) {
    const sidebar = document.querySelector('aside.sidebar')
    if (!sidebar) return

    if (storeList.length === 0) {
      sidebar.innerHTML = `
        <div class="sidebar-group" data-collapsed="false">
          <div class="sidebar-group-label">내 가게 없음</div>
        </div>
      `
      return
    }

    const currentPage = currentPageFile()

    sidebar.innerHTML = storeList
      .map((store, i) => {
        const isFirst = i === 0
        const collapsed = isFirst ? 'false' : 'true'
        return `
          <div class="sidebar-group" data-collapsed="${collapsed}" data-store-id="${store.storeId}">
            <div class="sidebar-group-label" role="button" tabindex="0" aria-expanded="${isFirst}">
              <i class="ti ti-chevron-right" aria-hidden="true"></i>
              <span class="sidebar-group-name">${escapeHtml(store.storeName ?? '가게')}</span>
            </div>
            <ul class="sidebar-nav">
              <li><a href="./owner-main.html"${activeAttr('owner-main.html', currentPage, isFirst)}>대시보드</a></li>
              <li><a href="#">가게 관리</a></li>
              <li><a href="./owner-order-manage.html"${activeAttr('owner-order-manage.html', currentPage, false)}>주문 관리</a></li>
              <li><a href="#">리뷰 관리</a></li>
              <li><a href="#">메뉴 관리</a></li>
            </ul>
          </div>
        `
      })
      .join('')

    sidebar.querySelectorAll('.sidebar-group-label').forEach((label) => {
      label.addEventListener('click', () => toggleGroup(label))
      label.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggleGroup(label)
        }
      })
    })
  }

  function activeAttr(href, currentPage, isFirstGroup) {
    return href === currentPage && isFirstGroup ? ' class="is-active"' : ''
  }

  function currentPageFile() {
    const last = window.location.pathname.split('/').filter(Boolean).pop()
    return last || ''
  }

  function toggleGroup(label) {
    const group = label.closest('.sidebar-group')
    if (!group) return
    const collapsed = group.dataset.collapsed === 'true'
    group.dataset.collapsed = collapsed ? 'false' : 'true'
    label.setAttribute('aria-expanded', String(collapsed))
  }

  /* ----------------- 가게 영업 상태 카드 ----------------- */
  async function renderStoreCard(storeList, { cardEl, titleEl, labelEl, inputEl }) {
    if (storeList.length === 0) {
      titleEl.textContent = '등록된 가게가 없습니다'
      labelEl.textContent = '먼저 가게를 등록해 주세요'
      return
    }

    const first = storeList[0]
    cardEl.dataset.storeId = String(first.storeId)
    titleEl.textContent = first.storeName ?? '가게'

    try {
      const detail = await api.stores.detail(first.storeId)
      applyStatusToToggle(detail.status, { inputEl, labelEl })
    } catch (e) {
      labelEl.textContent = errorMessage(e, '영업 상태를 불러올 수 없습니다.')
      inputEl.checked = false
      inputEl.disabled = true
    }
  }

  function applyStatusToToggle(status, { inputEl, labelEl }) {
    const isOpen = status === 'OPEN'
    inputEl.checked = isOpen
    inputEl.disabled = false
    labelEl.textContent = statusLabel(status)
  }

  function statusLabel(status) {
    switch (status) {
      case 'OPEN':
        return '영업 중'
      case 'CLOSE':
        return '영업 종료'
      case 'PREPARING':
        return '준비 중'
      default:
        return '영업 상태'
    }
  }

  /* ----------------- 토글 변경 ----------------- */
  async function handleToggle({ cardEl, inputEl, labelEl }) {
    const storeId = cardEl.dataset.storeId
    if (!storeId) return

    const nextStatus = inputEl.checked ? 'OPEN' : 'CLOSE'
    inputEl.disabled = true
    try {
      await api.stores.updateStatus(storeId, nextStatus)
      labelEl.textContent = statusLabel(nextStatus)
    } catch (e) {
      window.alert(errorMessage(e, '영업 상태를 바꾸지 못했습니다.'))
      inputEl.checked = !inputEl.checked
    } finally {
      inputEl.disabled = false
    }
  }

  /* ----------------- 유틸 ----------------- */
  function errorMessage(e, fallback) {
    if (!e) return fallback
    if (e.status === 401) return '로그인이 필요합니다.'
    if (e.status === 403) return '사장 권한이 필요합니다.'
    return e.message || fallback
  }

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
})()
