import { useMemo, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { Button, Calendar, Card, DatePicker, Drawer, Empty, Flex, Form, Input, List, Popconfirm, Segmented, Select, Space, Tag, TimePicker, Typography, message, type CalendarProps } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import zhTW from 'antd/locale/zh_TW'
import { useAppStore } from '../store/useAppStore'
import type { Lesson, LessonStatus } from '../types'

type LessonFormValues = { studentId: string; date: Dayjs; startTime: Dayjs; endTime: Dayjs; location: string; notes?: string }
const antdLocale = (zhTW as unknown as { default?: typeof zhTW }).default ?? zhTW
const calendarLocale = { ...antdLocale.Calendar, lang: { ...antdLocale.Calendar?.lang, locale: 'zh-tw', shortWeekDays: ['日', '一', '二', '三', '四', '五', '六'] } } as CalendarProps<Dayjs>['locale']
const toTime = (time: string) => dayjs(`${dayjs().format('YYYY-MM-DD')}T${time}`)

export default function CalendarPage() {
  const students = useAppStore((state) => state.students)
  const lessons = useAppStore((state) => state.lessons)
  const settings = useAppStore((state) => state.settings)
  const addLesson = useAppStore((state) => state.addLesson)
  const updateLesson = useAppStore((state) => state.updateLesson)
  const deleteLesson = useAppStore((state) => state.deleteLesson)
  const updateLessonStatus = useAppStore((state) => state.updateLessonStatus)
  const [viewMode, setViewMode] = useState<'月檢視' | '列表檢視'>('月檢視')
  const [selectedDate, setSelectedDate] = useState(dayjs())
  const [statusFilter, setStatusFilter] = useState<'all' | LessonStatus>('all')
  const [scheduleDrawerOpen, setScheduleDrawerOpen] = useState(false)
  const [lessonDrawerOpen, setLessonDrawerOpen] = useState(false)
  const [commuteDrawerOpen, setCommuteDrawerOpen] = useState(false)
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)
  const [form] = Form.useForm<LessonFormValues>()
  const selectedLessons = useMemo(() => lessons.filter((lesson) => lesson.date === selectedDate.format('YYYY-MM-DD')).sort((a, b) => a.startTime.localeCompare(b.startTime)), [lessons, selectedDate])
  const listedLessons = useMemo(() => lessons.filter((lesson) => statusFilter === 'all' || lesson.status === statusFilter).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)), [lessons, statusFilter])

  const openNewLesson = () => { setEditingLesson(null); form.setFieldsValue({ date: selectedDate, location: settings.defaultLocation, startTime: undefined, endTime: undefined, studentId: undefined, notes: undefined }); setLessonDrawerOpen(true) }
  const openEditLesson = (lesson: Lesson) => { setEditingLesson(lesson); form.setFieldsValue({ studentId: lesson.studentId, date: dayjs(lesson.date), startTime: toTime(lesson.startTime), endTime: toTime(lesson.endTime), location: lesson.location, notes: lesson.notes }); setLessonDrawerOpen(true) }
  const submitLesson = (values: LessonFormValues) => {
    const student = students.find((item) => item.id === values.studentId)
    if (!student) return
    const data = { studentId: student.id, studentName: student.name, subject: student.subject, date: values.date.format('YYYY-MM-DD'), startTime: values.startTime.format('HH:mm'), endTime: values.endTime.format('HH:mm'), location: values.location, notes: values.notes, status: editingLesson?.status ?? 'scheduled' as LessonStatus }
    if (editingLesson) updateLesson(editingLesson.id, data); else addLesson(data)
    setLessonDrawerOpen(false); void message.success(editingLesson ? '課程已更新' : '排課已新增')
  }
  const onValuesChange = (changed: Partial<LessonFormValues>) => {
    if (changed.studentId) { const student = students.find((item) => item.id === changed.studentId); if (student) form.setFieldValue('location', student.defaultLocation) }
    if (changed.startTime && !form.getFieldValue('endTime')) form.setFieldValue('endTime', changed.startTime.add(settings.defaultDuration, 'minute'))
  }
  const renderLesson = (lesson: Lesson) => <List.Item key={lesson.id}><div className="lesson-row"><div className="schedule-list-date">{dayjs(lesson.date).format('MM/DD')}<br /><span>{lesson.startTime} - {lesson.endTime}</span></div><div className="lesson-main"><Space size={8} wrap><span className="lesson-name">{lesson.studentName}</span><Tag color="blue">{lesson.subject}</Tag></Space><div className="lesson-meta">{lesson.location}</div></div><Space size={4} wrap><Select size="small" value={lesson.status} style={{ width: 90 }} options={[{ value: 'scheduled', label: '待上課' }, { value: 'completed', label: '完課' }, { value: 'leave', label: '請假' }]} onChange={(status: LessonStatus) => updateLessonStatus(lesson.id, status)} /><Button type="link" size="small" onClick={() => openEditLesson(lesson)}>編輯</Button><Popconfirm title="確定刪除此排課？" okText="刪除" cancelText="取消" onConfirm={() => { deleteLesson(lesson.id); void message.success('已刪除排課') }}><Button danger type="text" size="small">刪除</Button></Popconfirm></Space></div></List.Item>

  return <>
    <Flex className="calendar-toolbar" justify="space-between" align="center"><Segmented options={[{ label: '月檢視', value: '月檢視' }, { label: '列表檢視', value: '列表檢視' }]} value={viewMode} onChange={(value) => setViewMode(value as '月檢視' | '列表檢視')} /><Button type="primary" shape="circle" icon={<PlusOutlined />} aria-label="新增排程" onClick={() => setScheduleDrawerOpen(true)} /></Flex>
    {viewMode === '月檢視' ? <><Card className="surface-card calendar-card" style={{ marginBottom: 16 }}><Calendar fullscreen={false} locale={calendarLocale} value={selectedDate} onSelect={setSelectedDate} dateCellRender={(current) => { const dayLessons = lessons.filter((lesson) => lesson.date === current.format('YYYY-MM-DD')); if (dayLessons.length === 0) return null; const hasScheduled = dayLessons.some((lesson) => lesson.status === 'scheduled'); const complete = dayLessons.every((lesson) => lesson.status === 'completed'); return <span className={`calendar-lesson-dot ${complete && !hasScheduled ? 'is-complete' : ''}`} aria-label="有排課" /> }} /></Card><Card className="surface-card" title={`${selectedDate.format('MM 月 DD 日')}・當日課程`}>{selectedLessons.length ? <List className="lesson-list" dataSource={selectedLessons} renderItem={renderLesson} /> : <Empty description="當日沒有課程" />}</Card></> : <Card className="surface-card" title="近期排程" extra={<Segmented size="small" value={statusFilter} options={[{ label: '全部', value: 'all' }, { label: '待上課', value: 'scheduled' }, { label: '已完課', value: 'completed' }, { label: '請假', value: 'leave' }]} onChange={(value) => setStatusFilter(value as 'all' | LessonStatus)} />}>{listedLessons.length ? <List className="lesson-list" dataSource={listedLessons} renderItem={renderLesson} /> : <Empty description="沒有符合的排程" />}</Card>}
    <Drawer title="新增排程" placement="right" width={320} open={scheduleDrawerOpen} onClose={() => setScheduleDrawerOpen(false)}><Space direction="vertical" size={12} className="schedule-menu"><Button type="primary" block onClick={() => { setScheduleDrawerOpen(false); openNewLesson() }}>排課</Button><Button block onClick={() => { setScheduleDrawerOpen(false); setCommuteDrawerOpen(true) }}>通勤</Button><Button type="text" size="small" block onClick={() => setScheduleDrawerOpen(false)}>其他排程</Button></Space></Drawer>
    <Drawer title={editingLesson ? '編輯排課' : '新增排課'} placement="right" width={400} open={lessonDrawerOpen} onClose={() => setLessonDrawerOpen(false)} extra={<Button type="primary" onClick={() => form.submit()}>{editingLesson ? '儲存' : '新增'}</Button>}><Form form={form} layout="vertical" className="form-stack" onFinish={submitLesson} onValuesChange={onValuesChange}><Form.Item name="studentId" label="學員" rules={[{ required: true, message: '請選擇學員' }]}><Select placeholder="選擇學員" options={students.map((student) => ({ value: student.id, label: `${student.name}・${student.subject}` }))} /></Form.Item><Form.Item name="date" label="上課日期" rules={[{ required: true, message: '請選擇日期' }]}><DatePicker style={{ width: '100%' }} /></Form.Item><Form.Item name="startTime" label="開始時間" rules={[{ required: true, message: '請選擇開始時間' }]}><TimePicker style={{ width: '100%' }} format="HH:mm" /></Form.Item><Form.Item name="endTime" label="結束時間" rules={[{ required: true, message: '請選擇結束時間' }]}><TimePicker style={{ width: '100%' }} format="HH:mm" /></Form.Item><Form.Item name="location" label="上課地點" rules={[{ required: true, message: '請輸入地點' }]}><Input /></Form.Item><Form.Item name="notes" label="備註"><Input.TextArea rows={3} /></Form.Item></Form></Drawer>
    <Drawer title="新增通勤" placement="right" width={400} open={commuteDrawerOpen} onClose={() => setCommuteDrawerOpen(false)} extra={<Button type="primary" onClick={() => setCommuteDrawerOpen(false)}>新增</Button>}><Typography.Paragraph type="secondary">通勤排程 UI 預覽。</Typography.Paragraph><Form layout="vertical" className="form-stack"><Form.Item label="日期"><DatePicker style={{ width: '100%' }} /></Form.Item><Form.Item label="起訖時間"><TimePicker.RangePicker style={{ width: '100%' }} format="HH:mm" /></Form.Item><Form.Item label="出發地"><Input /></Form.Item><Form.Item label="目的地"><Input /></Form.Item></Form></Drawer>
  </>
}
