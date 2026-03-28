import { useEffect, useState, useRef } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'

export function useAssetOrder() {
  const { user } = useAuth()
  const [order, setOrderState] = useState([])
  const timerRef = useRef(null)

  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'config', 'assetOrder')
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setOrderState(snap.data().order ?? [])
    })
    return unsub
  }, [user])

  function setOrder(newOrder) {
    setOrderState(newOrder)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setDoc(doc(db, 'users', user.uid, 'config', 'assetOrder'), { order: newOrder })
    }, 500)
  }

  return { order, setOrder }
}
