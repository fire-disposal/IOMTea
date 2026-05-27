import { useEffect } from 'react'
import type { PropsWithChildren } from 'react'
import './app.scss'
import { startAutoSync } from './utils/sync'

function App({ children }: PropsWithChildren) {
  useEffect(() => {
    const id = startAutoSync()
    return () => clearInterval(id)
  }, [])

  return <>{children}</>
}

export default App
