import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { useAssets } from '../hooks/useAssets'
import { useSettings } from '../hooks/useSettings'
import { CATEGORIES } from '../lib/constants'
import { formatKRW, toKRW } from '../lib/utils'

// 카테고리별 기본 기대 수익률
const DEFAULT_RATES = {
  stock: 10,
  crypto: 20,
  cash: 3,
  real_estate: 5,
  pension: 6,
  other: 5,
}

const RATES_KEY = 'mg_calc_rates'

function formatYAxis(v) {
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}조`
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}억`
  if (v >= 1e4) return `${Math.round(v / 1e4)}만`
  return formatKRW(v)
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const total = payload.find((p) => p.dataKey === '예상금액')?.value ?? 0
  const principal = payload.find((p) => p.dataKey === '원금')?.value ?? 0
  const interest = total - principal
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm min-w-[180px]">
      <p className="text-gray-400 mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">예상 총자산</span>
          <span className="text-white font-medium">₩{formatKRW(total)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">투입 원금</span>
          <span className="text-gray-300">₩{formatKRW(principal)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">복리 수익</span>
          <span className="text-green-400">+₩{formatKRW(interest)}</span>
        </div>
      </div>
    </div>
  )
}

export default function Calculator() {
  const { assets, loading } = useAssets()
  const { settings } = useSettings()

  const [years, setYears] = useState(10)
  const [monthlyAdd, setMonthlyAdd] = useState('')
  const [rates, setRates] = useState(() => {
    try { return JSON.parse(localStorage.getItem(RATES_KEY) || '{}') } catch { return {} }
  })

  // 동일 티커 그룹화 + 평가액 계산
  const groups = useMemo(() => {
    const exRate = settings.exchangeRate
    const map = new Map()
    for (const asset of assets) {
      const key = asset.ticker || `__${asset.id}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(asset)
    }
    return Array.from(map.entries())
      .map(([key, records]) => {
        const currentValue = records.reduce(
          (s, a) => s + toKRW(a.currentPrice, a.quantity, a.currency, exRate), 0
        )
        const category = records[0].category
        return {
          key,
          name: records[0].name,
          ticker: records[0].ticker,
          category,
          currentValue,
          rate: rates[key] ?? DEFAULT_RATES[category] ?? 8,
        }
      })
      .filter((g) => g.currentValue > 0)
      .sort((a, b) => b.currentValue - a.currentValue)
  }, [assets, settings.exchangeRate, rates])

  function setGroupRate(key, value) {
    const next = { ...rates, [key]: value }
    setRates(next)
    localStorage.setItem(RATES_KEY, JSON.stringify(next))
  }

  const totalCurrent = groups.reduce((s, g) => s + g.currentValue, 0)
  const monthlyNum = Number(monthlyAdd) || 0

  function projectValue(currentValue, annualRate, n, monthly) {
    const r = annualRate / 100 / 12
    if (r === 0) return currentValue + monthly * n
    return currentValue * (1 + r) ** n + monthly * ((1 + r) ** n - 1) / r
  }

  // 연도별 전체 포트폴리오 성장 데이터
  const chartData = useMemo(() => {
    return Array.from({ length: years + 1 }, (_, year) => {
      const n = year * 12
      let total = 0
      for (const g of groups) {
        const monthly = totalCurrent > 0 ? (g.currentValue / totalCurrent) * monthlyNum : 0
        total += projectValue(g.currentValue, g.rate, n, monthly)
      }
      const principal = totalCurrent + monthlyNum * 12 * year
      return {
        year: `${year}년`,
        예상금액: Math.round(total),
        원금: Math.round(principal),
      }
    })
  }, [groups, years, monthlyNum, totalCurrent])

  // 종목별 최종 예상값
  const assetProjection = useMemo(() => {
    const n = years * 12
    return groups.map((g) => {
      const monthly = totalCurrent > 0 ? (g.currentValue / totalCurrent) * monthlyNum : 0
      const projected = projectValue(g.currentValue, g.rate, n, monthly)
      return { ...g, projected: Math.round(projected) }
    })
  }, [groups, years, monthlyNum, totalCurrent])

  const finalTotal = chartData[chartData.length - 1]?.예상금액 ?? 0
  const totalPrincipal = totalCurrent + monthlyNum * 12 * years
  const totalInterest = finalTotal - totalPrincipal
  const interestPct = totalPrincipal > 0 ? (totalInterest / totalPrincipal) * 100 : 0
  const tickInterval = Math.max(1, Math.ceil(years / 10))

  if (loading) return <div className="p-8 text-gray-400">로딩 중...</div>

  if (assets.length === 0) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-bold text-white mb-4">복리 계산기</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400">자산을 먼저 등록해주세요.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <h2 className="text-xl font-bold text-white">복리 계산기</h2>

      {/* 기간 · 월 납입 설정 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-wrap gap-8 items-end">
        <div>
          <label className="label">투자 기간</label>
          <div className="flex items-center gap-3 mt-1">
            <input
              type="range" min="1" max="30" value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="w-40 accent-brand-500"
            />
            <span className="text-white font-bold text-lg w-14">{years}년</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">1년 ~ 30년</p>
        </div>
        <div>
          <label className="label">월 추가 납입 (₩)</label>
          <input
            type="number" min="0" step="10000"
            className="input w-48"
            placeholder="0"
            value={monthlyAdd}
            onChange={(e) => setMonthlyAdd(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">현재 비중에 비례해 분배됩니다</p>
        </div>
      </div>

      {/* 종목별 기대 수익률 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-400">종목별 기대 수익률</h3>
          <p className="text-xs text-gray-600">카테고리 기본값이 자동 적용됩니다. 직접 수정 가능.</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">종목</th>
              <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">현재 평가액</th>
              <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">비중</th>
              <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">연 기대 수익률</th>
              <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium">{years}년 후 예상</th>
            </tr>
          </thead>
          <tbody>
            {assetProjection.map((g) => {
              const weight = totalCurrent > 0 ? (g.currentValue / totalCurrent) * 100 : 0
              const gain = g.projected - g.currentValue
              const gainPct = g.currentValue > 0 ? (gain / g.currentValue) * 100 : 0
              return (
                <tr key={g.key} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORIES[g.category]?.color }} />
                      <div>
                        <p className="text-white font-medium">{g.name}</p>
                        {g.ticker && <p className="text-xs text-gray-500 font-mono">{g.ticker}</p>}
                        <p className="text-xs text-gray-600">{CATEGORIES[g.category]?.label}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">₩{formatKRW(g.currentValue)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-gray-800 rounded-full h-1">
                        <div className="h-1 rounded-full" style={{ width: `${weight}%`, backgroundColor: CATEGORIES[g.category]?.color }} />
                      </div>
                      <span className="text-xs text-gray-500 w-10 text-right">{weight.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number" min="0" max="100" step="0.5"
                        value={g.rate}
                        onChange={(e) => setGroupRate(g.key, Number(e.target.value))}
                        className="w-20 text-right bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-brand-500 transition"
                      />
                      <span className="text-gray-400 text-sm">%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <p className="text-white font-medium">₩{formatKRW(g.projected)}</p>
                    <p className="text-xs text-green-400">
                      +₩{formatKRW(gain)} (+{gainPct.toFixed(0)}%)
                    </p>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-700 bg-gray-800/40">
              <td className="px-5 py-3 text-sm font-medium text-gray-300">합계</td>
              <td className="px-4 py-3 text-right text-white font-medium">₩{formatKRW(totalCurrent)}</td>
              <td />
              <td />
              <td className="px-5 py-3 text-right">
                <p className="text-brand-400 font-bold">₩{formatKRW(finalTotal)}</p>
                <p className="text-xs text-green-400">+₩{formatKRW(totalInterest)} (+{interestPct.toFixed(0)}%)</p>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">현재 총자산</p>
          <p className="text-xl font-bold text-white">₩{formatKRW(totalCurrent)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">{years}년 후 예상</p>
          <p className="text-xl font-bold text-brand-400">₩{formatKRW(finalTotal)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">총 투입 원금</p>
          <p className="text-xl font-bold text-white">₩{formatKRW(totalPrincipal)}</p>
          {monthlyNum > 0 && <p className="text-xs text-gray-500 mt-1">월 {formatKRW(monthlyNum)} 납입 포함</p>}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">복리 수익</p>
          <p className="text-xl font-bold text-green-400">+₩{formatKRW(totalInterest)}</p>
          <p className="text-xs text-green-500 mt-1">+{interestPct.toFixed(1)}%</p>
        </div>
      </div>

      {/* 성장 차트 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-4">포트폴리오 성장 예측</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <defs>
              <linearGradient id="gradProjected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradPrincipal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4b5563" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#4b5563" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="year"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={tickInterval}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxis}
              width={52}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend formatter={(v) => <span className="text-xs text-gray-300">{v}</span>} />
            <Area
              type="monotone"
              dataKey="원금"
              stroke="#4b5563"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              fill="url(#gradPrincipal)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="예상금액"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#gradProjected)"
              dot={false}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
