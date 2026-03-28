const TD_KEY = import.meta.env.VITE_TWELVE_DATA_KEY

const isKoreanTicker = (symbol) => symbol.endsWith('.KS') || symbol.endsWith('.KQ')

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

// 한국 주식/ETF 현재가 (Yahoo Finance — 무료, CORS 허용, .KS/.KQ 지원)
async function fetchKoreanStockPrice(symbol) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`
  )
  if (!res.ok) throw new Error('가격 조회 실패')
  const data = await res.json()
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
  if (!price) throw new Error(`종목을 찾을 수 없습니다: ${symbol}`)
  return price
}

// 미국 주식/ETF 현재가 (Twelve Data — 800회/일)
async function fetchUSStockPrice(symbol) {
  const res = await fetch(
    `https://api.twelvedata.com/price?symbol=${symbol}&apikey=${TD_KEY}`
  )
  if (!res.ok) throw new Error('Twelve Data 조회 실패')
  const data = await res.json()
  if (data.status === 'error' || !data.price) throw new Error(`종목을 찾을 수 없습니다: ${symbol}`)
  return parseFloat(data.price)
}

// 자산 카테고리·티커에 따라 적절한 API 호출 → 현재 단가 반환
export async function fetchAssetPrice(asset) {
  if (!asset.ticker) throw new Error('티커가 설정되지 않았습니다.')

  if (asset.category === 'crypto') {
    const prices = await fetchCryptoPrice(asset.ticker)
    return asset.currency === 'USD' ? prices.usd : prices.krw
  } else if (isKoreanTicker(asset.ticker)) {
    return fetchKoreanStockPrice(asset.ticker)
  } else {
    return fetchUSStockPrice(asset.ticker)
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
