import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  AlertOutlined,
  BellOutlined,
  BookOutlined,
  CompassOutlined,
  DollarOutlined,
  EditOutlined,
  EnvironmentOutlined,
  FieldTimeOutlined,
  RightOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { requestNotificationPermission, sendNotification } from '../utils/notifications'
import type { Lesson, PaymentStatus, Student } from '../types'

const statusText = { scheduled: '待上課', completed: '已完課', leave: '請假' } as const

const isTimeOverlapping = (startA: string, endA: string, startB: string, endB: string): boolean => {
  return startA < endB && endA > startB
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const lessons = useAppStore((state) => state.lessons)
  const students = useAppStore((state) => state.students)
  const updateStudentTeachingNotes = useAppStore((state) => state.updateStudentTeachingNotes)
  const updateLessonStatus = useAppStore((state) => state.updateLessonStatus)
  const updateLessonPaymentStatus = useAppStore((state) => state.updateLessonPaymentStatus)
  const markLeaveWaived = useAppStore((state) => state.markLeaveWaived)
  const setPendingMakeupLessonId = useAppStore((state) => state.setPendingMakeupLessonId)
  const delayLessons = useAppStore((state) => state.delayLessons)
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)

  const [noteModalStudent, setNoteModalStudent] = useState<Student | null>(null)
  const [noteModalText, setNoteModalText] = useState('')
  const [delayModalLesson, setDelayModalLesson] = useState<Lesson | null>(null)
  const [delayMinutes, setDelayMinutes] = useState<number>(15)
  const [delayCascade, setDelayCascade] = useState<boolean>(true)

  const openNoteModal = (student: Student) => {
    setNoteModalStudent(student)
    setNoteModalText(student.teachingNotes ?? '')
  }

  const openDelayModal = (lesson: Lesson) => {
    setDelayModalLesson(lesson)
    setDelayMinutes(15)
    setDelayCascade(true)
  }

  const handleEnableNotification = async () => {
    const granted = await requestNotificationPermission()
    if (granted) {
      updateSettings({ enableNotifications: true })
      void message.success('已成功啟用系統上課提醒')
      sendNotification('上課提醒已啟用 🔔', 'Nomad 會在上課前主動為您發送鬧鐘震動通知！')
    } else {
      void message.warning('瀏覽器通知已被封鎖，請於網址列旁允許通知權限')
    }
  }

  const today = dayjs().format('YYYY-MM-DD')
  const todayLessons = lessons.filter((lesson) => lesson.date === today)
  const upcoming = todayLessons.filter((lesson) => lesson.status === 'scheduled').sort((a, b) => a.startTime.localeCompare(b.startTime))
  const pending = lessons.filter((lesson) => lesson.status === 'scheduled' && lesson.date <= today).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
  const pendingMakeups = lessons.filter((lesson) => lesson.status === 'leave' && !lesson.rescheduledLessonId).sort((a, b) => b.date.localeCompare(a.date))

  const todayActiveLessons = todayLessons.filter((lesson) => lesson.status !== 'leave')
  const todayExpectedIncome = todayActiveLessons.reduce((sum, lesson) => sum + (lesson.fee ?? 0), 0)
  const todayUnpaidCount = todayActiveLessons.filter((lesson) => lesson.paymentStatus === 'unpaid' && (lesson.fee ?? 0) > 0).length

  const markStatus = (id: string, status: 'completed' | 'leave') => {
    updateLessonStatus(id, status)
    void message[status === 'completed' ? 'success' : 'info'](status === 'completed' ? '已標記為完課' : '已標記為請假')
  }

  const togglePayment = (lesson: Lesson) => {
    const nextStatus: PaymentStatus = lesson.paymentStatus === 'paid' ? 'unpaid' : 'paid'
    updateLessonPaymentStatus(lesson.id, nextStatus)
    void message.success(nextStatus === 'paid' ? `已標記 ${lesson.studentName} 為已收款` : `已標記 ${lesson.studentName} 為待收款`)
  }

  const checkConflict = (target: Lesson) => {
    return lessons.some((lesson) => {
      if (lesson.id === target.id) return false
      if (lesson.date !== target.date) return false
      if (lesson.status === 'leave') return false
      return isTimeOverlapping(target.startTime, target.endTime, lesson.startTime, lesson.endTime)
    })
  }

  // 計算骨牌順延預覽清單
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

  const showNotificationBanner = typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default' && !settings.enableNotifications

  return (
    <>
      <section className="page-heading">
        <Typography.Title level={2}>你好，老師</Typography.Title>
        <Typography.Text type="secondary">{dayjs().format('YYYY 年 MM 月 DD 日 dddd')}</Typography.Text>
      </section>

      {/* 課前鬧鐘提醒通知授權橫幅 (Topic 7) */}
      {showNotificationBanner && (
        <Alert
          style={{ marginBottom: 16 }}
          type="info"
          showIcon
          icon={<BellOutlined />}
          message="開啟系統上課鬧鐘提醒"
          description="啟用瀏覽器通知與震動後，每堂課即將開始前 Nomad 會主動發送提醒，讓您通勤與備課不再匆忙。"
          action={
            <Button size="small" type="primary" onClick={handleEnableNotification}>
              立即開啟
            </Button>
          }
          closable
        />
      )}

      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card className="surface-card dashboard-stat">
            <Statistic title="今日總堂數" value={todayActiveLessons.length} suffix="堂" />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="surface-card dashboard-stat">
            <Statistic title="待完成堂數" value={upcoming.length} suffix="堂" valueStyle={{ color: '#3b82f6' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="surface-card dashboard-stat">
            <Statistic title="今日預估收入" value={todayExpectedIncome} prefix="NT$" valueStyle={{ color: '#10b981' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="surface-card dashboard-stat">
            <Statistic title="待收學費堂數" value={todayUnpaidCount} suffix="堂" valueStyle={{ color: todayUnpaidCount > 0 ? '#f59e0b' : undefined }} />
          </Card>
        </Col>
      </Row>

      <Card
        className="surface-card"
        title="即將到來"
        extra={<Button type="link" onClick={() => navigate('/calendar')}>查看行事曆 <RightOutlined /></Button>}
        style={{ marginBottom: 16 }}
      >
        {upcoming.length === 0 ? <Empty description="今日已無待上課程" /> : (
          <List
            className="lesson-list"
            dataSource={upcoming}
            renderItem={(lesson) => {
              const hasConflict = checkConflict(lesson)
              const student = students.find((s) => s.id === lesson.studentId)
              const isPhysical = lesson.location && !lesson.location.includes('線上')
              return (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <div className="lesson-row">
                      <div className="lesson-time">{lesson.startTime} - {lesson.endTime}</div>
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
                              title="點擊切換 待收 / 已收"
                              onClick={() => togglePayment(lesson)}
                            >
                              <DollarOutlined /> NT$ {lesson.fee.toLocaleString()} · {lesson.paymentStatus === 'paid' ? '已收' : lesson.paymentStatus === 'waived' ? '免收' : '待收'}
                            </Tag>
                          ) : null}
                        </Space>
                        <div className="lesson-meta">
                          <EnvironmentOutlined /> {lesson.location}
                          {isPhysical && (
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
                          )}
                        </div>
                      </div>
                      <Space size={8} align="center">
                        <Button
                          size="small"
                          icon={<FieldTimeOutlined />}
                          onClick={() => openDelayModal(lesson)}
                          title="遇延誤拖堂，一鍵順延此堂及後續課程"
                        >
                          順延
                        </Button>
                        <Badge status="processing" text={statusText[lesson.status]} />
                      </Space>
                    </div>
                    {student?.teachingNotes ? (
                      <div className="dashboard-teaching-note">
                        <BookOutlined style={{ color: '#d97706', marginTop: 3, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Flex justify="space-between" align="center" style={{ marginBottom: 2 }}>
                            <Typography.Text strong style={{ fontSize: 13, color: '#b45309' }}>
                              課前提醒 / 教學筆記
                            </Typography.Text>
                            <Space size={8}>
                              <Button
                                type="link"
                                size="small"
                                style={{ padding: 0, height: 'auto', fontSize: 12 }}
                                onClick={() => openNoteModal(student)}
                              >
                                編輯筆記
                              </Button>
                              <Popconfirm
                                title="確定清空此學員的教學筆記？"
                                okText="全部清除"
                                cancelText="取消"
                                onConfirm={() => {
                                  updateStudentTeachingNotes(student.id, '')
                                  void message.success(`已清空【${student.name}】的教學筆記`)
                                }}
                              >
                                <Button
                                  type="link"
                                  danger
                                  size="small"
                                  style={{ padding: 0, height: 'auto', fontSize: 12 }}
                                >
                                  全部清除
                                </Button>
                              </Popconfirm>
                            </Space>
                          </Flex>
                          <div className="dashboard-teaching-note-content">
                            {student.teachingNotes}
                          </div>
                        </div>
                      </div>
                    ) : student ? (
                      <div className="dashboard-add-note-link">
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0, height: 'auto', fontSize: 12, color: '#8c8c8c' }}
                          icon={<EditOutlined />}
                          onClick={() => openNoteModal(student)}
                        >
                          新增課前備忘筆記
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </List.Item>
              )
            }}
          />
        )}
      </Card>

      {/* 待安排補課追蹤清單 */}
      {pendingMakeups.length > 0 && (
        <Card
          className="surface-card"
          title={
            <Space>
              <span>待安排補課</span>
              <Badge count={pendingMakeups.length} style={{ backgroundColor: '#f97316' }} />
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <List
            className="lesson-list"
            dataSource={pendingMakeups}
            renderItem={(lesson) => (
              <List.Item>
                <div className="lesson-row">
                  <div className="lesson-time">
                    {dayjs(lesson.date).format('MM/DD')}<br />
                    <span style={{ fontSize: 12, color: '#f97316' }}>請假</span>
                  </div>
                  <div className="lesson-main">
                    <Space size={6} wrap align="center">
                      <span className="lesson-name">{lesson.studentName}</span>
                      <Tag color="blue">{lesson.subject}</Tag>
                      {lesson.fee !== undefined ? (
                        <Tag color={lesson.paymentStatus === 'paid' ? 'success' : 'warning'}>
                          {lesson.paymentStatus === 'paid' ? '學費已收' : '學費待收'}
                        </Tag>
                      ) : null}
                    </Space>
                    <div className="lesson-meta">原課時段：{lesson.startTime} - {lesson.endTime} · {lesson.location}</div>
                  </div>
                  <Space size={6}>
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => {
                        setPendingMakeupLessonId(lesson.id)
                        navigate(`/calendar?makeup=${lesson.id}`)
                      }}
                    >
                      安排補課
                    </Button>
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
                </div>
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* 待補登完課 */}
      <Card className="surface-card" title="待補登完課">
        {pending.length === 0 ? <Empty description="沒有待補登課程" /> : (
          <List
            className="lesson-list"
            dataSource={pending}
            renderItem={(lesson) => {
              const hasConflict = checkConflict(lesson)
              const student = students.find((s) => s.id === lesson.studentId)
              const isPhysical = lesson.location && !lesson.location.includes('線上')
              return (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <div className="lesson-row">
                      <div className="lesson-time">
                        {dayjs(lesson.date).format('MM/DD')}<br />{lesson.startTime}
                      </div>
                      <div className="lesson-main">
                        <Space size={6} wrap align="center">
                          <span className="lesson-name">{lesson.studentName}</span>
                          <Tag>{lesson.subject}</Tag>
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
                              title="點擊切換 待收 / 已收"
                              onClick={() => togglePayment(lesson)}
                            >
                              <DollarOutlined /> NT$ {lesson.fee.toLocaleString()} · {lesson.paymentStatus === 'paid' ? '已收' : lesson.paymentStatus === 'waived' ? '免收' : '待收'}
                            </Tag>
                          ) : null}
                        </Space>
                        <div className="lesson-meta">
                          <EnvironmentOutlined /> {lesson.location}
                          {isPhysical && (
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
                          )}
                        </div>
                      </div>
                      <Space size={6}>
                        <Button type="primary" size="small" onClick={() => markStatus(lesson.id, 'completed')}>完課</Button>
                        <Button danger size="small" onClick={() => markStatus(lesson.id, 'leave')}>請假</Button>
                      </Space>
                    </div>
                    {student?.teachingNotes ? (
                      <div className="dashboard-teaching-note">
                        <BookOutlined style={{ color: '#d97706', marginTop: 3, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Flex justify="space-between" align="center" style={{ marginBottom: 2 }}>
                            <Typography.Text strong style={{ fontSize: 13, color: '#b45309' }}>
                              課前提醒 / 教學筆記
                            </Typography.Text>
                            <Space size={8}>
                              <Button
                                type="link"
                                size="small"
                                style={{ padding: 0, height: 'auto', fontSize: 12 }}
                                onClick={() => openNoteModal(student)}
                              >
                                編輯筆記
                              </Button>
                              <Popconfirm
                                title="確定清空此學員的教學筆記？"
                                okText="全部清除"
                                cancelText="取消"
                                onConfirm={() => {
                                  updateStudentTeachingNotes(student.id, '')
                                  void message.success(`已清空【${student.name}】的教學筆記`)
                                }}
                              >
                                <Button
                                  type="link"
                                  danger
                                  size="small"
                                  style={{ padding: 0, height: 'auto', fontSize: 12 }}
                                >
                                  全部清除
                                </Button>
                              </Popconfirm>
                            </Space>
                          </Flex>
                          <div className="dashboard-teaching-note-content">
                            {student.teachingNotes}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </List.Item>
              )
            }}
          />
        )}
      </Card>

      {/* 課堂延誤 / 骨牌一鍵順延 Modal (Topic 8) */}
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
        okButtonProps={{ danger: false, type: 'primary' }}
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

      {/* 快速編輯課前教學筆記 Modal */}
      <Modal
        title={
          <Space>
            <BookOutlined style={{ color: '#d97706' }} />
            <span>教學筆記與課前叮嚀 · {noteModalStudent?.name}</span>
          </Space>
        }
        open={Boolean(noteModalStudent)}
        onCancel={() => setNoteModalStudent(null)}
        footer={
          <Flex justify="space-between" align="center" style={{ width: '100%' }}>
            <Button
              danger
              onClick={() => setNoteModalText('')}
            >
              全部清除
            </Button>
            <Space>
              <Button onClick={() => setNoteModalStudent(null)}>取消</Button>
              <Button
                type="primary"
                onClick={() => {
                  if (noteModalStudent) {
                    updateStudentTeachingNotes(noteModalStudent.id, noteModalText)
                    void message.success(`已更新【${noteModalStudent.name}】的教學筆記`)
                    setNoteModalStudent(null)
                  }
                }}
              >
                儲存筆記
              </Button>
            </Space>
          </Flex>
        }
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 8 }}>
          記錄約 5 行簡易進度與備忘（當主頁通知上這堂課時會自動出現提醒老師）：
        </Typography.Paragraph>
        <Input.TextArea
          rows={5}
          value={noteModalText}
          onChange={(e) => setNoteModalText(e.target.value)}
          placeholder="例如：上次練到第 40 首，今天先驗收右手節奏；記得提醒家長下週請假..."
        />
      </Modal>
    </>
  )
}
