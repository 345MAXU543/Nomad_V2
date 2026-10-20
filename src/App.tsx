import { useState } from 'react'
import { ConfigProvider, theme } from 'antd'
import { HashRouter, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import CalendarPage from './pages/CalendarPage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import StudentsPage from './pages/StudentsPage'
import './App.css'

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false)

  return (
    <ConfigProvider theme={{ algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm, token: { borderRadius: 12, colorPrimary: '#3b82f6' } }}>
      <HashRouter>
        <Routes>
          <Route element={<AppLayout isDarkMode={isDarkMode} onThemeChange={setIsDarkMode} />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ConfigProvider>
  )
}

export default App
