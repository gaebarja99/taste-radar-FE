/**
 * 카카오 로고 SVG (Tabler 아이콘 대체 — 항상 표시)
 */
;(function () {
  'use strict'

  const KAKAO_BUBBLE_PATH =
    'M12 3c5.523 0 10 3.582 10 8 0 2.558-1.294 4.832-3.333 6.274L19 22l-5.2-2.86C14.89 19.378 13.47 19.5 12 19.5 6.477 19.5 2 15.918 2 11.5 2 7.082 6.477 3.5 12 3.5z'

  function iconHtml(sizeClass) {
    const cls = sizeClass ? `kakao-logo ${sizeClass}` : 'kakao-logo'
    return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="${KAKAO_BUBBLE_PATH}"/></svg>`
  }

  window.KakaoBrand = { iconHtml }
})()
