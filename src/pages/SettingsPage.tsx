import { useState, useRef } from 'react'
import dayjs from 'dayjs'
import { Button, Card, Form, Input, List, Modal, Popconfirm, Select, Space, Tag, Typography, message } from 'antd'
import { DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
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
    <Card className="surface-card setting-card" title="排課偏好設定"><Form form={form} className="setting-form" layout="vertical" initialValues={settings} onFinish={saveSettings}><Form.Item name="defaultDuration" label="預設課程時長"><Select options={[{ value: 50, label: '50 分鐘' }, { value: 60, label: '60 分鐘' }, { value: 90, label: '90 分鐘' }]} /></Form.Item><Form.Item name="defaultLocation" label="預設上課地點"><Input /></Form.Item><Button type="primary" htmlType="submit">儲存設定</Button></Form></Card>
    <Card className="surface-card setting-card" title="課程種類設定"><Space.Compact style={{ width: '100%', marginBottom: 12 }}><Input value={newCourseType} onChange={(event) => setNewCourseType(event.target.value)} onPressEnter={createCourseType} placeholder="輸入新課程名稱（如：木吉他、樂理）" /><Button type="primary" icon={<PlusOutlined />} onClick={createCourseType}>新增課程</Button></Space.Compact><List size="small" dataSource={settings.courseTypes} renderItem={(courseType) => <List.Item actions={renamingCourseType === courseType ? [<Button key="save" type="link" onClick={() => saveCourseTypeName(courseType)}>確認</Button>, <Button key="cancel" type="link" onClick={() => setRenamingCourseType(null)}>取消</Button>] : [<Button key="edit" type="link" icon={<EditOutlined />} onClick={() => { setRenamingCourseType(courseType); setRenameValue(courseType) }}>改名</Button>, <Popconfirm key="delete" title={students.some((student) => student.subject === courseType) ? '此課程仍有學員使用，確定刪除？' : '確定刪除此課程？'} okText="刪除" cancelText="取消" onConfirm={() => { deleteCourseType(courseType); void message.success('已刪除課程種類') }}><Button type="link" danger disabled={settings.courseTypes.length <= 1} icon={<DeleteOutlined />}>刪除</Button></Popconfirm>]}>{renamingCourseType === courseType ? <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onPressEnter={() => saveCourseTypeName(courseType)} autoFocus /> : <Tag color="blue">{courseType}</Tag>}</List.Item>} /></Card>
    <Card className="surface-card setting-card" title="本地資料備份"><Typography.Paragraph type="secondary">資料只儲存在此瀏覽器，可用 JSON 備份檔跨裝置或復原。</Typography.Paragraph><input ref={fileInputRef} type="file" accept=".json,application/json" hidden onChange={importFile} /><Space wrap><Button icon={<DownloadOutlined />} onClick={exportData}>匯出 JSON 備份檔</Button><Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>匯入備份檔</Button><Button danger onClick={() => Modal.confirm({ title: '重置所有資料？', content: '目前的學員、課程與設定將被初始測試資料取代。', okText: '重置', cancelText: '取消', okButtonProps: { danger: true }, onOk: () => { resetToDefault(); void message.success('已重置為初始資料') } })}>重置所有資料</Button></Space></Card>
  </>
}
