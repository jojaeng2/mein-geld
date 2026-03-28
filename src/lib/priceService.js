// CoinGecko — 암호화폐 (API 키 불필요)
export async function fetchCryptoPrice(coinId, currency = 'krw') {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${currency},usd`
  )
  if (!res.ok) throw new Error('CoinGecko 조회 실패')
  const data = await res.json()
  if (!data[coinId]) throw new Error(`코인 ID를 찾을 수 없습니다: ${coinId}`)
  return { krw: data[coinId].krw, usd: data[coinId].usd }
}

// Alpha Vantage — 주식/ETF (국내+해외)
// 국내 KOSPI: 005930.KS / KOSDAQ: 035720.KQ / 미국: AAPL
export async function fetchStockPrice(symbol, apiKey) {
  const res = await fetch(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`
  )
  if (!res.ok) throw new Error('Alpha Vantage 조회 실패')
  const data = await res.json()
  const quote = data['Global Quote']
  if (!quote || !quote['05. price']) throw new Error(`티커를 찾을 수 없습니다: ${symbol}`)
  return parseFloat(quote['05. price'])
}

// 자산의 카테고리에 따라 적절한 API 호출
// 반환값: KRW 기준 현재 단가
export async function fetchAssetPrice(asset, alphaVantageKey, exchangeRate) {
  if (!asset.ticker) throw new Error('티커가 설정되지 않았습니다.')

  if (asset.category === 'crypto') {
    const prices = await fetchCryptoPrice(asset.ticker)
    return asset.currency === 'USD' ? prices.usd : prices.krw
  } else {
    if (!alphaVantageKey) throw new Error('Alpha Vantage API 키가 필요합니다.')
    const price = await fetchStockPrice(asset.ticker, alphaVantageKey)
    // Alpha Vantage 국내주식은 KRW, 해외주식은 USD 반환
    return price
  }
}
