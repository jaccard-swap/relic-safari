import { useState, useEffect } from 'react'

export interface BandMatch {
  index: number
  aHash: string
  bHash: string
  matches: boolean
}

export interface TraitBreakdown {
  target: string | null
  consumed: string | null
  matches: boolean
  upgradeable: boolean
  action: 'upgrade' | 'essence' | 'keep' | 'none'
}

export interface SimulationResult {
  eligible: boolean
  minHash: {
    bands: BandMatch[]
    matchCount: number
    threshold: number
    estimatedJaccard: number
  }
  traitBreakdown: Record<string, TraitBreakdown>
  result: {
    newMetadata: Record<string, any>
    upgradedTraits: Record<string, { from: string; to: string }>
    essenceYield: number
  }
  target: {
    id: string
    tokenId: string
    metadata: Record<string, any>
  }
  consumed: {
    id: string
    tokenId: string
    metadata: Record<string, any>
  }
}

export function usePolymeraseSimulation(targetNftId: string | null, consumedNftId: string | null) {
  const [simulation, setSimulation] = useState<SimulationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!targetNftId || !consumedNftId) {
      setSimulation(null)
      return
    }

    const fetchSimulation = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const res = await fetch(`/api/faucet/polymerase/simulate?targetNftId=${targetNftId}&consumedNftId=${consumedNftId}`, {
          credentials: 'include',
        })
        const data = await res.json()
        
        if (!res.ok) {
          throw new Error(data.error || 'Simulation failed')
        }
        
        setSimulation(data)
      } catch (err) {
        setError((err as Error).message)
        setSimulation(null)
      } finally {
        setLoading(false)
      }
    }

    fetchSimulation()
  }, [targetNftId, consumedNftId])

  return { simulation, loading, error }
}

