/**
 * ?? ?? ????
 */
;(function () {
  'use strict'

  const DAY_LABELS = ['\uc6d4', '\ud654', '\uc218', '\ubaa9', '\uae08', '\ud1a0', '\uc77c']

  /** PPT 캡처용: ?demo=1 또는 매출/별점 데이터가 없을 때 표시 */
  const DEMO_WEEKLY_AMOUNTS = [420_000, 385_000, 510_000, 478_000, 692_000, 845_000, 598_000]
  const DEMO_WEEKLY_COUNTS = [18, 15, 21, 19, 28, 34, 24]
  const DEMO_LAST_WEEK_TOTAL = 3_180_000
  const DEMO_RATING = {
    averageRating: 4.6,
    reviewCount: 128,
    fiveStarCount: 72,
    fourStarCount: 38,
    threeStarCount: 12,
    lowStarCount: 6,
  }

  document.addEventListener('DOMContentLoaded', init)

  async function init() {
    const ctx = await OwnerShared.bootstrap({ skipSidebar: true })
    if (!ctx) return

    await loadTodayOrders(ctx.storeList)
    loadDashboardInsights()
    renderStoreStatusList(ctx.storeList)
  }

  async function loadDashboardInsights() {
    await Promise.all([loadWeeklySales(), loadRatingSummary()])
  }

  async function loadWeeklySales() {
    const changeEl = document.getElementById('weeklySalesChange')
    const totalEl = document.getElementById('weeklySalesTotal')
    const chartEl = document.getElementById('weeklySalesChart')
    if (!changeEl || !totalEl || !chartEl) return

    try {
      let data = await api.dashboard.weeklySales()
      let demoMode = shouldUseDemoDashboard(data)
      if (demoMode) {
        data = buildDemoWeeklySales()
      }

      const days = Array.isArray(data?.days) ? data.days : []
      const thisTotal = Number(data?.thisWeekTotal ?? 0)
      const lastTotal = Number(data?.lastWeekTotal ?? 0)
      const change = Number(data?.changePercent ?? 0)

      totalEl.textContent = formatWon(thisTotal)
      changeEl.textContent = formatChangeLabel(change, lastTotal)
      changeEl.className = `card-subtitle dashboard-change${change > 0 ? ' is-up' : change < 0 ? ' is-down' : ''}`

      chartEl.innerHTML = renderWeeklyChart(days, { demoMode })
      chartEl.setAttribute(
        'aria-label',
        `\uc774\ubc88 \uc8fc \uc77c\ubcc4 \ub9e4\ucd9c: ${days.map((d) => `${formatDayLabel(d.date)} ${formatWon(d.salesAmount)}`).join(', ')}`,
      )
    } catch (e) {
      totalEl.textContent = '\u2014'
      changeEl.textContent = OwnerShared.errorMessage(e, '\ub9e4\ucd9c \ud1b5\uacc4\ub97c \ubd88\ub7ec\uc62c \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.')
      changeEl.className = 'card-subtitle dashboard-change is-error'
      chartEl.innerHTML = `<p class="weekly-sales-chart-loading">${OwnerShared.escapeHtml(
        OwnerShared.errorMessage(e, '\ucc28\ud2b8\ub97c \ud45c\uc2dc\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.'),
      )}</p>`
    }
  }

  async function loadRatingSummary() {
    const valueEl = document.getElementById('ratingSummaryValue')
    const metaEl = document.getElementById('ratingSummaryMeta')
    const starsEl = document.getElementById('ratingSummaryStars')
    const distEl = document.getElementById('ratingDistribution')
    if (!valueEl || !metaEl || !starsEl || !distEl) return

    try {
      let data = await api.dashboard.ratingSummary()
      if (shouldUseDemoDashboard(null, data)) {
        data = { ...DEMO_RATING, storeCount: Number(data?.storeCount ?? 3) }
      }

      const rating = Number(data?.averageRating ?? 0)
      const reviewCount = Number(data?.reviewCount ?? 0)
      const storeCount = Number(data?.storeCount ?? 0)

      valueEl.textContent = reviewCount > 0 ? rating.toFixed(1) : '\u2014'
      metaEl.textContent =
        reviewCount > 0
          ? `\ub9ac\ubdf0 ${reviewCount.toLocaleString('ko-KR')}\uac1c \u00b7 \uac00\uac8c ${storeCount.toLocaleString('ko-KR')}\uacf3`
          : '\uc544\uc9c1 \ub4f1\ub85d\ub41c \ub9ac\ubdf0\uac00 \uc5c6\uc5b4\uc694'
      starsEl.innerHTML = renderStarRow(rating)
      distEl.innerHTML = renderRatingDistribution(data, reviewCount)
    } catch (e) {
      valueEl.textContent = '\u2014'
      metaEl.textContent = OwnerShared.errorMessage(e, '\ubcc4\uc810\uc744 \ubd88\ub7ec\uc62c \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.')
      starsEl.innerHTML = ''
      distEl.innerHTML = `<p class="rating-distribution-loading">${OwnerShared.escapeHtml(
        OwnerShared.errorMessage(e, '\ubd84\ud3ec\ub97c \ud45c\uc2dc\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.'),
      )}</p>`
    }
  }

  function renderRatingDistribution(data, reviewCount) {
    if (reviewCount <= 0) {
      return '<p class="rating-distribution-loading">\uc544\uc9c1 \ub9ac\ubdf0\uac00 \uc5c6\uc5b4\uc694</p>'
    }

    const buckets = [
      { label: '5\u2605', count: Number(data?.fiveStarCount ?? 0) },
      { label: '4\u2605', count: Number(data?.fourStarCount ?? 0) },
      { label: '3\u2605', count: Number(data?.threeStarCount ?? 0) },
      { label: '1~2\u2605', count: Number(data?.lowStarCount ?? 0) },
    ]
    const max = Math.max(...buckets.map((b) => b.count), 1)

    return buckets
      .map((b) => {
        const pct = Math.max(4, Math.round((b.count / max) * 100))
        return (
          '<div class="rating-dist-row">' +
          `<span class="rating-dist-label">${b.label}</span>` +
          `<span class="rating-dist-track"><span class="rating-dist-fill" style="width:${pct}%"></span></span>` +
          `<span class="rating-dist-count">${b.count.toLocaleString('ko-KR')}</span>` +
          '</div>'
        )
      })
      .join('')
  }

  function renderWeeklyChart(days, { demoMode = false } = {}) {
    if (!days.length) {
      return '<p class="weekly-sales-chart-loading">\uc774\ubc88 \uc8fc \ub9e4\ucd9c \ub370\uc774\ud130\uac00 \uc5c6\uc5b4\uc694.</p>'
    }

    const todayIso = seoulTodayIso()
    const max = Math.max(
      ...days
        .filter((d) => {
          if (demoMode) return true
          const iso = toDateIso(d.date)
          return iso && iso <= todayIso
        })
        .map((d) => Number(d.salesAmount ?? 0)),
      1,
    )

    const bars = days
      .map((d, i) => {
        const amount = Number(d.salesAmount ?? 0)
        const label = formatDayLabel(d.date, i)
        const dateIso = toDateIso(d.date)
        const isFuture = !demoMode && dateIso && dateIso > todayIso

        if (isFuture) {
          return (
            `<div class="weekly-sales-bar is-no-data" title="${label} \ub370\uc774\ud130 \uc5c6\uc74c">` +
            '<span class="weekly-sales-bar-empty">\ub370\uc774\ud130 \uc5c6\uc74c</span>' +
            `<span class="weekly-sales-bar-label">${OwnerShared.escapeHtml(label)}</span>` +
            '</div>'
          )
        }

        const height = amount > 0 ? Math.max(8, Math.round((amount / max) * 100)) : 0
        const emptyCls = amount <= 0 ? ' is-empty' : ''
        return (
          `<div class="weekly-sales-bar${emptyCls}" title="${label} ${formatWon(amount)}">` +
          `<div class="weekly-sales-bar-fill" style="height:${height}%"></div>` +
          `<span class="weekly-sales-bar-label">${OwnerShared.escapeHtml(label)}</span>` +
          '</div>'
        )
      })
      .join('')

    return `<div class="weekly-sales-bars">${bars}</div>`
  }

  function renderStarRow(rating) {
    const full = Math.floor(rating)
    const half = rating - full >= 0.5
    let html = ''
    for (let i = 0; i < 5; i++) {
      if (i < full) {
        html += '<i class="ti ti-star-filled"></i>'
      } else if (i === full && half) {
        html += '<i class="ti ti-star-half-filled"></i>'
      } else {
        html += '<i class="ti ti-star"></i>'
      }
    }
    return html
  }

  function isDemoDashboardForced() {
    const q = new URLSearchParams(location.search).get('demo')
    if (q === '1' || q === 'true') return true
    return localStorage.getItem('tasteRadar.demoDashboard') === '1'
  }

  function shouldUseDemoDashboard(weeklyData, ratingData) {
    if (isDemoDashboardForced()) return true
    if (weeklyData != null) {
      const total = Number(weeklyData?.thisWeekTotal ?? 0)
      const days = Array.isArray(weeklyData?.days) ? weeklyData.days : []
      const hasSales = days.some((d) => Number(d?.salesAmount ?? 0) > 0)
      if (total <= 0 && !hasSales) return true
    }
    if (ratingData != null) {
      if (Number(ratingData?.reviewCount ?? 0) <= 0) return true
    }
    return false
  }

  function seoulWeekStartIso() {
    const todayIso = seoulTodayIso()
    const d = new Date(`${todayIso}T12:00:00`)
    const dow = d.getDay()
    const mondayOffset = dow === 0 ? 6 : dow - 1
    d.setDate(d.getDate() - mondayOffset)
    return d.toISOString().slice(0, 10)
  }

  function addDaysIso(iso, days) {
    const d = new Date(`${iso}T12:00:00`)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  function buildDemoWeeklySales() {
    const weekStart = seoulWeekStartIso()
    const days = DEMO_WEEKLY_AMOUNTS.map((salesAmount, i) => ({
      date: addDaysIso(weekStart, i),
      salesAmount,
      orderCount: DEMO_WEEKLY_COUNTS[i] ?? 0,
    }))
    const thisWeekTotal = DEMO_WEEKLY_AMOUNTS.reduce((sum, n) => sum + n, 0)
    const lastWeekTotal = DEMO_LAST_WEEK_TOTAL
    const changePercent =
      lastWeekTotal > 0
        ? Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 1000) / 10
        : 100
    return { days, thisWeekTotal, lastWeekTotal, changePercent }
  }

  function seoulTodayIso() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  }

  function toDateIso(dateStr) {
    if (!dateStr) return ''
    const s = String(dateStr).slice(0, 10)
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''
  }

  function formatWon(amount) {
    return `${Number(amount ?? 0).toLocaleString('ko-KR')}\uc6d0`
  }

  function formatChangeLabel(change, lastTotal) {
    if (lastTotal <= 0 && change === 0) {
      return '\uc9c0\ub09c \uc8fc \ub300\ube44 \u2014'
    }
    const arrow = change > 0 ? '\u25b2' : change < 0 ? '\u25bc' : ''
    const sign = change > 0 ? '+' : ''
    return `${arrow} \uc9c0\ub09c \uc8fc \ub300\ube44 ${sign}${change.toLocaleString('ko-KR')}%`
  }

  function formatDayLabel(dateStr, index) {
    if (dateStr) {
      try {
        const d = new Date(`${toDateIso(dateStr)}T12:00:00`)
        if (!Number.isNaN(d.getTime())) {
          return DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1] ?? `${d.getMonth() + 1}/${d.getDate()}`
        }
      } catch {
        /* fall through */
      }
    }
    return DAY_LABELS[index] ?? ''
  }

  function parseTodayTotal(data) {
    if (!data || typeof data !== 'object') return 0
    const raw = data.totalCount ?? data.total ?? data.count
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  }

  /** GET /api/owner/orders/stats/today/stores ? storeId? ?? ? */
  function parseStoreTodayStats(rows) {
    const map = new Map()
    for (const row of Array.isArray(rows) ? rows : []) {
      const id = row.storeId ?? row.store_id
      if (id == null) continue
      const cnt = Number(row.orderCount ?? row.todayOrderCount ?? row.totalCount ?? 0)
      map.set(String(id), Number.isFinite(cnt) ? cnt : 0)
    }
    return map
  }

  function mergeTodayStatsIntoStores(storeList, statsMap) {
    return (storeList || []).map((s) => {
      const key = String(s.storeId)
      const fromApi = statsMap.has(key) ? statsMap.get(key) : Number(s.totalCount ?? 0)
      return { ...s, totalCount: fromApi }
    })
  }

  async function loadTodayOrders(storeList) {
    const totalEl = document.getElementById('todayOrdersTotal')
    const metaEl = document.getElementById('todayOrdersMeta')
    const listEl = document.getElementById('storeBreakdownList')
    if (!totalEl) return

    try {
      const [totalRes, byStoreRes] = await Promise.all([
        api.orders.owner.todayStats(),
        api.orders.owner.todayStatsByStore(),
      ])

      const statsMap = parseStoreTodayStats(byStoreRes)
      const mergedStores = mergeTodayStatsIntoStores(storeList, statsMap)

      let total = parseTodayTotal(totalRes)
      if (total === 0 && statsMap.size > 0) {
        total = [...statsMap.values()].reduce((sum, n) => sum + n, 0)
      }

      if (total === 0 && shouldUseDemoDashboard({ thisWeekTotal: 0, days: [] }, null)) {
        const demoCounts = [19, 14, 14]
        mergedStores.forEach((s, i) => {
          s.totalCount = demoCounts[i % demoCounts.length]
        })
        total = mergedStores.length
          ? demoCounts.slice(0, mergedStores.length).reduce((sum, n) => sum + n, 0)
          : 47
      }

      totalEl.textContent = total.toLocaleString('ko-KR')
      if (metaEl) metaEl.textContent = '\uc804\uccb4 \uac00\uac8c \u00b7 \uc624\ub298 00:00~\ud604\uc7ac'
      renderStoreBreakdown(mergedStores)
    } catch (e) {
      totalEl.textContent = '\u2014'
      if (metaEl) metaEl.textContent = OwnerShared.errorMessage(e, '\ud1b5\uacc4\ub97c \ubd88\ub7ec\uc62c \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.')
      if (listEl) {
        listEl.innerHTML =
          `<li><span class="order-summary-label">${OwnerShared.escapeHtml(
            OwnerShared.errorMessage(e, '\ubaa9\ub85d\uc744 \ubd88\ub7ec\uc62c \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.'),
          )}</span><span class="order-summary-count">\u2014</span></li>`
      }
    }
  }

  function renderStoreBreakdown(storeList) {
    const listEl = document.getElementById('storeBreakdownList')
    if (!listEl) return

    if (!storeList || storeList.length === 0) {
      listEl.innerHTML =
        '<li><span class="order-summary-label">\ub4f1\ub85d\ub41c \uac00\uac8c\uac00 \uc5c6\uc5b4\uc694</span>' +
        '<a href="./owner-store-manage.html" class="order-summary-count" style="color:var(--color-primary);text-decoration:none;font-weight:700">\uac00\uac8c \ub4f1\ub85d \u2192</a></li>'
      return
    }

    listEl.innerHTML = storeList
      .map((s) => {
        const dotCls = s.isDeleted ? 'status-dot--closed' : statusDotClass(s.status)
        const closedBadge = s.isDeleted ? ' <span class="inline-badge inline-badge--closed">\ud3d0\uc5c5</span>' : ''
        return (
          `<li${s.isDeleted ? ' class="is-closed"' : ''}>` +
          '<span class="order-summary-label">' +
          `<span class="status-dot ${dotCls}" aria-hidden="true"></span>` +
          `${OwnerShared.escapeHtml(s.storeName ?? '\uac00\uac8c')}${closedBadge}` +
          '</span>' +
          '<span class="order-summary-count">' +
          `${Number(s.totalCount ?? 0).toLocaleString('ko-KR')}` +
          '<span class="order-summary-count-unit">\uac74</span></span></li>'
        )
      })
      .join('')
  }

  function statusDotClass(status) {
    switch ((status || '').toUpperCase()) {
      case 'OPEN':
        return 'status-dot--open'
      case 'PREPARING':
        return 'status-dot--new'
      case 'CLOSE':
        return 'status-dot--closed'
      default:
        return 'status-dot--new'
    }
  }

  function renderStoreStatusList(storeList) {
    const wrap = document.getElementById('storeStatusList')
    if (!wrap) return

    if (!storeList || storeList.length === 0) {
      wrap.innerHTML =
        '<p class="empty-state" style="margin:0">\uba3c\uc800 <a href="./owner-store-manage.html" style="color:var(--color-primary);font-weight:700">\uac00\uac8c \ub4f1\ub85d</a>\uc744 \uc9c4\ud589\ud574 \uc8fc\uc138\uc694.</p>'
      return
    }

    const active = storeList.filter((s) => !s.isDeleted)
    const closed = storeList.filter((s) => s.isDeleted)

    let html = ''
    if (active.length) {
      html +=
        '<section class="store-status-group"><h3 class="store-status-group-title">\uc6b4\uc601 \uc911</h3>' +
        active.map(renderStoreStatusRow).join('') +
        '</section>'
    }
    if (closed.length) {
      html +=
        '<section class="store-status-group"><h3 class="store-status-group-title store-status-group-title--closed">\ud3d0\uc5c5</h3>' +
        closed.map(renderStoreStatusRow).join('') +
        '</section>'
    }

    wrap.innerHTML = html
    wrap.querySelectorAll('input[data-store-id]').forEach((input) => {
      input.addEventListener('change', () => handleToggle(input))
    })
  }

  function renderStoreStatusRow(store) {
    const status = (store.status || '').toUpperCase()
    const isOpen = status === 'OPEN'
    const isClosed = !!store.isDeleted

    const label = isClosed ? '\ud3d0\uc5c5 \ucc98\ub9ac\ub428' : OwnerShared.statusLabel(status || 'PREPARING')
    const labelCls = isClosed ? ' style="color:var(--color-cancel);font-weight:700"' : ''
    const closedBadge = isClosed ? ' <span class="inline-badge inline-badge--closed">\ud3d0\uc5c5</span>' : ''
    const switchEl = isClosed
      ? `<a href="./owner-store-manage.html?storeId=${encodeURIComponent(store.storeId)}" class="btn-outline-sm" style="text-decoration:none"><i class="ti ti-refresh" aria-hidden="true"></i> \uc7ac\uc624\ud508</a>`
      : `<label class="switch"><input type="checkbox" data-store-id="${store.storeId}" ${isOpen ? 'checked' : ''} aria-label="\uc601\uc5c5 \uc0c1\ud0dc \ucf1c\uae30/\ub044\uae30" /><span class="switch-slider"></span></label>`

    return (
      `<div data-store-row="${store.storeId}"${isClosed ? ' class="is-closed"' : ''}>` +
      '<div class="store-status-row">' +
      `<div class="store-status-info"><div class="store-status-name">${OwnerShared.escapeHtml(store.storeName ?? '\uac00\uac8c')}${closedBadge}</div>` +
      `<div class="store-status-label" data-status-label${labelCls}>${OwnerShared.escapeHtml(label)}</div></div>` +
      `${switchEl}</div></div>`
    )
  }

  async function handleToggle(input) {
    const storeId = input.dataset.storeId
    const next = input.checked ? 'OPEN' : 'CLOSE'
    const row = input.closest('[data-store-row]')
    const labelEl = row?.querySelector('[data-status-label]')
    input.disabled = true
    try {
      await api.stores.updateStatus(storeId, next)
      if (labelEl) labelEl.textContent = OwnerShared.statusLabel(next)
    } catch (e) {
      alert(OwnerShared.errorMessage(e, '\uc601\uc5c5 \uc0c1\ud0dc\ub97c \ubc14\uafb8\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.'))
      input.checked = !input.checked
    } finally {
      input.disabled = false
    }
  }
})()
