import { useState } from 'react'
import { Badge, Button, Calendar, Card, DatePicker, Flex, Form, Input, List, Modal, Segmented, Select, Space, Tag, TimePicker, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

const dayLessons = [
  { time: '10:00 - 11:00', name: '黃以樂', subject: '鋼琴', status: '待上課', badge: 'processing' as const },
  { time: '14:00 - 15:00', name: '林小安', subject: '鋼琴', status: '已完課', badge: 'success' as const },
  { time: '18:30 - 19:30', name: '吳子謙', subject: '吉他', status: '請假', badge: 'default' as const },
]

const lessonDates: Record<string, 'processing' | 'success'> = {
  '2026-10-18': 'processing',
  '2026-10-19': 'success',
  '2026-10-20': 'processing',
  '2026-10-22': 'processing',
}

export default function CalendarPage() {
  const [modalOpen, setModalOpen] = useState(false)
  return (
    <>
      <Flex className="calendar-toolbar" justify="space-between" align="center">
        <Segmented options={['月檢視', '列表檢視']} defaultValue="月檢視" />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新增排課</Button>
      </Flex>
      <Card className="surface-card calendar-card" style={{ marginBottom: 16 }}>
        <Calendar
          fullscreen={false}
          defaultValue={dayjs('2026-10-20')}
          cellRender={(current, info) => {
            if (info.type !== 'date') return info.originNode
            const status = lessonDates[current.format('YYYY-MM-DD')]
            return (
              <div className="calendar-date-cell">
                {info.originNode}
                {status && <div className="calendar-lesson-dot"><Badge status={status} /></div>}
              </div>
            )
          }}
        />
      </Card>
      <Card className="surface-card" title="10 月 20 日 · 當日課程">
        <List className="lesson-list" dataSource={dayLessons} renderItem={(lesson) => (
          <List.Item><div className="lesson-row"><div className="lesson-time">{lesson.time}</div><div className="lesson-main"><Space size={8} wrap><span className="lesson-name">{lesson.name}</span><Tag>{lesson.subject}</Tag></Space></div><Badge status={lesson.badge} text={lesson.status} /></div></List.Item>
        )} />
      </Card>
      <Modal title="新增排課" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => setModalOpen(false)} okText="建立排課" cancelText="取消">
        <Typography.Paragraph type="secondary">以下為排課表單的視覺預覽。</Typography.Paragraph>
        <Form layout="vertical" className="form-stack">
          <Form.Item label="學員"><Select placeholder="選擇學員" options={[{ value: 'lin', label: '林小安 · 鋼琴' }, { value: 'chen', label: '陳宇恩 · 吉他' }]} /></Form.Item>
          <Form.Item label="上課日期"><DatePicker style={{ width: '100%' }} placeholder="選擇日期" /></Form.Item>
          <Form.Item label="起訖時間"><TimePicker.RangePicker style={{ width: '100%' }} format="HH:mm" /></Form.Item>
          <Form.Item label="上課地點"><Input placeholder="例如：工作室 A" /></Form.Item>
          <Form.Item label="備註"><Input.TextArea rows={3} placeholder="可留空" /></Form.Item>
        </Form>
      </Modal>
    </>
  )
}
