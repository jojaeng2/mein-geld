import { useMemo, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { useSnapshots } from '../hooks/useSnapshots'
import { formatKRW } from '../lib/utils'

const RANGES = [
  { label: '1개월', value: '1M', months: 1 },
  { label: '3개월', value: '3M', months: 3 },
  { label: '6개월', value: '6M', months: 6 },
  { label: '1년', value: '1Y', months: 12 },
  { label: '전체', value: 'ALL', months: null },
]

const MAX_CHART_POINTS = 60 // 이 이상이면 균등 샘플링

function formatYAxis(v) {
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}억`
  if (v >= 1e4) return `${Math.round(v / 1e4)}만`
  return formatKRW(v)
}

function formatDateTick(date, range) {
  if (!date) return ''
  if (range === '1M') return date.slice(5)       // MM-DD
  if (range === '3M' || range === '6M') return date.slice(5) // MM-DD
  return date.slice(0, 7)                          // YYYY-MM
}

function CustomTooltip({ active, payload, label, firstTotal }) {
  if (active && payload && payload.length) {
    const val = payload[0].value
    const diff = firstTotal != null ? val - firstTotal : null
    const pct = firstTotal && firstTotal > 0 ? ((val - firstTotal) / firstTotal * 100) : null
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm min-w-[160px]">
        <p className="text-gray-400 mb-1">{label}</p>
        <p className="text-white font-medium">₩{formatKRW(val)}</p>
        {diff !== null && (
          <p className={`text-xs mt-0.5 ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {diff >= 0 ? '+' : ''}₩{formatKRW(diff)} ({pct >= 0 ? '+' : ''}{pct?.toFixed(2)}%)
          </p>
        )}
      </div>
    )
  }
  return null
}

// 균등 샘플링: 시작·끝은 항상 포함
function downsample(data, maxPoints) {
  if (data.length <= maxPoints) return data
  const result = []
  const step = (data.length - 1) / (maxPoints - 1)
  for (let i = 0; i < maxPoints; i++) {
    result.push(data[Math.round(i * step)])
  }
  return result
}

export default function History() {
  const { snapshots, loading, deleteSnapshot } = useSnapshots()
  const [range, setRange] = useState('3M')

  const filteredData = useMemo(() => {
    let data = snapshots.map((s) => ({ date: s.date, total: s.totalKRW, id: s.id }))

    if (range !== 'ALL') {
      const months = RANGES.find((r) => r.value === range)?.months ?? 3
      const cutoff = new Date()
      cutoff.setMonth(cutoff.getMonth() - months)
      const cutoffStr = cutoff.toISOString().slice(0, 10)
      data = data.filter((d) => d.date >= cutoffStr)
    }

    return downsample(data, MAX_CHART_POINTS)
  }, [snapshots, range])

  const firstTotal = filteredData[0]?.total ?? null
  const lastTotal = filteredData[filteredData.length - 1]?.total ?? null
  const overallDiff = firstTotal != null && lastTotal != null ? lastTotal - firstTotal : null
  const overallPct = firstTotal && firstTotal > 0 ? ((overallDiff / firstTotal) * 100) : null

  const minVal = filteredData.length
    ? Math.min(...filteredData.map((d) => d.total)) * 0.97
    : 0

  if (loading) return <div className="p-4 text-gray-400">로딩 중...</div>

  return (
    <div className="p-4 md:p-8 space-y-6">
      <h2 className="text-xl font-bold text-white">히스토리</h2>

      {/* 요약 카드 */}
      {snapshots.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-1">스냅샷 수</p>
            <p className="text-2xl font-bold text-white">{snapshots.length}개</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-1">최근 총자산</p>
            <p className="text-2xl font-bold text-white">₩{formatKRW(snapshots[snapshots.length - 1]?.totalKRW ?? 0)}</p>
          </div>
          {overallDiff !== null && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 col-span-2 lg:col-span-1">
              <p className="text-sm text-gray-400 mb-1">기간 내 변화 ({RANGES.find(r => r.value === range)?.label})</p>
              <p className={`text-2xl font-bold ${overallDiff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {overallDiff >= 0 ? '+' : ''}₩{formatKRW(overallDiff)}
              </p>
              <p className={`text-sm mt-0.5 ${overallDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {overallPct >= 0 ? '+' : ''}{overallPct?.toFixed(2)}%
              </p>
            </div>
          )}
        </div>
      )}

      {/* 차트 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-400">총 자산 변화 추이</h3>
          {/* 기간 필터 */}
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  range === r.value
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {filteredData.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-gray-500 text-sm">
            <p>해당 기간에 스냅샷이 없습니다. 다른 기간을 선택해보세요.</p>
          </div>
        ) : (
          <>
            {filteredData.length < snapshots.length && (
              <p className="text-xs text-gray-600 mb-2">
                전체 {snapshots.length}개 중 {filteredData.length}개 표시
                {snapshots.length > MAX_CHART_POINTS && range === 'ALL' && ` (${MAX_CHART_POINTS}개로 샘플링)`}
              </p>
            )}
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={filteredData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <defs>
                  <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(d) => formatDateTick(d, range)}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[minVal, 'auto']}
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatYAxis}
                  width={50}
                />
                <Tooltip content={<CustomTooltip firstTotal={firstTotal} />} />
                {firstTotal != null && (
                  <ReferenceLine y={firstTotal} stroke="#374151" strokeDasharray="4 4" />
                )}
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fill="url(#gradTotal)"
                  dot={filteredData.length <= 30 ? { fill: '#0ea5e9', r: filteredData.length === 1 ? 5 : 3 } : false}
                  activeDot={{ r: 5, fill: '#0ea5e9' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* 스냅샷 목록 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-400">스냅샷 기록</h3>
          <span className="text-xs text-gray-600">{snapshots.length}개</span>
        </div>
        {snapshots.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            아직 스냅샷이 없습니다. 대시보드에 접속하면 자동으로 저장됩니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">날짜</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">총 자산 (₩)</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">전일 대비</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">자산 수</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">환율</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {[...snapshots].reverse().map((snap, idx, arr) => {
                const prev = arr[idx + 1]
                const diff = prev ? snap.totalKRW - prev.totalKRW : null
                const pct = diff != null && prev?.totalKRW > 0 ? (diff / prev.totalKRW * 100) : null
                return (
                  <tr key={snap.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                    <td className="px-5 py-3 text-white">{snap.date}</td>
                    <td className="px-4 py-3 text-right text-white font-medium">₩{formatKRW(snap.totalKRW)}</td>
                    <td className="px-4 py-3 text-right">
                      {diff !== null ? (
                        <span className={`text-xs ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {diff >= 0 ? '+' : ''}₩{formatKRW(diff)}
                          <span className="ml-1 text-gray-500">({pct >= 0 ? '+' : ''}{pct?.toFixed(2)}%)</span>
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">{snap.assetCount ?? '-'}</td>
                    <td className="px-4 py-3 text-right text-gray-400">
                      {snap.exchangeRate ? `₩${formatKRW(snap.exchangeRate)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { if (confirm(`${snap.date} 스냅샷을 삭제할까요?`)) deleteSnapshot(snap.id) }}
                        className="text-xs text-gray-500 hover:text-red-400 transition px-2 py-1 rounded hover:bg-gray-700"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
