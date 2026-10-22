import { ConfigProvider, theme } from 'antd'
import zhTW from 'antd/locale/zh_TW'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-tw'
import { HashRouter, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import CalendarPage from './pages/CalendarPage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import StatsPage from './pages/StatsPage'
import StudentsPage from './pages/StudentsPage'
import { useAppStore } from './store/useAppStore'
import './App.css'

dayjs.locale('zh-tw')
const antdLocale = (zhTW as unknown as { default?: typeof zhTW }).default ?? zhTW

function App() {
  const isDarkMode = useAppStore((state) => state.settings.isDarkMode)
  const toggleDarkMode = useAppStore((state) => state.toggleDarkMode)

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          borderRadius: 12,
          fontSize: 16,
          fontSizeSM: 14,
          fontSizeLG: 18,
          colorPrimary: '#00E5FF',
          colorInfo: '#00E5FF',
          colorLink: '#00A6BE',
          colorTextSecondary: isDarkMode ? '#cbd5e1' : undefined,
        },
      }}
    >
      <HashRouter>
        <Routes>
          <Route element={<AppLayout isDarkMode={isDarkMode} onThemeToggle={toggleDarkMode} />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ConfigProvider>
  )
}

export default App
