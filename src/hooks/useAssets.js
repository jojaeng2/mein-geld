import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

const COLLECTION = 'assets'

export function useAssets() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      setAssets(data)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function addAsset(asset) {
    await addDoc(collection(db, COLLECTION), {
      ...asset,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  async function updateAsset(id, asset) {
    await updateDoc(doc(db, COLLECTION, id), {
      ...asset,
      updatedAt: serverTimestamp(),
    })
  }

  async function deleteAsset(id) {
    await deleteDoc(doc(db, COLLECTION, id))
  }

  return { assets, loading, addAsset, updateAsset, deleteAsset }
}
