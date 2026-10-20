import { useState } from 'react'
import { Avatar, Badge, Button, Drawer, Form, Input, List, Radio, Segmented, Select, Space, Switch, Tag, Typography } from 'antd'
import { PlusOutlined, UserOutlined } from '@ant-design/icons'

const students = [
  { name: '林小安', subject: '鋼琴', location: '工作室 A', initial: '安', color: '#7c3aed' },
  { name: '陳宇恩', subject: '吉他', location: '到府授課 · 中山區', initial: '恩', color: '#0f766e' },
  { name: '黃以樂', subject: '鋼琴', location: '工作室 B', initial: '樂', color: '#2563eb' },
  { name: '吳子謙', subject: '吉他', location: '線上課程', initial: '謙', color: '#db2777' },
]

export default function StudentsPage() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingName, setEditingName] = useState<string | null>(null)
  const openDrawer = (name?: string) => { setEditingName(name ?? null); setDrawerOpen(true) }
  return (
    <>
      <section className="page-heading"><Typography.Title level={2}>學員管理</Typography.Title><Typography.Text type="secondary">快速檢視目前在學的學員資料</Typography.Text></section>
      <div className="students-toolbar"><Input.Search placeholder="搜尋學員姓名或科目..." /><Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer()}>新增學員</Button><Segmented className="filter-segment" options={['全部 (12)', '在學中 (10)', '暫停 (2)']} defaultValue="全部 (12)" /></div>
      <List className="student-list" dataSource={students} renderItem={(student) => (
        <List.Item><div className="student-card"><Avatar size={44} style={{ backgroundColor: student.color }}>{student.initial}</Avatar><div className="student-info"><div className="student-name-line"><Typography.Text strong>{student.name}</Typography.Text><Tag color="blue">{student.subject}</Tag><Badge status="success" text="在學中" /></div><div className="student-location">預設地點：{student.location}</div></div><Button type="link" onClick={() => openDrawer(student.name)}>編輯</Button></div></List.Item>
      )} />
      <Drawer title={editingName ? `編輯學員 · ${editingName}` : '新增學員'} placement="right" width={400} open={drawerOpen} onClose={() => setDrawerOpen(false)} extra={<Button type="primary" onClick={() => setDrawerOpen(false)}>儲存</Button>}>
        <Typography.Paragraph type="secondary">純視覺表單預覽，不會寫入任何資料。</Typography.Paragraph>
        <Form layout="vertical" className="form-stack">
          <Form.Item label="學員姓名"><Input prefix={<UserOutlined />} placeholder="輸入姓名" defaultValue={editingName ?? undefined} /></Form.Item>
          <Form.Item label="學習科目"><Select placeholder="選擇科目" options={[{ value: 'piano', label: '鋼琴' }, { value: 'guitar', label: '吉他' }, { value: 'violin', label: '小提琴' }]} /></Form.Item>
          <Form.Item label="預設地點"><Radio.Group defaultValue="studio"><Space direction="vertical"><Radio value="studio">工作室</Radio><Radio value="home">到府</Radio><Radio value="online">線上</Radio></Space></Radio.Group></Form.Item>
          <Form.Item label="聯絡電話"><Input placeholder="0912-345-678" /></Form.Item>
          <Form.Item label="在學狀態" valuePropName="checked"><Switch defaultChecked checkedChildren="在學中" unCheckedChildren="暫停" /></Form.Item>
          <Form.Item label="備註"><Input.TextArea rows={4} placeholder="可留空" /></Form.Item>
        </Form>
      </Drawer>
    </>
  )
}
