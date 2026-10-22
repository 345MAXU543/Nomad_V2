import { useState } from 'react'
import { Button, Drawer, Layout, Menu, Switch, Typography } from 'antd'
import { BarChartOutlined, CalendarOutlined, MenuOutlined, MoonOutlined, SettingOutlined, SunOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import InstallBanner from './InstallBanner'

type AppLayoutProps = { isDarkMode: boolean; onThemeToggle: () => void }

const menuItems = [
  { key: '/', icon: <TrophyOutlined />, label: '主頁' },
  { key: '/calendar', icon: <CalendarOutlined />, label: '排課行事曆' },
  { key: '/students', icon: <TeamOutlined />, label: '學員管理' },
  { key: '/stats', icon: <BarChartOutlined />, label: '教學統計' },
  { key: '/settings', icon: <SettingOutlined />, label: '系統設定' },
]

export default function AppLayout({ isDarkMode, onThemeToggle }: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <Layout className={`app-shell ${isDarkMode ? 'is-dark' : ''}`} style={{ background: isDarkMode ? '#0a0a0a' : '#f5f7fa' }}>
      <InstallBanner />
      <Layout.Header className="app-header" style={{ background: isDarkMode ? '#141414' : '#ffffff' }}>
        <Button type="text" className="menu-button" aria-label="開啟導覽選單" icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} />
        <Button type="text" className="brand-button" onClick={() => navigate('/')}>Nomad</Button>
        <Switch checked={isDarkMode} onChange={onThemeToggle} checkedChildren={<MoonOutlined />} unCheckedChildren={<SunOutlined />} aria-label="亮暗模式切換" />
      </Layout.Header>
      <Drawer title={<Typography.Text strong>Nomad 導覽</Typography.Text>} placement="left" width={250} open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Menu mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => { navigate(key); setDrawerOpen(false) }} />
      </Drawer>
      <Layout.Content className="app-content"><main className="page-container"><Outlet /></main></Layout.Content>
    </Layout>
  )
}
