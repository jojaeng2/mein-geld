import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { DEFAULT_EXCHANGE_RATE } from '../lib/constants'

// 환율 캐시 유효 시간: 1시간
const CACHE_TTL_MS = 60 * 60 * 1000

async function fetchLiveExchangeRate() {
  const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=KRW')
  if (!res.ok) throw new Error('환율 조회 실패')
  const data = await res.json()
  return Math.round(data.rates.KRW)
}

export function useSettings() {
  const [settings, setSettings] = useState({ exchangeRate: DEFAULT_EXCHANGE_RATE })
  const [loading, setLoading] = useState(true)
  const [rateUpdating, setRateUpdating] = useState(false)

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', 'settings'), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data())
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  // 앱 로드 시 환율 자동 갱신 (마지막 갱신 후 1시간 지났을 때만)
  useEffect(() => {
    if (loading) return

    const lastUpdated = settings.rateUpdatedAt?.toDate?.()
    const now = Date.now()
    const shouldRefresh = !lastUpdated || now - lastUpdated.getTime() > CACHE_TTL_MS

    if (!shouldRefresh) return

    setRateUpdating(true)
    fetchLiveExchangeRate()
      .then((rate) =>
        setDoc(doc(db, 'config', 'settings'), {
          ...settings,
          exchangeRate: rate,
          rateUpdatedAt: serverTimestamp(),
        })
      )
      .catch(console.error)
      .finally(() => setRateUpdating(false))
  }, [loading])

  async function saveSettings(data) {
    await setDoc(doc(db, 'config', 'settings'), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  async function refreshRate() {
    setRateUpdating(true)
    try {
      const rate = await fetchLiveExchangeRate()
      await setDoc(doc(db, 'config', 'settings'), {
        ...settings,
        exchangeRate: rate,
        rateUpdatedAt: serverTimestamp(),
      })
    } finally {
      setRateUpdating(false)
    }
  }

  return { settings, loading, saveSettings, refreshRate, rateUpdating }
}
