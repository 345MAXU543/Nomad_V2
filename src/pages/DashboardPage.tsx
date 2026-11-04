import dayjs from 'dayjs'
import { Badge, Button, Card, Col, Empty, List, Row, Space, Statistic, Tag, Typography, message } from 'antd'
import { AlertOutlined, DollarOutlined, EnvironmentOutlined, RightOutlined, SyncOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import type { Lesson, PaymentStatus } from '../types'

const statusText = { scheduled: '待上課', completed: '已完課', leave: '請假' } as const

const isTimeOverlapping = (startA: string, endA: string, startB: string, endB: string): boolean => {
  return startA < endB && endA > startB
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const lessons = useAppStore((state) => state.lessons)
  const updateLessonStatus = useAppStore((state) => state.updateLessonStatus)
  const updateLessonPaymentStatus = useAppStore((state) => state.updateLessonPaymentStatus)

  const today = dayjs().format('YYYY-MM-DD')
  const todayLessons = lessons.filter((lesson) => lesson.date === today)
  const upcoming = todayLessons.filter((lesson) => lesson.status === 'scheduled').sort((a, b) => a.startTime.localeCompare(b.startTime))
  const pending = lessons.filter((lesson) => lesson.status === 'scheduled' && lesson.date <= today).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))

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
            return (
              <List.Item>
                <div className="lesson-row">
                  <div className="lesson-time">{lesson.startTime} - {lesson.endTime}</div>
                  <div className="lesson-main">
                    <Space size={6} wrap align="center">
                      <span className="lesson-name">{lesson.studentName}</span>
                      <Tag color="blue">{lesson.subject}</Tag>
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
              </List.Item>
            )
          }}
        />
      )}
    </Card>

    <Card className="surface-card" title="待補登完課">
      {pending.length === 0 ? <Empty description="沒有待補登課程" /> : (
        <List
          className="lesson-list"
          dataSource={pending}
          renderItem={(lesson) => {
            const hasConflict = checkConflict(lesson)
            return (
              <List.Item>
                <div className="lesson-row">
                  <div className="lesson-time">
                    {dayjs(lesson.date).format('MM/DD')}<br />{lesson.startTime}
                  </div>
                  <div className="lesson-main">
                    <Space size={6} wrap align="center">
                      <span className="lesson-name">{lesson.studentName}</span>
                      <Tag>{lesson.subject}</Tag>
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
              </List.Item>
            )
          }}
        />
      )}
    </Card>
  </>
}
