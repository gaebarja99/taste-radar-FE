/**
 * 리뷰 관리 페이지
 * - GET  /api/stores/{id}/reviews
 * - POST /api/owner/reviews/{reviewId}/reply
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
      if (state.storeId) loadReviews()
    })
    document.getElementById('btnRefresh').addEventListener('click', () => state.storeId && loadReviews())

    if (ctx.storeList.length > 0) {
      state.storeId = String(ctx.storeList[0].storeId)
      select.value = state.storeId
      await loadReviews()
    } else {
      document.getElementById('reviewEmpty').hidden = false
      document.getElementById('reviewEmpty').textContent = '먼저 가게를 등록해 주세요.'
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
      .map((s) => `<option value="${s.storeId}">${OwnerShared.escapeHtml(s.storeName ?? '가게')}</option>`)
      .join('')
  }

  async function loadReviews() {
    const listEl = document.getElementById('reviewList')
    const emptyEl = document.getElementById('reviewEmpty')
    listEl.innerHTML = '<p class="empty-state">불러오는 중…</p>'
    emptyEl.hidden = true

    try {
      const page = await api.reviews.listByStore(state.storeId, { page: 0, size: 30 })
      const items = Array.isArray(page?.content) ? page.content : []
      if (items.length === 0) {
        listEl.innerHTML = ''
        emptyEl.hidden = false
        return
      }
      listEl.innerHTML = items.map(renderCard).join('')
      attachHandlers()
    } catch (e) {
      listEl.innerHTML = `<p class="empty-state" style="color:var(--color-cancel)">${OwnerShared.escapeHtml(
        OwnerShared.errorMessage(e, '리뷰를 불러오지 못했습니다.'),
      )}</p>`
    }
  }

  function renderCard(r) {
    const rating = Number(r.rating ?? r.score ?? 0)
    const stars = rating > 0 ? '★'.repeat(Math.round(rating)) : '—'
    const writer = r.writerNickname ?? r.nickname ?? r.userName ?? '익명'
    const createdAt = r.createdAt ?? r.created_at ?? null
    const dateText = createdAt ? new Date(createdAt).toLocaleString('ko-KR') : ''
    const ownerReply = r.ownerReply ?? r.reply ?? null

    return `
      <article class="review-card" data-review-id="${r.id}">
        <div class="review-card-head">
          <strong>${OwnerShared.escapeHtml(writer)}</strong>
          <span class="review-card-rating">${stars} ${rating ? rating.toFixed(1) : ''}</span>
          <span>${OwnerShared.escapeHtml(dateText)}</span>
        </div>
        <p class="review-card-body">${OwnerShared.escapeHtml(r.content ?? r.review ?? '')}</p>
        ${
          ownerReply
            ? `<div class="review-reply"><strong>사장님 답글</strong>${OwnerShared.escapeHtml(ownerReply)}</div>`
            : `<div class="reply-form" style="display:flex;gap:6px">
                 <input type="text" class="field-select" data-reply-input placeholder="답글을 입력하세요" style="flex:1;height:36px;padding:0 12px"/>
                 <button type="button" class="btn-outline-sm" data-act="reply">답글 등록</button>
               </div>`
        }
      </article>
    `
  }

  function attachHandlers() {
    document.querySelectorAll('[data-act="reply"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const card = btn.closest('.review-card')
        const reviewId = card?.dataset.reviewId
        const input = card?.querySelector('[data-reply-input]')
        const text = input?.value.trim()
        if (!reviewId || !text) {
          alert('답글 내용을 입력하세요.')
          return
        }
        btn.disabled = true
        try {
          await api.reviews.ownerReply(reviewId, text)
          await loadReviews()
        } catch (e) {
          alert(OwnerShared.errorMessage(e, '답글 등록 실패'))
        } finally {
          btn.disabled = false
        }
      })
    })
  }
})()
