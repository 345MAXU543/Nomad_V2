import { useRef } from 'react'
import dayjs from 'dayjs'
import { Button, Card, Form, Input, Modal, Select, Space, Typography, message } from 'antd'
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import { useAppStore } from '../store/useAppStore'
import type { AppSettings, BackupPayload, Lesson, Student } from '../types'

const isSettings = (value: unknown): value is AppSettings => typeof value === 'object' && value !== null && 'defaultDuration' in value && 'defaultLocation' in value && 'isDarkMode' in value
const isBackupPayload = (value: unknown): value is BackupPayload => {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return Array.isArray(record.students) && Array.isArray(record.lessons) && isSettings(record.settings)
}

export default function SettingsPage() {
  const students = useAppStore((state) => state.students)
  const lessons = useAppStore((state) => state.lessons)
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const importData = useAppStore((state) => state.importData)
  const resetToDefault = useAppStore((state) => state.resetToDefault)
  const [form] = Form.useForm<AppSettings>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const saveSettings = (values: AppSettings) => { updateSettings(values); void message.success('設定已儲存') }
  const exportData = () => {
    const body = JSON.stringify({ students, lessons, settings, exportedAt: new Date().toISOString() }, null, 2)
    const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `nomad-backup-${dayjs().format('YYYYMMDD')}.json`; anchor.click(); URL.revokeObjectURL(url)
    void message.success('JSON 備份檔已匯出')
  }
  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const payload: unknown = JSON.parse(await file.text())
      if (!isBackupPayload(payload)) throw new Error('invalid backup')
      importData({ students: payload.students as Student[], lessons: payload.lessons as Lesson[], settings: payload.settings })
      void message.success('備份資料匯入成功')
    } catch { void message.error('備份格式錯誤，請選擇有效的 JSON 檔案') }
    event.target.value = ''
  }
  return <>
    <section className="page-heading"><Typography.Title level={2}>系統設定</Typography.Title><Typography.Text type="secondary">本機使用偏好與資料管理</Typography.Text></section>
    <Card className="surface-card setting-card" title="排課偏好設定"><Form form={form} className="setting-form" layout="vertical" initialValues={settings} onFinish={saveSettings}><Form.Item name="defaultDuration" label="預設課程時長"><Select options={[{ value: 50, label: '50 分鐘' }, { value: 60, label: '60 分鐘' }, { value: 90, label: '90 分鐘' }]} /></Form.Item><Form.Item name="defaultLocation" label="預設上課地點"><Input /></Form.Item><Button type="primary" htmlType="submit">儲存設定</Button></Form></Card>
    <Card className="surface-card setting-card" title="本地資料備份"><Typography.Paragraph type="secondary">資料只儲存在此瀏覽器，可用 JSON 備份檔跨裝置或復原。</Typography.Paragraph><input ref={fileInputRef} type="file" accept=".json,application/json" hidden onChange={importFile} /><Space wrap><Button icon={<DownloadOutlined />} onClick={exportData}>匯出 JSON 備份檔</Button><Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>匯入備份檔</Button><Button danger onClick={() => Modal.confirm({ title: '重置所有資料？', content: '目前的學員、課程與設定將被初始測試資料取代。', okText: '重置', cancelText: '取消', okButtonProps: { danger: true }, onOk: () => { resetToDefault(); void message.success('已重置為初始資料') } })}>重置所有資料</Button></Space></Card>
  </>
}
