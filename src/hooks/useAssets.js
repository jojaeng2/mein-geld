import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'

export function useAssets() {
  const { user } = useAuth()
  const [assets, setAssets]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const col = collection(db, 'users', user.uid, 'assets')
    const q   = query(col, orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setAssets(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [user])

  function col() { return collection(db, 'users', user.uid, 'assets') }

  async function addAsset(asset) {
    await addDoc(col(), { ...asset, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  }

  async function updateAsset(id, asset) {
    await updateDoc(doc(db, 'users', user.uid, 'assets', id), { ...asset, updatedAt: serverTimestamp() })
  }

  async function deleteAsset(id) {
    await deleteDoc(doc(db, 'users', user.uid, 'assets', id))
  }

  return { assets, loading, addAsset, updateAsset, deleteAsset }
}
