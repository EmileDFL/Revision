import { Navigate, Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { useAuth } from './lib/AuthProvider'
import Deadlines from './pages/Deadlines'
import Import from './pages/Import'
import Login from './pages/Login'
import Settings from './pages/Settings'
import Subjects from './pages/Subjects'
import Today from './pages/Today'

function App() {
  const { isCloud, loading, userEmail } = useAuth()

  if (loading) {
    return <div className="center-loading">Chargement…</div>
  }

  if (isCloud && !userEmail) {
    return <Login />
  }

  return (
    <div className="app-shell">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/matieres" element={<Subjects />} />
          <Route path="/echeances" element={<Deadlines />} />
          <Route path="/importer" element={<Import />} />
          <Route path="/reglages" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}

export default App
