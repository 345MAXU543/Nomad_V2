import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import {
  Alert,
  Avatar,
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
  Tooltip,
  Typography,
  message,
  type CalendarProps,
} from 'antd'
import {
  AlertOutlined,
  BookOutlined,
  ClockCircleOutlined,
  CompassOutlined,
  DollarOutlined,
  FieldTimeOutlined,
  EnvironmentOutlined,
  LeftOutlined,
  PlusOutlined,
  RightOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import zhTW from 'antd/locale/zh_TW'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import type { Lesson, LessonStatus, PaymentStatus } from '../types'
import type { DefaultOptionType } from 'antd/es/select'

type CommuteFormValues = {
  date: Dayjs
  timeRange: [Dayjs, Dayjs]
  origin: string
  destination: string
  notes?: string
}

type LessonFormValues = {
  studentId: string
  subject: string
  date: Dayjs
  startTime: Dayjs
  endTime: Dayjs
  location: string
  fee?: number
  paymentStatus?: PaymentStatus
  isRecurring?: boolean
  recurringFrequency?: 'weekly' | 'biweekly'
  recurringCount?: number
  skipConflictDates?: boolean
  notes?: string
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

const TIMELINE_START_HOUR = 8
const TIMELINE_END_HOUR = 22
const TIMELINE_HOURS = Array.from(
  { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 },
  (_, i) => TIMELINE_START_HOUR + i
)
const HOUR_ROW_HEIGHT = 60

const getWeekDays = (date: Dayjs): Dayjs[] => {
  const dow = date.day()
  const diffToMonday = dow === 0 ? -6 : 1 - dow
  const monday = date.add(diffToMonday, 'day')
  return Array.from({ length: 7 }, (_, i) => monday.add(i, 'day'))
}

type CalendarViewMode = '日檢視' | '週檢視' | '月檢視' | '列表檢視'

const isTimeOverlapping = (startA: string, endA: string, startB: string, endB: string): boolean => {
  return startA < endB && endA > startB
}

type TimelineEventInterval = { id: string; startMin: number; endMin: number }

const parseMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** 將同一天內時段重疊的課程與通勤色塊分配為並排欄位，避免互相覆蓋 */
const layoutDayEvents = (events: TimelineEventInterval[]) => {
  const layoutMap = new Map<string, { col: number; totalCols: number }>()
  if (events.length === 0) return layoutMap

  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  let cluster: TimelineEventInterval[] = []
  let clusterMaxEnd = -1

  const flushCluster = () => {
    if (cluster.length === 0) return
    const colEnds: number[] = []
    const assignments: { id: string; col: number }[] = []

    for (const item of cluster) {
      let assignedCol = colEnds.findIndex((end) => end <= item.startMin)
      if (assignedCol === -1) {
        assignedCol = colEnds.length
        colEnds.push(item.endMin)
      } else {
        colEnds[assignedCol] = item.endMin
      }
      assignments.push({ id: item.id, col: assignedCol })
    }

    const totalCols = colEnds.length
    for (const { id, col } of assignments) {
      layoutMap.set(id, { col, totalCols })
    }
    cluster = []
    clusterMaxEnd = -1
  }

  for (const ev of sorted) {
    if (cluster.length === 0 || ev.startMin < clusterMaxEnd) {
      cluster.push(ev)
      clusterMaxEnd = Math.max(clusterMaxEnd, ev.endMin)
    } else {
      flushCluster()
      cluster.push(ev)
      clusterMaxEnd = ev.endMin
    }
  }
  flushCluster()
  return layoutMap
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
  const commutes = useAppStore((state) => state.commutes ?? [])
  const addCommute = useAppStore((state) => state.addCommute)
  const deleteCommute = useAppStore((state) => state.deleteCommute)
  const delayLessons = useAppStore((state) => state.delayLessons)

  const [searchParams, setSearchParams] = useSearchParams()
  const handledMakeupRef = useRef<string | null>(null)
  const [viewMode, setViewMode] = useState<CalendarViewMode>('週檢視')
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
  const [commuteForm] = Form.useForm<CommuteFormValues>()
  const commuteOrigin = Form.useWatch('origin', commuteForm)
  const commuteDestination = Form.useWatch('destination', commuteForm)

  const [delayModalLesson, setDelayModalLesson] = useState<Lesson | null>(null)
  const [delayMinutes, setDelayMinutes] = useState<number>(15)
  const [delayCascade, setDelayCascade] = useState<boolean>(true)

  const openDelayModal = (lesson: Lesson) => {
    setDelayModalLesson(lesson)
    setDelayMinutes(15)
    setDelayCascade(true)
  }

  const [slotChoiceModal, setSlotChoiceModal] = useState<{ date: Dayjs; hour: number } | null>(null)

  const openCommuteDrawerForSlot = (date: Dayjs, hour: number) => {
    setScheduleDrawerOpen(false)
    setCommuteDrawerOpen(true)
    const start = date.hour(hour).minute(0)
    const end = start.add(settings.defaultDuration ?? 60, 'minute')
    commuteForm.setFieldsValue({
      date,
      timeRange: [start, end],
      origin: settings.defaultLocation || '教室 A',
      destination: '',
      notes: '',
    })
  }

  const openCommuteDrawer = () => {
    setScheduleDrawerOpen(false)
    setCommuteDrawerOpen(true)
    commuteForm.setFieldsValue({
      date: selectedDate,
      timeRange: [dayjs().hour(12).minute(0), dayjs().hour(13).minute(0)],
      origin: settings.defaultLocation || '教室 A',
      destination: '',
      notes: '',
    })
  }

  const submitCommute = (values: CommuteFormValues) => {
    const [start, end] = values.timeRange
    addCommute({
      date: values.date.format('YYYY-MM-DD'),
      startTime: start.format('HH:mm'),
      endTime: end.format('HH:mm'),
      origin: values.origin.trim(),
      destination: values.destination.trim(),
      notes: values.notes?.trim() || undefined,
    })
    void message.success('已新增通勤排程')
    setCommuteDrawerOpen(false)
    commuteForm.resetFields()
  }

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

  const selectedCommutes = useMemo(
    () => commutes.filter((c) => c.date === selectedDate.format('YYYY-MM-DD')).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [commutes, selectedDate]
  )

  const cascadePreviewList = useMemo(() => {
    if (!delayModalLesson) return []
    const shiftTime = (time: string, mins: number) => {
      const [h, m] = time.split(':').map(Number)
      const total = h * 60 + m + mins
      const clamped = Math.min(23 * 60 + 59, Math.max(0, total))
      const newH = Math.floor(clamped / 60)
      const newM = clamped % 60
      return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
    }
    const targetDate = delayModalLesson.date
    const targetStart = delayModalLesson.startTime

    const affected = lessons.filter((l) => {
      if (l.id === delayModalLesson.id) return true
      if (delayCascade && l.date === targetDate && l.status === 'scheduled' && l.startTime >= targetStart) {
        return true
      }
      return false
    }).sort((a, b) => a.startTime.localeCompare(b.startTime))

    return affected.map((l) => ({
      id: l.id,
      studentName: l.studentName,
      subject: l.subject,
      oldTime: `${l.startTime} - ${l.endTime}`,
      newTime: `${shiftTime(l.startTime, delayMinutes)} - ${shiftTime(l.endTime, delayMinutes)}`,
      isTarget: l.id === delayModalLesson.id,
    }))
  }, [delayModalLesson, delayMinutes, delayCascade, lessons])

  const selectedLessons = useMemo(
    () => lessons.filter((lesson) => lesson.date === selectedDate.format('YYYY-MM-DD')).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [lessons, selectedDate]
  )

  const listedLessons = useMemo(
    () => lessons.filter((lesson) => statusFilter === 'all' || lesson.status === statusFilter).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)),
    [lessons, statusFilter]
  )

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate])

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

  const openNewLessonForSlot = (date: Dayjs, hour: number) => {
    setEditingLesson(null)
    setMakeupForLesson(null)
    handledMakeupRef.current = null
    setExcludedDates([])
    const fallbackFee = settings.defaultFee ?? 1200
    const startTime = dayjs().hour(hour).minute(0)
    const endTime = startTime.add(settings.defaultDuration, 'minute')
    setSelectedDate(date)
    form.setFieldsValue({
      date,
      location: settings.defaultLocation,
      startTime,
      endTime,
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

    if (values.endTime.isBefore(values.startTime) || values.endTime.isSame(values.startTime)) {
      void message.error('結束時間必須晚於開始時間，請重新檢查')
      return
    }

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
    if (changed.startTime) {
      const prevStart = form.getFieldValue('startTime')
      const prevEnd = form.getFieldValue('endTime')
      let duration = settings.defaultDuration ?? 60
      if (prevEnd && prevStart && prevEnd.isAfter(prevStart)) {
        duration = prevEnd.diff(prevStart, 'minute')
      }
      form.setFieldValue('endTime', changed.startTime.add(duration, 'minute'))
      void form.validateFields(['endTime'])
    }
  }

  const togglePayment = (lesson: Lesson) => {
    const cycle: Record<PaymentStatus, PaymentStatus> = {
      unpaid: 'paid',
      paid: 'waived',
      waived: 'unpaid',
    }
    const nextStatus: PaymentStatus = cycle[lesson.paymentStatus ?? 'unpaid']
    updateLessonPaymentStatus(lesson.id, nextStatus)
    const label = nextStatus === 'paid' ? '已收款' : nextStatus === 'waived' ? '免收/包月折抵' : '待收款'
    void message.success(`已將【${lesson.studentName}】此堂設為：${label}`)
  }

  const toggleExcludeDate = (dateStr: string) => {
    setExcludedDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    )
  }

  const renderLesson = (lesson: Lesson) => {
    const conflicts = findConflicts(lesson.date, lesson.startTime, lesson.endTime, lessons, lesson.id)
    const hasConflict = conflicts.length > 0

    return (
      <List.Item key={lesson.id}>
        <div className="lesson-row">
          <div className="lesson-time">
            {lesson.date !== selectedDate.format('YYYY-MM-DD') ? (
              <span className="schedule-list-date">
                {dayjs(lesson.date).format('MM/DD')}<br />
                <span>{lesson.startTime}</span>
              </span>
            ) : (
              `${lesson.startTime} - ${lesson.endTime}`
            )}
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
                <Tag color="error" icon={<AlertOutlined />}>衝堂</Tag>
              ) : null}
              {lesson.fee !== undefined ? (
                <Tag
                  color={lesson.paymentStatus === 'paid' ? 'success' : lesson.paymentStatus === 'waived' ? 'default' : 'warning'}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  title="點擊切換 待收 ➔ 已收 ➔ 包月免收"
                  onClick={() => togglePayment(lesson)}
                >
                  <DollarOutlined /> NT$ {lesson.fee.toLocaleString()} · {lesson.paymentStatus === 'paid' ? '已收' : lesson.paymentStatus === 'waived' ? '包月/免收' : '待收'}
                </Tag>
              ) : null}
            </Space>
            <div className="lesson-meta">
              <EnvironmentOutlined /> {lesson.location}
              {lesson.location && !lesson.location.includes('線上') ? (
                <Button
                  type="link"
                  size="small"
                  icon={<CompassOutlined />}
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lesson.location)}`}
                  target="_blank"
                  style={{ padding: '0 4px', height: 'auto', fontSize: 13, marginLeft: 6 }}
                >
                  導航
                </Button>
              ) : null}
            </div>
          </div>
          <Space size={6} className="lesson-actions">
            {lesson.status === 'scheduled' ? (
              <>
                <Button type="primary" size="small" onClick={() => { updateLessonStatus(lesson.id, 'completed'); void message.success('已標記為完課') }}>完課</Button>
                <Button danger size="small" onClick={() => { updateLessonStatus(lesson.id, 'leave'); void message.info('已標記為請假') }}>請假</Button>
                <Button size="small" icon={<FieldTimeOutlined />} onClick={() => openDelayModal(lesson)}>順延</Button>
              </>
            ) : lesson.status === 'completed' ? (
              <Tag color="success">已完課</Tag>
            ) : (
              <Space size={4}>
                <Tag color="warning">請假</Tag>
                {lesson.rescheduledLessonId ? (
                  <Tag color="cyan">已補課</Tag>
                ) : (
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0 }}
                    onClick={() => openMakeupLesson(lesson)}
                  >
                    安排補課
                  </Button>
                )}
                <Button
                  type="text"
                  size="small"
                  style={{ color: '#8c8c8c' }}
                  onClick={() => {
                    markLeaveWaived(lesson.id)
                    void message.success('已標記為免補課')
                  }}
                >
                  免補
                </Button>
              </Space>
            )}
            <Button size="small" onClick={() => openEditLesson(lesson)}>編輯</Button>
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

  return (
    <>
      <Flex className="calendar-toolbar" justify="space-between" align="center" wrap="wrap" gap={8}>
        <Segmented
          options={[
            { label: '日檢視', value: '日檢視' },
            { label: '週時間軸', value: '週檢視' },
            { label: '月檢視', value: '月檢視' },
            { label: '列表', value: '列表檢視' },
          ]}
          value={viewMode}
          onChange={(value) => setViewMode(value as CalendarViewMode)}
        />
        <Button
          type="primary"
          shape="circle"
          icon={<PlusOutlined />}
          aria-label="新增排程"
          onClick={() => setScheduleDrawerOpen(true)}
        />
      </Flex>

      {/* 1. 日檢視 (Day View) */}
      {viewMode === '日檢視' && (
        <>
          <Card className="surface-card" style={{ marginBottom: 16 }}>
            <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
              <Space size={8} align="center" wrap>
                <Button
                  icon={<LeftOutlined />}
                  onClick={() => setSelectedDate(selectedDate.subtract(1, 'day'))}
                />
                <Button onClick={() => setSelectedDate(dayjs())}>今天</Button>
                <Button
                  icon={<RightOutlined />}
                  onClick={() => setSelectedDate(selectedDate.add(1, 'day'))}
                />
                <DatePicker
                  value={selectedDate}
                  onChange={(d) => d && setSelectedDate(d)}
                  allowClear={false}
                  style={{ width: 140 }}
                />
              </Space>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {selectedDate.format('YYYY 年 MM 月 DD 日 dddd')}
              </Typography.Title>
            </Flex>
            <Flex gap={8} wrap="wrap" style={{ marginTop: 12 }}>
              <Tag color="blue">當日共 {selectedLessons.length} 堂</Tag>
              {selectedCommutes.length > 0 && <Tag color="orange">通勤 {selectedCommutes.length} 趟</Tag>}
              <Tag color="success">
                已完課 {selectedLessons.filter((l) => l.status === 'completed').length} 堂
              </Tag>
              <Tag color="processing">
                待上課 {selectedLessons.filter((l) => l.status === 'scheduled').length} 堂
              </Tag>
              <Tag color="warning">
                請假 {selectedLessons.filter((l) => l.status === 'leave').length} 堂
              </Tag>
              <Tag color="gold">
                預期學費 NT$ {selectedLessons.reduce((sum, l) => sum + (l.fee ?? 0), 0).toLocaleString()}
              </Tag>
            </Flex>
          </Card>

          <Card className="surface-card" title="今日時間軸排程">
            <div style={{ position: 'relative' }}>
              {selectedDate.isSame(dayjs(), 'day') &&
                dayjs().hour() >= TIMELINE_START_HOUR &&
                dayjs().hour() <= TIMELINE_END_HOUR && (
                  <div
                    className="timeline-now-indicator"
                    style={{
                      top: `${
                        (dayjs().hour() - TIMELINE_START_HOUR + dayjs().minute() / 60) * 80 + 35
                      }px`,
                    }}
                    title={`現在時間 ${dayjs().format('HH:mm')}`}
                  />
                )}

              {TIMELINE_HOURS.map((hour) => {
                const hourLessons = selectedLessons.filter((l) => {
                  const startH = parseInt(l.startTime.split(':')[0], 10)
                  return startH === hour
                })
                const hourCommutes = selectedCommutes.filter((c) => {
                  const startH = parseInt(c.startTime.split(':')[0], 10)
                  return startH === hour
                })
                const ongoingLessons = selectedLessons.filter((l) => {
                  const [sh, sm] = l.startTime.split(':').map(Number)
                  const [eh, em] = l.endTime.split(':').map(Number)
                  const slotStart = hour * 60
                  const startMin = sh * 60 + sm
                  const endMin = eh * 60 + em
                  return startMin < slotStart && endMin > slotStart
                })
                const ongoingCommutes = selectedCommutes.filter((c) => {
                  const [sh, sm] = c.startTime.split(':').map(Number)
                  const [eh, em] = c.endTime.split(':').map(Number)
                  const slotStart = hour * 60
                  const startMin = sh * 60 + sm
                  const endMin = eh * 60 + em
                  return startMin < slotStart && endMin > slotStart
                })

                return (
                  <div key={hour} className="day-timeline-row">
                    <div className="day-timeline-hour">
                      {String(hour).padStart(2, '0')}:00
                    </div>
                    <div className="day-timeline-content">
                      {ongoingLessons.map((l) => (
                        <div key={`ongoing-${l.id}`} className="day-timeline-ongoing-item">
                          <Flex justify="space-between" align="center" wrap="wrap" gap={6}>
                            <Space size={8}>
                              <Tag color="cyan">授課進行中</Tag>
                              <Typography.Text strong style={{ fontSize: 13 }}>
                                延續【{l.studentName} · {l.subject}】（至 {l.endTime} 完課）
                              </Typography.Text>
                            </Space>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {l.location}
                            </Typography.Text>
                          </Flex>
                        </div>
                      ))}
                      {ongoingCommutes.map((c) => (
                        <div key={`ongoing-c-${c.id}`} className="day-timeline-ongoing-item">
                          <Flex justify="space-between" align="center" wrap="wrap" gap={6}>
                            <Space size={8}>
                              <Tag color="orange">🚗 移動途中</Tag>
                              <Typography.Text strong style={{ fontSize: 13 }}>
                                前往【{c.destination}】中（預估 {c.endTime} 抵達）
                              </Typography.Text>
                            </Space>
                          </Flex>
                        </div>
                      ))}
                      {hourCommutes.map((commute) => (
                        <div key={commute.id} className="day-timeline-commute-item">
                          <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
                            <Space size={8} wrap align="center">
                              <Tag color="orange" style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                                🚗 {commute.startTime} - {commute.endTime}
                              </Tag>
                              <Typography.Text strong style={{ fontSize: 14 }}>
                                通勤：{commute.origin} ➔ {commute.destination}
                              </Typography.Text>
                              {commute.notes ? <Tag>{commute.notes}</Tag> : null}
                            </Space>
                            <Space size={4}>
                              <Button
                                type="link"
                                size="small"
                                icon={<CompassOutlined />}
                                href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(commute.origin)}&destination=${encodeURIComponent(commute.destination)}`}
                                target="_blank"
                              >
                                導航
                              </Button>
                              <Popconfirm
                                title="確定刪除此通勤排程？"
                                okText="刪除"
                                cancelText="取消"
                                onConfirm={() => {
                                  deleteCommute(commute.id)
                                  void message.success('已刪除通勤排程')
                                }}
                              >
                                <Button danger type="text" size="small">刪除</Button>
                              </Popconfirm>
                            </Space>
                          </Flex>
                        </div>
                      ))}
                      {hourLessons.length > 0 ? (
                        hourLessons.map((lesson) => {
                          const student = students.find((s) => s.id === lesson.studentId)
                          return (
                            <div key={lesson.id} className="day-timeline-card-item">
                              <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
                                <Space size={8} wrap align="center">
                                  <Tag color="blue" style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                                    <ClockCircleOutlined /> {lesson.startTime} - {lesson.endTime}
                                  </Tag>
                                  <Avatar size="small" style={{ backgroundColor: student?.avatarColor ?? '#3b82f6' }}>
                                    {lesson.studentName.slice(0, 1)}
                                  </Avatar>
                                  <Typography.Text strong style={{ fontSize: 15 }}>
                                    {lesson.studentName}
                                  </Typography.Text>
                                  <Tag color="purple">{lesson.subject}</Tag>
                                  {lesson.isMakeup ? <Tag color="cyan">補課</Tag> : null}
                                  {lesson.recurringGroupId ? (
                                    <Tag color="purple" icon={<SyncOutlined />}>循環</Tag>
                                  ) : null}
                                  {lesson.status === 'completed' ? (
                                    <Tag color="success">已完課</Tag>
                                  ) : lesson.status === 'leave' ? (
                                    <Tag color="warning">請假</Tag>
                                  ) : (
                                    <Tag color="processing">待上課</Tag>
                                  )}
                                  {lesson.fee !== undefined ? (
                                    <Tag
                                      color={
                                        lesson.paymentStatus === 'paid'
                                          ? 'success'
                                          : lesson.paymentStatus === 'waived'
                                          ? 'default'
                                          : 'warning'
                                      }
                                      style={{ cursor: 'pointer' }}
                                      title="點擊切換 待收 ➔ 已收 ➔ 包月免收"
                                      onClick={() => togglePayment(lesson)}
                                    >
                                      <DollarOutlined /> NT$ {lesson.fee.toLocaleString()} ·{' '}
                                      {lesson.paymentStatus === 'paid'
                                        ? '已收'
                                        : lesson.paymentStatus === 'waived'
                                        ? '免收'
                                        : '待收'}
                                    </Tag>
                                  ) : null}
                                </Space>
                                <Space size={4}>
                                  {lesson.status === 'scheduled' && (
                                    <>
                                      <Button
                                        type="primary"
                                        size="small"
                                        onClick={() => {
                                          updateLessonStatus(lesson.id, 'completed')
                                          void message.success('已標記為完課')
                                        }}
                                      >
                                        完課
                                      </Button>
                                      <Button
                                        danger
                                        size="small"
                                        onClick={() => {
                                          updateLessonStatus(lesson.id, 'leave')
                                          void message.info('已標記為請假')
                                        }}
                                      >
                                        請假
                                      </Button>
                                      <Button
                                        size="small"
                                        icon={<FieldTimeOutlined />}
                                        onClick={() => openDelayModal(lesson)}
                                      >
                                        順延
                                      </Button>
                                    </>
                                  )}
                                  <Button size="small" onClick={() => openEditLesson(lesson)}>
                                    編輯
                                  </Button>
                                  {lesson.recurringGroupId ? (
                                    <Button
                                      danger
                                      type="text"
                                      size="small"
                                      onClick={() => setRecurringDeleteLesson(lesson)}
                                    >
                                      刪除
                                    </Button>
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
                                      <Button danger type="text" size="small">
                                        刪除
                                      </Button>
                                    </Popconfirm>
                                  )}
                                </Space>
                              </Flex>
                              <div style={{ marginTop: 6, color: '#8c8c8c', fontSize: 13, display: 'flex', alignItems: 'center' }}>
                                <EnvironmentOutlined /> <span style={{ marginLeft: 4 }}>{lesson.location}</span>
                                {lesson.location && !lesson.location.includes('線上') ? (
                                  <Button
                                    type="link"
                                    size="small"
                                    icon={<CompassOutlined />}
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lesson.location)}`}
                                    target="_blank"
                                    style={{ padding: '0 4px', height: 'auto', fontSize: 13, marginLeft: 6 }}
                                  >
                                    導航
                                  </Button>
                                ) : null}
                                {lesson.notes ? ` · 備註：${lesson.notes}` : ''}
                              </div>
                              {student?.teachingNotes ? (
                                <div className="day-view-teaching-note">
                                  <BookOutlined style={{ marginRight: 6 }} />
                                  <strong>課前提醒 / 教學筆記：</strong>
                                  <span style={{ whiteSpace: 'pre-line' }}>{student.teachingNotes}</span>
                                </div>
                              ) : null}
                            </div>
                          )
                        })
                      ) : (hourCommutes.length === 0 && ongoingLessons.length === 0 && ongoingCommutes.length === 0) ? (
                        <div className="day-timeline-empty">
                          <span style={{ fontSize: 13, color: '#94a3b8' }}>
                            無排程
                          </span>
                          <Space size={8}>
                            <Button
                              type="link"
                              size="small"
                              icon={<PlusOutlined />}
                              style={{ padding: 0, height: 'auto' }}
                              onClick={() => openNewLessonForSlot(selectedDate, hour)}
                            >
                              排課
                            </Button>
                            <Button
                              type="link"
                              size="small"
                              style={{ padding: 0, height: 'auto', color: '#ea580c' }}
                              onClick={() => openCommuteDrawerForSlot(selectedDate, hour)}
                            >
                              🚗 通勤
                            </Button>
                          </Space>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </>
      )}

      {/* 2. 週時間軸檢視 (Week Timeline View) */}
      {viewMode === '週檢視' && (
        <>
          <Card className="surface-card" style={{ marginBottom: 16 }}>
            <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
              <Space size={8} align="center" wrap>
                <Button
                  icon={<LeftOutlined />}
                  onClick={() => setSelectedDate(selectedDate.subtract(1, 'week'))}
                />
                <Button onClick={() => setSelectedDate(dayjs())}>本週</Button>
                <Button
                  icon={<RightOutlined />}
                  onClick={() => setSelectedDate(selectedDate.add(1, 'week'))}
                />
                <DatePicker
                  picker="week"
                  value={selectedDate}
                  onChange={(d) => d && setSelectedDate(d)}
                  allowClear={false}
                  style={{ width: 150 }}
                />
              </Space>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {weekDays[0].format('YYYY 年 MM 月 DD 日')} - {weekDays[6].format('MM 月 DD 日')}
              </Typography.Title>
            </Flex>
            <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginTop: 8, marginBottom: 0 }}>
              💡 提示：點擊色塊可查看或編輯課堂；點擊欄位空白時段可快速預約排課。
            </Typography.Paragraph>
          </Card>

          <div className="week-timeline-container surface-card">
            <div className="week-timeline-inner">
              {/* 表頭：星期與日期 */}
              <div className="week-timeline-header">
                <div
                  style={{
                    padding: '10px 4px',
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: 12,
                    color: '#8c8c8c',
                  }}
                >
                  時段
                </div>
                {weekDays.map((day) => {
                  const isToday = day.isSame(dayjs(), 'day')
                  const isSelected = day.isSame(selectedDate, 'day')
                  const dayLessons = lessons.filter(
                    (l) => l.date === day.format('YYYY-MM-DD')
                  )

                  return (
                    <div
                      key={day.format('YYYY-MM-DD')}
                      className={`week-day-header ${isToday ? 'is-today' : ''} ${
                        isSelected ? 'is-selected' : ''
                      }`}
                      onClick={() => setSelectedDate(day)}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {day.format('dddd')}
                      </div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: isToday ? '#3b82f6' : undefined,
                        }}
                      >
                        {day.format('MM/DD')}
                      </div>
                      {dayLessons.length > 0 && (
                        <Tag
                          color={isToday ? 'blue' : 'default'}
                          style={{ margin: '2px 0 0 0', fontSize: 10, padding: '0 4px' }}
                        >
                          {dayLessons.length}堂
                        </Tag>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 時間軸主體 */}
              <div className="week-timeline-body">
                {/* 左側時段標籤 */}
                <div className="week-time-sidebar">
                  {TIMELINE_HOURS.map((h) => (
                    <div key={h} className="week-hour-label">
                      {String(h).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {/* 7 天的時間欄位 */}
                {weekDays.map((day) => {
                  const dateStr = day.format('YYYY-MM-DD')
                  const isToday = day.isSame(dayjs(), 'day')
                  const dayLessons = lessons.filter((l) => l.date === dateStr)
                  const dayCommutes = commutes.filter((c) => c.date === dateStr)
                  const dayLayout = layoutDayEvents([
                    ...dayCommutes.map((c) => {
                      const s = parseMinutes(c.startTime)
                      return { id: `commute-${c.id}`, startMin: s, endMin: Math.max(s + 25, parseMinutes(c.endTime)) }
                    }),
                    ...dayLessons.map((l) => {
                      const s = parseMinutes(l.startTime)
                      return { id: `lesson-${l.id}`, startMin: s, endMin: Math.max(s + 30, parseMinutes(l.endTime)) }
                    }),
                  ])
                  const getColumnStyle = (eventKey: string) => {
                    const pos = dayLayout.get(eventKey)
                    if (!pos || pos.totalCols <= 1) {
                      return { left: '3px', width: 'calc(100% - 6px)', right: 'auto' as const }
                    }
                    return {
                      left: `calc(${(pos.col / pos.totalCols) * 100}% + 2px)`,
                      width: `calc(${100 / pos.totalCols}% - 4px)`,
                      right: 'auto' as const,
                    }
                  }

                  return (
                    <div
                      key={dateStr}
                      className={`week-day-column ${isToday ? 'is-today' : ''}`}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        const clickY = e.clientY - rect.top
                        const clickedHour = Math.min(
                          TIMELINE_END_HOUR,
                          Math.max(
                            TIMELINE_START_HOUR,
                            Math.floor(clickY / HOUR_ROW_HEIGHT) + TIMELINE_START_HOUR
                          )
                        )
                        setSlotChoiceModal({ date: day, hour: clickedHour })
                      }}
                    >
                      {/* 今天紅線指示 */}
                      {isToday &&
                        dayjs().hour() >= TIMELINE_START_HOUR &&
                        dayjs().hour() <= TIMELINE_END_HOUR && (
                          <div
                            className="timeline-now-indicator"
                            style={{
                              top: `${
                                (dayjs().hour() -
                                  TIMELINE_START_HOUR +
                                  dayjs().minute() / 60) *
                                HOUR_ROW_HEIGHT
                              }px`,
                            }}
                          />
                        )}

                      {/* 通勤色塊區塊 */}
                      {dayCommutes.map((commute) => {
                        const [sh, sm] = commute.startTime.split(':').map(Number)
                        const [eh, em] = commute.endTime.split(':').map(Number)
                        const startMin = (sh - TIMELINE_START_HOUR) * 60 + sm
                        const durationMin = Math.max(25, eh * 60 + em - (sh * 60 + sm))
                        const top = Math.max(0, (startMin / 60) * HOUR_ROW_HEIGHT)
                        const height = Math.max(24, (durationMin / 60) * HOUR_ROW_HEIGHT - 2)

                        return (
                          <Tooltip
                            key={commute.id}
                            title={`🚗 通勤 ${commute.startTime}-${commute.endTime}：${commute.origin} ➔ ${commute.destination}${commute.notes ? ` (${commute.notes})` : ''}`}
                          >
                            <div
                              className="week-commute-block"
                              style={{ top: `${top}px`, height: `${height}px`, ...getColumnStyle(`commute-${commute.id}`) }}
                              onClick={(e) => {
                                e.stopPropagation()
                                window.open(
                                  `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(commute.origin)}&destination=${encodeURIComponent(commute.destination)}`,
                                  '_blank'
                                )
                              }}
                            >
                              <div className="week-block-time">🚗 {commute.startTime}-{commute.endTime}</div>
                              <div className="week-block-title">{commute.origin} ➔ {commute.destination}</div>
                            </div>
                          </Tooltip>
                        )
                      })}

                      {/* 課堂色塊區塊 */}
                      {dayLessons.map((lesson) => {
                        const [sh, sm] = lesson.startTime.split(':').map(Number)
                        const [eh, em] = lesson.endTime.split(':').map(Number)
                        const startMin = (sh - TIMELINE_START_HOUR) * 60 + sm
                        const durationMin = Math.max(30, eh * 60 + em - (sh * 60 + sm))
                        const top = Math.max(0, (startMin / 60) * HOUR_ROW_HEIGHT)
                        const height = Math.max(26, (durationMin / 60) * HOUR_ROW_HEIGHT - 3)

                        return (
                          <Tooltip
                            key={lesson.id}
                            title={`${lesson.startTime} - ${lesson.endTime} · ${lesson.studentName} (${lesson.subject}) · ${lesson.location}`}
                          >
                            <div
                              className={`week-lesson-block status-${lesson.status}`}
                              style={{ top: `${top}px`, height: `${height}px`, ...getColumnStyle(`lesson-${lesson.id}`) }}
                              onClick={(e) => {
                                e.stopPropagation()
                                openEditLesson(lesson)
                              }}
                            >
                              <div className="week-block-time">
                                {lesson.startTime}-{lesson.endTime}
                              </div>
                              <div className="week-block-title">
                                {lesson.studentName} {lesson.isMakeup ? ' [補]' : ''}
                              </div>
                              {height >= 40 && (
                                <div className="week-block-sub">
                                  {lesson.subject} · {lesson.location}
                                </div>
                              )}
                            </div>
                          </Tooltip>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 3. 月檢視 (Month View) */}
      {viewMode === '月檢視' && (
        <>
          <Card className="surface-card calendar-card" style={{ marginBottom: 16 }}>
            <Calendar
              fullscreen={false}
              locale={calendarLocale}
              value={selectedDate}
              onSelect={setSelectedDate}
              dateCellRender={(current) => {
                const dateStr = current.format('YYYY-MM-DD')
                const dayLessons = lessons.filter((lesson) => lesson.date === dateStr)
                const dayCommutes = commutes.filter((commute) => commute.date === dateStr)
                if (dayLessons.length === 0 && dayCommutes.length === 0) return null
                const hasScheduled = dayLessons.some((lesson) => lesson.status === 'scheduled')
                const complete = dayLessons.length > 0 && dayLessons.every((lesson) => lesson.status === 'completed')
                return (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3, marginTop: 2 }}>
                    {dayLessons.length > 0 && (
                      <span className={`calendar-lesson-dot ${complete && !hasScheduled ? 'is-complete' : ''}`} aria-label="有排課" />
                    )}
                    {dayCommutes.length > 0 && (
                      <span style={{ display: 'block', width: 6, height: 6, borderRadius: '50%', backgroundColor: '#f97316' }} aria-label="有通勤" />
                    )}
                  </div>
                )
              }}
            />
          </Card>
          <Card
            className="surface-card"
            title={`${selectedDate.format('MM 月 DD 日')}・當日行程`}
            extra={
              <Space>
                {selectedLessons.length > 0 && <Tag color="blue">{selectedLessons.length} 堂課</Tag>}
                {selectedCommutes.length > 0 && <Tag color="orange">{selectedCommutes.length} 趟通勤</Tag>}
              </Space>
            }
          >
            {(() => {
              const merged = [
                ...selectedLessons.map((l) => ({ type: 'lesson' as const, data: l, startTime: l.startTime })),
                ...selectedCommutes.map((c) => ({ type: 'commute' as const, data: c, startTime: c.startTime })),
              ].sort((a, b) => a.startTime.localeCompare(b.startTime))

              if (merged.length === 0) {
                return <Empty description="當日沒有課程或通勤排程" />
              }

              return (
                <List
                  className="lesson-list"
                  dataSource={merged}
                  renderItem={(item) => {
                    if (item.type === 'lesson') {
                      return renderLesson(item.data)
                    }
                    const commute = item.data
                    return (
                      <List.Item>
                        <div className="lesson-row">
                          <div className="lesson-time" style={{ color: '#ea580c' }}>
                            🚗 {commute.startTime} - {commute.endTime}
                          </div>
                          <div className="lesson-main">
                            <Space size={6} wrap align="center">
                              <span className="lesson-name">通勤：{commute.origin} ➔ {commute.destination}</span>
                              {commute.notes ? <Tag>{commute.notes}</Tag> : null}
                            </Space>
                            <div className="lesson-meta">
                              <CompassOutlined /> Google 地圖路線規劃
                              <Button
                                type="link"
                                size="small"
                                icon={<CompassOutlined />}
                                href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(commute.origin)}&destination=${encodeURIComponent(commute.destination)}`}
                                target="_blank"
                                style={{ padding: '0 4px', height: 'auto', fontSize: 13, marginLeft: 6 }}
                              >
                                導航
                              </Button>
                            </div>
                          </div>
                          <Popconfirm
                            title="確定刪除此通勤排程？"
                            okText="刪除"
                            cancelText="取消"
                            onConfirm={() => {
                              deleteCommute(commute.id)
                              void message.success('已刪除通勤排程')
                            }}
                          >
                            <Button danger type="text" size="small">刪除</Button>
                          </Popconfirm>
                        </div>
                      </List.Item>
                    )
                  }}
                />
              )
            })()}
          </Card>
        </>
      )}

      {/* 4. 列表檢視 (List View) */}
      {viewMode === '列表檢視' && (
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

      {/* 新增排程快捷 Drawer */}
      <Drawer title="新增排程" placement="right" width={320} open={scheduleDrawerOpen} onClose={() => setScheduleDrawerOpen(false)}>
        <Space direction="vertical" size={12} className="schedule-menu">
          <Button type="primary" block onClick={() => { setScheduleDrawerOpen(false); openNewLesson() }}>排課</Button>
          <Button block onClick={openCommuteDrawer}>通勤</Button>
          <Button type="text" size="small" block onClick={() => setScheduleDrawerOpen(false)}>其他排程</Button>
        </Space>
      </Drawer>

      {/* 排課 / 編輯 / 補課 Drawer */}
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
        {selectedStudent?.teachingNotes && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16, background: 'rgba(234, 179, 8, 0.08)', borderColor: 'rgba(234, 179, 8, 0.3)' }}
            message={<Typography.Text strong style={{ color: '#b45309' }}>學員教學筆記叮嚀</Typography.Text>}
            description={<div style={{ whiteSpace: 'pre-line', fontSize: 13 }}>{selectedStudent.teachingNotes}</div>}
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
          {selectedStudent?.billingCycle === 'monthly' && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="此學員為【包月制】繳費"
              description={
                <div style={{ fontSize: 13 }}>
                  <div>若本月學費已整包預先收取，本堂可設為「已繳款」或「免收/包月折抵」，避免重複計算待收金額。</div>
                  <Space size={8} style={{ marginTop: 8 }}>
                    <Button
                      size="small"
                      onClick={() => {
                        form.setFieldValue('paymentStatus', 'paid')
                        void message.info('已設為：已繳款')
                      }}
                    >
                      設為已繳款
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        form.setFieldValue('paymentStatus', 'waived')
                        form.setFieldValue('fee', 0)
                        void message.info('已設為：免收/包月折抵 (NT$ 0)')
                      }}
                    >
                      設為免收 (NT$ 0)
                    </Button>
                  </Space>
                </div>
              }
            />
          )}

          <Form.Item name="startTime" label="開始時間" rules={[{ required: true, message: '請選擇開始時間' }]}>
            <TimePicker style={{ width: '100%' }} format="HH:mm" />
          </Form.Item>
          <Form.Item
            name="endTime"
            label="結束時間"
            dependencies={['startTime']}
            rules={[
              { required: true, message: '請選擇結束時間' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const startTime = getFieldValue('startTime')
                  if (!value || !startTime) return Promise.resolve()
                  if (value.isBefore(startTime) || value.isSame(startTime)) {
                    return Promise.reject(new Error('結束時間必須晚於開始時間'))
                  }
                  return Promise.resolve()
                },
              }),
            ]}
          >
            <TimePicker style={{ width: '100%' }} format="HH:mm" />
          </Form.Item>

          <div style={{ marginBottom: 16 }}>
            <Space size={6} wrap align="center">
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>常用時長：</Typography.Text>
              {[50, 60, 90].map((mins) => (
                <Button
                  key={mins}
                  size="small"
                  onClick={() => {
                    const start = form.getFieldValue('startTime') || dayjs().hour(14).minute(0)
                    form.setFieldValue('startTime', start)
                    form.setFieldValue('endTime', start.add(mins, 'minute'))
                    void form.validateFields(['endTime'])
                  }}
                >
                  +{mins} 分鐘
                </Button>
              ))}
            </Space>
          </div>

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

                  {/* 週期性排課日期預覽與衝堂標示 */}
                  <div style={{ marginBottom: 12 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                      預計建立日期（點擊標籤可排除該堂）：
                    </Typography.Text>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {recurringPreview.map((item) => {
                        const isExcluded = excludedDates.includes(item.dateStr)
                        return (
                          <Tag
                            key={item.dateStr}
                            color={item.conflicts.length > 0 ? 'error' : isExcluded ? 'default' : 'blue'}
                            style={{
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
      <Drawer
        title={
          <Space>
            <span>🚗 新增通勤行程</span>
          </Space>
        }
        placement="right"
        width={420}
        open={commuteDrawerOpen}
        onClose={() => setCommuteDrawerOpen(false)}
        footer={
          <Flex justify="flex-end" gap={8}>
            <Button onClick={() => setCommuteDrawerOpen(false)}>取消</Button>
            <Button type="primary" onClick={() => commuteForm.submit()}>
              新增通勤
            </Button>
          </Flex>
        }
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
          規劃跨點授課通勤時間，支援一鍵開啟 Google 地圖路線導航。
        </Typography.Paragraph>
        <Form
          form={commuteForm}
          layout="vertical"
          className="form-stack"
          onFinish={submitCommute}
        >
          <Form.Item name="date" label="通勤日期" rules={[{ required: true, message: '請選擇日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="timeRange" label="預計通勤時段" rules={[{ required: true, message: '請選擇時段' }]}>
            <TimePicker.RangePicker style={{ width: '100%' }} format="HH:mm" />
          </Form.Item>
          <Form.Item name="origin" label="出發地點 (A)" rules={[{ required: true, message: '請輸入出發地' }]}>
            <Input placeholder="例如：教室 A 或 台北車站" />
          </Form.Item>
          <Form.Item name="destination" label="抵達目的地 (B)" rules={[{ required: true, message: '請輸入目的地' }]}>
            <Input placeholder="例如：到府授課・中山區" />
          </Form.Item>
          {commuteOrigin && commuteDestination ? (
            <div style={{ marginBottom: 16 }}>
              <Button
                type="dashed"
                block
                icon={<CompassOutlined />}
                href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(commuteOrigin)}&destination=${encodeURIComponent(commuteDestination)}`}
                target="_blank"
              >
                在 Google Maps 規劃路線 (A ➔ B)
              </Button>
            </div>
          ) : null}
          <Form.Item name="notes" label="交通備註">
            <Input.TextArea rows={2} placeholder="例如：搭捷運淡水信義線轉 287 公車" />
          </Form.Item>
        </Form>

        {selectedCommutes.length > 0 && (
          <div style={{ marginTop: 24, borderTop: '1px solid rgba(15, 23, 42, .08)', paddingTop: 16 }}>
            <Typography.Text strong style={{ fontSize: 13 }}>
              {selectedDate.format('MM/DD')} 已排定通勤：
            </Typography.Text>
            <List
              size="small"
              style={{ marginTop: 8 }}
              dataSource={selectedCommutes}
              renderItem={(c) => (
                <List.Item
                  actions={[
                    <Button
                      key="nav"
                      type="link"
                      size="small"
                      icon={<CompassOutlined />}
                      href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(c.origin)}&destination=${encodeURIComponent(c.destination)}`}
                      target="_blank"
                      style={{ padding: 0 }}
                    >
                      導航
                    </Button>,
                    <Popconfirm
                      key="del"
                      title="確定刪除此通勤排程？"
                      onConfirm={() => {
                        deleteCommute(c.id)
                        void message.success('已刪除通勤排程')
                      }}
                    >
                      <Button danger type="text" size="small" style={{ padding: 0 }}>刪除</Button>
                    </Popconfirm>,
                  ]}
                >
                  <div style={{ minWidth: 0 }}>
                    <Tag color="orange" style={{ margin: 0, marginRight: 6 }}>{c.startTime}-{c.endTime}</Tag>
                    <span style={{ fontSize: 13 }}>{c.origin} ➔ {c.destination}</span>
                  </div>
                </List.Item>
              )}
            />
          </div>
        )}
      </Drawer>

      {/* 課堂延誤 / 骨牌一鍵順延 Modal */}
      <Modal
        title={
          <Space>
            <FieldTimeOutlined style={{ color: '#f59e0b', fontSize: 18 }} />
            <span>課堂延誤 / 骨牌一鍵順延</span>
          </Space>
        }
        open={Boolean(delayModalLesson)}
        onCancel={() => setDelayModalLesson(null)}
        onOk={() => {
          if (delayModalLesson) {
            delayLessons({
              targetLessonId: delayModalLesson.id,
              delayMinutes,
              cascadeSubsequent: delayCascade,
            })
            void message.success(`已順延 ${delayMinutes} 分鐘${delayCascade ? '（已骨牌連動後續所有排課）' : ''}`)
            setDelayModalLesson(null)
          }
        }}
        okText="確認順延"
        cancelText="取消"
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>
          上課拖堂或交通延誤時，快速順延時間，並可自動推遲今日後續所有課程，避免手動一一調整。
        </Typography.Paragraph>

        <div style={{ marginBottom: 16 }}>
          <Typography.Text strong>順延時間長度：</Typography.Text>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[10, 15, 20, 30, 45].map((mins) => (
              <Button
                key={mins}
                type={delayMinutes === mins ? 'primary' : 'default'}
                size="small"
                onClick={() => setDelayMinutes(mins)}
              >
                +{mins} 分鐘
              </Button>
            ))}
            <InputNumber
              min={1}
              max={180}
              value={delayMinutes}
              onChange={(val) => setDelayMinutes(val ?? 15)}
              style={{ width: 100 }}
              addonAfter="分"
              size="small"
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Typography.Text strong>順延範圍：</Typography.Text>
          <Radio.Group
            value={delayCascade}
            onChange={(e) => setDelayCascade(e.target.value as boolean)}
            style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}
          >
            <Radio value={true}>
              <strong>連動順延此堂及今日後續所有課程（骨牌連動）</strong>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>推薦：後續課程將全部同步往後推遲 {delayMinutes} 分鐘</div>
            </Radio>
            <Radio value={false}>
              <strong>僅順延此堂課</strong>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>僅變動本堂時間，後續排程保持原樣</div>
            </Radio>
          </Radio.Group>
        </div>

        {cascadePreviewList.length > 0 && (
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>調整前後預覽對照：</Typography.Text>
            <div style={{ maxHeight: 180, overflowY: 'auto', marginTop: 8, border: '1px solid rgba(15, 23, 42, .08)', borderRadius: 8, padding: '8px 12px' }}>
              {cascadePreviewList.map((item) => (
                <Flex key={item.id} justify="space-between" align="center" style={{ padding: '4px 0', borderBottom: '1px dashed rgba(15, 23, 42, .06)' }}>
                  <div>
                    <Typography.Text strong={item.isTarget}>{item.studentName}</Typography.Text>
                    <Tag style={{ marginLeft: 6 }} color="blue">{item.subject}</Tag>
                  </div>
                  <Space size={8}>
                    <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: 13 }}>{item.oldTime}</span>
                    <span style={{ color: '#1677ff', fontWeight: 700, fontSize: 13 }}>➔ {item.newTime}</span>
                  </Space>
                </Flex>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* 週時間軸時段行程選擇 Modal */}
      <Modal
        title={
          <Space>
            <span>新增時段排程</span>
            <Tag color="blue">{slotChoiceModal?.date.format('MM/DD (dd)')} {String(slotChoiceModal?.hour).padStart(2, '0')}:00</Tag>
          </Space>
        }
        open={Boolean(slotChoiceModal)}
        onCancel={() => setSlotChoiceModal(null)}
        footer={null}
        width={360}
        centered
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16 }}>
          請選擇您要在此時段建立的行程種類：
        </Typography.Paragraph>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Button
            type="primary"
            block
            size="large"
            icon={<BookOutlined />}
            onClick={() => {
              if (slotChoiceModal) {
                openNewLessonForSlot(slotChoiceModal.date, slotChoiceModal.hour)
                setSlotChoiceModal(null)
              }
            }}
          >
            預約學員排課
          </Button>
          <Button
            block
            size="large"
            style={{ borderColor: '#f97316', color: '#ea580c' }}
            onClick={() => {
              if (slotChoiceModal) {
                openCommuteDrawerForSlot(slotChoiceModal.date, slotChoiceModal.hour)
                setSlotChoiceModal(null)
              }
            }}
          >
            🚗 安排跨點通勤
          </Button>
        </Space>
      </Modal>

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
                  void message.success('已刪除此單堂課')
                }
              }}
            >
              僅刪除此堂
            </Button>
            <Button
              danger
              type="primary"
              onClick={() => {
                if (recurringDeleteLesson?.recurringGroupId) {
                  deleteRecurringLessons(recurringDeleteLesson.recurringGroupId, recurringDeleteLesson.date)
                  setRecurringDeleteLesson(null)
                  void message.success('已刪除此堂及後續所有週期課程')
                }
              }}
            >
              刪除此堂及後續課程
            </Button>
          </Space>
        }
      >
        <Typography.Paragraph>
          此堂課為規律週期性排課（<strong>{recurringDeleteLesson?.studentName}</strong> · {recurringDeleteLesson?.date} {recurringDeleteLesson?.startTime}）。
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary">
          您可以選擇「僅刪除此堂」，或「刪除此堂及後續所有週期排課」。
        </Typography.Paragraph>
      </Modal>
    </>
  )
}
