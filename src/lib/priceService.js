const PROXY_URL = import.meta.env.VITE_KR_PROXY_URL

// 암호화폐 현재가 (CoinGecko, 키 불필요)
export async function fetchCryptoPrice(coinId, currency = 'krw') {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${currency},usd`
  )
  if (!res.ok) throw new Error('CoinGecko 조회 실패')
  const data = await res.json()
  if (!data[coinId]) throw new Error(`코인을 찾을 수 없습니다: ${coinId}`)
  return { krw: data[coinId].krw, usd: data[coinId].usd }
}

// 주식/ETF 현재가 (Cloudflare Worker → Naver Finance, 한국/미국 공통)
async function fetchStockPrice(symbol) {
  if (!PROXY_URL) throw new Error('VITE_KR_PROXY_URL 환경변수가 설정되지 않았습니다.')
  const code = symbol.replace(/\.(KS|KQ)$/, '')
  const res = await fetch(`${PROXY_URL}?code=${code}`)
  if (!res.ok) throw new Error('가격 조회 실패')
  const data = await res.json()
  if (!data?.price) throw new Error(`종목을 찾을 수 없습니다: ${symbol}`)
  return data.price
}

// 자산 카테고리·티커에 따라 적절한 API 호출 → 현재 단가 반환
export async function fetchAssetPrice(asset) {
  if (!asset.ticker) throw new Error('티커가 설정되지 않았습니다.')

  if (asset.category === 'crypto') {
    const prices = await fetchCryptoPrice(asset.ticker)
    return asset.currency === 'USD' ? prices.usd : prices.krw
  } else {
    return fetchStockPrice(asset.ticker)
  }
}

// 코인 검색 (CoinGecko search)
export async function searchCryptoTicker(query) {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`
  )
  if (!res.ok) throw new Error('검색 실패')
  const data = await res.json()
  return (data.coins || []).slice(0, 8).map((c) => ({
    symbol: c.id,           // CoinGecko ID (bitcoin, ethereum ...)
    name: c.name,
    ticker: c.symbol.toUpperCase(), // BTC, ETH ...
  }))
}
