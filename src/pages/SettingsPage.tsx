import { useState, useRef } from 'react'
import dayjs from 'dayjs'
import { Button, Card, Flex, Form, Input, InputNumber, List, Modal, Popconfirm, Select, Space, Switch, Tag, Typography, message } from 'antd'
import { BellOutlined, BulbOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, SyncOutlined, UploadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { requestNotificationPermission, sendNotification } from '../utils/notifications'
import type { AppSettings, BackupPayload, Lesson, Student } from '../types'

const isSettings = (value: unknown): value is AppSettings => typeof value === 'object' && value !== null && 'defaultDuration' in value && 'defaultLocation' in value && 'isDarkMode' in value
const isBackupPayload = (value: unknown): value is BackupPayload => {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return Array.isArray(record.students) && Array.isArray(record.lessons) && isSettings(record.settings)
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const resetOnboarding = useAppStore((state) => state.resetOnboarding)
  const startBlankState = useAppStore((state) => state.startBlankState)
  const loadDemoState = useAppStore((state) => state.loadDemoState)
  const students = useAppStore((state) => state.students)
  const lessons = useAppStore((state) => state.lessons)
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const addCourseType = useAppStore((state) => state.addCourseType)
  const renameCourseType = useAppStore((state) => state.renameCourseType)
  const deleteCourseType = useAppStore((state) => state.deleteCourseType)
  const importData = useAppStore((state) => state.importData)
  const resetToDefault = useAppStore((state) => state.resetToDefault)
  const [form] = Form.useForm<AppSettings>()
  const [newCourseType, setNewCourseType] = useState('')
  const [renamingCourseType, setRenamingCourseType] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const saveSettings = (values: AppSettings) => { updateSettings(values); void message.success('設定已儲存') }
  const createCourseType = () => {
    const name = newCourseType.trim()
    if (!name) return
    if (settings.courseTypes.includes(name)) { void message.warning('課程種類已存在'); return }
    addCourseType(name); setNewCourseType(''); void message.success('已新增課程種類')
  }
  const saveCourseTypeName = (oldName: string) => {
    const name = renameValue.trim()
    if (!name) return
    if (name !== oldName && settings.courseTypes.includes(name)) { void message.warning('課程種類已存在'); return }
    renameCourseType(oldName, name); setRenamingCourseType(null); void message.success('課程種類已改名')
  }
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
    <Card className="surface-card setting-card" title="排課偏好設定"><Form form={form} className="setting-form" layout="vertical" initialValues={settings} onFinish={saveSettings}><Form.Item name="defaultDuration" label="預設課程時長"><Select options={[{ value: 50, label: '50 分鐘' }, { value: 60, label: '60 分鐘' }, { value: 90, label: '90 分鐘' }]} /></Form.Item><Form.Item name="defaultFee" label="預設每堂學費 (NT$)"><InputNumber min={0} step={100} style={{ width: '100%' }} placeholder="例如：1200" prefix="NT$" /></Form.Item><Form.Item name="defaultLocation" label="預設上課地點"><Input /></Form.Item><Button type="primary" htmlType="submit">儲存設定</Button></Form></Card>
    <Card className="surface-card setting-card" title="系統上課提醒與鬧鐘震動">
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        啟用課前通知後，系統將於上課前主動發送瀏覽器系統級通知與手機震動提醒，協助您從容備課與出行。
      </Typography.Paragraph>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Flex justify="space-between" align="center">
          <div>
            <Typography.Text strong>開啟課前系統通知提醒</Typography.Text>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>
              {'Notification' in window ? (Notification.permission === 'granted' ? '目前權限：已允許' : Notification.permission === 'denied' ? '目前權限：已拒絕（請至瀏覽器設定中解鎖）' : '尚未授權通知') : '此瀏覽器不支援通知 API'}
            </div>
          </div>
          <Switch
            checked={settings.enableNotifications}
            onChange={async (checked) => {
              if (checked) {
                const granted = await requestNotificationPermission()
                if (granted) {
                  updateSettings({ enableNotifications: true })
                  void message.success('已啟用課前提醒通知')
                  sendNotification('課前通知功能已啟用 🔔', 'Nomad 會在上課前主動發送鬧鐘震動提醒！')
                } else {
                  void message.error('瀏覽器通知權限已被拒絕，請於瀏覽器網址列旁開啟權限後再試')
                }
              } else {
                updateSettings({ enableNotifications: false })
                void message.info('已關閉課前提醒通知')
              }
            }}
          />
        </Flex>

        {settings.enableNotifications && (
          <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
            <Typography.Text>課前提醒提前時間</Typography.Text>
            <Select
              style={{ width: 140 }}
              value={settings.notificationLeadMinutes ?? 15}
              onChange={(value) => {
                updateSettings({ notificationLeadMinutes: value })
                void message.success(`已將提醒時間調整為課前 ${value} 分鐘`)
              }}
              options={[
                { value: 5, label: '課前 5 分鐘' },
                { value: 10, label: '課前 10 分鐘' },
                { value: 15, label: '課前 15 分鐘' },
                { value: 30, label: '課前 30 分鐘' },
                { value: 60, label: '課前 1 小時' },
              ]}
            />
          </Flex>
        )}

        <Space wrap>
          <Button
            icon={<BellOutlined />}
            onClick={async () => {
              const granted = await requestNotificationPermission()
              if (granted) {
                sendNotification(
                  '測試提醒：課堂即將開始 🔔',
                  '【林小安】的鋼琴課將於 15 分鐘後開始！震動與系統通知運作正常。'
                )
                void message.success('已發送測試提醒通知')
              } else {
                void message.warning('無法發送通知，請允許瀏覽器通知權限')
              }
            }}
          >
            測試發送提醒通知
          </Button>
        </Space>
      </div>
    </Card>
    <Card className="surface-card setting-card" title="課程種類設定"><Space.Compact style={{ width: '100%', marginBottom: 12 }}><Input value={newCourseType} onChange={(event) => setNewCourseType(event.target.value)} onPressEnter={createCourseType} placeholder="輸入新課程名稱（如：木吉他、樂理）" /><Button type="primary" icon={<PlusOutlined />} onClick={createCourseType}>新增課程</Button></Space.Compact><List size="small" dataSource={settings.courseTypes} renderItem={(courseType) => <List.Item className="course-type-item"><Flex className="course-type-row" align="center" justify="space-between" gap={8}><div className="course-type-name">{renamingCourseType === courseType ? <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onPressEnter={() => saveCourseTypeName(courseType)} autoFocus /> : <Tag color="blue">{courseType}</Tag>}</div><Space className="course-type-actions" size={0}>{renamingCourseType === courseType ? <><Button type="link" onClick={() => saveCourseTypeName(courseType)}>確認</Button><Button type="link" onClick={() => setRenamingCourseType(null)}>取消</Button></> : <><Button type="link" icon={<EditOutlined />} onClick={() => { setRenamingCourseType(courseType); setRenameValue(courseType) }}>改名</Button><Popconfirm title={students.some((student) => student.subjects.includes(courseType)) ? '此課程仍有學員使用，確定刪除？' : '確定刪除此課程？'} okText="刪除" cancelText="取消" onConfirm={() => { deleteCourseType(courseType); void message.success('已刪除課程種類') }}><Button type="link" danger disabled={settings.courseTypes.length <= 1} icon={<DeleteOutlined />}>刪除</Button></Popconfirm></>}</Space></Flex></List.Item>} /></Card>
    <Card className="surface-card setting-card" title="新手教學與帳本資料重置">
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        隨時重溫系統核心功能引導教學，或切換體驗示範資料與全新空白帳本。
      </Typography.Paragraph>
      <Space wrap>
        <Button
          icon={<BulbOutlined />}
          onClick={() => {
            resetOnboarding()
            navigate('/')
          }}
        >
          重新開啟新手教學導覽
        </Button>
        <Button
          icon={<SyncOutlined />}
          onClick={() => {
            loadDemoState()
            void message.success('已載入示範教學資料')
            navigate('/')
          }}
        >
          載入示範教學資料
        </Button>
        <Popconfirm
          title="確定清空為空白帳本？"
          description="將清空所有學員、課堂與通勤紀錄，請確認已備份重要資料。"
          okText="清空為空白"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          onConfirm={() => {
            startBlankState()
            void message.success('已清空為全新空白帳本')
            navigate('/students')
          }}
        >
          <Button danger icon={<DeleteOutlined />}>
            清空為全新空白帳本
          </Button>
        </Popconfirm>
      </Space>
    </Card>
    <Card className="surface-card setting-card" title="本地資料備份"><Typography.Paragraph type="secondary">資料只儲存在此瀏覽器，可用 JSON 備份檔跨裝置或復原。</Typography.Paragraph><input ref={fileInputRef} type="file" accept=".json,application/json" hidden onChange={importFile} /><Space wrap><Button icon={<DownloadOutlined />} onClick={exportData}>匯出 JSON 備份檔</Button><Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>匯入備份檔</Button><Button danger onClick={() => Modal.confirm({ title: '重置所有資料？', content: '目前的學員、課程與設定將被初始測試資料取代。', okText: '重置', cancelText: '取消', okButtonProps: { danger: true }, onOk: () => { resetToDefault(); void message.success('已重置為初始資料') } })}>重置所有資料</Button></Space></Card>
  </>
}
