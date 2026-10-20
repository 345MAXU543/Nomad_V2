import { useState } from 'react'
import { Badge, Button, Calendar, Card, DatePicker, Drawer, Flex, Form, Input, List, Segmented, Select, Space, Tag, TimePicker, Typography, type CalendarProps } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import zhTW from 'antd/locale/zh_TW'
import dayjs, { type Dayjs } from 'dayjs'

const dayLessons = [
  { time: '10:00 - 11:00', name: '黃以樂', subject: '鋼琴', status: '待上課', badge: 'processing' as const },
  { time: '14:00 - 15:00', name: '林小安', subject: '鋼琴', status: '已完課', badge: 'success' as const },
  { time: '18:30 - 19:30', name: '吳子謙', subject: '吉他', status: '請假', badge: 'default' as const },
]

const scheduleList = [
  { date: '10/18（日）', time: '10:00 - 11:00', type: '排課', color: 'blue', title: '黃以樂', detail: '鋼琴 · 教室 B', status: '待上課', badge: 'processing' as const },
  { date: '10/19（一）', time: '14:30 - 15:00', type: '通勤', color: 'gold', title: '前往中山區', detail: '教室 A → 到府地點', status: '通勤', badge: 'default' as const },
  { date: '10/20（二）', time: '14:00 - 15:00', type: '排課', color: 'blue', title: '林小安', detail: '鋼琴 · 教室 A', status: '已完課', badge: 'success' as const },
  { date: '10/22（四）', time: '18:30 - 19:30', type: '排課', color: 'purple', title: '吳子謙', detail: '吉他 · 線上課程', status: '待上課', badge: 'processing' as const },
]

const lessonDates: Record<string, 'processing' | 'success'> = {
  '2026-10-18': 'processing',
  '2026-10-19': 'success',
  '2026-10-20': 'processing',
  '2026-10-22': 'processing',
}

const antdLocale = (zhTW as unknown as { default?: typeof zhTW }).default ?? zhTW
const calendarLocale = {
  ...antdLocale.Calendar,
  lang: {
    ...antdLocale.Calendar?.lang,
    locale: 'zh-tw',
    shortWeekDays: ['日', '一', '二', '三', '四', '五', '六'],
  },
} as CalendarProps<Dayjs>['locale']

