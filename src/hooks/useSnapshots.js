import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, addDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'

export function useSnapshots() {
  const { user } = useAuth()
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!user) return
    const col = collection(db, 'users', user.uid, 'snapshots')
    const q   = query(col, orderBy('date', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setSnapshots(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [user])

  async function saveSnapshot(snapshot) {
    await addDoc(collection(db, 'users', user.uid, 'snapshots'), {
      ...snapshot,
      createdAt: serverTimestamp(),
    })
  }

  async function deleteSnapshot(id) {
    await deleteDoc(doc(db, 'users', user.uid, 'snapshots', id))
  }

  return { snapshots, loading, saveSnapshot, deleteSnapshot }
}
