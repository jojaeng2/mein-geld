import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { DEFAULT_EXCHANGE_RATE } from '../lib/constants'

const SETTINGS_DOC = 'config/settings'

export function useSettings() {
  const [settings, setSettings] = useState({ exchangeRate: DEFAULT_EXCHANGE_RATE })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', 'settings'), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data())
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function saveSettings(data) {
    await setDoc(doc(db, 'config', 'settings'), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  return { settings, loading, saveSettings }
}
