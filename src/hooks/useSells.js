import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, addDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'

export function useSells() {
  const { user } = useAuth()
  const [sells, setSells]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'users', user.uid, 'sells'),
      orderBy('sellDate', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setSells(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [user])

  async function addSell(sell) {
    await addDoc(collection(db, 'users', user.uid, 'sells'), {
      ...sell,
      createdAt: serverTimestamp(),
    })
  }

  async function deleteSell(id) {
    await deleteDoc(doc(db, 'users', user.uid, 'sells', id))
  }

  return { sells, loading, addSell, deleteSell }
}
