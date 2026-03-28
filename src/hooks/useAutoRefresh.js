import { useEffect, useState } from 'react'
import { useAssets } from './useAssets'
import { fetchAssetPrice } from '../lib/priceService'

/**
 * 세션당 1회, 로그인 직후 티커 보유 자산 가격을 자동 갱신합니다.
 * sessionStorage 플래그로 페이지 이동 / 리렌더링 시 재실행을 방지합니다.
 */
export function useAutoRefresh() {
  const { assets, loading, updateAsset } = useAssets()
  const [status, setStatus] = useState('idle') // 'idle' | 'refreshing' | 'done'

  useEffect(() => {
    if (loading) return
    if (sessionStorage.getItem('priceRefreshed')) return

    const targets = assets.filter((a) => a.ticker)
    if (targets.length === 0) return

    sessionStorage.setItem('priceRefreshed', '1')
    setStatus('refreshing')

    const run = async () => {
      // 같은 티커는 1회만 API 호출
      const byTicker = new Map()
      for (const asset of targets) {
        if (!byTicker.has(asset.ticker)) byTicker.set(asset.ticker, [])
        byTicker.get(asset.ticker).push(asset)
      }

      for (const [, records] of byTicker) {
        try {
          const price = await fetchAssetPrice(records[0])
          for (const asset of records) {
            await updateAsset(asset.id, { ...asset, currentPrice: price })
          }
        } catch {
          // 개별 실패는 무시하고 계속 진행
        }
        await new Promise((r) => setTimeout(r, 1200))
      }

      setStatus('done')
    }

    run()
  }, [loading]) // loading 이 false 로 바뀔 때 딱 한 번 실행

  return status
}
