import { useEffect, useState } from 'react'
import { AppstoreAddOutlined, CloseOutlined } from '@ant-design/icons'
import { Button, Flex, Modal, Typography, message } from 'antd'

type InstallChoice = { outcome: 'accepted' | 'dismissed'; platform: string }
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<InstallChoice>
}

type NavigatorWithStandalone = Navigator & { standalone?: boolean }

const isIosDevice = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as NavigatorWithStandalone).standalone)

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('nomad-install-banner-dismissed') === 'true')
  const [ios] = useState(() => isIosDevice())
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

  const install = async () => {
    if (ios) {
      Modal.info({
        title: '加入 Nomad 到主畫面',
        content: '請點擊瀏覽器底部的「分享」按鈕，然後選擇「加入主畫面」。',
        okText: '知道了',
      })
      return
    }
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') closeBanner()
    else void message.info('尚未安裝 Nomad，你可稍後再試一次。')
  }

  if (dismissed || standalone || (!ios && !deferredPrompt)) return null

  return <>
    <div className="install-banner-spacer" aria-hidden="true" />
    <div className="install-banner" role="region" aria-label="安裝 Nomad">
      <Flex align="center" gap={10} className="install-banner-inner">
        <AppstoreAddOutlined className="install-banner-icon" />
        <Typography.Text className="install-banner-message">將 Nomad 加到主畫面，體驗更流暢！</Typography.Text>
        <Button size="small" type="primary" onClick={() => void install()}>新增</Button>
        <Button size="small" type="text" icon={<CloseOutlined />} aria-label="關閉安裝提示" onClick={closeBanner} />
      </Flex>
    </div>
  </>
}
