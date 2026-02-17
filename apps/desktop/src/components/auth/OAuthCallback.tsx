import { useEffect } from 'react'

export function OAuthCallback() {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const error = urlParams.get('error')

    if (error) {
      window.opener?.postMessage({ type: 'KAKAO_AUTH_ERROR', error }, '*')
      window.close()
      return
    }

    if (code) {
      // Exchange code for access token via Kakao API
      // In a real app, this would be done on the backend
      // For now, we'll send the code to the parent window
      // The backend should handle the token exchange
      exchangeCodeForToken(code)
    }
  }, [])

  const exchangeCodeForToken = async (code: string) => {
    try {
      // This should ideally be done on the backend
      // The backend receives the code and exchanges it for tokens
      const KAKAO_CLIENT_ID = import.meta.env.VITE_KAKAO_CLIENT_ID
      const KAKAO_REDIRECT_URI = import.meta.env.VITE_KAKAO_REDIRECT_URI || 'http://localhost:1420/oauth/kakao'

      const response = await fetch('https://kauth.kakao.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: KAKAO_CLIENT_ID,
          redirect_uri: KAKAO_REDIRECT_URI,
          code,
        }),
      })

      const data = await response.json()

      if (data.access_token) {
        window.opener?.postMessage(
          { type: 'KAKAO_AUTH_SUCCESS', accessToken: data.access_token },
          '*'
        )
      } else {
        window.opener?.postMessage({ type: 'KAKAO_AUTH_ERROR', error: 'No access token' }, '*')
      }
    } catch (err) {
      window.opener?.postMessage({ type: 'KAKAO_AUTH_ERROR', error: String(err) }, '*')
    }

    window.close()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Processing login...</p>
      </div>
    </div>
  )
}