import { useEffect, useState, useRef } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'

const DEFAULTS = {
  years: 10,
  reinvest: true,
  capitalRates: {},
  divRates: {},
  monthlyAmounts: {},
  monthlySalary: 0,
}

export function useCalculatorSettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState(DEFAULTS)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'config', 'calculator')
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setSettings({ ...DEFAULTS, ...snap.data() })
      setLoading(false)
    })
    return unsub
  }, [user])

  function update(partial) {
    const next = { ...settings, ...partial }
    setSettings(next)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setSaving(true)
      try {
        await setDoc(doc(db, 'users', user.uid, 'config', 'calculator'), next)
      } finally {
        setSaving(false)
      }
    }, 800)
  }

  return { settings, loading, saving, update }
}
