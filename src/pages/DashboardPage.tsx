import { useState } from 'react'
import dayjs from 'dayjs'
import { Badge, Button, Card, Col, Empty, Flex, Input, List, Modal, Popconfirm, Row, Space, Statistic, Tag, Typography, message } from 'antd'
import { AlertOutlined, BookOutlined, DollarOutlined, EditOutlined, EnvironmentOutlined, RightOutlined, SyncOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
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
  const [noteModalStudent, setNoteModalStudent] = useState<Student | null>(null)
  const [noteModalText, setNoteModalText] = useState('')
  const openNoteModal = (student: Student) => {
    setNoteModalStudent(student)
    setNoteModalText(student.teachingNotes ?? '')
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

  return <>
    <section className="page-heading">
      <Typography.Title level={2}>你好，老師</Typography.Title>
      <Typography.Text type="secondary">{dayjs().format('YYYY 年 MM 月 DD 日 dddd')}</Typography.Text>
    </section>

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

    <Card className="surface-card" title="即將到來" extra={<Button type="link" onClick={() => navigate('/calendar')}>查看行事曆 <RightOutlined /></Button>} style={{ marginBottom: 16 }}>
      {upcoming.length === 0 ? <Empty description="今日已無待上課程" /> : (
        <List
          className="lesson-list"
          dataSource={upcoming}
          renderItem={(lesson) => {
            const hasConflict = checkConflict(lesson)
            const student = students.find((s) => s.id === lesson.studentId)
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
                      <div className="lesson-meta"><EnvironmentOutlined /> {lesson.location}</div>
                    </div>
                    <Badge status="processing" text={statusText[lesson.status]} />
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

    <Card className="surface-card" title="待補登完課">
      {pending.length === 0 ? <Empty description="沒有待補登課程" /> : (
        <List
          className="lesson-list"
          dataSource={pending}
          renderItem={(lesson) => {
            const hasConflict = checkConflict(lesson)
            const student = students.find((s) => s.id === lesson.studentId)
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
                      <div className="lesson-meta">{lesson.location}</div>
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
}
