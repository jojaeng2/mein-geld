import { useState } from 'react'
import { useAssets } from '../hooks/useAssets'
import { useSettings } from '../hooks/useSettings'
import { CATEGORIES, CURRENCIES } from '../lib/constants'
import { formatKRW, formatUSD, toKRW, calcReturn } from '../lib/utils'

const EMPTY_FORM = {
  name: '',
  category: 'stock',
  quantity: '',
  purchasePrice: '',
  currentPrice: '',
  currency: 'KRW',
  memo: '',
}

function AssetModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const [loading, setLoading] = useState(false)

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6">
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
                placeholder="0"
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
  const [modal, setModal] = useState(null) // null | 'add' | asset object
  const [filter, setFilter] = useState('all')

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

  if (loading) return <div className="p-8 text-gray-400">로딩 중...</div>

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">자산 관리</h2>
        <button
          onClick={() => setModal('add')}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition"
        >
          + 자산 추가
        </button>
      </div>

      {/* Category filter */}
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
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: CATEGORIES[asset.category]?.color }}
                        />
                        <div>
                          <p className="text-white font-medium">{asset.name}</p>
                          {asset.memo && <p className="text-xs text-gray-500">{asset.memo}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{CATEGORIES[asset.category]?.label}</td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {asset.quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {sym}{asset.currency === 'KRW' ? formatKRW(asset.currentPrice) : formatUSD(asset.currentPrice)}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-medium">
                      ₩{formatKRW(currentVal)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${profitRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {profitRate >= 0 ? '+' : ''}{profitRate.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setModal(asset)}
                          className="text-xs text-gray-400 hover:text-white transition px-2 py-1 rounded hover:bg-gray-700"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(asset)}
                          className="text-xs text-gray-400 hover:text-red-400 transition px-2 py-1 rounded hover:bg-gray-700"
                        >
                          삭제
                        </button>
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
