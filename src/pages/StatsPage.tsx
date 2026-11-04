import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Button, Card, Col, Empty, Popconfirm, Progress, Row, Segmented, Statistic, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckOutlined, DollarOutlined } from '@ant-design/icons'
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
  paidFee: number
  unpaidFee: number
  unpaidLessonIds: string[]
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
  const batchUpdateLessonPaymentStatus = useAppStore((state) => state.batchUpdateLessonPaymentStatus)
  const [period, setPeriod] = useState<Period>('本月')

  const report = useMemo(() => {
    const filtered = lessons.filter((lesson) => isWithinPeriod(lesson.date, period))
    const completed = filtered.filter((lesson) => lesson.status === 'completed')
    const scheduled = filtered.filter((lesson) => lesson.status === 'scheduled')
    const leave = filtered.filter((lesson) => lesson.status === 'leave')
    const completedHours = completed.reduce((total, lesson) => total + lessonMinutes(lesson), 0) / 60
    const attendanceBase = completed.length + leave.length
    const completionRate = attendanceBase ? Math.round((completed.length / attendanceBase) * 100) : 0

    // 財務指標（請假不計入應收）
    const billableLessons = filtered.filter((lesson) => lesson.status !== 'leave')
    const paidRevenue = billableLessons
      .filter((lesson) => lesson.paymentStatus === 'paid')
      .reduce((sum, lesson) => sum + (lesson.fee ?? 0), 0)
    const unpaidRevenue = billableLessons
      .filter((lesson) => lesson.paymentStatus === 'unpaid')
      .reduce((sum, lesson) => sum + (lesson.fee ?? 0), 0)
    const totalExpectedRevenue = paidRevenue + unpaidRevenue
    const collectionRate = totalExpectedRevenue > 0 ? Math.round((paidRevenue / totalExpectedRevenue) * 100) : 100

    const subjectMap = new Map<string, { lessons: number; minutes: number }>()
    filtered.forEach((lesson) => {
      const current = subjectMap.get(lesson.subject) ?? { lessons: 0, minutes: 0 }
      subjectMap.set(lesson.subject, { lessons: current.lessons + 1, minutes: current.minutes + lessonMinutes(lesson) })
    })
    const subjectStats: SubjectSummary[] = Array.from(subjectMap.entries())
      .map(([subject, data]) => ({ subject, lessons: data.lessons, hours: data.minutes / 60, percent: filtered.length ? Math.round((data.lessons / filtered.length) * 100) : 0 }))
      .sort((left, right) => right.lessons - left.lessons)

    return {
      completed,
      scheduled,
      leave,
      completedHours,
      completionRate,
      paidRevenue,
      unpaidRevenue,
      totalExpectedRevenue,
      collectionRate,
      subjectStats,
      filtered,
    }
  }, [lessons, period])

  const studentRows = useMemo<StudentSummary[]>(() => students.map((student: Student) => {
    const studentLessons = report.filtered.filter((lesson) => lesson.studentId === student.id)
    const completed = studentLessons.filter((lesson) => lesson.status === 'completed')
    const billable = studentLessons.filter((lesson) => lesson.status !== 'leave')
    const unpaidLessons = billable.filter((lesson) => lesson.paymentStatus === 'unpaid' && (lesson.fee ?? 0) > 0)

    const paidFee = billable
      .filter((lesson) => lesson.paymentStatus === 'paid')
      .reduce((sum, lesson) => sum + (lesson.fee ?? 0), 0)
    const unpaidFee = unpaidLessons.reduce((sum, lesson) => sum + (lesson.fee ?? 0), 0)

    return {
      key: student.id,
      name: student.name,
      subjects: student.subjects,
      completed: completed.length,
      scheduled: studentLessons.filter((lesson) => lesson.status === 'scheduled').length,
      leave: studentLessons.filter((lesson) => lesson.status === 'leave').length,
      hours: completed.reduce((total, lesson) => total + lessonMinutes(lesson), 0) / 60,
      paidFee,
      unpaidFee,
      unpaidLessonIds: unpaidLessons.map((l) => l.id),
    }
  }), [students, report.filtered])

  const collectAllForStudent = (row: StudentSummary) => {
    if (row.unpaidLessonIds.length === 0) return
    batchUpdateLessonPaymentStatus(row.unpaidLessonIds, 'paid')
    void message.success(`已將學員【${row.name}】本期 ${row.unpaidLessonIds.length} 堂課標記為已收款`)
  }

  const columns: ColumnsType<StudentSummary> = [
    {
      title: '學員',
      dataIndex: 'name',
      render: (name: string, row) => (
        <div>
          <Typography.Text strong>{name}</Typography.Text>
          <div>{row.subjects.map((subject) => <Tag color="blue" key={subject}>{subject}</Tag>)}</div>
        </div>
      ),
    },
    {
      title: '完課 / 待上',
      key: 'lessonCounts',
      render: (_, row) => <span>{row.completed} 完課 / {row.scheduled} 待上</span>,
    },
    {
      title: '已收學費',
      dataIndex: 'paidFee',
      sorter: (a, b) => a.paidFee - b.paidFee,
      render: (fee: number) => <span style={{ color: fee > 0 ? '#10b981' : undefined, fontWeight: 600 }}>NT$ {fee.toLocaleString()}</span>,
    },
    {
      title: '待收學費',
      dataIndex: 'unpaidFee',
      sorter: (a, b) => a.unpaidFee - b.unpaidFee,
      defaultSortOrder: 'descend',
      render: (fee: number) => (
        <span style={{ color: fee > 0 ? '#f59e0b' : undefined, fontWeight: fee > 0 ? 700 : 400 }}>
          {fee > 0 ? `NT$ ${fee.toLocaleString()}` : '-'}
        </span>
      ),
    },
    {
      title: '完課時數',
      dataIndex: 'hours',
      render: (hours: number) => `${hours.toFixed(1)} hr`,
    },
    {
      title: '收款操作',
      key: 'action',
      render: (_, row) => (
        row.unpaidFee > 0 ? (
          <Popconfirm
            title={`確認將【${row.name}】待收學費 NT$ ${row.unpaidFee.toLocaleString()} 全數標記已收？`}
            okText="確認收齊"
            cancelText="取消"
            onConfirm={() => collectAllForStudent(row)}
          >
            <Button size="small" type="primary" ghost icon={<CheckOutlined />}>
              一鍵收齊
            </Button>
          </Popconfirm>
        ) : (
          <Tag color="success">已結清</Tag>
        )
      ),
    },
  ]

  return <>
    <section className="page-heading stats-heading">
      <div>
        <Typography.Title level={2}>教學與營收統計</Typography.Title>
        <Typography.Text type="secondary">掌握授課堂數、時數與學費實收進度</Typography.Text>
      </div>
      <Segmented value={period} options={['本月', '近三個月', '上月', '全部']} onChange={(value) => setPeriod(value as Period)} />
    </section>

    {/* 財務統計指標 */}
    <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 12 }}>
      <DollarOutlined style={{ color: '#10b981', marginRight: 6 }} />學費營收狀況
    </Typography.Title>
    <Row gutter={[12, 12]} className="stats-metrics">
      <Col xs={12} md={6}>
        <Card className="surface-card">
          <Statistic title="已實收學費" value={report.paidRevenue} prefix="NT$" valueStyle={{ color: '#10b981', fontWeight: 700 }} />
          <Typography.Text type="secondary">收款達成率 {report.collectionRate}%</Typography.Text>
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card className="surface-card">
          <Statistic title="待收取學費" value={report.unpaidRevenue} prefix="NT$" valueStyle={{ color: report.unpaidRevenue > 0 ? '#f59e0b' : undefined, fontWeight: 700 }} />
          <Typography.Text type="secondary">{report.unpaidRevenue > 0 ? '尚有學員未繳清' : '款項已全數入帳'}</Typography.Text>
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card className="surface-card">
          <Statistic title="總預計營收" value={report.totalExpectedRevenue} prefix="NT$" />
          <Typography.Text type="secondary">當期所有正常排課</Typography.Text>
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card className="surface-card">
          <Statistic title="累計授課時數" value={report.completedHours} precision={1} suffix="小時" />
          <Typography.Text type="secondary">完課率 {report.completionRate}%</Typography.Text>
        </Card>
      </Col>
    </Row>

    {/* 堂數統計指標 */}
    <Typography.Title level={4} style={{ marginTop: 8, marginBottom: 12 }}>
      課堂狀況
    </Typography.Title>
    <Row gutter={[12, 12]} className="stats-metrics">
      <Col xs={8} md={4}>
        <Card className="surface-card">
          <Statistic title="已完課" value={report.completed.length} suffix="堂" valueStyle={{ color: '#22c55e' }} />
        </Card>
      </Col>
      <Col xs={8} md={4}>
        <Card className="surface-card">
          <Statistic title="待上課" value={report.scheduled.length} suffix="堂" valueStyle={{ color: '#3b82f6' }} />
        </Card>
      </Col>
      <Col xs={8} md={4}>
        <Card className="surface-card">
          <Statistic title="請假" value={report.leave.length} suffix="堂" />
        </Card>
      </Col>
    </Row>

    <Card className="surface-card stats-card" title="各科目授課分佈">
      {report.subjectStats.length === 0 ? <Empty description="此期間尚無排課資料" /> : report.subjectStats.map((item) => (
        <div className="subject-progress" key={item.subject}>
          <div>
            <Tag color="blue">{item.subject}</Tag>
            <Typography.Text type="secondary">{item.lessons} 堂（{item.hours.toFixed(1)} 小時）</Typography.Text>
          </div>
          <Progress percent={item.percent} />
        </div>
      ))}
    </Card>

    <Card className="surface-card stats-card" title="學員收費與上課統計">
      {studentRows.length === 0 ? (
        <Empty description="尚無學員資料" />
      ) : (
        <Table columns={columns} dataSource={studentRows} pagination={false} size="middle" scroll={{ x: 750 }} />
      )}
    </Card>
  </>
}
