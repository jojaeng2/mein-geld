import { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { useAssets } from '../hooks/useAssets'
import { useSettings } from '../hooks/useSettings'
import { useCalculatorSettings } from '../hooks/useCalculatorSettings'
import { CATEGORIES } from '../lib/constants'
import { formatKRW, toKRW } from '../lib/utils'

const DEFAULT_CAPITAL  = { stock: 8, crypto: 20, cash: 3, real_estate: 3, pension: 5, other: 5 }
const DEFAULT_DIVIDEND = { stock: 2, crypto: 0,  cash: 0, real_estate: 4, pension: 1, other: 0 }

function formatYAxis(v) {
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}조`
  if (v >= 1e8)  return `${(v / 1e8).toFixed(1)}억`
  if (v >= 1e4)  return `${Math.round(v / 1e4)}만`
  return formatKRW(v)
}

function RateInput({ value, onChange }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <input
        type="number" min="0" max="100" step="0.5"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 text-right bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5
                   text-white text-sm focus:outline-none focus:border-brand-500 transition"
      />
      <span className="text-gray-500 text-xs">%</span>
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const total     = payload.find((p) => p.dataKey === '예상금액')?.value ?? 0
  const holding   = payload.find((p) => p.dataKey === '현재자산')?.value ?? 0
  const added     = payload.find((p) => p.dataKey === '추가투자')?.value ?? 0
  const principal = payload.find((p) => p.dataKey === '원금')?.value ?? 0
  const div       = payload.find((p) => p.dataKey === '연간배당금')?.value ?? 0
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm min-w-[200px]">
      <p className="text-gray-400 mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">예상 총자산</span>
          <span className="text-white font-medium">₩{formatKRW(total)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">└ 현재 자산 성장</span>
          <span className="text-brand-300">₩{formatKRW(holding)}</span>
        </div>
        {added > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">└ 추가 투자 적립</span>
            <span className="text-purple-300">₩{formatKRW(added)}</span>
          </div>
        )}
        <div className="flex justify-between gap-4 pt-1 border-t border-gray-700/60">
          <span className="text-gray-500">투입 원금</span>
          <span className="text-gray-400">₩{formatKRW(principal)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">복리 수익</span>
          <span className="text-green-400">+₩{formatKRW(total - principal)}</span>
        </div>
        {div > 0 && (
          <div className="flex justify-between gap-4 pt-1 border-t border-gray-700/60">
            <span className="text-yellow-400">연간 배당금</span>
            <span className="text-yellow-300">₩{formatKRW(div)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Calculator() {
  const { assets, loading: assetsLoading } = useAssets()
  const { settings: appSettings }          = useSettings()
  const { settings, loading: calcLoading, saving, update } = useCalculatorSettings()

  const { years, reinvest, capitalRates, divRates, monthlyAmounts, monthlySalary } = settings

  const groups = useMemo(() => {
    const exRate = appSettings.exchangeRate
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
        const cat = records[0].category
        const rep = records[0]
        // 배당률 자동 계산: divPerShare × 연간 지급 횟수 / 현재 단가
        const autoDivRate = rep.divPerShare && rep.divMonths?.length && rep.currentPrice
          ? (rep.divPerShare * rep.divMonths.length) / rep.currentPrice * 100
          : 0
        return {
          key,
          name: rep.name,
          ticker: rep.ticker,
          category: cat,
          currentValue,
          capitalRate: capitalRates[key] ?? DEFAULT_CAPITAL[cat] ?? 8,
          divRate:     divRates[key]     ?? autoDivRate,
        }
      })
      .filter((g) => g.currentValue > 0)
      .sort((a, b) => b.currentValue - a.currentValue)
  }, [assets, appSettings.exchangeRate, capitalRates, divRates])

  const totalCurrent    = groups.reduce((s, g) => s + g.currentValue, 0)
  const totalMonthlyAdd = groups.reduce((s, g) => s + (Number(monthlyAmounts[g.key]) || 0), 0)
  const investRatio     = monthlySalary > 0 ? (totalMonthlyAdd / monthlySalary) * 100 : 0

  const weightedRate = useMemo(() => {
    if (totalCurrent === 0) return 0
    return groups.reduce((s, g) => {
      const effective = g.capitalRate + (reinvest ? g.divRate : 0)
      return s + effective * (g.currentValue / totalCurrent)
    }, 0)
  }, [groups, totalCurrent, reinvest])

  function projectHolding(g, n) {
    const effective = g.capitalRate + (reinvest ? g.divRate : 0)
    const r = effective / 100 / 12
    if (r === 0) return g.currentValue
    return g.currentValue * (1 + r) ** n
  }

  function projectAssetMonthly(g, n) {
    const monthly = Number(monthlyAmounts[g.key]) || 0
    if (monthly === 0) return 0
    const effective = g.capitalRate + (reinvest ? g.divRate : 0)
    const r = effective / 100 / 12
    if (r === 0) return monthly * n
    return monthly * ((1 + r) ** n - 1) / r
  }

  function annualDividend(g, year) {
    const r = g.capitalRate / 100 / 12
    const n = year * 12
    const capitalValue = r === 0 ? g.currentValue : g.currentValue * (1 + r) ** n
    return capitalValue * (g.divRate / 100)
  }

  const chartData = useMemo(() => {
    return Array.from({ length: years + 1 }, (_, year) => {
      const n = year * 12
      let holdingTotal = 0
      let divTotal = 0
      for (const g of groups) {
        holdingTotal += projectHolding(g, n)
        divTotal     += annualDividend(g, year)
      }
      let addedTotal = 0
      for (const g of groups) addedTotal += projectAssetMonthly(g, n)
      return {
        year:       `${year}년`,
        현재자산:   Math.round(holdingTotal),
        추가투자:   Math.round(addedTotal),
        예상금액:   Math.round(holdingTotal + addedTotal),
        원금:       Math.round(totalCurrent + totalMonthlyAdd * 12 * year),
        연간배당금: Math.round(divTotal),
      }
    })
  }, [groups, years, totalMonthlyAdd, totalCurrent, reinvest, weightedRate])

  const assetProjection = useMemo(() => {
    const n = years * 12
    return groups.map((g) => ({
      ...g,
      projected: Math.round(projectHolding(g, n)),
      yearlyDiv: Math.round(annualDividend(g, years)),
    }))
  }, [groups, years, reinvest])

  const last           = chartData[chartData.length - 1]
  const finalHolding   = last?.현재자산 ?? 0
  const finalAdded     = last?.추가투자 ?? 0
  const finalTotal     = last?.예상금액 ?? 0
  const finalDiv       = last?.연간배당금 ?? 0
  const currentDiv     = chartData[0]?.연간배당금 ?? 0
  const totalPrincipal = totalCurrent + totalMonthlyAdd * 12 * years
  const totalInterest  = finalTotal - totalPrincipal
  const interestPct    = totalPrincipal > 0 ? (totalInterest / totalPrincipal) * 100 : 0
  const tickInterval   = Math.max(1, Math.ceil(years / 10))

  const divMilestones = [1, 3, 5, 10, years]
    .filter((y, i, arr) => y <= years && arr.indexOf(y) === i)
    .map((y) => ({
      year: y,
      annual:  chartData[y]?.연간배당금 ?? 0,
      monthly: Math.round((chartData[y]?.연간배당금 ?? 0) / 12),
    }))


  if (assetsLoading || calcLoading) return <div className="p-8 text-gray-400">로딩 중...</div>

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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">복리 계산기</h2>
        {saving && <span className="text-xs text-gray-500">저장 중...</span>}
      </div>

      {/* 설정 바 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-wrap gap-8 items-end">
        <div>
          <label className="label">투자 기간</label>
          <div className="flex items-center gap-3 mt-1">
            <input
              type="range" min="1" max="30" value={years}
              onChange={(e) => update({ years: Number(e.target.value) })}
              className="w-40 accent-brand-500"
            />
            <span className="text-white font-bold text-lg w-14">{years}년</span>
          </div>
        </div>

        <div>
          <label className="label">배당금 처리</label>
          <div className="flex rounded-lg overflow-hidden border border-gray-700 mt-1">
            <button
              onClick={() => update({ reinvest: true })}
              className={`px-4 py-2 text-sm font-medium transition ${reinvest ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              재투자
            </button>
            <button
              onClick={() => update({ reinvest: false })}
              className={`px-4 py-2 text-sm font-medium transition ${!reinvest ? 'bg-yellow-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              현금 수령
            </button>
          </div>
        </div>

        <div>
          <label className="label">월 고정 수입</label>
          <div className="flex items-center gap-1.5 mt-1">
            <input
              type="number" min="0" step="100000"
              value={monthlySalary || ''}
              placeholder="0"
              onChange={(e) => update({ monthlySalary: Number(e.target.value) || 0 })}
              className="w-36 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500 transition"
            />
            <span className="text-gray-500 text-xs">₩/월</span>
          </div>
        </div>

        {monthlySalary > 0 && (
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center justify-between mb-1.5">
              <label className="label">월 투자 비율</label>
              <span className="text-sm">
                <span className="text-purple-300 font-medium">₩{formatKRW(totalMonthlyAdd)}</span>
                <span className="text-gray-600"> / ₩{formatKRW(monthlySalary)}</span>
                <span className={`ml-1.5 font-bold ${investRatio >= 30 ? 'text-green-400' : investRatio >= 10 ? 'text-brand-400' : 'text-gray-400'}`}>
                  {investRatio.toFixed(1)}%
                </span>
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, investRatio)}%`,
                  backgroundColor: investRatio >= 30 ? '#4ade80' : investRatio >= 10 ? '#0ea5e9' : '#6b7280',
                }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {totalMonthlyAdd < monthlySalary
                ? `잔여 ₩${formatKRW(monthlySalary - totalMonthlyAdd)} / 월`
                : '월 수입 전액 투자 중'}
            </p>
          </div>
        )}
      </div>

      {/* 종목별 수익률 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-400">종목별 수익률 설정</h3>
          <p className="text-xs text-gray-600">{years}년 후 예상은 현재 보유분 기준 · 설정은 자동 저장됩니다</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">종목</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">현재 평가액</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">비중</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">연 수익률</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">배당수익률</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">월 추가 투자</th>
                <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium">{years}년 후 예상</th>
              </tr>
            </thead>
            <tbody>
              {assetProjection.map((g) => {
                const weight  = totalCurrent > 0 ? (g.currentValue / totalCurrent) * 100 : 0
                const gain    = g.projected - g.currentValue
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
                        <div className="w-14 bg-gray-800 rounded-full h-1">
                          <div className="h-1 rounded-full" style={{ width: `${weight}%`, backgroundColor: CATEGORIES[g.category]?.color }} />
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">{weight.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RateInput
                        value={g.capitalRate}
                        onChange={(v) => update({ capitalRates: { ...capitalRates, [g.key]: v } })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <RateInput
                          value={g.divRate}
                          onChange={(v) => update({ divRates: { ...divRates, [g.key]: v } })}
                        />
                        {g.divRate > 0 && (
                          <p className="text-xs text-yellow-500 text-right">
                            현재 연 ₩{formatKRW(Math.round(g.currentValue * g.divRate / 100))}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number" min="0" step="10000"
                          value={monthlyAmounts[g.key] || ''}
                          placeholder="0"
                          onChange={(e) => update({ monthlyAmounts: { ...monthlyAmounts, [g.key]: Number(e.target.value) || 0 } })}
                          className="w-24 text-right bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5
                                     text-white text-sm focus:outline-none focus:border-brand-500 transition"
                        />
                        <span className="text-gray-500 text-xs">₩</span>
                      </div>
                      {monthlySalary > 0 && monthlyAmounts[g.key] > 0 && (
                        <p className="text-xs text-gray-600 text-right mt-0.5">
                          급여의 {((monthlyAmounts[g.key] / monthlySalary) * 100).toFixed(1)}%
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <p className="text-white font-medium">₩{formatKRW(g.projected)}</p>
                      <p className="text-xs text-green-400">+{gainPct.toFixed(0)}%</p>
                      {g.divRate > 0 && (
                        <p className="text-xs text-yellow-400">배당 ₩{formatKRW(g.yearlyDiv)}/년</p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-700 bg-gray-800/40">
                <td className="px-5 py-3 text-sm font-medium text-gray-300">합계</td>
                <td className="px-4 py-3 text-right text-white font-medium">₩{formatKRW(totalCurrent)}</td>
                <td colSpan="3" className="px-4 py-3 text-right text-xs text-gray-500">
                  포트폴리오 평균 수익률 <span className="text-brand-400 font-medium">{weightedRate.toFixed(1)}%</span>
                </td>
                <td className="px-4 py-3 text-right text-sm text-purple-300 font-medium">
                  {totalMonthlyAdd > 0 ? `월 ₩${formatKRW(totalMonthlyAdd)}` : <span className="text-gray-600 text-xs">—</span>}
                </td>
                <td className="px-5 py-3 text-right">
                  <p className="text-brand-400 font-bold">₩{formatKRW(finalHolding)}</p>
                  <p className="text-xs text-gray-500">{years}년 후 현재 자산</p>
                  {totalMonthlyAdd > 0 && (
                    <>
                      <p className="text-purple-300 font-medium mt-1">+₩{formatKRW(finalAdded)}</p>
                      <p className="text-xs text-gray-500">+ 추가 투자 적립</p>
                    </>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">현재 총자산</p>
          <p className="text-xl font-bold text-white">₩{formatKRW(totalCurrent)}</p>
          {currentDiv > 0 && <p className="text-xs text-yellow-400 mt-1">배당 ₩{formatKRW(currentDiv)}/년</p>}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">{years}년 후 예상</p>
          <p className="text-xl font-bold text-brand-400">₩{formatKRW(finalTotal)}</p>
          {finalDiv > 0 && <p className="text-xs text-yellow-400 mt-1">배당 ₩{formatKRW(finalDiv)}/년</p>}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">복리 수익</p>
          <p className="text-xl font-bold text-green-400">+₩{formatKRW(totalInterest)}</p>
          <p className="text-xs text-green-500 mt-1">+{interestPct.toFixed(1)}%</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">배당 처리</p>
          <p className={`text-xl font-bold ${reinvest ? 'text-brand-400' : 'text-yellow-400'}`}>
            {reinvest ? '재투자' : '현금 수령'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {reinvest ? '배당금을 다시 투자에 활용' : '배당금을 현금으로 받음'}
          </p>
        </div>
      </div>

      {/* 성장 차트 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-1">포트폴리오 성장 예측</h3>
        {totalMonthlyAdd > 0 && (
          <p className="text-xs text-gray-600 mb-4">파란 영역 = 현재 자산 성장 · 보라 영역 = 추가 투자 적립 · 점선 = 투입 원금</p>
        )}
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <defs>
              <linearGradient id="gradHolding" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradAdded" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} interval={tickInterval} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatYAxis} width={52} />
            <Tooltip content={<ChartTooltip />} />
            <Legend formatter={(v) => <span className="text-xs text-gray-300">{v}</span>} />
            <Area type="monotone" dataKey="원금" stroke="#374151" strokeWidth={1.5} strokeDasharray="5 3" fill="none" dot={false} />
            <Area type="monotone" dataKey="현재자산" name="현재 자산" stroke="#0ea5e9" strokeWidth={2} fill="url(#gradHolding)" dot={false} activeDot={{ r: 4 }} stackId="a" />
            {totalMonthlyAdd > 0 && (
              <Area type="monotone" dataKey="추가투자" name="추가 투자" stroke="#a855f7" strokeWidth={2} fill="url(#gradAdded)" dot={false} activeDot={{ r: 4 }} stackId="a" />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 배당 이정표 */}
      {finalDiv > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-400">연간 배당금 예측</h3>
            <span className="text-xs text-gray-600">
              {reinvest ? '재투자 기준 자산가치 기반 환산' : '현금 수령 기준'} · 현재 보유분만 기준
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">시점</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">연간 배당금</th>
                <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium">월 환산</th>
              </tr>
            </thead>
            <tbody>
              {divMilestones.map(({ year, annual, monthly }) => (
                <tr key={year} className="border-b border-gray-800/50">
                  <td className="px-5 py-3 text-white">{year}년 후</td>
                  <td className="px-4 py-3 text-right text-yellow-400 font-medium">₩{formatKRW(annual)}</td>
                  <td className="px-5 py-3 text-right text-yellow-300">₩{formatKRW(monthly)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
