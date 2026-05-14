/**
 * 리뷰 UI 공통 — 별점, 오각형 맛 입력/표시
 */
;(function () {
  'use strict'

  const TASTE_FIELDS = [
    { key: 'sweetness', label: '단맛' },
    { key: 'saltiness', label: '짠맛' },
    { key: 'sourness', label: '신맛' },
    { key: 'bitterness', label: '쓴맛' },
    { key: 'umami', label: '감칠맛' },
  ]

  const TASTE_SPECIALTY_KEYS = [
    { key: 'sweet', label: '단맛' },
    { key: 'salty', label: '짠맛' },
    { key: 'sour', label: '신맛' },
    { key: 'bitter', label: '쓴맛' },
    { key: 'umami', label: '감칠맛' },
  ]

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function renderStars(rating, { interactive = false, name = 'rating' } = {}) {
    const n = Number(rating) || 0
    if (!interactive) {
      return `<span class="review-stars" aria-label="${n}점">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`
    }
    return `
      <div class="review-stars-input" data-star-group="${escapeHtml(name)}">
        ${[1, 2, 3, 4, 5]
          .map(
            (v) =>
              `<button type="button" class="review-star-btn${v <= n ? ' is-on' : ''}" data-star-val="${v}" aria-label="${v}점">★</button>`,
          )
          .join('')}
        <input type="hidden" name="${escapeHtml(name)}" value="${n || ''}" data-star-hidden required />
      </div>
    `
  }

  function bindStarInputs(root, name = 'rating') {
    const group = root.querySelector(`[data-star-group="${name}"]`)
    if (!group) return
    const hidden = group.querySelector('[data-star-hidden]')
    group.querySelectorAll('[data-star-val]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = Number(btn.dataset.starVal)
        hidden.value = String(val)
        group.querySelectorAll('[data-star-val]').forEach((b) => {
          b.classList.toggle('is-on', Number(b.dataset.starVal) <= val)
        })
      })
    })
  }

  function renderTasteSpecialtyInputs(taste = {}, { prefix = 'taste' } = {}) {
    return `
      <fieldset class="review-taste-fieldset">
        <legend class="review-taste-legend">이 음식에 특화된 맛 (복수 선택)</legend>
        <div class="taste-pick-grid">
          ${TASTE_SPECIALTY_KEYS.map(({ key, label }) => {
            const checked = !!taste[key]
            return `
              <label class="taste-pick-item">
                <input type="checkbox" name="${prefix}-${key}" data-taste-pref-key="${key}" ${checked ? 'checked' : ''} />
                <span>${label}</span>
              </label>`
          }).join('')}
        </div>
      </fieldset>
    `
  }

  function readTasteSpecialtyFromRoot(root, { prefix = 'taste' } = {}) {
    const taste = {}
    TASTE_SPECIALTY_KEYS.forEach(({ key }) => {
      const input = root.querySelector(`[name="${prefix}-${key}"], [data-taste-pref-key="${key}"]`)
      taste[key] = !!input?.checked
    })
    return taste
  }

  function hasAnyTasteSpecialty(taste) {
    if (!taste) return false
    return TASTE_SPECIALTY_KEYS.some(({ key }) => !!taste[key])
  }

  function distinctOrderMenus(items) {
    const seen = new Map()
    for (const item of items || []) {
      const menuId = Number(item.menuId)
      if (!Number.isFinite(menuId)) continue
      if (!seen.has(menuId)) {
        seen.set(menuId, { menuId, menuName: item.menuName || '메뉴' })
      }
    }
    return [...seen.values()]
  }

  function menuTasteSelectionMap(menuTastes) {
    const map = {}
    for (const mt of menuTastes || []) {
      const menuId = Number(mt.menuId)
      if (Number.isFinite(menuId) && mt.taste) map[menuId] = mt.taste
    }
    return map
  }

  function renderMenuTastePickers(menus, menuTastes = []) {
    const selected = menuTasteSelectionMap(menuTastes)
    const list = Array.isArray(menus) ? menus : []
    if (!list.length) {
      return '<p class="review-taste-empty muted">주문 메뉴를 불러오지 못했어요.</p>'
    }
    return `
      <fieldset class="review-taste-fieldset">
        <legend class="review-taste-legend">주문 메뉴별 특화 맛 (메뉴당 1개 필수)</legend>
        <div class="menu-taste-list">
          ${list
            .map(({ menuId, menuName }) => {
              const name = `menu-taste-${menuId}`
              return `
                <section class="menu-taste-row" data-menu-id="${menuId}">
                  <p class="menu-taste-name">${escapeHtml(menuName)}</p>
                  <div class="taste-pick-grid" role="radiogroup" aria-label="${escapeHtml(menuName)} 맛 선택">
                    ${TASTE_SPECIALTY_KEYS.map(({ key, label }) => {
                      const checked = selected[menuId] === key
                      return `
                        <label class="taste-pick-item">
                          <input type="radio" name="${name}" value="${key}" ${checked ? 'checked' : ''} required />
                          <span>${label}</span>
                        </label>`
                    }).join('')}
                  </div>
                </section>`
            })
            .join('')}
        </div>
      </fieldset>
    `
  }

  function readMenuTastesFromRoot(root) {
    const result = []
    root.querySelectorAll('.menu-taste-row[data-menu-id]').forEach((row) => {
      const menuId = Number(row.dataset.menuId)
      const checked = row.querySelector('input[type="radio"]:checked')
      if (Number.isFinite(menuId) && checked?.value) {
        result.push({ menuId, taste: checked.value })
      }
    })
    return result
  }

  function validateMenuTastes(menus, menuTastes) {
    const list = Array.isArray(menus) ? menus : []
    if (!list.length) return false
    if (!Array.isArray(menuTastes) || menuTastes.length !== list.length) return false
    const expected = new Set(list.map((m) => Number(m.menuId)))
    const seen = new Set()
    for (const mt of menuTastes) {
      const menuId = Number(mt.menuId)
      if (!expected.has(menuId) || seen.has(menuId) || !mt.taste) return false
      seen.add(menuId)
    }
    return seen.size === expected.size
  }

  function tasteLabel(key) {
    return TASTE_SPECIALTY_KEYS.find((t) => t.key === key)?.label ?? key
  }

  function renderMenuTasteSummary(menuTastes, fallbackTaste) {
    if (Array.isArray(menuTastes) && menuTastes.length) {
      return `
        <p class="review-menu-taste-summary" aria-label="메뉴별 특화 맛">
          ${menuTastes
            .map(
              (mt) =>
                `<span class="review-menu-taste-chip"><strong>${escapeHtml(mt.menuName ?? '메뉴')}</strong> ${escapeHtml(tasteLabel(mt.taste))}</span>`,
            )
            .join('')}
        </p>
      `
    }
    return renderTasteSpecialtyTags(fallbackTaste)
  }

  function renderTasteSpecialtyTags(taste) {
    if (!taste || !hasAnyTasteSpecialty(taste)) return ''
    const labels = TASTE_SPECIALTY_KEYS.filter(({ key }) => taste[key]).map(({ label }) => label)
    return `
      <p class="review-taste-tags" aria-label="특화 맛">
        ${labels.map((label) => `<span class="store-taste-tag">${escapeHtml(label)}</span>`).join('')}
      </p>
    `
  }

  /** @deprecated 리뷰 작성은 renderTasteSpecialtyInputs 사용 */
  function renderTasteInputs(taste = {}, opts = {}) {
    return renderTasteSpecialtyInputs(taste, opts)
  }

  function bindTasteInputs(root) {
    /* 체크박스는 별도 바인딩 불필요 */
  }

  function readTasteFromRoot(root, opts = {}) {
    return readTasteSpecialtyFromRoot(root, opts)
  }

  function renderTastePentagon(taste) {
    if (!taste) return ''
    return `
      <ul class="review-pentagon" aria-label="맛 오각형">
        ${TASTE_FIELDS.map(({ key, label }) => {
          const score = Number(taste[key] ?? 0)
          const pct = Math.min(100, Math.max(0, (score / 5) * 100))
          return `
            <li class="review-pentagon-row">
              <span class="review-pentagon-label">${label}</span>
              <span class="review-pentagon-bar"><i style="width:${pct}%"></i></span>
              <span class="review-pentagon-score">${score}/5</span>
            </li>`
        }).join('')}
      </ul>
    `
  }

  function readRatingFromRoot(root, name = 'rating') {
    const hidden = root.querySelector(`[data-star-group="${name}"] [data-star-hidden]`)
    if (hidden) return Number(hidden.value ?? 0)
    const checked = root.querySelector(`input[name="${name}"]:checked`)
    return Number(checked?.value ?? 0)
  }

  function hasAnyTastePreference(prefs) {
    if (!prefs) return false
    return !!(prefs.sweet || prefs.salty || prefs.sour || prefs.bitter || prefs.umami)
  }

  function tasteFromProfile(profile) {
    if (!profile) return null
    return {
      sweetness: Number(profile.sweetness ?? 0),
      saltiness: Number(profile.saltiness ?? 0),
      sourness: Number(profile.sourness ?? 0),
      bitterness: Number(profile.bitterness ?? 0),
      umami: Number(profile.umami ?? 0),
    }
  }

  function prefsToPentagon(prefs) {
    if (!prefs) return null
    return {
      sweetness: prefs.sweet ? 5 : 2,
      saltiness: prefs.salty ? 5 : 2,
      sourness: prefs.sour ? 5 : 2,
      bitterness: prefs.bitter ? 5 : 2,
      umami: prefs.umami ? 5 : 2,
    }
  }

  function hasTasteScores(taste) {
    if (!taste) return false
    return TASTE_FIELDS.some(({ key }) => Number(taste[key] ?? 0) > 0)
  }

  function radarPoint(cx, cy, radius, index, score, maxScore = 5) {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / TASTE_FIELDS.length
    const r = radius * (Math.max(0, Math.min(maxScore, score)) / maxScore)
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    }
  }

  function renderTasteRadarSvg(series, { size = 220, maxScore = 5 } = {}) {
    const cx = size / 2
    const cy = size / 2
    const radius = size * 0.34
    const gridLevels = [1, 2, 3, 4, 5]

    const gridPolygons = gridLevels
      .map((level) => {
        const pts = TASTE_FIELDS.map((_, i) => {
          const p = radarPoint(cx, cy, radius, i, level, maxScore)
          return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
        }).join(' ')
        return `<polygon points="${pts}" class="taste-radar-grid" />`
      })
      .join('')

    const axisLines = TASTE_FIELDS.map((_, i) => {
      const p = radarPoint(cx, cy, radius, i, maxScore, maxScore)
      return `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" class="taste-radar-axis" />`
    }).join('')

    const labels = TASTE_FIELDS.map(({ label }, i) => {
      const p = radarPoint(cx, cy, radius + 18, i, maxScore, maxScore)
      return `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" class="taste-radar-label" text-anchor="middle" dominant-baseline="middle">${label}</text>`
    }).join('')

    const polygons = (Array.isArray(series) ? series : [])
      .filter((s) => s && hasTasteScores(s.taste))
      .map((s) => {
        const pts = TASTE_FIELDS.map(({ key }, i) => {
          const p = radarPoint(cx, cy, radius, i, Number(s.taste[key] ?? 0), maxScore)
          return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
        }).join(' ')
        const cls = s.className || 'taste-radar-series'
        return `<polygon points="${pts}" class="${cls}" />`
      })
      .join('')

    return `
      <svg class="taste-radar-svg" viewBox="0 0 ${size} ${size}" role="img" aria-hidden="true">
        ${gridPolygons}
        ${axisLines}
        ${polygons}
        ${labels}
      </svg>
    `
  }

  function renderTasteRadarBlock(series, { title, subtitle, legend, size } = {}) {
    const legendHtml = Array.isArray(legend) && legend.length
      ? `<ul class="taste-radar-legend">${legend
          .map(
            (item) =>
              `<li><span class="taste-radar-legend-swatch ${escapeHtml(item.className || '')}"></span>${escapeHtml(item.label)}</li>`,
          )
          .join('')}</ul>`
      : ''

    return [
      '<div class="taste-radar-block">',
      title ? `<h3 class="taste-radar-title">${escapeHtml(title)}</h3>` : '',
      subtitle ? `<p class="taste-radar-subtitle">${escapeHtml(subtitle)}</p>` : '',
      '<div class="taste-radar-wrap">',
      renderTasteRadarSvg(series, { size }),
      legendHtml,
      '</div>',
      '</div>',
    ].join('')
  }

  function tasteBadgeClass(key) {
    const map = {
      sweetness: 'store-taste-tag--sweet',
      saltiness: 'store-taste-tag--salty',
      sourness: 'store-taste-tag--sour',
      bitterness: 'store-taste-tag--bitter',
      umami: 'store-taste-tag--umami',
      sweet: 'store-taste-tag--sweet',
      salty: 'store-taste-tag--salty',
      sour: 'store-taste-tag--sour',
      bitter: 'store-taste-tag--bitter',
    }
    return map[String(key)] || 'store-taste-tag--default'
  }

  function renderTasteMiniTags(highlights) {
    const items = Array.isArray(highlights) ? highlights : []
    if (!items.length) return ''
    return `
      <p class="store-taste-tags" aria-label="대표 맛">
        ${items
          .map(
            (h) =>
              `<span class="store-taste-tag ${tasteBadgeClass(h.key)}">${escapeHtml(h.label)}<strong>↑</strong></span>`,
          )
          .join('')}
      </p>
    `
  }

  window.ReviewUi = {
    TASTE_FIELDS,
    TASTE_SPECIALTY_KEYS,
    escapeHtml,
    renderStars,
    bindStarInputs,
    renderTasteInputs,
    renderTasteSpecialtyInputs,
    bindTasteInputs,
    readTasteFromRoot,
    readTasteSpecialtyFromRoot,
    renderTastePentagon,
    renderTasteSpecialtyTags,
    distinctOrderMenus,
    renderMenuTastePickers,
    readMenuTastesFromRoot,
    validateMenuTastes,
    renderMenuTasteSummary,
    tasteLabel,
    readRatingFromRoot,
    hasAnyTastePreference,
    hasAnyTasteSpecialty,
    tasteFromProfile,
    prefsToPentagon,
    hasTasteScores,
    renderTasteRadarSvg,
    renderTasteRadarBlock,
    renderTasteMiniTags,
  }
})()
