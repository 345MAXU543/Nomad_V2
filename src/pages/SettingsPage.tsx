import { Button, Card, Form, Input, Select, Space, Typography } from 'antd'
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons'

export default function SettingsPage() {
  return (
    <>
      <section className="page-heading"><Typography.Title level={2}>系統設定</Typography.Title><Typography.Text type="secondary">本機使用偏好與資料管理</Typography.Text></section>
      <Card className="surface-card setting-card" title="排課偏好設定">
        <Form className="setting-form" layout="vertical">
          <Form.Item label="預設課程時長"><Select defaultValue="60" options={[{ value: '50', label: '50 分鐘' }, { value: '60', label: '60 分鐘' }, { value: '90', label: '90 分鐘' }]} /></Form.Item>
          <Form.Item label="預設上課地點"><Input defaultValue="工作室 A" /></Form.Item>
        </Form>
      </Card>
      <Card className="surface-card setting-card" title="本地資料備份">
        <Typography.Paragraph type="secondary">此原型僅呈現本機備份操作介面，不會存取雲端或外部帳號。</Typography.Paragraph>
        <Space wrap><Button icon={<DownloadOutlined />}>匯出 JSON 備份檔</Button><Button icon={<UploadOutlined />}>匯入備份檔</Button><Button danger>重置所有資料</Button></Space>
      </Card>
    </>
  )
}
