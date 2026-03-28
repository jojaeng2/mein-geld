import { useMemo, useEffect, useRef, useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { useAssets } from '../hooks/useAssets'
import { useSettings } from '../hooks/useSettings'
import { useSnapshots } from '../hooks/useSnapshots'
import { useSells } from '../hooks/useSells'
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
  const { snapshots, loading: snapshotsLoading, saveSnapshot, deleteSnapshot } = useSnapshots()
  const { sells } = useSells()
  const savedRef = useRef(false)
  const [sellTab, setSellTab] = useState('all')

  const currentTotal = useMemo(() => {
    const rate = settings.exchangeRate
    return assets.reduce((sum, a) => sum + toKRW(a.currentPrice, a.quantity, a.currency, rate), 0)
  }, [assets, settings.exchangeRate])

  useEffect(() => {
    if (assetsLoading || settingsLoading || snapshotsLoading) return
    if (assets.length === 0) return
    if (savedRef.current) return
    savedRef.current = true
    const today = new Date().toISOString().slice(0, 10)
    const existing = snapshots.find((s) => s.date === today)
    const run = async () => {
      if (existing) await deleteSnapshot(existing.id)
      await saveSnapshot({
        date: today,
        totalKRW: currentTotal,
        exchangeRate: settings.exchangeRate,
        assetCount: assets.length,
      })
    }
    run().catch(() => { savedRef.current = false })
  }, [assetsLoading, settingsLoading, snapshotsLoading])

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

  const maturityAssets = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return assets
      .filter((a) => a.maturityDate)
      .map((a) => {
        const diffMs = new Date(a.maturityDate) - new Date(today)
        const dDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
        return { ...a, dDays }
      })
      .sort((a, b) => a.dDays - b.dDays)
  }, [assets])

  const DEDUCTION = 2_500_000 // 해외주식 양도소득세 기본공제 250만원
  const currentYear = new Date().getFullYear().toString()

  const filteredSells = useMemo(() => {
    if (sellTab === 'domestic') return sells.filter((s) => s.currency === 'KRW')
    if (sellTab === 'overseas') return sells.filter((s) => s.currency !== 'KRW')
    return sells
  }, [sells, sellTab])

  const totalGainKRW = filteredSells.reduce((s, sell) => s + (sell.realizedGainKRW ?? 0), 0)

  const overseasGainThisYear = useMemo(() =>
    sells
      .filter((s) => s.currency !== 'KRW' && s.sellDate?.startsWith(currentYear))
      .reduce((s, sell) => s + (sell.realizedGainKRW ?? 0), 0)
  , [sells, currentYear])

  const taxableGain  = Math.max(0, overseasGainThisYear - DEDUCTION)
  const estimatedTax = Math.round(taxableGain * 0.22)

  if (assetsLoading || settingsLoading) {
    return <div className="p-8 text-gray-400">로딩 중...</div>
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">대시보드</h2>
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

      {/* 실현 손익 */}
      {(
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-400">실현 손익</h3>
            <div className="flex gap-1">
              {[['all', '전체'], ['domestic', '국내'], ['overseas', '해외']].map(([v, label]) => (
                <button key={v} onClick={() => setSellTab(v)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition ${sellTab === v ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">실현 손익 합계</p>
              <p className={`text-2xl font-bold ${totalGainKRW >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalGainKRW >= 0 ? '+' : ''}₩{formatKRW(totalGainKRW)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">거래 횟수</p>
              <p className="text-2xl font-bold text-white">{filteredSells.length}건</p>
            </div>
          </div>

          {/* 해외주식 세금 추정 */}
          {(sellTab === 'overseas' || sellTab === 'all') && overseasGainThisYear !== 0 && (
            <div className="bg-gray-800 rounded-lg p-4 text-sm space-y-2 mb-4">
              <p className="text-gray-400 font-medium text-xs mb-2">{currentYear}년 해외주식 양도소득세 추정</p>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">해외주식 실현 수익</span>
                  <span className={overseasGainThisYear >= 0 ? 'text-white' : 'text-red-400'}>
                    {overseasGainThisYear >= 0 ? '' : '-'}₩{formatKRW(Math.abs(overseasGainThisYear))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">기본공제</span>
                  <span className="text-gray-400">- ₩{formatKRW(DEDUCTION)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-700 pt-1.5">
                  <span className="text-gray-500">과세표준</span>
                  <span className={taxableGain > 0 ? 'text-yellow-400' : 'text-gray-400'}>₩{formatKRW(taxableGain)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">예상 세금 (22%)</span>
                  <span className={estimatedTax > 0 ? 'text-red-400 font-semibold' : 'text-gray-400'}>
                    {estimatedTax > 0 ? `- ₩${formatKRW(estimatedTax)}` : '없음'}
                  </span>
                </div>
                {estimatedTax > 0 && (
                  <div className="flex justify-between border-t border-gray-700 pt-1.5">
                    <span className="text-gray-400 font-medium">세후 실수령</span>
                    <span className="text-green-400 font-semibold">₩{formatKRW(overseasGainThisYear - estimatedTax)}</span>
                  </div>
                )}
              </div>
              {taxableGain <= 0 && overseasGainThisYear > 0 && (
                <p className="text-xs text-green-500 pt-1">기본공제(250만원) 이하 — 세금 없음</p>
              )}
            </div>
          )}

          {/* 최근 매도 목록 */}
          {filteredSells.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-2">아직 매도 기록이 없습니다.</p>
          ) : (
            <div className="space-y-0">
              {filteredSells.slice(0, 5).map((sell) => (
                <div key={sell.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <div>
                    <span className="text-sm text-white">{sell.name}</span>
                    {sell.ticker && <span className="ml-1.5 text-xs text-gray-500 font-mono">{sell.ticker}</span>}
                    <span className="ml-2 text-xs text-gray-600">{sell.sellDate}</span>
                  </div>
                  <span className={`text-sm font-medium ${sell.realizedGainKRW >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {sell.realizedGainKRW >= 0 ? '+' : ''}₩{formatKRW(sell.realizedGainKRW)}
                  </span>
                </div>
              ))}
              {filteredSells.length > 5 && (
                <p className="text-xs text-gray-600 text-center pt-2">+{filteredSells.length - 5}건 더 (자산 페이지에서 전체 확인)</p>
              )}
            </div>
          )}
        </div>
      )}

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

          {/* 만기 예정 */}
          {maturityAssets.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-4">만기 예정</h3>
              <div className="space-y-2">
                {maturityAssets.map((a) => {
                  const isExpired = a.dDays < 0
                  const isUrgent = a.dDays >= 0 && a.dDays <= 30
                  const isSoon = a.dDays > 30 && a.dDays <= 90
                  const dLabel = isExpired
                    ? `만기 지남 (${Math.abs(a.dDays)}일 전)`
                    : a.dDays === 0 ? 'D-Day' : `D-${a.dDays}`
                  const dColor = isExpired ? 'text-gray-500' : isUrgent ? 'text-red-400' : isSoon ? 'text-yellow-400' : 'text-gray-400'
                  return (
                    <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                      <div>
                        <p className="text-sm text-white">{a.name}</p>
                        <p className="text-xs text-gray-500">{a.maturityDate} · {a.category === 'cash' ? '예금/적금' : a.category === 'real_estate' ? '부동산' : a.category}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${dColor}`}>{dLabel}</p>
                        {a.currentPrice > 0 && (
                          <p className="text-xs text-gray-400">₩{formatKRW(a.currentPrice * (a.quantity ?? 1))}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
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
