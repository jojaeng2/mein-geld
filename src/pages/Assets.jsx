import { useState, useRef, useEffect, useMemo } from 'react'
import { useAssets } from '../hooks/useAssets'
import { useSettings } from '../hooks/useSettings'
import { CATEGORIES, CURRENCIES } from '../lib/constants'
import { formatKRW, formatUSD, toKRW, calcReturn } from '../lib/utils'
import { fetchAssetPrice, searchCryptoTicker } from '../lib/priceService'
import { searchLocalStocks } from '../lib/stockList'

const TODAY = new Date().toISOString().slice(0, 10)

const EMPTY_FORM = {
  name: '',
  category: 'stock',
  quantity: '',
  purchasePrice: '',
  currentPrice: '',
  currency: 'KRW',
  ticker: '',
  memo: '',
  // 예금/적금 전용
  interestRate: '',
  startDate: TODAY,
  maturityDate: '',
}

// ── 티커 검색 ─────────────────────────────────────────────
function TickerSearch({ category, onSelect }) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen]         = useState(false)
  const timerRef  = useRef(null)
  const wrapperRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleInput(e) {
    const val = e.target.value
    setQuery(val)
    setOpen(true)
    clearTimeout(timerRef.current)
    if (!val.trim()) { setResults([]); return }
    if (category === 'crypto') {
      timerRef.current = setTimeout(async () => {
        setSearching(true)
        try { setResults(await searchCryptoTicker(val)) } catch { setResults([]) } finally { setSearching(false) }
      }, 500)
    } else {
      setResults(searchLocalStocks(val))
    }
  }

  function handleSelect(item) {
    onSelect(item)
    setQuery(''); setResults([]); setOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        className="input"
        placeholder={category === 'crypto' ? '코인명 검색 (예: bitcoin)' : '종목명 검색 (예: 삼성전자)'}
        value={query}
        onChange={handleInput}
        onFocus={() => results.length && setOpen(true)}
      />
      {open && (query || searching) && (
        <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          {searching && <div className="px-4 py-3 text-xs text-gray-400">검색 중...</div>}
          {!searching && results.length === 0 && query && (
            <div className="px-4 py-3 text-xs text-gray-500">
              검색 결과 없음 —{' '}
              {category === 'crypto' ? 'CoinGecko ID를 직접 입력 (예: bitcoin)' : '티커 직접 입력 (예: 005930.KS, AAPL)'}
            </div>
          )}
          {results.map((item, i) => (
            <button key={i} type="button" onClick={() => handleSelect(item)}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-700 transition border-b border-gray-700/50 last:border-0">
              {category === 'crypto' ? (
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm">{item.name}</span>
                  <span className="text-xs text-gray-400 font-mono">{item.ticker}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm">{item.name}</span>
                  <div className="text-right">
                    <span className="text-xs font-mono text-brand-400 block">{item.symbol}</span>
                    <span className="text-xs text-gray-500">{item.market}</span>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 자산 추가/수정 모달 ───────────────────────────────────
function AssetModal({ initial, onSave, onClose }) {
  const [form, setForm]           = useState(initial ? { ...EMPTY_FORM, ...initial } : EMPTY_FORM)
  const [loading, setLoading]     = useState(false)
  const [fetchingPrice, setFetchingPrice] = useState(false)
  const [priceError, setPriceError] = useState('')

  const isInvestment = ['stock', 'crypto'].includes(form.category)
  const isCash       = form.category === 'cash'
  const isRealEstate = form.category === 'real_estate'

  // 예금: 만기 수령액 자동계산 (단리)
  const maturityValue = useMemo(() => {
    if (!isCash) return null
    const principal = Number(form.purchasePrice) || 0
    if (!principal) return 0
    const rate = Number(form.interestRate) || 0
    if (!rate || !form.maturityDate) return principal
    const start = form.startDate ? new Date(form.startDate) : new Date()
    const end   = new Date(form.maturityDate)
    const termYears = Math.max(0, (end - start) / (365.25 * 24 * 60 * 60 * 1000))
    return Math.round(principal * (1 + rate / 100 * termYears))
  }, [isCash, form.purchasePrice, form.interestRate, form.startDate, form.maturityDate])

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })) }

  function handleTickerSelect(item) {
    set('ticker', item.symbol)
    set('name', item.name)
    const isKorean = item.symbol.endsWith('.KS') || item.symbol.endsWith('.KQ')
    set('currency', isKorean ? 'KRW' : 'USD')
  }

  async function handleFetchPrice() {
    if (!form.ticker) return
    setPriceError('')
    setFetchingPrice(true)
    try {
      const price = await fetchAssetPrice({ ticker: form.ticker, category: form.category, currency: form.currency })
      set('currentPrice', String(price))
    } catch (e) {
      setPriceError(e.message)
    } finally {
      setFetchingPrice(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    let payload = { ...form, interestRate: Number(form.interestRate) || 0 }

    if (isCash) {
      payload.quantity      = 1
      payload.purchasePrice = Number(form.purchasePrice) || 0
      payload.currentPrice  = maturityValue ?? Number(form.purchasePrice) ?? 0
      payload.ticker        = ''
    } else if (isRealEstate) {
      payload.quantity      = 1
      const deposit         = Number(form.currentPrice) || 0
      payload.purchasePrice = deposit   // 보증금 = 매입가 (수익률 무의미)
      payload.currentPrice  = deposit
      payload.ticker        = ''
    } else {
      payload.quantity      = Number(form.quantity)
      payload.purchasePrice = Number(form.purchasePrice)
      payload.currentPrice  = Number(form.currentPrice)
    }

    await onSave(payload)
    onClose()
  }

  const isEdit = Boolean(initial?.id)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-white mb-5">{isEdit ? '자산 수정' : '자산 추가'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* 카테고리 + 통화 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">카테고리</label>
              <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">통화</label>
              <select className="input" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                {Object.entries(CURRENCIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          {/* ── 주식 / 암호화폐 ── */}
          {isInvestment && (
            <>
              <div className="space-y-2">
                <label className="label">종목 검색</label>
                <TickerSearch category={form.category} onSelect={handleTickerSelect} />
                {form.ticker && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700">
                      <span className="text-xs text-gray-400">티커</span>
                      <span className="text-sm font-mono text-white">{form.ticker}</span>
                      <button type="button" onClick={() => { set('ticker', ''); set('name', '') }}
                        className="ml-auto text-gray-500 hover:text-white text-xs">✕</button>
                    </div>
                    <button type="button" disabled={fetchingPrice} onClick={handleFetchPrice}
                      className="px-3 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-xs rounded-lg transition whitespace-nowrap">
                      {fetchingPrice ? '조회 중...' : '가격 조회'}
                    </button>
                  </div>
                )}
                {priceError && <p className="text-xs text-red-400">{priceError}</p>}
              </div>

              <div>
                <label className="label">자산명</label>
                <input required className="input" placeholder="종목 검색 시 자동 입력"
                  value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">수량</label>
                  <input required type="number" min="0" step="any" className="input" placeholder="0"
                    value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
                </div>
                <div>
                  <label className="label">매입 단가</label>
                  <input required type="number" min="0" step="any" className="input" placeholder="0"
                    value={form.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} />
                </div>
              </div>

              <div>
                <label className="label">현재 단가</label>
                <input required type="number" min="0" step="any" className="input" placeholder="가격 조회 또는 직접 입력"
                  value={form.currentPrice} onChange={(e) => set('currentPrice', e.target.value)} />
              </div>
            </>
          )}

          {/* ── 현금 / 예금 / 적금 ── */}
          {isCash && (
            <>
              <div>
                <label className="label">자산명</label>
                <input required className="input" placeholder="예: 신한은행 정기예금"
                  value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">원금 (₩)</label>
                  <input required type="number" min="0" step="any" className="input" placeholder="0"
                    value={form.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} />
                </div>
                <div>
                  <label className="label">연 이자율 (%)</label>
                  <input type="number" min="0" max="100" step="0.01" className="input" placeholder="0.00"
                    value={form.interestRate} onChange={(e) => set('interestRate', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">납입일</label>
                  <input type="date" className="input" value={form.startDate}
                    onChange={(e) => set('startDate', e.target.value)} />
                </div>
                <div>
                  <label className="label">만기일</label>
                  <input type="date" className="input" value={form.maturityDate}
                    onChange={(e) => set('maturityDate', e.target.value)} />
                </div>
              </div>

              {/* 만기 수령액 미리보기 */}
              {maturityValue !== null && maturityValue > 0 && (
                <div className="px-4 py-3 bg-gray-800 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">만기 수령액 (자동계산)</span>
                    <span className="text-white font-medium">₩{formatKRW(maturityValue)}</span>
                  </div>
                  {Number(form.purchasePrice) > 0 && (
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-gray-500">이자</span>
                      <span className="text-green-400">+₩{formatKRW(maturityValue - Number(form.purchasePrice))}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── 부동산 ── */}
          {isRealEstate && (
            <>
              <div>
                <label className="label">자산명</label>
                <input required className="input" placeholder="예: 강남구 아파트 전세"
                  value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div>
                <label className="label">보증금</label>
                <input required type="number" min="0" step="any" className="input" placeholder="0"
                  value={form.currentPrice} onChange={(e) => set('currentPrice', e.target.value)} />
              </div>
            </>
          )}

          {/* ── 연금 / 기타 ── */}
          {!isInvestment && !isCash && !isRealEstate && (
            <>
              <div>
                <label className="label">자산명</label>
                <input required className="input" placeholder="자산명"
                  value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">현재 가치</label>
                  <input required type="number" min="0" step="any" className="input" placeholder="0"
                    value={form.currentPrice} onChange={(e) => set('currentPrice', e.target.value)} />
                </div>
                <div>
                  <label className="label">매입 가치 (선택)</label>
                  <input type="number" min="0" step="any" className="input" placeholder="0"
                    value={form.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* 메모 */}
          <div>
            <label className="label">메모 (선택)</label>
            <input className="input" placeholder="메모"
              value={form.memo} onChange={(e) => set('memo', e.target.value)} />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition text-sm font-medium">
              취소
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition text-sm font-semibold disabled:opacity-50">
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────
export default function Assets() {
  const { assets, loading, addAsset, updateAsset, deleteAsset } = useAssets()
  const { settings } = useSettings()
  const [modal, setModal]     = useState(null)
  const [filter, setFilter]   = useState('all')
  const [expanded, setExpanded] = useState(new Set())

  const filtered = filter === 'all' ? assets : assets.filter((a) => a.category === filter)

  const displayGroups = useMemo(() => {
    const map = new Map()
    for (const asset of filtered) {
      const key = asset.ticker || `__${asset.id}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(asset)
    }
    return Array.from(map.values()).map((records) => {
      if (!records[0].ticker || records.length === 1) return { isGroup: false, asset: records[0] }
      const totalQty        = records.reduce((s, a) => s + a.quantity, 0)
      const totalPurchaseAmt = records.reduce((s, a) => s + a.purchasePrice * a.quantity, 0)
      const avgPurchasePrice = totalPurchaseAmt / totalQty
      return {
        isGroup: true,
        ticker: records[0].ticker,
        name: records[0].name,
        category: records[0].category,
        currency: records[0].currency,
        totalQty,
        avgPurchasePrice,
        currentPrice: records[0].currentPrice,
        records,
      }
    })
  }, [filtered])

  function toggleExpand(ticker) {
    setExpanded((prev) => { const n = new Set(prev); n.has(ticker) ? n.delete(ticker) : n.add(ticker); return n })
  }

  async function handleSave(data) {
    if (data.id) { const { id, createdAt, ...rest } = data; await updateAsset(id, rest) }
    else await addAsset(data)
  }

  async function handleDelete(asset) {
    if (confirm(`"${asset.name}"을 삭제할까요?`)) await deleteAsset(asset.id)
  }

  if (loading) return <div className="p-8 text-gray-400">로딩 중...</div>

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">자산 관리</h2>
        <button onClick={() => setModal('add')}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition">
          + 자산 추가
        </button>
      </div>

      {/* 카테고리 필터 */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === 'all' ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
          전체
        </button>
        {Object.entries(CATEGORIES).map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === k ? 'text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            style={filter === k ? { backgroundColor: v.color } : {}}>
            {v.label}
          </button>
        ))}
      </div>

      {displayGroups.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400">자산이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">자산명</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">카테고리</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">수량</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">현재가 / 금액</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">평가금액 (₩)</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">수익률</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {displayGroups.map((row) => {
                if (row.isGroup) {
                  const { ticker, name, category, currency, totalQty, avgPurchasePrice, currentPrice, records } = row
                  const rate      = settings.exchangeRate
                  const totalVal  = toKRW(currentPrice, totalQty, currency, rate)
                  const profitRate = calcReturn(avgPurchasePrice, currentPrice)
                  const sym       = CURRENCIES[currency]?.symbol
                  const isExpanded = expanded.has(ticker)
                  return [
                    <tr key={`g_${ticker}`} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => toggleExpand(ticker)} className="text-gray-500 hover:text-white text-xs w-4 flex-shrink-0">
                            {isExpanded ? '▼' : '▶'}
                          </button>
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORIES[category]?.color }} />
                          <div>
                            <p className="text-white font-medium">{name}</p>
                            <p className="text-xs text-gray-500 font-mono">{ticker} · {records.length}건</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{CATEGORIES[category]?.label}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{totalQty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {sym}{currency === 'KRW' ? formatKRW(currentPrice) : formatUSD(currentPrice)}
                      </td>
                      <td className="px-4 py-3 text-right text-white font-medium">₩{formatKRW(totalVal)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${profitRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {profitRate >= 0 ? '+' : ''}{profitRate.toFixed(2)}%
                        <p className="text-xs text-gray-500 font-normal">평균 {sym}{currency === 'KRW' ? formatKRW(avgPurchasePrice) : formatUSD(avgPurchasePrice)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setModal('add')} className="text-xs text-gray-400 hover:text-white transition px-2 py-1 rounded hover:bg-gray-700">+ 추가</button>
                      </td>
                    </tr>,
                    ...(isExpanded ? records.map((asset) => {
                      const subProfitRate = calcReturn(asset.purchasePrice, currentPrice)
                      const subVal = toKRW(currentPrice, asset.quantity, currency, settings.exchangeRate)
                      return (
                        <tr key={`sub_${asset.id}`} className="border-b border-gray-800/30 bg-gray-800/20">
                          <td className="px-5 py-2 pl-14">
                            <p className="text-xs text-gray-400">{asset.memo || `${asset.quantity}주 @ ${sym}${currency === 'KRW' ? formatKRW(asset.purchasePrice) : formatUSD(asset.purchasePrice)}`}</p>
                          </td>
                          <td /><td className="px-4 py-2 text-right text-xs text-gray-500">{asset.quantity.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right text-xs text-gray-500">매입 {sym}{currency === 'KRW' ? formatKRW(asset.purchasePrice) : formatUSD(asset.purchasePrice)}</td>
                          <td className="px-4 py-2 text-right text-xs text-gray-400">₩{formatKRW(subVal)}</td>
                          <td className={`px-4 py-2 text-right text-xs ${subProfitRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>{subProfitRate >= 0 ? '+' : ''}{subProfitRate.toFixed(2)}%</td>
                          <td className="px-4 py-2">
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setModal(asset)} className="text-xs text-gray-400 hover:text-white transition px-2 py-1 rounded hover:bg-gray-700">수정</button>
                              <button onClick={() => handleDelete(asset)} className="text-xs text-gray-400 hover:text-red-400 transition px-2 py-1 rounded hover:bg-gray-700">삭제</button>
                            </div>
                          </td>
                        </tr>
                      )
                    }) : []),
                  ]
                }

                // 단일 자산
                const { asset } = row
                const rate       = settings.exchangeRate
                const currentVal = toKRW(asset.currentPrice, asset.quantity, asset.currency, rate)
                const isDeposit  = asset.category === 'cash'
                const isRE       = asset.category === 'real_estate'
                const profitRate = calcReturn(asset.purchasePrice, asset.currentPrice)
                const sym        = CURRENCIES[asset.currency]?.symbol

                // 만기일까지 남은 일수
                const daysLeft = asset.maturityDate
                  ? Math.ceil((new Date(asset.maturityDate) - new Date()) / (1000 * 60 * 60 * 24))
                  : null

                return (
                  <tr key={asset.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 pl-6">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORIES[asset.category]?.color }} />
                        <div>
                          <p className="text-white font-medium">{asset.name}</p>
                          {asset.ticker && <p className="text-xs text-gray-500 font-mono">{asset.ticker}</p>}
                          {asset.maturityDate && (
                            <p className={`text-xs ${daysLeft < 30 ? 'text-yellow-400' : 'text-gray-500'}`}>
                              만기 {asset.maturityDate} {daysLeft != null && `(D-${daysLeft})`}
                            </p>
                          )}
                          {asset.memo && !asset.ticker && !asset.maturityDate && (
                            <p className="text-xs text-gray-500">{asset.memo}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{CATEGORIES[asset.category]?.label}</td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {isDeposit || isRE ? '—' : asset.quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {isDeposit ? (
                        <div>
                          <p className="text-xs text-gray-500">원금 {sym}{formatKRW(asset.purchasePrice)}</p>
                          <p>만기 {sym}{formatKRW(asset.currentPrice)}</p>
                        </div>
                      ) : isRE ? (
                        <span>보증금 {sym}{formatKRW(asset.currentPrice)}</span>
                      ) : (
                        <span>{sym}{asset.currency === 'KRW' ? formatKRW(asset.currentPrice) : formatUSD(asset.currentPrice)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-medium">₩{formatKRW(currentVal)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${isRE ? 'text-gray-500' : profitRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {isRE ? '—' : `${profitRate >= 0 ? '+' : ''}${profitRate.toFixed(2)}%`}
                      {isDeposit && asset.interestRate > 0 && (
                        <p className="text-xs text-gray-500 font-normal">연 {asset.interestRate}%</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setModal(asset)} className="text-xs text-gray-400 hover:text-white transition px-2 py-1 rounded hover:bg-gray-700">수정</button>
                        <button onClick={() => handleDelete(asset)} className="text-xs text-gray-400 hover:text-red-400 transition px-2 py-1 rounded hover:bg-gray-700">삭제</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <AssetModal
          initial={modal === 'add' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
