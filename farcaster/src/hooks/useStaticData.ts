import { useEffect, useState } from 'react'
import { useConnection } from 'wagmi'

export interface StaticData {
  jaccardSwapAddr: string
  jaccardSwapAbi: any[]
  jaccardErc1155Addr: string
  jaccardErc1155Abi: any[]
  scripAddr: string
  scripAbi: any[]
  essenceAddr: string
  essenceAbi: any[]
}

export const useStaticData = () => {
  const { chainId } = useConnection()
  const [staticData, setStaticData] = useState<StaticData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!chainId) {
      setStaticData(null)
      return
    }
    
    const loadStaticData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const [swap, scrip, nft, essence] = await Promise.all([
          import(`../assets/${chainId}/JaccardSwap.json`),
          import(`../assets/${chainId}/Scrip.json`),
          import(`../assets/${chainId}/JaccardERC1155.json`),
          import(`../assets/${chainId}/Essence.json`),
        ])
        setStaticData({
          jaccardSwapAddr: swap.address,
          jaccardSwapAbi: swap.abi,
          scripAddr: scrip.address,
          scripAbi: scrip.abi,
          jaccardErc1155Addr: nft.address,
          jaccardErc1155Abi: nft.abi,
          essenceAddr: essence.address,
          essenceAbi: essence.abi,
        })
      } catch (err) {
        const errorMessage = `Failed to load static data for chain ${chainId}`
        console.error(errorMessage, err)
        setError(errorMessage)
        setStaticData(null)
      } finally {
        setLoading(false)
      }
    }
    
    loadStaticData()
  }, [chainId])

  return {
    staticData,
    loading,
    error,
    chainId
  }
}
