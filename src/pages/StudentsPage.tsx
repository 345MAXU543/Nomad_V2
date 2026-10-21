import { useMemo, useState } from 'react'
import { Avatar, Button, Card, Drawer, Form, Input, InputNumber, List, Popconfirm, Radio, Select, Space, Tag, Typography, message } from 'antd'
import { PlusOutlined, UserOutlined } from '@ant-design/icons'
import { useAppStore } from '../store/useAppStore'
import type { Student } from '../types'

type StudentFormValues = Omit<Student, 'id' | 'active'>
const subjectOptions = ['鋼琴', '吉他', '小提琴', '編曲'].map((value) => ({ value, label: value }))

export default function StudentsPage() {
  const students = useAppStore((state) => state.students)
  const addStudent = useAppStore((state) => state.addStudent)
  const updateStudent = useAppStore((state) => state.updateStudent)
  const deleteStudent = useAppStore((state) => state.deleteStudent)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [searchText, setSearchText] = useState('')
  const [form] = Form.useForm<StudentFormValues>()
  const locationType = Form.useWatch('locationType', form)
  const visibleStudents = useMemo(() => students.filter((student) => {
    const query = searchText.trim().toLowerCase()
    return !query || [student.name, student.subject, student.defaultLocation].some((value) => value.toLowerCase().includes(query))
  }), [students, searchText])
  const openDrawer = (student?: Student) => {
    setEditingStudent(student ?? null)
    if (student) form.setFieldsValue(student); else form.setFieldsValue({ name: '', subject: undefined, locationType: '工作室', defaultLocation: '', phone: '', notes: '', gender: undefined, age: undefined, occupation: '', lineId: '' })
    setDrawerOpen(true)
  }
  const saveStudent = (values: StudentFormValues) => {
    if (editingStudent) updateStudent(editingStudent.id, values); else addStudent({ ...values, active: true })
    setDrawerOpen(false); void message.success(editingStudent ? '學員資料已儲存' : '學員已新增')
  }
  const removeStudent = (student: Student) => { deleteStudent(student.id); setDrawerOpen(false); void message.success('學員已刪除') }
  return <>
    <section className="page-heading"><Typography.Title level={2}>學員管理</Typography.Title></section>
    <div className="students-toolbar"><Input.Search value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="搜尋學員姓名、科目或地點..." /><Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer()}>新增學員</Button></div>
    <Card className="surface-card students-card"><Typography.Text className="students-count" strong>全部（{students.length}）</Typography.Text>
      <List className="student-list" dataSource={visibleStudents} locale={{ emptyText: '找不到符合的學員' }} renderItem={(student) => <List.Item><div className="student-card"><Avatar size={44} style={{ backgroundColor: student.avatarColor ?? '#3b82f6' }}>{student.name.slice(0, 1)}</Avatar><div className="student-info"><div className="student-name-line"><Typography.Text strong>{student.name}</Typography.Text><Tag color="blue">{student.subject}</Tag></div><div className="student-location">預設地點：{student.defaultLocation || '未設定'}</div></div><Button type="link" onClick={() => openDrawer(student)}>編輯</Button></div></List.Item>} />
    </Card>
    <Drawer title={editingStudent ? `編輯學員 · ${editingStudent.name}` : '新增學員'} placement="right" width={400} open={drawerOpen} onClose={() => setDrawerOpen(false)} extra={<Button type="primary" onClick={() => form.submit()}>{editingStudent ? '儲存' : '新增'}</Button>}>
      <Form form={form} layout="vertical" className="form-stack" onFinish={saveStudent} initialValues={{ locationType: '工作室', active: true }}>
        <Form.Item name="name" label="學員姓名" rules={[{ required: true, message: '請輸入學員姓名' }]}><Input prefix={<UserOutlined />} /></Form.Item>
        <Form.Item name="subject" label="學習科目" rules={[{ required: true, message: '請選擇學習科目' }]}><Select options={subjectOptions} placeholder="選擇科目" /></Form.Item>
        <Form.Item name="gender" label="性別"><Radio.Group><Radio value="女">女</Radio><Radio value="男">男</Radio></Radio.Group></Form.Item>
        <Form.Item name="age" label="年齡"><InputNumber min={0} max={120} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="occupation" label="職業"><Input placeholder="例如：學生、工程師" /></Form.Item>
        <Form.Item name="locationType" label="預設授課型態"><Radio.Group><Space direction="vertical"><Radio value="工作室">教室</Radio><Radio value="到府">到府</Radio><Radio value="線上">線上</Radio></Space></Radio.Group></Form.Item>
        <Form.Item name="defaultLocation" label={locationType === '到府' ? '到府地點' : locationType === '工作室' ? '教室地點' : '線上課程說明'} rules={[{ required: true, message: '請輸入預設地點' }]}><Input placeholder={locationType === '到府' ? '輸入上課地址或區域' : '例如：教室 A'} /></Form.Item>
        <Form.Item name="phone" label="聯絡電話"><Input /></Form.Item>
        <Form.Item name="lineId" label="LINE ID"><Input /></Form.Item>
        <Form.Item name="notes" label="備註"><Input.TextArea rows={4} /></Form.Item>
      </Form>
      {editingStudent && <Popconfirm title="確定刪除這位學員與其所有課程？" okText="刪除" cancelText="取消" onConfirm={() => removeStudent(editingStudent)}><Button danger block>刪除學員</Button></Popconfirm>}
    </Drawer>
  </>
}
