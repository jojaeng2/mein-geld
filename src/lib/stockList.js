// 주요 국내 주식 (KOSPI / KOSDAQ)
export const KR_STOCKS = [
  { symbol: '005930.KS', name: '삼성전자', market: 'KOSPI' },
  { symbol: '000660.KS', name: 'SK하이닉스', market: 'KOSPI' },
  { symbol: '035420.KS', name: 'NAVER', market: 'KOSPI' },
  { symbol: '005380.KS', name: '현대차', market: 'KOSPI' },
  { symbol: '000270.KS', name: '기아', market: 'KOSPI' },
  { symbol: '051910.KS', name: 'LG화학', market: 'KOSPI' },
  { symbol: '006400.KS', name: '삼성SDI', market: 'KOSPI' },
  { symbol: '035720.KS', name: '카카오', market: 'KOSPI' },
  { symbol: '055550.KS', name: '신한지주', market: 'KOSPI' },
  { symbol: '105560.KS', name: 'KB금융', market: 'KOSPI' },
  { symbol: '086790.KS', name: '하나금융지주', market: 'KOSPI' },
  { symbol: '012330.KS', name: '현대모비스', market: 'KOSPI' },
  { symbol: '207940.KS', name: '삼성바이오로직스', market: 'KOSPI' },
  { symbol: '068270.KS', name: '셀트리온', market: 'KOSPI' },
  { symbol: '003550.KS', name: 'LG', market: 'KOSPI' },
  { symbol: '066570.KS', name: 'LG전자', market: 'KOSPI' },
  { symbol: '011070.KS', name: 'LG이노텍', market: 'KOSPI' },
  { symbol: '096770.KS', name: 'SK이노베이션', market: 'KOSPI' },
  { symbol: '034730.KS', name: 'SK', market: 'KOSPI' },
  { symbol: '017670.KS', name: 'SK텔레콤', market: 'KOSPI' },
  { symbol: '032830.KS', name: '삼성생명', market: 'KOSPI' },
  { symbol: '028260.KS', name: '삼성물산', market: 'KOSPI' },
  { symbol: '003490.KS', name: '대한항공', market: 'KOSPI' },
  { symbol: '030200.KS', name: 'KT', market: 'KOSPI' },
  { symbol: '033780.KS', name: 'KT&G', market: 'KOSPI' },
  { symbol: '010130.KS', name: '고려아연', market: 'KOSPI' },
  { symbol: '011200.KS', name: 'HMM', market: 'KOSPI' },
  { symbol: '009540.KS', name: 'HD한국조선해양', market: 'KOSPI' },
  { symbol: '018260.KS', name: '삼성에스디에스', market: 'KOSPI' },
  { symbol: '090430.KS', name: '아모레퍼시픽', market: 'KOSPI' },
  { symbol: '010950.KS', name: 'S-Oil', market: 'KOSPI' },
  { symbol: '000100.KS', name: '유한양행', market: 'KOSPI' },
  { symbol: '004020.KS', name: '현대제철', market: 'KOSPI' },
  { symbol: '002380.KS', name: 'KCC', market: 'KOSPI' },
  { symbol: '047050.KS', name: '포스코인터내셔널', market: 'KOSPI' },
  // KOSDAQ
  { symbol: '247540.KQ', name: '에코프로비엠', market: 'KOSDAQ' },
  { symbol: '086520.KQ', name: '에코프로', market: 'KOSDAQ' },
  { symbol: '196170.KQ', name: '알테오젠', market: 'KOSDAQ' },
  { symbol: '293490.KQ', name: '카카오게임즈', market: 'KOSDAQ' },
  { symbol: '112040.KQ', name: '위메이드', market: 'KOSDAQ' },
  { symbol: '122870.KQ', name: '와이지엔터테인먼트', market: 'KOSDAQ' },
  { symbol: '041510.KQ', name: 'SM엔터테인먼트', market: 'KOSDAQ' },
  { symbol: '035900.KQ', name: 'JYP엔터테인먼트', market: 'KOSDAQ' },
  { symbol: '263750.KQ', name: '펄어비스', market: 'KOSDAQ' },
  { symbol: '036570.KQ', name: '엔씨소프트', market: 'KOSDAQ' },
]

// 주요 미국 주식 / ETF
export const US_STOCKS = [
  // 빅테크
  { symbol: 'AAPL', name: 'Apple', market: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft', market: 'NASDAQ' },
  { symbol: 'GOOGL', name: 'Alphabet (Google)', market: 'NASDAQ' },
  { symbol: 'AMZN', name: 'Amazon', market: 'NASDAQ' },
  { symbol: 'NVDA', name: 'NVIDIA', market: 'NASDAQ' },
  { symbol: 'TSLA', name: 'Tesla', market: 'NASDAQ' },
  { symbol: 'META', name: 'Meta', market: 'NASDAQ' },
  { symbol: 'NFLX', name: 'Netflix', market: 'NASDAQ' },
  { symbol: 'AVGO', name: 'Broadcom', market: 'NASDAQ' },
  { symbol: 'AMD', name: 'AMD', market: 'NASDAQ' },
  { symbol: 'INTC', name: 'Intel', market: 'NASDAQ' },
  { symbol: 'QCOM', name: 'Qualcomm', market: 'NASDAQ' },
  // 금융
  { symbol: 'JPM', name: 'JPMorgan Chase', market: 'NYSE' },
  { symbol: 'BAC', name: 'Bank of America', market: 'NYSE' },
  { symbol: 'V', name: 'Visa', market: 'NYSE' },
  { symbol: 'MA', name: 'Mastercard', market: 'NYSE' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway B', market: 'NYSE' },
  // 기타
  { symbol: 'JNJ', name: 'Johnson & Johnson', market: 'NYSE' },
  { symbol: 'WMT', name: 'Walmart', market: 'NYSE' },
  { symbol: 'XOM', name: 'ExxonMobil', market: 'NYSE' },
  { symbol: 'COST', name: 'Costco', market: 'NASDAQ' },
  { symbol: 'DIS', name: 'Disney', market: 'NYSE' },
  // ETF
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', market: 'ETF' },
  { symbol: 'QQQ', name: 'Invesco QQQ (NASDAQ 100)', market: 'ETF' },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', market: 'ETF' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market', market: 'ETF' },
  { symbol: 'IVV', name: 'iShares Core S&P 500', market: 'ETF' },
  { symbol: 'ARKK', name: 'ARK Innovation ETF', market: 'ETF' },
  { symbol: 'SCHD', name: 'Schwab US Dividend Equity ETF', market: 'ETF' },
  { symbol: 'VNQ', name: 'Vanguard Real Estate ETF', market: 'ETF' },
  { symbol: 'GLD', name: 'SPDR Gold Shares', market: 'ETF' },
  { symbol: 'TLT', name: 'iShares 20+ Year Treasury', market: 'ETF' },
]

export const ALL_STOCKS = [...KR_STOCKS, ...US_STOCKS]

/**
 * 종목명 또는 티커로 로컬 검색
 */
export function searchLocalStocks(query) {
  if (!query || query.length < 1) return []
  const q = query.toLowerCase().replace(/\s/g, '')
  return ALL_STOCKS.filter(
    (s) =>
      s.name.toLowerCase().replace(/\s/g, '').includes(q) ||
      s.symbol.toLowerCase().replace(/\s/g, '').includes(q)
  ).slice(0, 10)
}
