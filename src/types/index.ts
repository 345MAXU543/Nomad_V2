export type LessonStatus = 'scheduled' | 'completed' | 'leave'
export type LocationType = '工作室' | '到府' | '線上'

export interface Student {
  id: string
  name: string
  subjects: string[]
  /** 舊版資料相容欄位；新資料以 subjects 為準。 */
  subject?: string
  locationType: LocationType
  defaultLocation: string
  phone: string
  active: boolean
  notes?: string
  avatarColor?: string
  gender?: '女' | '男'
  age?: number
  occupation?: string
  lineId?: string
}

export interface Lesson {
  id: string
  studentId: string
  studentName: string
  subject: string
  date: string
  startTime: string
  endTime: string
  location: string
  status: LessonStatus
  notes?: string
}

export interface AppSettings {
  defaultDuration: number
  defaultLocation: string
  isDarkMode: boolean
  courseTypes: string[]
}

export interface BackupPayload {
  students: Student[]
  lessons: Lesson[]
  settings: AppSettings
}
