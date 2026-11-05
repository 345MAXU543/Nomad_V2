import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import {
  Alert,
  Button,
  Calendar,
  Card,
  Checkbox,
  DatePicker,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Radio,
  Segmented,
  Select,
  Space,
  Switch,
  Tag,
  TimePicker,
  Typography,
  message,
  type CalendarProps,
} from 'antd'
import {
  AlertOutlined,
  CalendarOutlined,
  DollarOutlined,
  PlusOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import zhTW from 'antd/locale/zh_TW'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import type { Lesson, LessonStatus, PaymentStatus } from '../types'
import type { DefaultOptionType } from 'antd/es/select'

type LessonFormValues = {
  studentId: string
  subject: string
  date: Dayjs
  startTime: Dayjs
  endTime: Dayjs
  location: string
  fee?: number
  paymentStatus?: PaymentStatus
  notes?: string
  isRecurring?: boolean
  recurringFrequency?: 'weekly' | 'biweekly'
  recurringCount?: number
  skipConflictDates?: boolean
}

const antdLocale = (zhTW as unknown as { default?: typeof zhTW }).default ?? zhTW
const calendarLocale = {
  ...antdLocale.Calendar,
  lang: { ...antdLocale.Calendar?.lang, locale: 'zh-tw', shortWeekDays: ['日', '一', '二', '三', '四', '五', '六'] },
} as CalendarProps<Dayjs>['locale']
const toTime = (time?: string) => {
  if (!time) return dayjs().hour(14).minute(0)
  const d = dayjs(`${dayjs().format('YYYY-MM-DD')}T${time}`)
  return d.isValid() ? d : dayjs().hour(14).minute(0)
}

const isTimeOverlapping = (startA: string, endA: string, startB: string, endB: string): boolean => {
  return startA < endB && endA > startB
}

const findConflicts = (
  date: string,
  startTime: string,
  endTime: string,
  allLessons: Lesson[],
  excludeLessonId?: string
): Lesson[] => {
  if (!date || !startTime || !endTime) return []
  return allLessons.filter((lesson) => {
    if (lesson.id === excludeLessonId) return false
    if (lesson.date !== date) return false
    if (lesson.status === 'leave') return false
    return isTimeOverlapping(startTime, endTime, lesson.startTime, lesson.endTime)
  })
}

export default function CalendarPage() {
  const location = useLocation()
  const students = useAppStore((state) => state.students)
  const lessons = useAppStore((state) => state.lessons)
  const settings = useAppStore((state) => state.settings)
  const courseTypes = useAppStore((state) => state.settings.courseTypes)
  const addLesson = useAppStore((state) => state.addLesson)
  const addLessons = useAppStore((state) => state.addLessons)
  const updateLesson = useAppStore((state) => state.updateLesson)
  const deleteLesson = useAppStore((state) => state.deleteLesson)
  const deleteRecurringLessons = useAppStore((state) => state.deleteRecurringLessons)
  const updateLessonStatus = useAppStore((state) => state.updateLessonStatus)
  const markLeaveWaived = useAppStore((state) => state.markLeaveWaived)
  const updateLessonPaymentStatus = useAppStore((state) => state.updateLessonPaymentStatus)
  const pendingMakeupLessonId = useAppStore((state) => state.pendingMakeupLessonId)
  const setPendingMakeupLessonId = useAppStore((state) => state.setPendingMakeupLessonId)

  const [searchParams, setSearchParams] = useSearchParams()
  const handledMakeupRef = useRef<string | null>(null)
  const [viewMode, setViewMode] = useState<'月檢視' | '列表檢視'>('月檢視')
  const [selectedDate, setSelectedDate] = useState(dayjs())
  const [statusFilter, setStatusFilter] = useState<'all' | LessonStatus>('all')
  const [scheduleDrawerOpen, setScheduleDrawerOpen] = useState(false)
  const [lessonDrawerOpen, setLessonDrawerOpen] = useState(false)
  const [commuteDrawerOpen, setCommuteDrawerOpen] = useState(false)
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)
  const [recurringDeleteLesson, setRecurringDeleteLesson] = useState<Lesson | null>(null)
  const [makeupForLesson, setMakeupForLesson] = useState<Lesson | null>(null)
  const [excludedDates, setExcludedDates] = useState<string[]>([])
  const [form] = Form.useForm<LessonFormValues>()

  const selectedStudentId = Form.useWatch('studentId', form)
  const formDate = Form.useWatch('date', form)
  const formStartTime = Form.useWatch('startTime', form)
  const formEndTime = Form.useWatch('endTime', form)
  const formIsRecurring = Form.useWatch('isRecurring', form)
  const formFrequency = Form.useWatch('recurringFrequency', form) ?? 'weekly'
  const formCount = Form.useWatch('recurringCount', form) ?? 4

  const selectedStudent = students.find(
    (student) => student.id === (selectedStudentId || makeupForLesson?.studentId)
  )

  const lessonSubjectOptions: DefaultOptionType[] = selectedStudent
    ? [
        { label: '學員主修才藝', options: selectedStudent.subjects.map((subject) => ({ label: subject, value: subject })) },
        { label: '其他系統課程種類', options: courseTypes.filter((courseType) => !selectedStudent.subjects.includes(courseType)).map((courseType) => ({ label: courseType, value: courseType })) },
      ]
    : courseTypes.map((courseType) => ({ label: courseType, value: courseType }))

  const selectedLessons = useMemo(
    () => lessons.filter((lesson) => lesson.date === selectedDate.format('YYYY-MM-DD')).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [lessons, selectedDate]
  )

  const listedLessons = useMemo(
    () => lessons.filter((lesson) => statusFilter === 'all' || lesson.status === statusFilter).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)),
    [lessons, statusFilter]
  )

  // 週期性排課與衝堂即時計算（純內嵌提示，不彈窗）
  const recurringPreview = useMemo(() => {
    if (!formDate || !formStartTime || !formEndTime) return []
    const count = formIsRecurring ? Math.min(Math.max(1, Number(formCount) || 4), 24) : 1
    const stepDays = formFrequency === 'biweekly' ? 14 : 7
    const startTimeStr = formStartTime.format('HH:mm')
    const endTimeStr = formEndTime.format('HH:mm')

    const list: { dateStr: string; dayLabel: string; conflicts: Lesson[] }[] = []
    for (let i = 0; i < count; i++) {
      const curDate = formDate.add(i * stepDays, 'day')
      const dateStr = curDate.format('YYYY-MM-DD')
      const dayLabel = curDate.format('MM/DD (dd)')
      const conflicts = findConflicts(dateStr, startTimeStr, endTimeStr, lessons, editingLesson?.id)
      list.push({ dateStr, dayLabel, conflicts })
    }
    return list
  }, [formDate, formStartTime, formEndTime, formIsRecurring, formFrequency, formCount, lessons, editingLesson])

  const conflictCount = useMemo(
    () => recurringPreview.filter((item) => item.conflicts.length > 0).length,
    [recurringPreview]
  )

  const openNewLesson = () => {
    setEditingLesson(null)
    setMakeupForLesson(null)
    handledMakeupRef.current = null
    setExcludedDates([])
    const fallbackFee = settings.defaultFee ?? 1200
    form.setFieldsValue({
      date: selectedDate,
      location: settings.defaultLocation,
      startTime: undefined,
      endTime: undefined,
      studentId: undefined,
      subject: undefined,
      notes: undefined,
      fee: fallbackFee,
      paymentStatus: 'unpaid',
      isRecurring: false,
      recurringFrequency: 'weekly',
      recurringCount: 4,
      skipConflictDates: false,
    })
    setLessonDrawerOpen(true)
  }

  const openEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson)
    setMakeupForLesson(null)
    handledMakeupRef.current = null
    setExcludedDates([])
    const student = students.find((item) => item.id === lesson.studentId)
    form.setFieldsValue({
      studentId: lesson.studentId,
      subject: lesson.subject,
      date: dayjs(lesson.date),
      startTime: toTime(lesson.startTime),
      endTime: toTime(lesson.endTime),
      location: lesson.location,
      notes: lesson.notes,
      fee: lesson.fee !== undefined ? lesson.fee : (student?.defaultFee ?? settings.defaultFee ?? 1200),
      paymentStatus: lesson.paymentStatus ?? 'unpaid',
      isRecurring: false,
    })
    setLessonDrawerOpen(true)
  }

  const openMakeupLesson = useCallback((leaveLesson: Lesson) => {
    setEditingLesson(null)
    setMakeupForLesson(leaveLesson)
    setExcludedDates([])
    const proposedDate = selectedDate.isBefore(dayjs().subtract(1, 'day')) ? dayjs().add(1, 'day') : selectedDate
    setSelectedDate(proposedDate)
    form.setFieldsValue({
      studentId: leaveLesson.studentId,
      subject: leaveLesson.subject,
      date: proposedDate,
      startTime: toTime(leaveLesson.startTime),
      endTime: toTime(leaveLesson.endTime),
      location: leaveLesson.location,
      notes: `補 ${dayjs(leaveLesson.date).format('YYYY/MM/DD')} 請假課程`,
      fee: 0,
      paymentStatus: 'paid',
      isRecurring: false,
      skipConflictDates: false,
    })
    setLessonDrawerOpen(true)
  }, [form, selectedDate])

  // 接收來自外部頁面（如 Dashboard）傳遞進來的補課請求
  useEffect(() => {
    const makeupId = searchParams.get('makeup') || pendingMakeupLessonId || (location.state as { makeupLessonId?: string } | null)?.makeupLessonId
    if (!makeupId || handledMakeupRef.current === makeupId) return

    const leaveLesson = lessons.find((l) => l.id === makeupId)
    if (leaveLesson) {
      handledMakeupRef.current = makeupId
      queueMicrotask(() => {
        openMakeupLesson(leaveLesson)
        if (pendingMakeupLessonId) {
          setPendingMakeupLessonId(null)
        }
        if (searchParams.get('makeup')) {
          setSearchParams({}, { replace: true })
        }
      })
    }
  }, [searchParams, pendingMakeupLessonId, location.state, lessons, openMakeupLesson, setSearchParams, setPendingMakeupLessonId])

  const submitLesson = (values: LessonFormValues) => {
    const targetStudentId = values.studentId || makeupForLesson?.studentId
    const student = students.find((item) => item.id === targetStudentId)
    if (!student) return
    const fallbackFee = student.defaultFee ?? settings.defaultFee ?? 1200
    const fee = values.fee !== undefined ? values.fee : fallbackFee

    // 補課儲存邏輯
    if (makeupForLesson) {
      addLesson({
        studentId: student.id,
        studentName: student.name,
        subject: values.subject,
        date: values.date.format('YYYY-MM-DD'),
        startTime: values.startTime.format('HH:mm'),
        endTime: values.endTime.format('HH:mm'),
        location: values.location,
        notes: values.notes,
        fee,
        paymentStatus: values.paymentStatus ?? 'paid',
        status: 'scheduled' as LessonStatus,
        isMakeup: true,
        makeupForLessonId: makeupForLesson.id,
      })
      setMakeupForLesson(null)
      setLessonDrawerOpen(false)
      handledMakeupRef.current = null
      void message.success(`已為【${student.name}】安排補課`)
      return
    }

    // 週期性排課邏輯
    if (!editingLesson && values.isRecurring) {
      const recurringGroupId = `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const candidateItems = values.skipConflictDates
        ? recurringPreview.filter((p) => p.conflicts.length === 0)
        : recurringPreview

      const targetItems = candidateItems.filter((p) => !excludedDates.includes(p.dateStr))

      if (targetItems.length === 0) {
        void message.warning('所有預訂日期皆已被略過或與現有行程衝突，未建立任何排課')
        return
      }

      const batchLessons = targetItems.map((item) => ({
        studentId: student.id,
        studentName: student.name,
        subject: values.subject,
        date: item.dateStr,
        startTime: values.startTime.format('HH:mm'),
        endTime: values.endTime.format('HH:mm'),
        location: values.location,
        notes: values.notes,
        fee,
        paymentStatus: values.paymentStatus ?? 'unpaid',
        status: 'scheduled' as LessonStatus,
        recurringGroupId,
      }))

      addLessons(batchLessons)
      setLessonDrawerOpen(false)
      void message.success(`已成功建立 ${batchLessons.length} 堂週期性排課`)
      return
    }

    // 單堂排課 / 編輯既有排課
    const data = {
      studentId: student.id,
      studentName: student.name,
      subject: values.subject,
      date: values.date.format('YYYY-MM-DD'),
      startTime: values.startTime.format('HH:mm'),
      endTime: values.endTime.format('HH:mm'),
      location: values.location,
      notes: values.notes,
      fee,
      paymentStatus: values.paymentStatus ?? 'unpaid',
      status: editingLesson?.status ?? ('scheduled' as LessonStatus),
      recurringGroupId: editingLesson?.recurringGroupId,
    }

    if (editingLesson) updateLesson(editingLesson.id, data); else addLesson(data)
    setLessonDrawerOpen(false)
    void message.success(editingLesson ? '課程已更新' : '排課已新增')
  }

  const onValuesChange = (changed: Partial<LessonFormValues>) => {
    if (changed.studentId) {
      const student = students.find((item) => item.id === changed.studentId)
      if (student) {
        form.setFieldValue('location', student.defaultLocation)
        form.setFieldValue('subject', student.subjects[0])
        const studentFee = student.defaultFee ?? settings.defaultFee ?? 1200
        form.setFieldValue('fee', studentFee)
      }
    }
    if (changed.startTime && !form.getFieldValue('endTime')) {
      form.setFieldValue('endTime', changed.startTime.add(settings.defaultDuration, 'minute'))
    }
  }

  const togglePayment = (lesson: Lesson) => {
    const nextStatus: PaymentStatus = lesson.paymentStatus === 'paid' ? 'unpaid' : 'paid'
    updateLessonPaymentStatus(lesson.id, nextStatus)
    void message.success(nextStatus === 'paid' ? `已標記 ${lesson.studentName} 為已收款` : `已標記 ${lesson.studentName} 為待收款`)
  }

  const toggleExcludeDate = (dateStr: string) => {
    setExcludedDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    )
  }

  const renderLesson = (lesson: Lesson) => {
    const conflicts = findConflicts(lesson.date, lesson.startTime, lesson.endTime, lessons, lesson.id)
    const hasConflict = conflicts.length > 0
    const rescheduledTarget = lesson.rescheduledLessonId && lesson.rescheduledLessonId !== 'waived'
      ? lessons.find((l) => l.id === lesson.rescheduledLessonId)
      : null

    return (
      <List.Item key={lesson.id}>
        <div className="lesson-row">
          <div className="schedule-list-date">
            {dayjs(lesson.date).format('MM/DD')}<br />
            <span>{lesson.startTime} - {lesson.endTime}</span>
          </div>
          <div className="lesson-main">
            <Space size={6} wrap align="center">
              <span className="lesson-name">{lesson.studentName}</span>
              <Tag color="blue">{lesson.subject}</Tag>
              {lesson.isMakeup ? (
                <Tag color="cyan">補課</Tag>
              ) : null}
              {lesson.recurringGroupId ? (
                <Tag color="purple" icon={<SyncOutlined />}>循環</Tag>
              ) : null}
              {hasConflict ? (
                <Tag color="error" icon={<AlertOutlined />} title={`與 ${conflicts.map((c) => c.studentName).join('、')} 衝堂`}>
                  衝堂
                </Tag>
              ) : null}
              {lesson.status === 'leave' ? (
                lesson.rescheduledLessonId === 'waived' ? (
                  <Tag>已免補課</Tag>
                ) : rescheduledTarget ? (
                  <Tag color="green">已排補課 {dayjs(rescheduledTarget.date).format('MM/DD')}</Tag>
                ) : (
                  <Tag color="orange">待排補課</Tag>
                )
              ) : null}
              {lesson.fee !== undefined ? (
                <Tag
                  color={lesson.paymentStatus === 'paid' ? 'success' : lesson.paymentStatus === 'waived' ? 'default' : 'warning'}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  title="點擊切換 待收 / 已收"
                  onClick={() => togglePayment(lesson)}
                >
                  <DollarOutlined /> NT$ {lesson.fee.toLocaleString()} · {lesson.paymentStatus === 'paid' ? '已收' : lesson.paymentStatus === 'waived' ? '免收' : '待收'}
                </Tag>
              ) : null}
            </Space>
            <div className="lesson-meta">{lesson.location}</div>
          </div>
          <Space className="lesson-actions" size={4} wrap>
            <Select
              size="small"
              value={lesson.status}
              style={{ width: 90 }}
              options={[
                { value: 'scheduled', label: '待上課' },
                { value: 'completed', label: '完課' },
                { value: 'leave', label: '請假' },
              ]}
              onChange={(status: LessonStatus) => updateLessonStatus(lesson.id, status)}
            />
            {lesson.status === 'leave' && !lesson.rescheduledLessonId && (
              <Button type="primary" ghost size="small" onClick={() => openMakeupLesson(lesson)}>
                安排補課
              </Button>
            )}
            {lesson.status === 'leave' && !lesson.rescheduledLessonId && (
              <Popconfirm
                title="確認此堂請假免補課？"
                okText="確認免補"
                cancelText="取消"
                onConfirm={() => {
                  markLeaveWaived(lesson.id)
                  void message.success('已標記為免補課')
                }}
              >
                <Button type="text" size="small" style={{ color: '#8c8c8c' }}>
                  免補
                </Button>
              </Popconfirm>
            )}
            <Button type="link" size="small" onClick={() => openEditLesson(lesson)}>編輯</Button>
            {lesson.recurringGroupId ? (
              <Button danger type="text" size="small" onClick={() => setRecurringDeleteLesson(lesson)}>刪除</Button>
            ) : (
              <Popconfirm
                title="確定刪除此排課？"
                okText="刪除"
                cancelText="取消"
                onConfirm={() => {
                  deleteLesson(lesson.id)
                  void message.success('已刪除排課')
                }}
              >
                <Button danger type="text" size="small">刪除</Button>
              </Popconfirm>
            )}
          </Space>
        </div>
      </List.Item>
    )
  }

  return <>
    <Flex className="calendar-toolbar" justify="space-between" align="center">
      <Segmented options={[{ label: '月檢視', value: '月檢視' }, { label: '列表檢視', value: '列表檢視' }]} value={viewMode} onChange={(value) => setViewMode(value as '月檢視' | '列表檢視')} />
      <Button type="primary" shape="circle" icon={<PlusOutlined />} aria-label="新增排程" onClick={() => setScheduleDrawerOpen(true)} />
    </Flex>
    {viewMode === '月檢視' ? (
      <>
        <Card className="surface-card calendar-card" style={{ marginBottom: 16 }}>
          <Calendar
            fullscreen={false}
            locale={calendarLocale}
            value={selectedDate}
            onSelect={setSelectedDate}
            dateCellRender={(current) => {
              const dayLessons = lessons.filter((lesson) => lesson.date === current.format('YYYY-MM-DD'))
              if (dayLessons.length === 0) return null
              const hasScheduled = dayLessons.some((lesson) => lesson.status === 'scheduled')
              const complete = dayLessons.every((lesson) => lesson.status === 'completed')
              return <span className={`calendar-lesson-dot ${complete && !hasScheduled ? 'is-complete' : ''}`} aria-label="有排課" />
            }}
          />
        </Card>
        <Card className="surface-card" title={`${selectedDate.format('MM 月 DD 日')}・當日課程`}>
          {selectedLessons.length ? <List className="lesson-list" dataSource={selectedLessons} renderItem={renderLesson} /> : <Empty description="當日沒有課程" />}
        </Card>
      </>
    ) : (
      <Card
        className="surface-card"
        title="近期排程"
        extra={
          <Segmented
            size="small"
            value={statusFilter}
            options={[
              { label: '全部', value: 'all' },
              { label: '待上課', value: 'scheduled' },
              { label: '已完課', value: 'completed' },
              { label: '請假', value: 'leave' },
            ]}
            onChange={(value) => setStatusFilter(value as 'all' | LessonStatus)}
          />
        }
      >
        {listedLessons.length ? <List className="lesson-list" dataSource={listedLessons} renderItem={renderLesson} /> : <Empty description="沒有符合的排程" />}
      </Card>
    )}
    <Drawer title="新增排程" placement="right" width={320} open={scheduleDrawerOpen} onClose={() => setScheduleDrawerOpen(false)}>
      <Space direction="vertical" size={12} className="schedule-menu">
        <Button type="primary" block onClick={() => { setScheduleDrawerOpen(false); openNewLesson() }}>排課</Button>
        <Button block onClick={() => { setScheduleDrawerOpen(false); setCommuteDrawerOpen(true) }}>通勤</Button>
        <Button type="text" size="small" block onClick={() => setScheduleDrawerOpen(false)}>其他排程</Button>
      </Space>
    </Drawer>
    <Drawer
      title={makeupForLesson ? `安排補課 · ${makeupForLesson.studentName}` : editingLesson ? '編輯排課' : '新增排課'}
      placement="right"
      width={440}
      open={lessonDrawerOpen}
      onClose={() => {
        setLessonDrawerOpen(false)
        setMakeupForLesson(null)
        handledMakeupRef.current = null
      }}
      extra={<Button type="primary" onClick={() => form.submit()}>{makeupForLesson ? '確認補課' : editingLesson ? '儲存' : '新增'}</Button>}
    >
      {makeupForLesson && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`此為補課排程（原請假課：${dayjs(makeupForLesson.date).format('YYYY/MM/DD')}）`}
          description="系統已自動帶入學員與科目，補課預設學費已標記為已結清。"
        />
      )}
      <Form
        form={form}
        layout="vertical"
        className="form-stack"
        onFinish={submitLesson}
        onValuesChange={onValuesChange}
        initialValues={{ isRecurring: false, recurringFrequency: 'weekly', recurringCount: 4, skipConflictDates: false }}
      >
        <Form.Item name="studentId" label="學員" rules={[{ required: true, message: '請選擇學員' }]}>
          <Select
            disabled={Boolean(makeupForLesson)}
            placeholder="選擇學員"
            options={students.map((student) => ({ value: student.id, label: `${student.name}・${student.subjects.join('、')}` }))}
          />
        </Form.Item>
        <Form.Item name="subject" label="課程科目" rules={[{ required: true, message: '請選擇課程種類' }]}>
          <Select placeholder="請選擇課程種類" options={lessonSubjectOptions} />
        </Form.Item>
        <Space style={{ display: 'flex', width: '100%' }} size={12}>
          <Form.Item name="fee" label="本堂學費 (NT$)" style={{ flex: 1 }}>
            <InputNumber min={0} step={100} style={{ width: '100%' }} placeholder="例如：1200" prefix="NT$" />
          </Form.Item>
          <Form.Item name="paymentStatus" label="繳費狀態" style={{ flex: 1 }}>
            <Select
              options={[
                { value: 'unpaid', label: '待繳款' },
                { value: 'paid', label: '已繳款' },
                { value: 'waived', label: '免收/折抵' },
              ]}
            />
          </Form.Item>
        </Space>
        <Form.Item name="date" label="上課日期" rules={[{ required: true, message: '請選擇日期' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="startTime" label="開始時間" rules={[{ required: true, message: '請選擇開始時間' }]}>
          <TimePicker style={{ width: '100%' }} format="HH:mm" />
        </Form.Item>
        <Form.Item name="endTime" label="結束時間" rules={[{ required: true, message: '請選擇結束時間' }]}>
          <TimePicker style={{ width: '100%' }} format="HH:mm" />
        </Form.Item>

        {/* 衝突提示（單堂，非侵入式內嵌提示，不彈大彈窗） */}
        {!formIsRecurring && conflictCount > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="時段衝突提醒"
            description={
              <div>
                此時段與現有行程時間重疊：
                {recurringPreview[0]?.conflicts.map((c) => (
                  <div key={c.id}>
                    • <strong>{c.studentName}</strong> ({c.subject}) {c.startTime} - {c.endTime}
                  </div>
                ))}
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  * 您仍可直接送出預排，後續再行微調。
                </Typography.Text>
              </div>
            }
          />
        )}

        {/* 週期性重複排課選項（僅新增排課時可用，補課不適用週期） */}
        {!editingLesson && !makeupForLesson && (
          <Card size="small" style={{ marginBottom: 16, background: 'rgba(59, 130, 246, 0.04)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
            <Flex justify="space-between" align="center" style={{ marginBottom: formIsRecurring ? 12 : 0 }}>
              <Space>
                <SyncOutlined style={{ color: '#3b82f6' }} />
                <Typography.Text strong>週期性規律排課</Typography.Text>
              </Space>
              <Form.Item name="isRecurring" valuePropName="checked" noStyle>
                <Switch />
              </Form.Item>
            </Flex>

            {formIsRecurring && (
              <>
                <Form.Item name="recurringFrequency" label="重複頻率" style={{ marginBottom: 12 }}>
                  <Radio.Group optionType="button" buttonStyle="solid">
                    <Radio.Button value="weekly">每週</Radio.Button>
                    <Radio.Button value="biweekly">隔週 (每 2 週)</Radio.Button>
                  </Radio.Group>
                </Form.Item>

                <Form.Item label="排課堂數" style={{ marginBottom: 12 }}>
                  <Space wrap align="center">
                    <Radio.Group
                      value={[4, 8, 12].includes(formCount) ? formCount : 'custom'}
                      onChange={(e) => {
                        if (e.target.value !== 'custom') {
                          form.setFieldValue('recurringCount', e.target.value)
                        }
                      }}
                    >
                      <Radio.Button value={4}>4 堂</Radio.Button>
                      <Radio.Button value={8}>8 堂</Radio.Button>
                      <Radio.Button value={12}>12 堂</Radio.Button>
                      <Radio.Button value="custom">自訂</Radio.Button>
                    </Radio.Group>
                    <Form.Item name="recurringCount" noStyle>
                      <InputNumber min={1} max={24} style={{ width: 80 }} placeholder="堂數" />
                    </Form.Item>
                  </Space>
                </Form.Item>

                {/* 衝突內嵌警告（安靜不擾民，零彈跳） */}
                {conflictCount > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message={`衝堂提醒：系列中有 ${conflictCount} 堂課與現有行程時間重疊`}
                    description="您可選擇自動略過衝堂日，或點擊個別日期標籤切換排除／排入。"
                  />
                )}

                {/* 即將排入的日期預覽 chips */}
                <div style={{ marginBottom: 12 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                    <CalendarOutlined style={{ marginRight: 4 }} />
                    預覽排入日期清單（點擊可個別略過/恢復）：
                  </Typography.Text>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto', padding: 4 }}>
                    {recurringPreview.map((item) => {
                      const isExcluded = excludedDates.includes(item.dateStr)
                      return (
                        <Tag
                          key={item.dateStr}
                          color={isExcluded ? 'default' : item.conflicts.length > 0 ? 'warning' : 'blue'}
                          style={{
                            padding: '3px 8px',
                            fontSize: 12,
                            cursor: 'pointer',
                            textDecoration: isExcluded ? 'line-through' : 'none',
                            opacity: isExcluded ? 0.45 : 1,
                          }}
                          onClick={() => toggleExcludeDate(item.dateStr)}
                          title="點擊排除或恢復此日期"
                        >
                          {item.dayLabel} {item.conflicts.length > 0 ? `⚠️ 與 ${item.conflicts.map((c) => c.studentName).join('、')} 重疊` : isExcluded ? '(已排除)' : '✓'}
                        </Tag>
                      )
                    })}
                  </div>
                </div>

                <Form.Item name="skipConflictDates" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Checkbox>自動略過衝堂日期（僅排入無衝突的堂數）</Checkbox>
                </Form.Item>
              </>
            )}
          </Card>
        )}

        <Form.Item name="location" label="上課地點" rules={[{ required: true, message: '請輸入地點' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="notes" label="備註">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Drawer>
    <Drawer title="新增通勤" placement="right" width={400} open={commuteDrawerOpen} onClose={() => setCommuteDrawerOpen(false)} extra={<Button type="primary" onClick={() => setCommuteDrawerOpen(false)}>新增</Button>}>
      <Typography.Paragraph type="secondary">通勤排程 UI 預覽。</Typography.Paragraph>
      <Form layout="vertical" className="form-stack">
        <Form.Item label="日期"><DatePicker style={{ width: '100%' }} /></Form.Item>
        <Form.Item label="起訖時間"><TimePicker.RangePicker style={{ width: '100%' }} format="HH:mm" /></Form.Item>
        <Form.Item label="出發地"><Input /></Form.Item>
        <Form.Item label="目的地"><Input /></Form.Item>
      </Form>
    </Drawer>

    {/* 週期性課程刪除確認 Modal（受控狀態，保證在任何情境下都能穩定彈出） */}
    <Modal
      title="刪除週期性排課"
      open={Boolean(recurringDeleteLesson)}
      onCancel={() => setRecurringDeleteLesson(null)}
      footer={
        <Space style={{ marginTop: 12 }}>
          <Button onClick={() => setRecurringDeleteLesson(null)}>取消</Button>
          <Button
            type="primary"
            onClick={() => {
              if (recurringDeleteLesson) {
                deleteLesson(recurringDeleteLesson.id)
                setRecurringDeleteLesson(null)
                void message.success('已刪除此堂課程')
              }
            }}
          >
            僅刪除此堂課
          </Button>
          <Button
            danger
            type="primary"
            onClick={() => {
              if (recurringDeleteLesson && recurringDeleteLesson.recurringGroupId) {
                deleteRecurringLessons(recurringDeleteLesson.recurringGroupId, recurringDeleteLesson.date)
                setRecurringDeleteLesson(null)
                void message.success('已刪除此堂與後續所有週期課程')
              }
            }}
          >
            刪除本堂及往後全部
          </Button>
        </Space>
      }
    >
      <div style={{ padding: '8px 0' }}>
        <p>
          學員：<strong>{recurringDeleteLesson?.studentName}</strong>（{recurringDeleteLesson?.subject}）
        </p>
        <p style={{ color: '#8c8c8c' }}>
          上課時間：{recurringDeleteLesson?.date} {recurringDeleteLesson?.startTime} - {recurringDeleteLesson?.endTime}
        </p>
        <p style={{ marginTop: 12 }}>這堂課屬於循環規律排課系列，請選擇您想執行的刪除範圍：</p>
      </div>
    </Modal>
  </>
}
