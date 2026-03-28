import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

const COLLECTION = 'snapshots'

export function useSnapshots() {
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, COLLECTION), orderBy('date', 'asc'))
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setSnapshots(data)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function saveSnapshot(snapshot) {
    await addDoc(collection(db, COLLECTION), {
      ...snapshot,
      createdAt: serverTimestamp(),
    })
  }

  async function deleteSnapshot(id) {
    await deleteDoc(doc(db, COLLECTION, id))
  }

  return { snapshots, loading, saveSnapshot, deleteSnapshot }
}
