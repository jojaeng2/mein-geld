import { useState } from 'react'
import { useSettings } from '../hooks/useSettings'
import { useAssets } from '../hooks/useAssets'
import { useSnapshots } from '../hooks/useSnapshots'
import { formatKRW } from '../lib/utils'

export default function Settings() {
  const { settings, saveSettings } = useSettings()
  const { assets, addAsset } = useAssets()
  const { snapshots } = useSnapshots()

  const [rate, setRate] = useState('')
  const [rateSaved, setRateSaved] = useState(false)
  const [importError, setImportError] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteCodeSaved, setInviteCodeSaved] = useState(false)

  async function handleSaveRate(e) {
    e.preventDefault()
    const value = Number(rate)
    if (!value || value <= 0) return
    await saveSettings({ ...settings, exchangeRate: value })
    setRateSaved(true)
    setRate('')
    setTimeout(() => setRateSaved(false), 2000)
  }

  async function handleSaveInviteCode(e) {
    e.preventDefault()
    if (!inviteCode.trim()) return
    await saveSettings({ ...settings, inviteCode: inviteCode.trim() })
    setInviteCode('')
    setInviteCodeSaved(true)
    setTimeout(() => setInviteCodeSaved(false), 2000)
  }

  function handleExport() {
    const data = {
      exportedAt: new Date().toISOString(),
      settings,
      assets: assets.map(({ id, createdAt, updatedAt, ...rest }) => rest),
      snapshots: snapshots.map(({ id, createdAt, ...rest }) => rest),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mein-geld-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')

    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!data.assets || !Array.isArray(data.assets)) {
          throw new Error('올바른 백업 파일이 아닙니다.')
        }
        if (!confirm(`자산 ${data.assets.length}개를 가져옵니다. 기존 자산에 추가됩니다. 계속할까요?`)) return

        for (const asset of data.assets) {
          await addAsset(asset)
        }
        if (data.settings?.exchangeRate) {
          await saveSettings(data.settings)
        }
        alert('가져오기 완료!')
      } catch (err) {
        setImportError(err.message || '파일을 읽는 중 오류가 발생했습니다.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="p-8 space-y-6">
      <h2 className="text-xl font-bold text-white">설정</h2>

      {/* Exchange rate */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-white mb-1">환율 설정</h3>
        <p className="text-xs text-gray-500 mb-4">달러 자산의 원화 환산에 사용됩니다.</p>

        <p className="text-sm text-gray-400 mb-3">
          현재 환율:{' '}
          <span className="text-white font-medium">₩{formatKRW(settings.exchangeRate)} / USD</span>
        </p>

        <form onSubmit={handleSaveRate} className="flex gap-3">
          <input
            type="number"
            min="1"
            step="1"
            className="input w-40"
            placeholder="예: 1350"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition"
          >
            저장
          </button>
          {rateSaved && <span className="self-center text-sm text-green-400">저장됨!</span>}
        </form>
      </div>

      {/* Invite code */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-white mb-1">초대 코드 설정</h3>
        <p className="text-xs text-gray-500 mb-4">
          회원가입 시 필요한 코드입니다. 본인과 여자친구만 알 수 있도록 설정해주세요.
        </p>
        {settings.inviteCode && (
          <p className="text-sm text-gray-400 mb-3">
            현재 코드:{' '}
            <span className="text-white font-medium font-mono">{settings.inviteCode}</span>
          </p>
        )}
        <form onSubmit={handleSaveInviteCode} className="flex gap-3">
          <input
            type="text"
            className="input w-48"
            placeholder="새 초대 코드"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition"
          >
            저장
          </button>
          {inviteCodeSaved && <span className="self-center text-sm text-green-400">저장됨!</span>}
        </form>
      </div>

      {/* Backup / Restore */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-white mb-1">데이터 백업 / 복원</h3>
        <p className="text-xs text-gray-500 mb-4">
          자산 데이터를 JSON 파일로 내보내거나 가져올 수 있습니다. 다른 기기로 이전할 때 유용합니다.
        </p>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition"
          >
            JSON 내보내기
          </button>

          <label className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition cursor-pointer">
            JSON 가져오기
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
        </div>

        {importError && (
          <p className="mt-3 text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-4 py-2">
            {importError}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-white mb-3">데이터 현황</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400">등록된 자산</p>
            <p className="text-white font-medium">{assets.length}개</p>
          </div>
          <div>
            <p className="text-gray-400">스냅샷 기록</p>
            <p className="text-white font-medium">{snapshots.length}개</p>
          </div>
        </div>
      </div>
    </div>
  )
}