export default function CalendarPage() {
  const [viewMode, setViewMode] = useState<'月檢視' | '列表檢視'>('月檢視')
  const [scheduleDrawerOpen, setScheduleDrawerOpen] = useState(false)
  const [lessonDrawerOpen, setLessonDrawerOpen] = useState(false)
  const [commuteDrawerOpen, setCommuteDrawerOpen] = useState(false)
  return (
    <>
      <Flex className="calendar-toolbar" justify="space-between" align="center">
        <Segmented options={['月檢視', '列表檢視']} value={viewMode} onChange={(value) => setViewMode(value as '月檢視' | '列表檢視')} />
        <Button type="primary" shape="circle" icon={<PlusOutlined />} aria-label="新增排程" onClick={() => setScheduleDrawerOpen(true)} />
      </Flex>
      {viewMode === '月檢視' ? (
        <>
          <Card className="surface-card calendar-card" style={{ marginBottom: 16 }}>
            <Calendar
              fullscreen={false}
              locale={calendarLocale}
              defaultValue={dayjs('2026-10-20')}
              dateCellRender={(current) => {
                const status = lessonDates[current.format('YYYY-MM-DD')]
                return status ? <span className={`calendar-lesson-dot ${status === 'success' ? 'is-complete' : ''}`} aria-label="有排課" /> : null
              }}
            />
          </Card>
          <Card className="surface-card" title="10 月 20 日 · 當日課程">
            <List className="lesson-list" dataSource={dayLessons} renderItem={(lesson) => (
              <List.Item><div className="lesson-row"><div className="lesson-time">{lesson.time}</div><div className="lesson-main"><Space size={8} wrap><span className="lesson-name">{lesson.name}</span><Tag>{lesson.subject}</Tag></Space></div><Badge status={lesson.badge} text={lesson.status} /></div></List.Item>
            )} />
          </Card>
        </>
      ) : (
        <Card className="surface-card" title="近期排程">
          <List className="lesson-list" dataSource={scheduleList} renderItem={(item) => (
            <List.Item><div className="lesson-row"><div className="schedule-list-date">{item.date}<br /><span>{item.time}</span></div><div className="lesson-main"><Space size={8} wrap><Tag color={item.color}>{item.type}</Tag><span className="lesson-name">{item.title}</span></Space><div className="lesson-meta">{item.detail}</div></div><Badge status={item.badge} text={item.status} /></div></List.Item>
          )} />
        </Card>
      )}
      <Drawer title="新增排程" placement="right" width={320} open={scheduleDrawerOpen} onClose={() => setScheduleDrawerOpen(false)}>
        <Space direction="vertical" size={12} className="schedule-menu">
          <Button type="primary" block onClick={() => { setScheduleDrawerOpen(false); setLessonDrawerOpen(true) }}>排課</Button>
          <Button block onClick={() => { setScheduleDrawerOpen(false); setCommuteDrawerOpen(true) }}>通勤</Button>
          <Button type="text" size="small" block onClick={() => setScheduleDrawerOpen(false)}>其他排程</Button>
        </Space>
      </Drawer>
      <Drawer title="新增排課" placement="right" width={400} open={lessonDrawerOpen} onClose={() => setLessonDrawerOpen(false)} extra={<Button type="primary" onClick={() => setLessonDrawerOpen(false)}>新增</Button>}>
        <Typography.Paragraph type="secondary">以下為排課表單的視覺預覽。</Typography.Paragraph>
        <Form layout="vertical" className="form-stack">
          <Form.Item label="學員"><Select placeholder="選擇學員" options={[{ value: 'lin', label: '林小安 · 鋼琴' }, { value: 'chen', label: '陳宇恩 · 吉他' }]} /></Form.Item>
          <Form.Item label="上課日期"><DatePicker style={{ width: '100%' }} placeholder="選擇日期" /></Form.Item>
          <Form.Item label="起訖時間"><TimePicker.RangePicker style={{ width: '100%' }} format="HH:mm" /></Form.Item>
          <Form.Item label="上課地點"><Input placeholder="例如：工作室 A" /></Form.Item>
          <Form.Item label="備註"><Input.TextArea rows={3} placeholder="可留空" /></Form.Item>
        </Form>
      </Drawer>
      <Drawer title="新增通勤" placement="right" width={400} open={commuteDrawerOpen} onClose={() => setCommuteDrawerOpen(false)} extra={<Button type="primary" onClick={() => setCommuteDrawerOpen(false)}>新增</Button>}>
        <Typography.Paragraph type="secondary">純視覺表單預覽，不會寫入任何資料。</Typography.Paragraph>
        <Form layout="vertical" className="form-stack">
          <Form.Item label="日期"><DatePicker style={{ width: '100%' }} placeholder="選擇日期" /></Form.Item>
          <Form.Item label="起訖時間"><TimePicker.RangePicker style={{ width: '100%' }} format="HH:mm" /></Form.Item>
          <Form.Item label="出發地"><Input placeholder="例如：教室 A" /></Form.Item>
          <Form.Item label="目的地"><Input placeholder="例如：學員住址／到府地點" /></Form.Item>
          <Form.Item label="交通方式"><Select placeholder="選擇交通方式" options={[{ value: 'car', label: '開車' }, { value: 'motorcycle', label: '騎車' }, { value: 'public', label: '大眾運輸' }, { value: 'walk', label: '步行' }]} /></Form.Item>
          <Form.Item label="備註"><Input.TextArea rows={4} placeholder="可留空" /></Form.Item>
        </Form>
      </Drawer>
    </>
  )
}
