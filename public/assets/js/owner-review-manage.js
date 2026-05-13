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

    const list = ctx.storeList || []
    const scope = OwnerShared.ensureOwnerStoreScope(list, 'owner-review-manage.html')
    if (!scope.success) return

    if (scope.store) {
      state.storeId = String(scope.store.storeId)
      const titleEl = document.querySelector('.page-title')
      if (titleEl) titleEl.textContent = `리뷰 관리 · ${scope.store.storeName ?? '가게'}`
    } else {
      state.storeId = null
    }

    document.getElementById('btnRefresh').addEventListener('click', () => state.storeId && loadReviews())

    if (state.storeId) {
      await loadReviews()
    } else {
      document.getElementById('reviewEmpty').hidden = false
      document.getElementById('reviewEmpty').textContent = '먼저 가게를 등록해 주세요.'
    }
  }

  async function loadReviews() {
    const listEl = document.getElementById('reviewList')
    const emptyEl = document.getElementById('reviewEmpty')
    listEl.innerHTML = '<p class="empty-state">불러오는 중…</p>'
    emptyEl.hidden = true

    try {
      // 리뷰 목록은 비로그인 API 라 폐업 가게면 404 가능 — 그 경우 빈 목록으로 처리
      const page = await api.reviews
        .listByStore(state.storeId, { page: 0, size: 30 })
        .catch((err) => (err?.status === 404 ? { content: [] } : Promise.reject(err)))
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
          <span class="review-card-date">${OwnerShared.escapeHtml(dateText)}</span>
          <button type="button" class="btn-outline-sm is-danger review-card-remove" data-act="remove">
            <i class="ti ti-trash" aria-hidden="true"></i> 리뷰 삭제
          </button>
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

    document.querySelectorAll('[data-act="remove"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const card = btn.closest('.review-card')
        const reviewId = card?.dataset.reviewId
        if (!reviewId) return
        if (!confirm('이 리뷰를 삭제할까요? 한 번 삭제하면 복구할 수 없어요.')) return
        btn.disabled = true
        try {
          await api.reviews.ownerRemove(reviewId)
          await loadReviews()
        } catch (e) {
          alert(OwnerShared.errorMessage(e, '리뷰 삭제 실패'))
          btn.disabled = false
        }
      })
    })
  }
})()
