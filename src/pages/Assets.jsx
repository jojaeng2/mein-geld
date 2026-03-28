import { useState, useEffect, useRef } from 'react'
import { useAssets } from '../hooks/useAssets'
import { useSettings } from '../hooks/useSettings'
import { CATEGORIES, CURRENCIES } from '../lib/constants'
import { formatKRW, formatUSD, toKRW, calcReturn } from '../lib/utils'
import { fetchAssetPrice, searchCryptoTicker } from '../lib/priceService'
import { searchLocalStocks } from '../lib/stockList'

const EMPTY_FORM = {
  name: '',
  category: 'stock',
  quantity: '',
  purchasePrice: '',
  currentPrice: '',
  currency: 'KRW',
  ticker: '',
  memo: '',
}

function TickerSearch({ category, onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const timerRef = useRef(null)
  const wrapperRef = useRef(null)

  // 바깥 클릭 시 닫기
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
      // 암호화폐: CoinGecko API (무제한)
      timerRef.current = setTimeout(async () => {
        setSearching(true)
        try {
          setResults(await searchCryptoTicker(val))
        } catch {
          setResults([])
        } finally {
          setSearching(false)
        }
      }, 500)
    } else {
      // 주식/ETF: 로컬 데이터 검색 (API 사용 0회, 즉시 응답)
      setResults(searchLocalStocks(val))
    }
  }

  function handleSelect(item) {
    onSelect(item)
    setQuery('')
    setResults([])
    setOpen(false)
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
          {searching && (
            <div className="px-4 py-3 text-xs text-gray-400">검색 중...</div>
          )}
          {!searching && results.length === 0 && query && (
            <div className="px-4 py-3 text-xs text-gray-500">
              검색 결과 없음 —{' '}
              {category === 'crypto'
                ? 'CoinGecko ID를 직접 입력해보세요 (예: bitcoin)'
                : '티커를 직접 입력하세요 (국내: 종목코드.KS, 미국: AAPL)'}
            </div>
          )}
          {results.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(item)}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-700 transition border-b border-gray-700/50 last:border-0"
            >
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

function AssetModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [fetchingPrice, setFetchingPrice] = useState(false)
  const [priceError, setPriceError] = useState('')

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleTickerSelect(item) {
    if (form.category === 'crypto') {
      set('ticker', item.symbol) // CoinGecko ID
      if (!form.name) set('name', item.name)
    } else {
      set('ticker', item.symbol)
      if (!form.name) set('name', item.name)
      // 국내주식(KS/KQ)이면 KRW, 그 외엔 USD
      const isKorean = item.symbol.endsWith('.KS') || item.symbol.endsWith('.KQ')
      set('currency', isKorean ? 'KRW' : 'USD')
    }
  }

  async function handleFetchPrice() {
    if (!form.ticker) return
    setPriceError('')
    setFetchingPrice(true)
    try {
      const price = await fetchAssetPrice(
        { ticker: form.ticker, category: form.category, currency: form.currency }
      )
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
    await onSave({
      ...form,
      quantity: Number(form.quantity),
      purchasePrice: Number(form.purchasePrice),
      currentPrice: Number(form.currentPrice),
    })
    onClose()
  }

  const isEdit = Boolean(initial?.id)
  const hasTicker = ['stock', 'crypto'].includes(form.category)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-white mb-5">
          {isEdit ? '자산 수정' : '자산 추가'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">자산명</label>
              <input
                required
                className="input"
                placeholder="예: 삼성전자"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </div>

            <div>
              <label className="label">카테고리</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
              >
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">통화</label>
              <select
                className="input"
                value={form.currency}
                onChange={(e) => set('currency', e.target.value)}
              >
                {Object.entries(CURRENCIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            {hasTicker && (
              <div className="col-span-2 space-y-2">
                <label className="label">종목 검색</label>
                <TickerSearch category={form.category} onSelect={handleTickerSelect} />

                {form.ticker && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700">
                      <span className="text-xs text-gray-400">티커</span>
                      <span className="text-sm font-mono text-white">{form.ticker}</span>
                      <button
                        type="button"
                        onClick={() => set('ticker', '')}
                        className="ml-auto text-gray-500 hover:text-white text-xs"
                      >✕</button>
                    </div>
                    <button
                      type="button"
                      disabled={fetchingPrice}
                      onClick={handleFetchPrice}
                      className="px-3 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-xs rounded-lg transition whitespace-nowrap"
                    >
                      {fetchingPrice ? '조회 중...' : '가격 조회'}
                    </button>
                  </div>
                )}
                {priceError && (
                  <p className="text-xs text-red-400">{priceError}</p>
                )}
              </div>
            )}

            <div>
              <label className="label">수량</label>
              <input
                required
                type="number"
                min="0"
                step="any"
                className="input"
                placeholder="0"
                value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)}
              />
            </div>

            <div>
              <label className="label">매입 단가</label>
              <input
                required
                type="number"
                min="0"
                step="any"
                className="input"
                placeholder="0"
                value={form.purchasePrice}
                onChange={(e) => set('purchasePrice', e.target.value)}
              />
            </div>

            <div className="col-span-2">
              <label className="label">현재 단가</label>
              <input
                required
                type="number"
                min="0"
                step="any"
                className="input"
                placeholder="가격 조회 또는 직접 입력"
                value={form.currentPrice}
                onChange={(e) => set('currentPrice', e.target.value)}
              />
            </div>

            <div className="col-span-2">
              <label className="label">메모 (선택)</label>
              <input
                className="input"
                placeholder="메모"
                value={form.memo}
                onChange={(e) => set('memo', e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition text-sm font-medium"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition text-sm font-semibold disabled:opacity-50"
            >
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Assets() {
  const { assets, loading, addAsset, updateAsset, deleteAsset } = useAssets()
  const { settings } = useSettings()
  const [modal, setModal] = useState(null)
  const [filter, setFilter] = useState('all')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState(null)

  const filtered = filter === 'all' ? assets : assets.filter((a) => a.category === filter)

  async function handleSave(data) {
    if (data.id) {
      const { id, createdAt, ...rest } = data
      await updateAsset(id, rest)
    } else {
      await addAsset(data)
    }
  }

  async function handleDelete(asset) {
    if (confirm(`"${asset.name}"을 삭제할까요?`)) {
      await deleteAsset(asset.id)
    }
  }

  async function handleRefreshAllPrices() {
    const targets = assets.filter((a) => a.ticker)
    if (targets.length === 0) {
      alert('티커가 설정된 자산이 없습니다.')
      return
    }
    setRefreshing(true)
    setRefreshResult(null)
    let success = 0
    let failed = []

    for (const asset of targets) {
      try {
        const price = await fetchAssetPrice(asset)
        await updateAsset(asset.id, { ...asset, currentPrice: price })
        success++
        await new Promise((r) => setTimeout(r, 1200))
      } catch {
        failed.push(asset.name)
      }
    }

    setRefreshing(false)
    setRefreshResult({ success, failed })
  }

  if (loading) return <div className="p-8 text-gray-400">로딩 중...</div>

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">자산 관리</h2>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshAllPrices}
            disabled={refreshing}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
          >
            {refreshing ? '갱신 중...' : '↻ 현재가 갱신'}
          </button>
          <button
            onClick={() => setModal('add')}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition"
          >
            + 자산 추가
          </button>
        </div>
      </div>

      {refreshResult && (
        <div className={`text-sm rounded-lg px-4 py-2 border ${refreshResult.failed.length === 0 ? 'text-green-400 bg-green-950 border-green-800' : 'text-yellow-400 bg-yellow-950 border-yellow-800'}`}>
          {refreshResult.success}개 갱신 완료
          {refreshResult.failed.length > 0 && ` / 실패: ${refreshResult.failed.join(', ')}`}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === 'all' ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
        >
          전체
        </button>
        {Object.entries(CATEGORIES).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === k ? 'text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            style={filter === k ? { backgroundColor: v.color } : {}}
          >
            {v.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
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
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">현재가</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">평가금액 (₩)</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">수익률</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((asset) => {
                const rate = settings.exchangeRate
                const currentVal = toKRW(asset.currentPrice, asset.quantity, asset.currency, rate)
                const profitRate = calcReturn(asset.purchasePrice, asset.currentPrice)
                const sym = CURRENCIES[asset.currency]?.symbol

                return (
                  <tr key={asset.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORIES[asset.category]?.color }} />
                        <div>
                          <p className="text-white font-medium">{asset.name}</p>
                          {asset.ticker && <p className="text-xs text-gray-500 font-mono">{asset.ticker}</p>}
                          {asset.memo && !asset.ticker && <p className="text-xs text-gray-500">{asset.memo}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{CATEGORIES[asset.category]?.label}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{asset.quantity.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {sym}{asset.currency === 'KRW' ? formatKRW(asset.currentPrice) : formatUSD(asset.currentPrice)}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-medium">₩{formatKRW(currentVal)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${profitRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {profitRate >= 0 ? '+' : ''}{profitRate.toFixed(2)}%
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
