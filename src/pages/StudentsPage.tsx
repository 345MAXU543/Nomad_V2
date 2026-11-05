import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  Avatar,
  Button,
  Card,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  List,
  Popconfirm,
  Radio,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  BookOutlined,
  DollarOutlined,
  HistoryOutlined,
  PlusOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useAppStore } from '../store/useAppStore'
import type { Student } from '../types'

type StudentFormValues = Omit<Student, 'id' | 'active' | 'subject'>

export default function StudentsPage() {
  const students = useAppStore((state) => state.students)
  const lessons = useAppStore((state) => state.lessons)
  const courseTypes = useAppStore((state) => state.settings.courseTypes)
  const addStudent = useAppStore((state) => state.addStudent)
  const updateStudent = useAppStore((state) => state.updateStudent)
  const updateStudentTeachingNotes = useAppStore((state) => state.updateStudentTeachingNotes)
  const deleteStudent = useAppStore((state) => state.deleteStudent)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState<'notes' | 'info'>('notes')
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [teachingNotesValue, setTeachingNotesValue] = useState('')
  const [searchText, setSearchText] = useState('')
  const [form] = Form.useForm<StudentFormValues>()
  const locationType = Form.useWatch('locationType', form)

  const visibleStudents = useMemo(() => students.filter((student) => {
    const query = searchText.trim().toLowerCase()
    return !query || student.name.toLowerCase().includes(query) || student.defaultLocation.toLowerCase().includes(query) || student.subjects.some((subject) => subject.toLowerCase().includes(query))
  }), [students, searchText])

  const studentHistoryLessons = useMemo(() => {
    if (!editingStudent) return []
    return lessons
      .filter((l) => l.studentId === editingStudent.id)
      .sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`))
  }, [lessons, editingStudent])

  const openDrawer = (student?: Student, defaultTab: 'notes' | 'info' = 'notes') => {
    setEditingStudent(student ?? null)
    setDrawerTab(student ? defaultTab : 'info')
    if (student) {
      setTeachingNotesValue(student.teachingNotes ?? '')
      form.setFieldsValue({
        ...student,
        teachingNotes: student.teachingNotes ?? '',
      })
    } else {
      setTeachingNotesValue('')
      form.setFieldsValue({
        name: '',
        subjects: [],
        locationType: '工作室',
        defaultLocation: '',
        phone: '',
        notes: '',
        teachingNotes: '',
        gender: undefined,
        age: undefined,
        occupation: '',
        lineId: '',
        defaultFee: 1200,
        billingCycle: 'monthly',
      })
    }
    setDrawerOpen(true)
  }

  const saveStudent = (values: StudentFormValues) => {
    const studentData = {
      ...values,
      subject: values.subjects[0],
      teachingNotes: editingStudent ? teachingNotesValue : (values.teachingNotes ?? teachingNotesValue),
    }
    if (editingStudent) {
      updateStudent(editingStudent.id, studentData)
    } else {
      addStudent({ ...studentData, active: true })
    }
    setDrawerOpen(false)
    void message.success(editingStudent ? '學員資料已儲存' : '學員已新增')
  }

  const saveTeachingNotesOnly = () => {
    if (editingStudent) {
      updateStudentTeachingNotes(editingStudent.id, teachingNotesValue)
      void message.success(`已儲存【${editingStudent.name}】的教學筆記`)
    }
  }

  const removeStudent = (student: Student) => {
    deleteStudent(student.id)
    setDrawerOpen(false)
    void message.success('學員已刪除')
  }

  return (
    <>
      <section className="page-heading">
        <Typography.Title level={2}>學員管理</Typography.Title>
      </section>
      <div className="students-toolbar">
        <Input.Search
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="搜尋學員姓名、科目或地點..."
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer()}>
          新增學員
        </Button>
      </div>
      <Card className="surface-card students-card">
        <Typography.Text className="students-count" strong>
          全部（{students.length}）
        </Typography.Text>
        <List
          className="student-list"
          dataSource={visibleStudents}
          locale={{ emptyText: '找不到符合的學員' }}
          renderItem={(student) => {
            const pendingMakeupCount = lessons.filter(
              (l) => l.studentId === student.id && l.status === 'leave' && !l.rescheduledLessonId
            ).length

            return (
              <List.Item>
                <div
                  className="student-card student-card-clickable"
                  onClick={() => openDrawer(student, 'notes')}
                >
                  <Avatar size={44} style={{ backgroundColor: student.avatarColor ?? '#3b82f6' }}>
                    {student.name.slice(0, 1)}
                  </Avatar>
                  <div className="student-info">
                    <div className="student-name-line">
                      <Typography.Text strong>{student.name}</Typography.Text>
                      {student.subjects.map((subject) => (
                        <Tag color="blue" key={subject}>{subject}</Tag>
                      ))}
                      {student.defaultFee ? (
                        <Tag color="cyan">
                          <DollarOutlined /> NT$ {student.defaultFee.toLocaleString()} / 堂
                        </Tag>
                      ) : null}
                      {student.billingCycle ? (
                        <Tag>{student.billingCycle === 'monthly' ? '月結' : '單堂'}</Tag>
                      ) : null}
                      {pendingMakeupCount > 0 ? (
                        <Tag color="volcano">待補 {pendingMakeupCount} 堂</Tag>
                      ) : null}
                    </div>
                    {student.teachingNotes ? (
                      <div className="student-notes-preview">
                        <BookOutlined style={{ color: '#d97706', marginRight: 4 }} />
                        <span>{student.teachingNotes.replace(/\n/g, ' ')}</span>
                      </div>
                    ) : null}
                    <div className="student-location">預設地點：{student.defaultLocation || '未設定'}</div>
                  </div>
                  <Space size={4}>
                    <Button
                      type="link"
                      onClick={(e) => {
                        e.stopPropagation()
                        openDrawer(student, 'notes')
                      }}
                    >
                      紀錄與筆記
                    </Button>
                    <Button
                      type="link"
                      style={{ color: '#8c8c8c' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        openDrawer(student, 'info')
                      }}
                    >
                      編輯
                    </Button>
                  </Space>
                </div>
              </List.Item>
            )
          }}
        />
      </Card>

      <Drawer
        title={
          editingStudent ? (
            <Space align="center">
              <Avatar size="small" style={{ backgroundColor: editingStudent.avatarColor ?? '#3b82f6' }}>
                {editingStudent.name.slice(0, 1)}
              </Avatar>
              <span>{editingStudent.name} · 學員檔案</span>
            </Space>
          ) : (
            '新增學員'
          )
        }
        placement="right"
        width={460}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          editingStudent && drawerTab === 'notes' ? (
            <Button type="primary" onClick={saveTeachingNotesOnly}>
              儲存筆記
            </Button>
          ) : (
            <Button type="primary" onClick={() => form.submit()}>
              {editingStudent ? '儲存資料' : '新增'}
            </Button>
          )
        }
      >
        {editingStudent && (
          <Segmented
            block
            value={drawerTab}
            onChange={(val) => setDrawerTab(val as 'notes' | 'info')}
            options={[
              { label: '課堂紀錄與筆記', value: 'notes', icon: <BookOutlined /> },
              { label: '學員基本資料', value: 'info', icon: <UserOutlined /> },
            ]}
            style={{ marginBottom: 16 }}
          />
        )}

        {editingStudent && drawerTab === 'notes' ? (
          <div>
            {/* 課堂教學筆記 / 叮嚀 */}
            <Card
              size="small"
              style={{
                marginBottom: 20,
                background: 'rgba(234, 179, 8, 0.05)',
                borderColor: 'rgba(234, 179, 8, 0.25)',
              }}
            >
              <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
                <Space>
                  <BookOutlined style={{ color: '#d97706' }} />
                  <Typography.Text strong>課堂教學筆記 / 課前叮嚀</Typography.Text>
                </Space>
                <Popconfirm
                  title="確定清空教學筆記內容？"
                  okText="全部清除"
                  cancelText="取消"
                  onConfirm={() => {
                    setTeachingNotesValue('')
                    if (editingStudent) {
                      updateStudentTeachingNotes(editingStudent.id, '')
                      void message.success('已清空教學筆記')
                    }
                  }}
                >
                  <Button type="link" danger size="small" style={{ padding: 0 }}>
                    全部清除
                  </Button>
                </Popconfirm>
              </Flex>
              <Input.TextArea
                rows={5}
                value={teachingNotesValue}
                onChange={(e) => setTeachingNotesValue(e.target.value)}
                placeholder="記錄約 5 行教學進度、課堂重點或交代事項（主頁當天有此堂課時會自動出現提醒老師）..."
              />
              <Flex justify="space-between" align="center" style={{ marginTop: 8 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  💡 當天有課時，主頁會自動浮現此提醒
                </Typography.Text>
                <Button type="primary" size="small" onClick={saveTeachingNotesOnly}>
                  儲存筆記
                </Button>
              </Flex>
            </Card>

            {/* 歷史課堂紀錄 */}
            <div>
              <div style={{ marginBottom: 12 }}>
                <Typography.Text strong style={{ fontSize: 15 }}>
                  <HistoryOutlined /> 歷史課堂紀錄（共 {studentHistoryLessons.length} 堂）
                </Typography.Text>
              </div>
              {studentHistoryLessons.length === 0 ? (
                <Empty description="尚無課堂紀錄" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <List
                  size="small"
                  dataSource={studentHistoryLessons}
                  renderItem={(l) => (
                    <List.Item style={{ padding: '10px 0' }}>
                      <div style={{ width: '100%' }}>
                        <Flex justify="space-between" align="center">
                          <Space size={6}>
                            <Typography.Text strong style={{ fontSize: 14 }}>
                              {dayjs(l.date).format('MM/DD (dd)')}
                            </Typography.Text>
                            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                              {l.startTime} - {l.endTime}
                            </Typography.Text>
                          </Space>
                          <Space size={4} wrap>
                            <Tag color="blue">{l.subject}</Tag>
                            {l.status === 'completed' ? (
                              <Tag color="success">已完課</Tag>
                            ) : l.status === 'leave' ? (
                              <Tag color="warning">請假</Tag>
                            ) : (
                              <Tag color="processing">待上課</Tag>
                            )}
                            {l.isMakeup ? <Tag color="cyan">補課</Tag> : null}
                            {l.fee !== undefined ? (
                              <Tag color={l.paymentStatus === 'paid' ? 'success' : 'default'}>
                                NT$ {l.fee.toLocaleString()} · {l.paymentStatus === 'paid' ? '已收' : '待收'}
                              </Tag>
                            ) : null}
                          </Space>
                        </Flex>
                        {l.notes ? (
                          <div style={{ marginTop: 4, fontSize: 13, color: '#6b7280', paddingLeft: 4 }}>
                            備忘：{l.notes}
                          </div>
                        ) : null}
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </div>
          </div>
        ) : (
          <Form
            form={form}
            layout="vertical"
            className="form-stack"
            onFinish={saveStudent}
            initialValues={{
              locationType: '工作室',
              active: true,
              defaultFee: 1200,
              billingCycle: 'monthly',
            }}
          >
            <Form.Item name="name" label="學員姓名" rules={[{ required: true, message: '請輸入學員姓名' }]}>
              <Input prefix={<UserOutlined />} />
            </Form.Item>
            <Form.Item
              name="subjects"
              label="學習科目（可複選）"
              rules={[{ required: true, type: 'array', min: 1, message: '請至少選擇一項學習科目' }]}
            >
              <Select
                mode="multiple"
                options={courseTypes.map((courseType) => ({ label: courseType, value: courseType }))}
                placeholder="請選擇學員學習的才藝（可複選）"
              />
            </Form.Item>
            <Space style={{ display: 'flex', width: '100%' }} size={12}>
              <Form.Item name="defaultFee" label="每堂預設學費 (NT$)" style={{ flex: 1 }}>
                <InputNumber min={0} step={100} style={{ width: '100%' }} placeholder="例如：1200" prefix="NT$" />
              </Form.Item>
              <Form.Item name="billingCycle" label="計費方式" style={{ flex: 1 }}>
                <Radio.Group optionType="button" buttonStyle="solid">
                  <Radio.Button value="monthly">月結</Radio.Button>
                  <Radio.Button value="perLesson">單堂收</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Space>

            {/* 新增學員時也能直接寫5行教學筆記 */}
            {!editingStudent && (
              <Form.Item
                label={
                  <Flex justify="space-between" align="center" style={{ width: '100%' }}>
                    <span>教學筆記與課前叮嚀 (約5行)</span>
                    <Button
                      type="link"
                      danger
                      size="small"
                      style={{ padding: 0 }}
                      onClick={() => form.setFieldValue('teachingNotes', '')}
                    >
                      全部清除
                    </Button>
                  </Flex>
                }
                name="teachingNotes"
              >
                <Input.TextArea
                  rows={5}
                  placeholder="輸入約 5 行教學進度或課前交代（主頁當天有此堂課時會自動出現提醒老師）..."
                />
              </Form.Item>
            )}

            <Form.Item name="gender" label="性別">
              <Radio.Group>
                <Radio value="女">女</Radio>
                <Radio value="男">男</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item name="age" label="年齡">
              <InputNumber min={0} max={120} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="occupation" label="職業">
              <Input placeholder="例如：學生、工程師" />
            </Form.Item>
            <Form.Item name="locationType" label="預設授課型態">
              <Radio.Group>
                <Space direction="vertical">
                  <Radio value="工作室">教室</Radio>
                  <Radio value="到府">到府</Radio>
                  <Radio value="線上">線上</Radio>
                </Space>
              </Radio.Group>
            </Form.Item>
            <Form.Item
              name="defaultLocation"
              label={locationType === '到府' ? '到府地點' : locationType === '工作室' ? '教室地點' : '線上課程說明'}
              rules={[{ required: true, message: '請輸入預設地點' }]}
            >
              <Input placeholder={locationType === '到府' ? '輸入上課地址或區域' : '例如：教室 A'} />
            </Form.Item>
            <Form.Item name="phone" label="聯絡電話">
              <Input />
            </Form.Item>
            <Form.Item name="lineId" label="LINE ID">
              <Input />
            </Form.Item>
            <Form.Item name="notes" label="其他基本備忘">
              <Input.TextArea rows={2} placeholder="學員個性、家長聯絡偏好等基本備忘..." />
            </Form.Item>
            {editingStudent && (
              <Popconfirm
                title="確定刪除這位學員與其所有課程？"
                okText="刪除"
                cancelText="取消"
                onConfirm={() => removeStudent(editingStudent)}
              >
                <Button danger block style={{ marginTop: 8 }}>
                  刪除學員
                </Button>
              </Popconfirm>
            )}
          </Form>
        )}
      </Drawer>
    </>
  )
}

