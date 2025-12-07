
import { useConnection, useConnect, useDisconnect, useSignMessage} from 'wagmi'
import { createSiweMessage } from 'viem/siwe'
import { useState, useCallback, useEffect } from 'react'

interface UseSiweAuthOptions {
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export function useSiweAuth(options?: UseSiweAuthOptions) {
  const { address, isConnected, chainId } = useConnection()
  const { connectAsync } = useConnect()
  const { disconnect } = useDisconnect()
  const { signMessageAsync } = useSignMessage()
  const [isSigning, setIsSigning] = useState(false)
  const [pendingAuth, setPendingAuth] = useState(false)

  // Perform SIWE after wallet connects
  const performSiweAuth = useCallback(async (connector) => {
    const con = await connectAsync({
      connector,
      })

    console.log('con', con)
    try {
      // Get nonce from backend
      console.log('[SIWE] Fetching nonce from backend')
      const nonceResponse = await fetch('/api/auth/nonce', {
        credentials: 'include',
      })
      
      if (!nonceResponse.ok) {
        throw new Error(`Failed to fetch nonce: ${nonceResponse.status}`)
      }
      
      const nonce = await nonceResponse.text()
      console.log('[SIWE] Received nonce:', nonce)

      // Create SIWE message
      const messageParams = {
        address: con.accounts[0] as `0x${string}`,
        statement: 'Sign in with Ethereum to the app.',
        uri: window.location.origin,
        version: '1' as const,
        chainId: con.chainId,
        nonce,
        domain: window.location.hostname,
        scheme: window.location.protocol.slice(0, -1) as 'http' | 'https',
      }
      console.log('[SIWE] Creating message with params:', messageParams)
      
      const message = createSiweMessage(messageParams)
      console.log('[SIWE] Message created:', message)

      // Sign message using wagmi
      console.log('[SIWE] Requesting signature from wallet')
      const signature = await signMessageAsync({ message })
      console.log('[SIWE] Signature received:', signature)

      // Verify with backend
      console.log('[SIWE] Sending verification request to backend')
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message,
          signature,
          nonce,
          type: 'user',
        }),
      })

      if (!loginResponse.ok) {
        const errorText = await loginResponse.text()
        console.error('[SIWE] Login failed:', loginResponse.status, errorText)
        throw new Error(`Login failed: ${loginResponse.status}`)
      }

      const result = await loginResponse.json()
      console.log('[SIWE] Login successful:', result)

    } catch (error) {
      console.log('error', error)
    } finally {
      setIsSigning(false)
    }
  }, [address, chainId, signMessageAsync, options])

  // Auto-trigger SIWE after wallet connection
  useEffect(() => {
    if (pendingAuth && isConnected && address) {
      console.log('[SIWE] Wallet connected, proceeding with SIWE auth')
      performSiweAuth()
    }
  }, [pendingAuth, isConnected, address, performSiweAuth])

  const signOut = useCallback(async () => {
    console.log('[SIWE] Sign out initiated')
    try {
      console.log('[SIWE] Clearing session on backend')
      const response = await fetch('/api/auth/session', {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (!response.ok) {
        console.warn('[SIWE] Failed to clear session on backend:', response.status)
      } else {
        console.log('[SIWE] Session cleared successfully')
      }
      
      console.log('[SIWE] Disconnecting wallet')
      disconnect()
    } catch (error) {
      console.error('[SIWE] Sign out error:', error)
    }
  }, [disconnect])

  return {
    address,
    isConnected,
    isSigning,
    performSiweAuth,
    signOut,
  }
}
