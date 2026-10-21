import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Card, Col, Empty, Progress, Row, Segmented, Statistic, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useAppStore } from '../store/useAppStore'
import type { Lesson, Student } from '../types'

type Period = '本月' | '近三個月' | '上月' | '全部'

type SubjectSummary = { subject: string; lessons: number; hours: number; percent: number }
type StudentSummary = {
  key: string
  name: string
  subjects: string[]
  completed: number
  scheduled: number
  leave: number
  hours: number
}

const lessonMinutes = (lesson: Lesson) => {
  const [startHour, startMinute] = lesson.startTime.split(':').map(Number)
  const [endHour, endMinute] = lesson.endTime.split(':').map(Number)
  return Math.max(0, (endHour * 60 + endMinute) - (startHour * 60 + startMinute))
}

const isWithinPeriod = (date: string, period: Period) => {
  const lessonDate = dayjs(date)
  const today = dayjs()
  if (period === '全部') return true
  if (period === '本月') return lessonDate.isSame(today, 'month')
  if (period === '上月') return lessonDate.isSame(today.subtract(1, 'month'), 'month')
  return lessonDate.isAfter(today.startOf('month').subtract(2, 'month').subtract(1, 'day')) && lessonDate.isBefore(today.endOf('month').add(1, 'day'))
}

export default function StatsPage() {
  const lessons = useAppStore((state) => state.lessons)
  const students = useAppStore((state) => state.students)
  const [period, setPeriod] = useState<Period>('本月')

  const report = useMemo(() => {
    const filtered = lessons.filter((lesson) => isWithinPeriod(lesson.date, period))
    const completed = filtered.filter((lesson) => lesson.status === 'completed')
    const scheduled = filtered.filter((lesson) => lesson.status === 'scheduled')
    const leave = filtered.filter((lesson) => lesson.status === 'leave')
    const completedHours = completed.reduce((total, lesson) => total + lessonMinutes(lesson), 0) / 60
    const attendanceBase = completed.length + leave.length
    const completionRate = attendanceBase ? Math.round((completed.length / attendanceBase) * 100) : 0
    const subjectMap = new Map<string, { lessons: number; minutes: number }>()
    filtered.forEach((lesson) => {
      const current = subjectMap.get(lesson.subject) ?? { lessons: 0, minutes: 0 }
      subjectMap.set(lesson.subject, { lessons: current.lessons + 1, minutes: current.minutes + lessonMinutes(lesson) })
    })
    const subjectStats: SubjectSummary[] = Array.from(subjectMap.entries())
      .map(([subject, data]) => ({ subject, lessons: data.lessons, hours: data.minutes / 60, percent: filtered.length ? Math.round((data.lessons / filtered.length) * 100) : 0 }))
      .sort((left, right) => right.lessons - left.lessons)
    return { completed, scheduled, leave, completedHours, completionRate, subjectStats, filtered }
  }, [lessons, period])

  const studentRows = useMemo<StudentSummary[]>(() => students.map((student: Student) => {
    const studentLessons = report.filtered.filter((lesson) => lesson.studentId === student.id)
    const completed = studentLessons.filter((lesson) => lesson.status === 'completed')
    return {
      key: student.id,
      name: student.name,
      subjects: student.subjects,
      completed: completed.length,
      scheduled: studentLessons.filter((lesson) => lesson.status === 'scheduled').length,
      leave: studentLessons.filter((lesson) => lesson.status === 'leave').length,
      hours: completed.reduce((total, lesson) => total + lessonMinutes(lesson), 0) / 60,
    }
  }), [students, report.filtered])

  const columns: ColumnsType<StudentSummary> = [
    { title: '學員', dataIndex: 'name', render: (name: string, row) => <div><Typography.Text strong>{name}</Typography.Text><div>{row.subjects.map((subject) => <Tag color="blue" key={subject}>{subject}</Tag>)}</div></div> },
    { title: '已完課', dataIndex: 'completed', sorter: (left, right) => left.completed - right.completed, defaultSortOrder: 'descend' },
    { title: '待上課', dataIndex: 'scheduled' },
    { title: '請假', dataIndex: 'leave' },
    { title: '完課時數', dataIndex: 'hours', render: (hours: number) => `${hours.toFixed(1)} 小時` },
  ]

  return <>
    <section className="page-heading stats-heading">
      <div><Typography.Title level={2}>教學統計</Typography.Title><Typography.Text type="secondary">掌握授課堂數、時數與學員出席狀況</Typography.Text></div>
      <Segmented value={period} options={['本月', '近三個月', '上月', '全部']} onChange={(value) => setPeriod(value as Period)} />
    </section>
    <Row gutter={[12, 12]} className="stats-metrics">
      <Col xs={12} md={6}><Card className="surface-card"><Statistic title="已完課堂數" value={report.completed.length} suffix="堂" valueStyle={{ color: '#22c55e' }} /></Card></Col>
      <Col xs={12} md={6}><Card className="surface-card"><Statistic title="累計授課時數" value={report.completedHours} precision={1} suffix="小時" /></Card></Col>
      <Col xs={12} md={6}><Card className="surface-card"><Statistic title="待上課堂數" value={report.scheduled.length} suffix="堂" valueStyle={{ color: '#3b82f6' }} /></Card></Col>
      <Col xs={12} md={6}><Card className="surface-card"><Statistic title="請假堂數" value={report.leave.length} suffix="堂" /><Typography.Text type="secondary">完課率 {report.completionRate}%</Typography.Text></Card></Col>
    </Row>
    <Card className="surface-card stats-card" title="各科目授課分佈">
      {report.subjectStats.length === 0 ? <Empty description="此期間尚無排課資料" /> : report.subjectStats.map((item) => <div className="subject-progress" key={item.subject}><div><Tag color="blue">{item.subject}</Tag><Typography.Text type="secondary">{item.lessons} 堂（{item.hours.toFixed(1)} 小時）</Typography.Text></div><Progress percent={item.percent} /></div>)}
    </Card>
    <Card className="surface-card stats-card" title="學員上課統計">
      {studentRows.length === 0 ? <Empty description="尚無學員資料" /> : <Table columns={columns} dataSource={studentRows} pagination={false} size="middle" scroll={{ x: 650 }} />}
    </Card>
  </>
}
