import { useEffect } from 'react'
import type { PropsWithChildren } from 'react'
import './app.scss'
import { startAutoSync } from './utils/sync'

function App({ children }: PropsWithChildren) {
  useEffect(() => {
    startAutoSync()
  }, [])

  return <>{children}</>
}

export default App
