import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useAssets } from '../hooks/useAssets'
import { useSettings } from '../hooks/useSettings'
import { useSnapshots } from '../hooks/useSnapshots'
import { formatKRW, toKRW } from '../lib/utils'

function CustomTooltip({ active, payload, label }) {
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

export default function History() {
  const { assets } = useAssets()
  const { settings } = useSettings()
  const { snapshots, loading, saveSnapshot, deleteSnapshot } = useSnapshots()

  const currentTotal = useMemo(() => {
    const rate = settings.exchangeRate
    return assets.reduce((sum, a) => sum + toKRW(a.currentPrice, a.quantity, a.currency, rate), 0)
  }, [assets, settings.exchangeRate])

  const chartData = useMemo(() => {
    return snapshots.map((s) => ({
      date: s.date,
      total: s.totalKRW,
      id: s.id,
    }))
  }, [snapshots])

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

  if (loading) return <div className="p-8 text-gray-400">로딩 중...</div>

  const minVal = chartData.length ? Math.min(...chartData.map((d) => d.total)) * 0.95 : 0

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">히스토리</h2>
        <button
          onClick={handleSaveSnapshot}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition"
        >
          오늘 스냅샷 저장
        </button>
      </div>

      {/* Current total */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p className="text-sm text-gray-400 mb-1">현재 총 자산</p>
        <p className="text-3xl font-bold text-white">₩{formatKRW(currentTotal)}</p>
      </div>

      {/* Line chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-4">총 자산 변화 추이</h3>
        {chartData.length < 2 ? (
          <div className="h-52 flex items-center justify-center text-gray-500 text-sm">
            스냅샷이 2개 이상 있어야 차트가 표시됩니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[minVal, 'auto']}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1e8).toFixed(0)}억`}
                width={45}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={{ fill: '#0ea5e9', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Snapshot list */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <h3 className="text-sm font-medium text-gray-400">스냅샷 기록</h3>
        </div>
        {snapshots.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            아직 스냅샷이 없습니다. 위 버튼으로 오늘 총자산을 저장해보세요.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">날짜</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">총 자산 (₩)</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">자산 수</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">환율</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {[...snapshots].reverse().map((snap, idx, arr) => {
                const prev = arr[idx + 1]
                const diff = prev ? snap.total - prev.total : null
                return (
                  <tr key={snap.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                    <td className="px-5 py-3 text-white">{snap.date}</td>
                    <td className="px-4 py-3 text-right text-white font-medium">
                      ₩{formatKRW(snap.totalKRW)}
                      {diff !== null && (
                        <span className={`ml-2 text-xs ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {diff >= 0 ? '+' : ''}₩{formatKRW(diff)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">{snap.assetCount ?? '-'}</td>
                    <td className="px-4 py-3 text-right text-gray-400">
                      {snap.exchangeRate ? `₩${formatKRW(snap.exchangeRate)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`${snap.date} 스냅샷을 삭제할까요?`)) deleteSnapshot(snap.id)
                        }}
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
        )}
      </div>
    </div>
  )
}
