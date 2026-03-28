import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { useAssets } from '../hooks/useAssets'
import { useSettings } from '../hooks/useSettings'
import { useSnapshots } from '../hooks/useSnapshots'
import { CATEGORIES } from '../lib/constants'
import { formatKRW, toKRW, calcReturn } from '../lib/utils'

const DETAIL_COLORS = [
  '#818cf8', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24',
  '#f87171', '#fb923c', '#f472b6', '#4ade80', '#38bdf8',
  '#e879f9', '#facc15', '#2dd4bf', '#c084fc', '#7dd3fc',
]

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-white'}`}>{value}</p>
      {sub && <p className="text-sm text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function PieTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const { name, value, pct } = payload[0].payload
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
        <p className="text-white font-medium">{name}</p>
        <p className="text-gray-300">₩{formatKRW(value)}</p>
        {pct != null && <p className="text-gray-400 text-xs">{pct.toFixed(1)}%</p>}
      </div>
    )
  }
  return null
}

function AreaTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
        <p className="text-gray-400 mb-1">{label}</p>
        <p className="text-white font-medium">₩{formatKRW(payload[0].value)}</p>
      </div>
    )
  }
  return null
}

function formatYAxis(v) {
  if (v >= 1e8) return `${(v / 1e8).toFixed(0)}억`
  if (v >= 1e4) return `${Math.round(v / 1e4)}만`
  return formatKRW(v)
}

