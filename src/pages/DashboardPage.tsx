import dayjs from 'dayjs'
import { Badge, Button, Card, Col, Empty, List, Row, Space, Statistic, Tag, Typography, message } from 'antd'
import { EnvironmentOutlined, RightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'

const statusText = { scheduled: '待上課', completed: '已完課', leave: '請假' } as const

export default function DashboardPage() {
  const navigate = useNavigate()
  const lessons = useAppStore((state) => state.lessons)
  const updateLessonStatus = useAppStore((state) => state.updateLessonStatus)
  const today = dayjs().format('YYYY-MM-DD')
  const todayLessons = lessons.filter((lesson) => lesson.date === today)
  const upcoming = todayLessons.filter((lesson) => lesson.status === 'scheduled').sort((a, b) => a.startTime.localeCompare(b.startTime))
  const pending = lessons.filter((lesson) => lesson.status === 'scheduled' && lesson.date <= today).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
  const markStatus = (id: string, status: 'completed' | 'leave') => {
    updateLessonStatus(id, status)
    void message[status === 'completed' ? 'success' : 'info'](status === 'completed' ? '已標記為完課' : '已標記為請假')
  }
  return <>
    <section className="page-heading"><Typography.Title level={2}>你好，老師</Typography.Title><Typography.Text type="secondary">{dayjs().format('YYYY 年 MM 月 DD 日 dddd')}</Typography.Text></section>
    <Row gutter={12} style={{ marginBottom: 20 }}><Col span={12}><Card className="surface-card dashboard-stat"><Statistic title="今日總堂數" value={todayLessons.filter((lesson) => lesson.status !== 'leave').length} suffix="堂" /></Card></Col><Col span={12}><Card className="surface-card dashboard-stat"><Statistic title="待完成堂數" value={upcoming.length} suffix="堂" valueStyle={{ color: '#3b82f6' }} /></Card></Col></Row>
    <Card className="surface-card" title="即將到來" extra={<Button type="link" onClick={() => navigate('/calendar')}>查看行事曆 <RightOutlined /></Button>} style={{ marginBottom: 16 }}>
      {upcoming.length === 0 ? <Empty description="今日已無待上課程" /> : <List className="lesson-list" dataSource={upcoming} renderItem={(lesson) => <List.Item><div className="lesson-row"><div className="lesson-time">{lesson.startTime} - {lesson.endTime}</div><div className="lesson-main"><Space size={8} wrap><span className="lesson-name">{lesson.studentName}</span><Tag color="blue">{lesson.subject}</Tag></Space><div className="lesson-meta"><EnvironmentOutlined /> {lesson.location}</div></div><Badge status="processing" text={statusText[lesson.status]} /></div></List.Item>} />}
    </Card>
    <Card className="surface-card" title="待補登完課">
      {pending.length === 0 ? <Empty description="沒有待補登課程" /> : <List className="lesson-list" dataSource={pending} renderItem={(lesson) => <List.Item><div className="lesson-row"><div className="lesson-time">{dayjs(lesson.date).format('MM/DD')}<br />{lesson.startTime}</div><div className="lesson-main"><Space size={8} wrap><span className="lesson-name">{lesson.studentName}</span><Tag>{lesson.subject}</Tag></Space><div className="lesson-meta">{lesson.location}</div></div><Space size={6}><Button type="primary" size="small" onClick={() => markStatus(lesson.id, 'completed')}>完課</Button><Button danger size="small" onClick={() => markStatus(lesson.id, 'leave')}>請假</Button></Space></div></List.Item>} />}
    </Card>
  </>
}
