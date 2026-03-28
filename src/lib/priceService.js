const AV_KEY = import.meta.env.VITE_ALPHA_VANTAGE_KEY

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

// 주식/ETF 현재가 (Alpha Vantage)
export async function fetchStockPrice(symbol) {
  const res = await fetch(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${AV_KEY}`
  )
  if (!res.ok) throw new Error('Alpha Vantage 조회 실패')
  const data = await res.json()
  const quote = data['Global Quote']
  if (!quote || !quote['05. price']) throw new Error(`티커를 찾을 수 없습니다: ${symbol}`)
  return parseFloat(quote['05. price'])
}

// 자산 카테고리에 따라 적절한 API 호출 → 현재 단가 반환
export async function fetchAssetPrice(asset, exchangeRate) {
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
