import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useAssets } from '../hooks/useAssets'
import { useSettings } from '../hooks/useSettings'
import { CATEGORIES } from '../lib/constants'
import { formatKRW, toKRW, calcReturn, calcProfit } from '../lib/utils'

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-white'}`}>{value}</p>
      {sub && <p className="text-sm text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const { name, value } = payload[0].payload
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
        <p className="text-white font-medium">{name}</p>
        <p className="text-gray-300">₩{formatKRW(value)}</p>
      </div>
    )
  }
  return null
}

export default function Dashboard() {
  const { assets, loading: assetsLoading } = useAssets()
  const { settings, loading: settingsLoading } = useSettings()

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
      color: CATEGORIES[cat]?.color || '#6b7280',
    }))

    return { totalCurrent, totalPurchase, profitAmt, profitRate, pieData }
  }, [assets, settings.exchangeRate])

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
      <h2 className="text-xl font-bold text-white">대시보드</h2>

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">카테고리별 비중</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={stats?.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {stats?.pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => <span className="text-xs text-gray-300">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top Assets */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">비중 TOP 5</h3>
            <div className="space-y-3">
              {topAssets.map((asset) => {
                const rate = settings.exchangeRate
                const currentVal = toKRW(asset.currentPrice, asset.quantity, asset.currency, rate)
                const profitAmt = calcProfit(asset.purchasePrice, asset.currentPrice, asset.quantity)
                const profitKRW = asset.currency === 'USD' ? profitAmt * rate : profitAmt
                const profitRate = calcReturn(asset.purchasePrice, asset.currentPrice)
                const pct = stats?.totalCurrent > 0 ? (currentVal / stats.totalCurrent) * 100 : 0

                return (
                  <div key={asset.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: CATEGORIES[asset.category]?.color }}
                        />
                        <span className="text-sm text-white truncate max-w-[120px]">{asset.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-white">₩{formatKRW(currentVal)}</span>
                        <span className={`ml-2 text-xs ${profitRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {profitRate >= 0 ? '+' : ''}{profitRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: CATEGORIES[asset.category]?.color,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{pct.toFixed(1)}% 비중</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
