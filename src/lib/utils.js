/**
 * 숫자를 한국 원화 형식으로 포맷 (예: 1,234,567)
 */
export function formatKRW(value) {
  if (value === null || value === undefined || isNaN(value)) return '0'
  return Math.round(value).toLocaleString('ko-KR')
}

/**
 * 숫자를 달러 형식으로 포맷 (예: 1,234.56)
 */
export function formatUSD(value) {
  if (value === null || value === undefined || isNaN(value)) return '0.00'
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * 자산 가치를 KRW로 환산
 * @param {number} price 단가
 * @param {number} quantity 수량
 * @param {'KRW'|'USD'} currency 통화
 * @param {number} exchangeRate 환율 (KRW/USD)
 */
export function toKRW(price, quantity, currency, exchangeRate) {
  const value = price * quantity
  return currency === 'USD' ? value * exchangeRate : value
}

/**
 * 수익률 계산 (%)
 */
export function calcReturn(purchasePrice, currentPrice) {
  if (!purchasePrice || purchasePrice === 0) return 0
  return ((currentPrice - purchasePrice) / purchasePrice) * 100
}

/**
 * 수익/손실 금액 계산
 */
export function calcProfit(purchasePrice, currentPrice, quantity) {
  return (currentPrice - purchasePrice) * quantity
}
