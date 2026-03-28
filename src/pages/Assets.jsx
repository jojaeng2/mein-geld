import { useState, useRef, useEffect, useMemo } from 'react'
import { useAssets } from '../hooks/useAssets'
import { useSettings } from '../hooks/useSettings'
import { CATEGORIES, CURRENCIES } from '../lib/constants'
import { formatKRW, formatUSD, toKRW, calcReturn } from '../lib/utils'
import { fetchAssetPrice, searchCryptoTicker } from '../lib/priceService'
import { searchLocalStocks } from '../lib/stockList'
import { useSells } from '../hooks/useSells'

const TODAY = new Date().toISOString().slice(0, 10)

const EMPTY_FORM = {
  name: '',
  category: 'stock',
  quantity: '',
  purchasePrice: '',
  currentPrice: '',
  currency: 'KRW',
  ticker: '',
  divRate: '',
  divPerShare: '',
  divMonths: [],
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
            <button
              type="button"
              onClick={() => handleSelect({ symbol: query.trim(), name: query.trim() })}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-700 transition"
            >
              <span className="text-xs text-gray-400">직접 입력: </span>
              <span className="text-sm font-mono text-white">{query.trim()}</span>
            </button>
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

// ── 매도 모달 ─────────────────────────────────────────────
function SellModal({ name, ticker, currency, records, totalQty, avgPurchasePrice, exchangeRate, onClose, onConfirm }) {
  const [qty, setQty]     = useState('')
  const [price, setPrice] = useState('')
  const [date, setDate]   = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)

  const sym       = CURRENCIES[currency]?.symbol || ''
  const sellQty   = parseFloat(qty) || 0
  const sellPrice = parseFloat(price) || 0
  const gain      = sellQty > 0 && sellPrice > 0 ? (sellPrice - avgPurchasePrice) * sellQty : null

  async function handleSubmit(e) {
    e.preventDefault()
    if (sellQty <= 0 || sellQty > totalQty || sellPrice <= 0) return
    setLoading(true)
    try { await onConfirm({ qty: sellQty, price: sellPrice, date }) } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-white mb-1">매도</h3>
        <p className="text-sm text-gray-400 mb-5">
          {name}
          {ticker && <span className="ml-2 font-mono text-xs text-gray-600">{ticker}</span>}
        </p>

        <div className="bg-gray-800 rounded-lg p-3 mb-5 text-sm space-y-1.5">
          <div className="flex justify-between">
            <span className="text-gray-400">보유 수량</span>
            <span className="text-white">{totalQty.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">평균 매입가</span>
            <span className="text-white">{sym}{currency === 'KRW' ? formatKRW(avgPurchasePrice) : formatUSD(avgPurchasePrice)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">매도 수량</label>
            <input required type="number" min="0.000001" max={totalQty} step="any" className="input"
              placeholder={`최대 ${totalQty}`} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <label className="label">매도 단가 ({currency})</label>
            <input required type="number" min="0" step="any" className="input"
              placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <label className="label">매도일</label>
            <input required type="date" className="input"
              value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {gain !== null && (
            <div className={`rounded-lg p-3 text-sm ${gain >= 0 ? 'bg-green-950 border border-green-800' : 'bg-red-950 border border-red-800'}`}>
              <div className="flex justify-between">
                <span className={gain >= 0 ? 'text-green-400' : 'text-red-400'}>실현 손익</span>
                <span className={`font-semibold ${gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {gain >= 0 ? '+' : ''}{sym}{currency === 'KRW' ? formatKRW(gain) : formatUSD(gain)}
                </span>
              </div>
              {currency !== 'KRW' && (
                <div className="flex justify-between mt-1">
                  <span className="text-gray-500 text-xs">KRW 환산</span>
                  <span className={`text-xs font-medium ${gain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {gain >= 0 ? '+' : ''}₩{formatKRW(gain * exchangeRate)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition text-sm font-medium">
              취소
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white transition text-sm font-semibold disabled:opacity-50">
              {loading ? '처리 중...' : '매도 확정'}
            </button>
          </div>
        </form>
      </div>
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
      payload.divRate       = Number(form.divRate) || 0
      payload.divPerShare   = Number(form.divPerShare) || 0
      payload.divMonths     = form.divMonths || []
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">현재 단가</label>
                  <input required type="number" min="0" step="any" className="input" placeholder="가격 조회 또는 직접 입력"
                    value={form.currentPrice} onChange={(e) => set('currentPrice', e.target.value)} />
                </div>
                <div>
                  <label className="label">1주당 배당금 <span className="text-gray-600 font-normal">선택</span></label>
                  <input type="number" min="0" step="any" className="input"
                    placeholder={form.currency === 'KRW' ? '원 단위' : 'USD 단위'}
                    value={form.divPerShare} onChange={(e) => set('divPerShare', e.target.value)} />
                </div>
              </div>

              {Number(form.divPerShare) > 0 && (
                <div>
                  <label className="label">배당 지급 월 <span className="text-gray-600 font-normal">선택 (복수 가능)</span></label>
                  <div className="grid grid-cols-6 gap-1 mt-1">
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => {
                      const checked = (form.divMonths || []).includes(m)
                      return (
                        <button key={m} type="button"
                          onClick={() => {
                            const cur = form.divMonths || []
                            set('divMonths', checked ? cur.filter(x => x !== m) : [...cur, m].sort((a,b)=>a-b))
                          }}
                          className={`py-1 rounded text-xs font-medium border transition-colors ${checked ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent text-gray-400 border-gray-600 hover:border-gray-400'}`}>
                          {m}월
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
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

// ── 배당 설정 모달 ────────────────────────────────────────
function DivModal({ group, onSave, onClose }) {
  const [divPerShare, setDivPerShare] = useState(String(group.records[0]?.divPerShare || ''))
  const [divMonths, setDivMonths]     = useState(group.records[0]?.divMonths || [])
  const [loading, setLoading]         = useState(false)

  const sym = group.currency === 'KRW' ? '₩' : '$'

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await onSave({ divPerShare: Number(divPerShare) || 0, divMonths })
    } finally {
      setLoading(false)
    }
  }

  function toggleMonth(m) {
    setDivMonths((cur) => cur.includes(m) ? cur.filter(x => x !== m) : [...cur, m].sort((a,b)=>a-b))
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-white">배당 설정</h3>
            <p className="text-xs text-gray-500 mt-0.5">{group.name}{group.ticker ? ` · ${group.ticker}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">1주당 배당금 ({sym})</label>
            <input type="number" min="0" step="any" className="input" placeholder="0.00"
              value={divPerShare} onChange={(e) => setDivPerShare(e.target.value)} />
          </div>
          {Number(divPerShare) > 0 && (
            <div>
              <label className="label">배당 지급 월 <span className="text-gray-600 font-normal">복수 선택 가능</span></label>
              <div className="grid grid-cols-6 gap-1 mt-1">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                  <button key={m} type="button" onClick={() => toggleMonth(m)}
                    className={`py-1.5 rounded text-xs font-medium border transition-colors ${divMonths.includes(m) ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent text-gray-400 border-gray-600 hover:border-gray-400'}`}>
                    {m}월
                  </button>
                ))}
              </div>
            </div>
          )}
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
  const { sells, addSell, deleteSell } = useSells()
  const [modal, setModal]         = useState(null)
  const [sellModal, setSellModal]   = useState(null)
  const [divModal, setDivModal]   = useState(null)
  const [filter, setFilter]       = useState('all')
  const [expanded, setExpanded]   = useState(new Set())
  const [showAllSells, setShowAllSells] = useState(false)

  const SELLS_PAGE = 10

  const totalRealizedGainKRW = sells.reduce((s, sell) => s + (sell.realizedGainKRW ?? 0), 0)

  const filtered = filter === 'all' ? assets : assets.filter((a) => a.category === filter)

  const displayGroups = useMemo(() => {
    const map = new Map()
    for (const asset of filtered) {
      const key = asset.ticker || `__${asset.id}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(asset)
    }
    return Array.from(map.values()).map((records) => {
      const isInvestment     = ['stock', 'crypto'].includes(records[0].category)
      const totalQty         = records.reduce((s, a) => s + (a.quantity ?? 1), 0)
      const totalPurchaseAmt = records.reduce((s, a) => s + a.purchasePrice * (a.quantity ?? 1), 0)
      const avgPurchasePrice = totalQty > 0 ? totalPurchaseAmt / totalQty : records[0].purchasePrice
      return {
        ticker: records[0].ticker,
        name: records[0].name,
        category: records[0].category,
        currency: records[0].currency,
        isInvestment,
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

  async function handleDivSave({ divPerShare, divMonths }) {
    const { records } = divModal
    await Promise.all(records.map((r) => updateAsset(r.id, { divPerShare, divMonths })))
    setDivModal(null)
  }

  async function handleSell({ qty: sellQty, price: sellPrice, date: sellDate }) {
    const { name, ticker, category, currency, records } = sellModal

    // FIFO: 오래된 매수 기록부터 차감
    const sorted = [...records].sort((a, b) =>
      (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0)
    )

    let remaining = sellQty
    let totalCost = 0

    for (const record of sorted) {
      if (remaining <= 0) break
      const consume = Math.min(remaining, record.quantity)
      totalCost += consume * record.purchasePrice
      remaining -= consume
      if (consume >= record.quantity) {
        await deleteAsset(record.id)
      } else {
        await updateAsset(record.id, { quantity: record.quantity - consume })
      }
    }

    const avgBuyPrice    = totalCost / sellQty
    const realizedGain   = (sellPrice - avgBuyPrice) * sellQty
    const realizedGainKRW = currency === 'KRW' ? realizedGain : realizedGain * settings.exchangeRate

    await addSell({
      name,
      ticker: ticker || '',
      category,
      currency,
      quantity: sellQty,
      avgPurchasePrice: avgBuyPrice,
      sellPrice,
      sellDate,
      realizedGain,
      realizedGainKRW,
      exchangeRate: settings.exchangeRate,
    })

    setSellModal(null)
  }

  if (loading) return <div className="p-8 text-gray-400">로딩 중...</div>

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">자산 관리</h2>
        <button onClick={() => setModal({})}
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
                const { ticker, name, category, currency, isInvestment, totalQty, avgPurchasePrice, currentPrice, records } = row
                const rate      = settings.exchangeRate
                const isDeposit = category === 'cash'
                const isRE      = category === 'real_estate'
                const totalVal  = isInvestment
                  ? toKRW(currentPrice, totalQty, currency, rate)
                  : toKRW(records[0].currentPrice, records[0].quantity ?? 1, records[0].currency, rate)
                const profitRate = isInvestment
                  ? calcReturn(avgPurchasePrice, currentPrice)
                  : calcReturn(records[0].purchasePrice, records[0].currentPrice)
                const sym       = CURRENCIES[currency]?.symbol
                const expandKey = ticker || records[0].id
                const isExpanded = expanded.has(expandKey)

                return [
                  <tr key={`g_${expandKey}`} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => toggleExpand(expandKey)} className="text-gray-500 hover:text-white text-xs w-4 flex-shrink-0">
                          {isExpanded ? '▼' : '▶'}
                        </button>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORIES[category]?.color }} />
                        <div>
                          <p className="text-white font-medium">{name}</p>
                          {ticker && <p className="text-xs text-gray-500 font-mono">{ticker}{records.length > 1 ? ` · ${records.length}건` : ''}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{CATEGORIES[category]?.label}</td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {isDeposit || isRE ? '—' : totalQty.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {isDeposit ? (
                        <div>
                          <p className="text-xs text-gray-500">원금 {sym}{formatKRW(records[0].purchasePrice)}</p>
                          <p>만기 {sym}{formatKRW(records[0].currentPrice)}</p>
                        </div>
                      ) : isRE ? (
                        <span>보증금 {sym}{formatKRW(records[0].currentPrice)}</span>
                      ) : (
                        <span>{sym}{currency === 'KRW' ? formatKRW(currentPrice) : formatUSD(currentPrice)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-medium">₩{formatKRW(totalVal)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${isRE ? 'text-gray-500' : profitRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {isRE ? '—' : `${profitRate >= 0 ? '+' : ''}${profitRate.toFixed(2)}%`}
                      {isDeposit && records[0].interestRate > 0 && (
                        <p className="text-xs text-gray-500 font-normal">연 {records[0].interestRate}%</p>
                      )}
                      {isInvestment && (
                        <p className="text-xs text-gray-500 font-normal">평균 {sym}{currency === 'KRW' ? formatKRW(avgPurchasePrice) : formatUSD(avgPurchasePrice)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        {isInvestment && (<>
                          <button onClick={() => setModal({ name, ticker, category, currency })}
                            className="text-xs text-gray-400 hover:text-white transition px-2 py-1 rounded hover:bg-gray-700">+ 추가</button>
                          <button onClick={() => setDivModal({ name, ticker, currency, records })}
                            className="text-xs text-yellow-600 hover:text-yellow-400 transition px-2 py-1 rounded hover:bg-gray-700">배당</button>
                          <button onClick={() => setSellModal({ name, ticker, category, currency, records, totalQty, avgPurchasePrice })}
                            className="text-xs text-red-500 hover:text-red-400 transition px-2 py-1 rounded hover:bg-gray-700">매도</button>
                        </>)}
                      </div>
                    </td>
                  </tr>,

                  ...(isExpanded ? records.map((asset) => {
                    const subProfitRate = isInvestment
                      ? calcReturn(asset.purchasePrice, currentPrice)
                      : calcReturn(asset.purchasePrice, asset.currentPrice)
                    const subVal = toKRW(
                      isInvestment ? currentPrice : asset.currentPrice,
                      asset.quantity ?? 1, currency, settings.exchangeRate
                    )
                    const daysLeft = asset.maturityDate
                      ? Math.ceil((new Date(asset.maturityDate) - new Date()) / 86400000)
                      : null

                    return (
                      <tr key={`sub_${asset.id}`} className="border-b border-gray-800/30 bg-gray-800/20">
                        <td className="px-5 py-2.5 pl-14">
                          {isDeposit ? (
                            <div className="text-xs text-gray-400 space-y-0.5">
                              <p>원금 {sym}{formatKRW(asset.purchasePrice)} → 만기 {sym}{formatKRW(asset.currentPrice)}</p>
                              {asset.interestRate > 0 && <p className="text-gray-500">연 {asset.interestRate}% · {asset.startDate} ~ {asset.maturityDate}</p>}
                            </div>
                          ) : isRE ? (
                            <p className="text-xs text-gray-400">보증금 {sym}{formatKRW(asset.currentPrice)}{asset.memo ? ` · ${asset.memo}` : ''}</p>
                          ) : (
                            <p className="text-xs text-gray-400">{asset.memo || `${asset.quantity}주 @ ${sym}${currency === 'KRW' ? formatKRW(asset.purchasePrice) : formatUSD(asset.purchasePrice)}`}</p>
                          )}
                          {daysLeft !== null && (
                            <p className={`text-xs mt-0.5 ${daysLeft < 30 ? 'text-yellow-400' : daysLeft < 90 ? 'text-yellow-600' : 'text-gray-500'}`}>
                              만기 {asset.maturityDate} (D-{daysLeft})
                            </p>
                          )}
                        </td>
                        <td />
                        <td className="px-4 py-2 text-right text-xs text-gray-500">
                          {!isDeposit && !isRE ? asset.quantity?.toLocaleString() : ''}
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-gray-500">
                          {isInvestment ? `매입 ${sym}${currency === 'KRW' ? formatKRW(asset.purchasePrice) : formatUSD(asset.purchasePrice)}` : ''}
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-gray-400">₩{formatKRW(subVal)}</td>
                        <td className={`px-4 py-2 text-right text-xs ${isRE ? 'text-gray-500' : subProfitRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {!isRE ? `${subProfitRate >= 0 ? '+' : ''}${subProfitRate.toFixed(2)}%` : ''}
                        </td>
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
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 매도 기록 */}
      {sells.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-400">매도 기록</h3>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${totalRealizedGainKRW >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                실현 손익 {totalRealizedGainKRW >= 0 ? '+' : ''}₩{formatKRW(totalRealizedGainKRW)}
              </span>
              <span className="text-xs text-gray-600">{sells.length}건</span>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">날짜</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">종목</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">수량</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">매입가</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">매도가</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">실현 손익 (₩)</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(showAllSells ? sells : sells.slice(0, SELLS_PAGE)).map((sell) => {
                const sym = CURRENCIES[sell.currency]?.symbol || ''
                return (
                  <tr key={sell.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                    <td className="px-5 py-3 text-gray-300">{sell.sellDate}</td>
                    <td className="px-4 py-3">
                      <p className="text-white">{sell.name}</p>
                      {sell.ticker && <p className="text-xs text-gray-500 font-mono">{sell.ticker}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">{sell.quantity.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-400">
                      {sym}{sell.currency === 'KRW' ? formatKRW(sell.avgPurchasePrice) : formatUSD(sell.avgPurchasePrice)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {sym}{sell.currency === 'KRW' ? formatKRW(sell.sellPrice) : formatUSD(sell.sellPrice)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${sell.realizedGainKRW >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {sell.realizedGainKRW >= 0 ? '+' : ''}₩{formatKRW(sell.realizedGainKRW)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { if (confirm(`${sell.name} 매도 기록을 삭제할까요?`)) deleteSell(sell.id) }}
                        className="text-xs text-gray-500 hover:text-red-400 transition px-2 py-1 rounded hover:bg-gray-700"
                      >삭제</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {sells.length > SELLS_PAGE && (
            <div className="px-5 py-3 border-t border-gray-800 text-center">
              <button
                onClick={() => setShowAllSells((v) => !v)}
                className="text-xs text-gray-400 hover:text-white transition"
              >
                {showAllSells ? '접기 ▲' : `${sells.length - SELLS_PAGE}건 더 보기 ▼`}
              </button>
            </div>
          )}
        </div>
      )}

      {modal !== null && (
        <AssetModal
          initial={modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {sellModal && (
        <SellModal
          {...sellModal}
          exchangeRate={settings.exchangeRate}
          onClose={() => setSellModal(null)}
          onConfirm={handleSell}
        />
      )}

      {divModal && (
        <DivModal
          group={divModal}
          onSave={handleDivSave}
          onClose={() => setDivModal(null)}
        />
      )}
    </div>
  )
}