export default function Dashboard() {
  const { assets, loading: assetsLoading } = useAssets()
  const { settings, loading: settingsLoading } = useSettings()
  const { snapshots, saveSnapshot, deleteSnapshot } = useSnapshots()

  const currentTotal = useMemo(() => {
    const rate = settings.exchangeRate
    return assets.reduce((sum, a) => sum + toKRW(a.currentPrice, a.quantity, a.currency, rate), 0)
  }, [assets, settings.exchangeRate])

  async function handleSaveSnapshot() {
    const today = new Date().toISOString().slice(0, 10)
    const already = snapshots.find((s) => s.date === today)
    if (already) {
      if (!confirm(`오늘(${today}) 스냅샷이 이미 있습니다. 덮어쓸까요?`)) return
      await deleteSnapshot(already.id)
    }
    await saveSnapshot({
      date: today,
      totalKRW: currentTotal,
      exchangeRate: settings.exchangeRate,
      assetCount: assets.length,
    })
  }

  const stats = useMemo(() => {
    if (!assets.length) return null
    const rate = settings.exchangeRate
    let totalCurrent = 0
    let totalPurchase = 0
    const byCategory = {}

    for (const asset of assets) {
      const current = toKRW(asset.currentPrice, asset.quantity, asset.currency, rate)
      const purchase = toKRW(asset.purchasePrice, asset.quantity, asset.currency, rate)
      totalCurrent += current
      totalPurchase += purchase
      if (!byCategory[asset.category]) byCategory[asset.category] = 0
      byCategory[asset.category] += current
    }

    const profitAmt = totalCurrent - totalPurchase
    const profitRate = totalPurchase > 0 ? ((profitAmt / totalPurchase) * 100) : 0
    const pieData = Object.entries(byCategory).map(([cat, value]) => ({
      name: CATEGORIES[cat]?.label || cat,
      value,
      pct: totalCurrent > 0 ? (value / totalCurrent) * 100 : 0,
      color: CATEGORIES[cat]?.color || '#6b7280',
    }))

    return { totalCurrent, totalPurchase, profitAmt, profitRate, pieData }
  }, [assets, settings.exchangeRate])

  const detailData = useMemo(() => {
    const rate = settings.exchangeRate
    const map = new Map()
    for (const asset of assets) {
      const key = asset.ticker || asset.name
      const val = toKRW(asset.currentPrice, asset.quantity, asset.currency, rate)
      if (!map.has(key)) map.set(key, { name: asset.name, value: 0 })
      map.get(key).value += val
    }
    const total = Array.from(map.values()).reduce((s, v) => s + v.value, 0)
    return Array.from(map.values())
      .sort((a, b) => b.value - a.value)
      .map((item, i) => ({
        ...item,
        pct: total > 0 ? (item.value / total) * 100 : 0,
        color: DETAIL_COLORS[i % DETAIL_COLORS.length],
      }))
  }, [assets, settings.exchangeRate])

  // 최근 3개월 스냅샷 미니 차트
  const recentChartData = useMemo(() => {
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - 3)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    return snapshots
      .filter((s) => s.date >= cutoffStr)
      .map((s) => ({ date: s.date.slice(5), total: s.totalKRW })) // MM-DD
  }, [snapshots])

  const topAssets = useMemo(() => {
    const rate = settings.exchangeRate
    return [...assets]
      .sort((a, b) => toKRW(b.currentPrice, b.quantity, b.currency, rate) - toKRW(a.currentPrice, a.quantity, a.currency, rate))
      .slice(0, 5)
  }, [assets, settings.exchangeRate])

  if (assetsLoading || settingsLoading) {
    return <div className="p-8 text-gray-400">로딩 중...</div>
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">대시보드</h2>
        <button
          onClick={handleSaveSnapshot}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition"
        >
          오늘 스냅샷 저장
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="총 자산"
          value={`₩${formatKRW(stats?.totalCurrent ?? 0)}`}
          sub={`${assets.length}개 자산`}
        />
        <StatCard
          label="총 매입가"
          value={`₩${formatKRW(stats?.totalPurchase ?? 0)}`}
        />
        <StatCard
          label="평가 손익"
          value={`${stats?.profitAmt >= 0 ? '+' : ''}₩${formatKRW(stats?.profitAmt ?? 0)}`}
          color={!stats ? 'text-white' : stats.profitAmt >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <StatCard
          label="수익률"
          value={`${stats?.profitRate >= 0 ? '+' : ''}${stats?.profitRate?.toFixed(2) ?? '0.00'}%`}
          sub={`환율: ₩${formatKRW(settings.exchangeRate)}/USD`}
          color={!stats ? 'text-white' : stats.profitRate >= 0 ? 'text-green-400' : 'text-red-400'}
        />
      </div>

      {assets.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400">아직 자산이 없습니다.</p>
          <p className="text-sm text-gray-500 mt-1">자산 관리 메뉴에서 자산을 추가해보세요.</p>
        </div>
      ) : (
        <>
          {/* 두 가지 비중 차트 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-4">카테고리별 비중</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={stats?.pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={3} dataKey="value">
                    {stats?.pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend formatter={(value, entry) => (
                    <span className="text-xs text-gray-300">{value} <span className="text-gray-500">{entry.payload.pct?.toFixed(1)}%</span></span>
                  )} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-4">종목별 상세 비중</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={detailData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={2} dataKey="value">
                    {detailData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend formatter={(value, entry) => (
                    <span className="text-xs text-gray-300">{value} <span className="text-gray-500">{entry.payload.pct?.toFixed(1)}%</span></span>
                  )} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 최근 3개월 추이 */}
          {recentChartData.length >= 2 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-4">최근 3개월 자산 추이</h3>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={recentChartData} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={formatYAxis} width={42} />
                  <Tooltip content={<AreaTooltip />} />
                  <Area type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={2} fill="url(#colorTotal)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 비중 TOP 5 */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">비중 TOP 5</h3>
            <div className="space-y-3">
              {topAssets.map((asset) => {
                const rate = settings.exchangeRate
                const currentVal = toKRW(asset.currentPrice, asset.quantity, asset.currency, rate)
                const profitRate = calcReturn(asset.purchasePrice, asset.currentPrice)
                const pct = stats?.totalCurrent > 0 ? (currentVal / stats.totalCurrent) * 100 : 0
                return (
                  <div key={asset.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORIES[asset.category]?.color }} />
                        <span className="text-sm text-white truncate max-w-[160px]">{asset.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-white">₩{formatKRW(currentVal)}</span>
                        <span className={`ml-2 text-xs ${profitRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {profitRate >= 0 ? '+' : ''}{profitRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: CATEGORIES[asset.category]?.color }} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{pct.toFixed(1)}% 비중</p>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
