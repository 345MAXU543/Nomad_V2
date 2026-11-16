import { useEffect, useState } from 'react'
import { AppleOutlined, AppstoreAddOutlined, CloseOutlined, CopyOutlined, ExportOutlined } from '@ant-design/icons'
import { Alert, Button, Flex, Modal, Space, Typography, message } from 'antd'

type InstallChoice = { outcome: 'accepted' | 'dismissed'; platform: string }
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<InstallChoice>
}

type NavigatorWithStandalone = Navigator & { standalone?: boolean }

const isIosDevice = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const isInAppBrowser = () =>
  /Line|FBAN|FBAV|Instagram|MicroMessenger|Threads/i.test(navigator.userAgent)

const isIosThirdPartyBrowser = () =>
  /CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent)

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  Boolean((navigator as NavigatorWithStandalone).standalone)

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('nomad-install-banner-dismissed') === 'true')
  const [iosGuideOpen, setIosGuideOpen] = useState(false)
  const [ios] = useState(() => isIosDevice())
  const [inApp] = useState(() => isInAppBrowser())
  const [iosThirdParty] = useState(() => isIosThirdPartyBrowser())
  const [standalone] = useState(() => isStandalone())

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      if (!dismissed && !standalone) setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [dismissed, standalone])

  const closeBanner = () => {
    sessionStorage.setItem('nomad-install-banner-dismissed', 'true')
    setDismissed(true)
  }

  const copyCurrentUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      void message.success('已複製網址，請貼到 Safari 開啟！')
    } catch {
      void message.info(`請複製此網址並用 Safari 開啟：${window.location.href}`)
    }
  }

  const install = async () => {
    if (ios) {
      setIosGuideOpen(true)
      return
    }
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') closeBanner()
    else void message.info('尚未安裝 Nomad，你可稍後再試一次。')
  }

  if (dismissed || standalone || (!ios && !deferredPrompt)) return null

  return (
    <>
      <div className="install-banner-spacer" aria-hidden="true" />
      <div className="install-banner" role="region" aria-label="安裝 Nomad">
        <Flex align="center" gap={10} className="install-banner-inner">
          <AppstoreAddOutlined className="install-banner-icon" />
          <Typography.Text className="install-banner-message">
            {ios && inApp ? '請改用 Safari 開啟以安裝 Nomad 到主畫面' : '將 Nomad 加到主畫面，體驗更流暢！'}
          </Typography.Text>
          <Button size="small" type="primary" onClick={() => void install()}>
            {ios ? '安裝教學' : '新增'}
          </Button>
          <Button size="small" type="text" icon={<CloseOutlined />} aria-label="關閉安裝提示" onClick={closeBanner} />
        </Flex>
      </div>

      {/* 受控 Modal（相容 React 19，且高 zIndex 確保不被頂部橫幅或導引彈窗遮住） */}
      <Modal
        title={
          <Space>
            <AppleOutlined style={{ color: '#3b82f6' }} />
            <span>在 iPhone / iPad 安裝 Nomad App</span>
          </Space>
        }
        open={iosGuideOpen}
        onCancel={() => setIosGuideOpen(false)}
        footer={
          <Flex justify="space-between" align="center" gap={8} wrap="wrap">
            {(inApp || iosThirdParty) ? (
              <Button icon={<CopyOutlined />} onClick={() => void copyCurrentUrl()}>
                複製網址去 Safari 開啟
              </Button>
            ) : <span />}
            <Button type="primary" onClick={() => setIosGuideOpen(false)}>
              知道了
            </Button>
          </Flex>
        }
        zIndex={1200}
        centered
      >
        {inApp ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type="warning"
              showIcon
              message="偵測到目前正使用 App 內建瀏覽器（如 LINE / FB / IG）"
              description="iOS 系統限制內建瀏覽器無法直接安裝 PWA，必須切換至 Safari 瀏覽器才能加入主畫面。"
            />
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              <strong>請依照以下步驟操作：</strong>
              <ol style={{ paddingLeft: 20, marginTop: 8, marginBottom: 0, lineHeight: 1.8 }}>
                <li>點擊畫面角落的「<strong>...</strong>」或「<ExportOutlined /> <strong>分享</strong>」按鈕。</li>
                <li>選擇「<strong>以預設瀏覽器（Safari）開啟</strong>」（或先點下方「複製網址」再貼到 Safari）。</li>
                <li>在 Safari 開啟後，點擊底部「<ExportOutlined /> <strong>分享</strong>」➔「<strong>加入主畫面</strong>」➔「<strong>新增</strong>」即可完成安裝！</li>
              </ol>
            </Typography.Paragraph>
          </Space>
        ) : iosThirdParty ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="偵測到您正在 iOS 使用非 Safari 瀏覽器（如 Chrome / Edge）"
              description="部分 iOS 第三方瀏覽器可能不支援完整 PWA 安裝，建議使用內建 Safari 開啟效果最佳。"
            />
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              <strong>安裝步驟：</strong>
              <ol style={{ paddingLeft: 20, marginTop: 8, marginBottom: 0, lineHeight: 1.8 }}>
                <li>點擊網址列旁的「<ExportOutlined /> <strong>分享</strong>」圖示，向下滑動尋找「<strong>加入主畫面</strong>」。</li>
                <li>若選單中找不到「加入主畫面」，請點下方「<strong>複製網址</strong>」改用 <strong>Safari</strong> 開啟並加入主畫面。</li>
              </ol>
            </Typography.Paragraph>
          </Space>
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="因 Apple iOS 系統安全限制，網頁無法直接自動彈出安裝鈕"
              description="只需透過 Safari 的分享選單 3 步驟，即可將 Nomad 安裝為獨立桌面 App。"
            />
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              <ol style={{ paddingLeft: 20, marginTop: 4, marginBottom: 0, lineHeight: 1.9 }}>
                <li>點擊 Safari 瀏覽器<strong>底部工具列</strong>（iPad 為右上角）的「<ExportOutlined /> <strong>分享</strong>」按鈕（若網址列旁顯示「<code>...</code>」，請先點「<code>...</code>」再點「分享」）。</li>
                <li>將分享選單往上滑動，點擊「<strong>加入主畫面</strong>」。</li>
                <li>確認名稱為「<strong>Nomad</strong>」後，點選右上角「<strong>新增</strong>」，桌面就會出現 App 圖示囉！</li>
              </ol>
            </Typography.Paragraph>
          </Space>
        )}
      </Modal>
    </>
  )
}
