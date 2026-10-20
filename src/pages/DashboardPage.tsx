import { Badge, Button, Card, Col, List, Row, Space, Statistic, Tag, Typography } from 'antd'
import { EnvironmentOutlined, RightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const upcomingLessons = [
  { time: '14:00 - 15:00', name: '林小安', subject: '鋼琴', location: '工作室 A', color: 'blue' },
  { time: '16:30 - 17:30', name: '陳宇恩', subject: '吉他', location: '工作室 B', color: 'purple' },
]
const pendingLessons = [
  { time: '昨日 19:00', name: '王語晴', subject: '鋼琴' },
  { time: '10/18 15:30', name: '張品妤', subject: '小提琴' },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  return (
    <>
      <section className="page-heading">
        <Typography.Title level={2}>你好，老師 </Typography.Title>
        <Typography.Text type="secondary">2026 年 10 月 20 日 星期二</Typography.Text>
      </section>
      <Row gutter={12} style={{ marginBottom: 20 }}>
        <Col span={12}><Card className="surface-card dashboard-stat"><Statistic title="今日總堂數" value={4} suffix="堂" /></Card></Col>
        <Col span={12}><Card className="surface-card dashboard-stat"><Statistic title="待完成堂數" value={2} suffix="堂" valueStyle={{ color: '#3b82f6' }} /></Card></Col>
      </Row>
      <Card className="surface-card" title="即將到來" extra={<Button type="link" onClick={() => navigate('/calendar')}>查看行事曆 <RightOutlined /></Button>} style={{ marginBottom: 16 }}>
        <List className="lesson-list" dataSource={upcomingLessons} renderItem={(lesson) => (
          <List.Item><div className="lesson-row"><div className="lesson-time">{lesson.time}</div><div className="lesson-main"><Space size={8} wrap><span className="lesson-name">{lesson.name}</span><Tag color={lesson.color}>{lesson.subject}</Tag></Space><div className="lesson-meta"><EnvironmentOutlined /> {lesson.location}</div></div></div></List.Item>
        )} />
      </Card>
      <Card className="surface-card" title="待補登完課">
        <List className="lesson-list" dataSource={pendingLessons} renderItem={(lesson) => (
          <List.Item><div className="lesson-row"><div className="lesson-time">{lesson.time}</div><div className="lesson-main"><Space size={8} wrap><span className="lesson-name">{lesson.name}</span><Tag>{lesson.subject}</Tag></Space><div className="lesson-meta"><Badge status="processing" text="等待確認本次課程狀態" /></div></div><Space size={6}><Button type="primary" size="small">完課</Button><Button danger size="small">請假</Button></Space></div></List.Item>
        )} />
      </Card>
    </>
  )
}
