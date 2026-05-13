const key = String(import.meta.env.VITE_KAKAO_JS_KEY ?? '').trim()

if (!key) {
  window.__kakaoMapLoadError = 'missing-key'
} else {
  window.__kakaoMapReady = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`
    script.onload = () => resolve()
    script.onerror = () => {
      window.__kakaoMapLoadError = 'network'
      reject(new Error('Kakao Map SDK script failed to load'))
    }
    document.head.appendChild(script)
  })
}
