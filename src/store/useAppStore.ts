import dayjs from 'dayjs'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { AppSettings, BackupPayload, Commute, Lesson, LessonStatus, PaymentStatus, Student } from '../types'

type AppState = BackupPayload & {
  commutes: Commute[]
  pendingMakeupLessonId: string | null
  setPendingMakeupLessonId: (id: string | null) => void
  addStudent: (student: Omit<Student, 'id'>) => void
  updateStudent: (id: string, data: Partial<Student>) => void
  updateStudentTeachingNotes: (studentId: string, notes: string) => void
  deleteStudent: (id: string) => void
  toggleStudentActive: (id: string) => void
  addLesson: (lesson: Omit<Lesson, 'id'>) => void
  addLessons: (lessons: Omit<Lesson, 'id'>[]) => void
  updateLesson: (id: string, data: Partial<Lesson>) => void
  deleteLesson: (id: string) => void
  deleteRecurringLessons: (recurringGroupId: string, fromDate?: string) => void
  updateLessonStatus: (id: string, status: LessonStatus) => void
  markLeaveWaived: (lessonId: string) => void
  updateLessonPaymentStatus: (id: string, status: PaymentStatus) => void
  batchUpdateLessonPaymentStatus: (ids: string[], status: PaymentStatus) => void
  addCommute: (commute: Omit<Commute, 'id'>) => void
  deleteCommute: (id: string) => void
  delayLessons: (options: { targetLessonId: string; delayMinutes: number; cascadeSubsequent: boolean }) => void
  updateSettings: (data: Partial<AppSettings>) => void
  addCourseType: (name: string) => void
  renameCourseType: (oldName: string, newName: string) => void
  deleteCourseType: (name: string) => void
  toggleDarkMode: () => void
  importData: (payload: BackupPayload) => void
  resetToDefault: () => void
}

const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const defaultCourseTypes = ['鋼琴', '吉他', '小提琴', '編曲']
const normalizeSettings = (settings: Partial<AppSettings>): AppSettings => ({
  defaultDuration: settings.defaultDuration ?? 60,
  defaultLocation: settings.defaultLocation ?? '教室 A',
  defaultFee: settings.defaultFee ?? 1200,
  isDarkMode: settings.isDarkMode ?? false,
  courseTypes: settings.courseTypes?.length ? settings.courseTypes : defaultCourseTypes,
  enableNotifications: settings.enableNotifications ?? false,
  notificationLeadMinutes: settings.notificationLeadMinutes ?? 15,
})

type StoredStudent = Omit<Student, 'subjects'> & { subjects?: string[] }

const normalizeStudent = (student: StoredStudent): Student => {
  const subjects = Array.isArray(student.subjects) && student.subjects.length > 0
    ? [...new Set(student.subjects.filter(Boolean))]
    : student.subject ? [student.subject] : [defaultCourseTypes[0]]
  return {
    ...student,
    subjects,
    subject: student.subject ?? subjects[0],
    defaultFee: student.defaultFee !== undefined ? student.defaultFee : 1200,
    billingCycle: student.billingCycle ?? 'monthly',
    teachingNotes: student.teachingNotes !== undefined ? student.teachingNotes : (student.notes ?? ''),
  }
}

export const createSeedData = (): BackupPayload & { commutes: Commute[] } => {
  const students: Student[] = [
    { id: 'student-lin', name: '林小安', subjects: ['鋼琴', '編曲'], locationType: '工作室', defaultLocation: '教室 A', phone: '0912-345-678', active: true, avatarColor: '#7c3aed', gender: '女', defaultFee: 1200, billingCycle: 'monthly', teachingNotes: '上次進度：小奏鳴曲 Op.36 No.1 第一樂章練習完畢。\n本次重點：右手連續十六音符觸鍵乾淨度，強弱踏板配合。\n課前叮嚀：提醒家長下週需帶新琴譜，並討論 12 月檢定考時間。' },
    { id: 'student-chen', name: '陳宇恩', subjects: ['吉他', '小提琴'], locationType: '到府', defaultLocation: '到府授課・中山區', phone: '0922-345-678', active: true, avatarColor: '#0f766e', gender: '男', defaultFee: 1400, billingCycle: 'perLesson', teachingNotes: '進度：民謠吉他刷弦切音技巧演練。\n課前叮嚀：提醒帶節拍器與調音器。\n學費：本月學費已結清。' },
    { id: 'student-huang', name: '黃以樂', subjects: ['鋼琴'], locationType: '工作室', defaultLocation: '教室 B', phone: '0932-345-678', active: true, avatarColor: '#2563eb', gender: '女', defaultFee: 1000, billingCycle: 'monthly', teachingNotes: '進度：拜爾第 65 首驗收。\n重點：左手伴奏音量要收，右手旋律歌唱性表現。' },
    { id: 'student-wu', name: '吳子謙', subjects: ['吉他'], locationType: '線上', defaultLocation: '線上課程', phone: '0942-345-678', active: true, avatarColor: '#db2777', gender: '男', defaultFee: 900, billingCycle: 'perLesson' },
  ]
  const today = dayjs()
  const lesson = (id: string, student: Student, offset: number, startTime: string, endTime: string, status: LessonStatus, paymentStatus: PaymentStatus = 'unpaid'): Lesson => ({
    id, studentId: student.id, studentName: student.name, subject: student.subjects[0], date: today.add(offset, 'day').format('YYYY-MM-DD'), startTime, endTime, location: student.defaultLocation, status, fee: student.defaultFee ?? 1000, paymentStatus,
  })
  return {
    students,
    lessons: [
      lesson('lesson-today-1', students[0], 0, '10:00', '11:00', 'scheduled', 'paid'),
      lesson('lesson-today-2', students[1], 0, '14:00', '15:00', 'scheduled', 'unpaid'),
      lesson('lesson-today-3', students[2], 0, '18:30', '19:30', 'completed', 'paid'),
      lesson('lesson-yesterday', students[3], -1, '16:00', '17:00', 'scheduled', 'unpaid'),
      lesson('lesson-before-yesterday', students[0], -2, '19:00', '20:00', 'leave', 'paid'),
      lesson('lesson-tomorrow-1', students[2], 1, '11:00', '12:00', 'scheduled', 'unpaid'),
      lesson('lesson-tomorrow-2', students[3], 1, '15:30', '16:30', 'scheduled', 'unpaid'),
    ],
    settings: normalizeSettings({}),
    commutes: [
      {
        id: 'commute-1',
        date: today.format('YYYY-MM-DD'),
        startTime: '12:30',
        endTime: '13:30',
        origin: '教室 A',
        destination: '到府授課・中山區',
        notes: '搭乘捷運淡水信義線轉公車',
      },
    ],
  }
}

export const useAppStore = create<AppState>()(persist((set) => ({
  ...createSeedData(),
  pendingMakeupLessonId: null,
  setPendingMakeupLessonId: (id) => set({ pendingMakeupLessonId: id }),
  addCommute: (commute) => set((state) => ({
    commutes: [...(state.commutes || []), { ...commute, id: createId() }],
  })),
  deleteCommute: (id) => set((state) => ({
    commutes: (state.commutes || []).filter((c) => c.id !== id),
  })),
  delayLessons: ({ targetLessonId, delayMinutes, cascadeSubsequent }) => set((state) => {
    const targetLesson = state.lessons.find((l) => l.id === targetLessonId)
    if (!targetLesson || delayMinutes === 0) return state

    const shiftTime = (time: string, mins: number) => {
      const [h, m] = time.split(':').map(Number)
      const total = h * 60 + m + mins
      const clamped = Math.min(23 * 60 + 59, Math.max(0, total))
      const newH = Math.floor(clamped / 60)
      const newM = clamped % 60
      return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
    }

    const targetDate = targetLesson.date
    const targetStart = targetLesson.startTime

    const updatedLessons = state.lessons.map((lesson) => {
      if (lesson.id === targetLessonId) {
        return {
          ...lesson,
          startTime: shiftTime(lesson.startTime, delayMinutes),
          endTime: shiftTime(lesson.endTime, delayMinutes),
        }
      }
      if (cascadeSubsequent && lesson.date === targetDate && lesson.status === 'scheduled' && lesson.startTime >= targetStart) {
        return {
          ...lesson,
          startTime: shiftTime(lesson.startTime, delayMinutes),
          endTime: shiftTime(lesson.endTime, delayMinutes),
        }
      }
      return lesson
    })

    return { lessons: updatedLessons }
  }),
  addStudent: (student) => set((state) => ({ students: [...state.students, normalizeStudent({ ...student, id: createId() })] })),
  updateStudent: (id, data) => set((state) => {
    const updated = state.students.map((student) => student.id === id ? normalizeStudent({ ...student, ...data }) : student)
    const changed = updated.find((student) => student.id === id)
    const today = dayjs().format('YYYY-MM-DD')
    return { students: updated, lessons: changed ? state.lessons.map((lesson) => lesson.studentId === id && lesson.status === 'scheduled' && lesson.date > today ? { ...lesson, studentName: changed.name, subject: changed.subjects.includes(lesson.subject) ? lesson.subject : changed.subjects[0] } : lesson) : state.lessons }
  }),
  updateStudentTeachingNotes: (studentId, notes) => set((state) => ({
    students: state.students.map((s) => s.id === studentId ? { ...s, teachingNotes: notes } : s),
  })),
  deleteStudent: (id) => set((state) => ({ students: state.students.filter((student) => student.id !== id), lessons: state.lessons.filter((lesson) => lesson.studentId !== id) })),
  toggleStudentActive: (id) => set((state) => ({ students: state.students.map((student) => student.id === id ? { ...student, active: !student.active } : student) })),
  addLesson: (lesson) => set((state) => {
    const student = state.students.find((s) => s.id === lesson.studentId)
    const fee = lesson.fee !== undefined ? lesson.fee : (student?.defaultFee ?? state.settings.defaultFee ?? 1200)
    const newId = createId()
    const newLesson: Lesson = {
      ...lesson,
      fee,
      paymentStatus: lesson.paymentStatus ?? 'unpaid',
      id: newId,
    }
    const updatedLessons = state.lessons.map((l) => {
      if (lesson.makeupForLessonId && l.id === lesson.makeupForLessonId) {
        return { ...l, rescheduledLessonId: newId }
      }
      return l
    })
    return { lessons: [...updatedLessons, newLesson] }
  }),
  addLessons: (newLessons) => set((state) => {
    const prepared = newLessons.map((lesson) => {
      const student = state.students.find((s) => s.id === lesson.studentId)
      const fee = lesson.fee !== undefined ? lesson.fee : (student?.defaultFee ?? state.settings.defaultFee ?? 1200)
      return {
        ...lesson,
        fee,
        paymentStatus: lesson.paymentStatus ?? 'unpaid',
        id: createId(),
      }
    })
    return { lessons: [...state.lessons, ...prepared] }
  }),
  updateLesson: (id, data) => set((state) => ({ lessons: state.lessons.map((lesson) => lesson.id === id ? { ...lesson, ...data } : lesson) })),
  deleteLesson: (id) => set((state) => {
    const target = state.lessons.find((l) => l.id === id)
    return {
      lessons: state.lessons
        .filter((l) => l.id !== id)
        .map((l) => {
          if (target?.makeupForLessonId && l.id === target.makeupForLessonId) {
            return { ...l, rescheduledLessonId: undefined }
          }
          if (target?.rescheduledLessonId && l.id === target.rescheduledLessonId) {
            return { ...l, isMakeup: false, makeupForLessonId: undefined }
          }
          return l
        }),
    }
  }),
  deleteRecurringLessons: (recurringGroupId, fromDate) => set((state) => ({
    lessons: state.lessons.filter((lesson) => {
      if (lesson.recurringGroupId !== recurringGroupId) return true
      if (fromDate && lesson.date < fromDate) return true
      return false
    }),
  })),
  updateLessonStatus: (id, status) => set((state) => ({
    lessons: state.lessons.map((lesson) => {
      if (lesson.id === id) {
        // If status changes away from leave, reset rescheduledLessonId
        const rescheduledLessonId = status === 'leave' ? lesson.rescheduledLessonId : undefined
        return { ...lesson, status, rescheduledLessonId }
      }
      return lesson
    }),
  })),
  markLeaveWaived: (lessonId) => set((state) => ({
    lessons: state.lessons.map((lesson) => lesson.id === lessonId ? { ...lesson, rescheduledLessonId: 'waived' } : lesson),
  })),
  updateLessonPaymentStatus: (id, paymentStatus) => set((state) => ({
    lessons: state.lessons.map((lesson) => lesson.id === id ? { ...lesson, paymentStatus, paidAt: paymentStatus === 'paid' ? dayjs().format('YYYY-MM-DD HH:mm') : undefined } : lesson),
  })),
  batchUpdateLessonPaymentStatus: (ids, paymentStatus) => set((state) => ({
    lessons: state.lessons.map((lesson) => ids.includes(lesson.id) ? { ...lesson, paymentStatus, paidAt: paymentStatus === 'paid' ? dayjs().format('YYYY-MM-DD HH:mm') : undefined } : lesson),
  })),
  updateSettings: (data) => set((state) => ({ settings: { ...state.settings, ...data } })),
  addCourseType: (name) => set((state) => {
    const trimmed = name.trim()
    return !trimmed || state.settings.courseTypes.includes(trimmed) ? state : { settings: { ...state.settings, courseTypes: [...state.settings.courseTypes, trimmed] } }
  }),
  renameCourseType: (oldName, newName) => set((state) => {
    const trimmed = newName.trim()
    if (!trimmed || oldName === trimmed || state.settings.courseTypes.includes(trimmed)) return state
    return {
      settings: { ...state.settings, courseTypes: state.settings.courseTypes.map((courseType) => courseType === oldName ? trimmed : courseType) },
      students: state.students.map((student) => {
        const subjects = [...new Set(student.subjects.map((subject) => subject === oldName ? trimmed : subject))]
        return { ...student, subjects, subject: student.subject === oldName ? trimmed : student.subject }
      }),
      lessons: state.lessons.map((lesson) => lesson.subject === oldName ? { ...lesson, subject: trimmed } : lesson),
    }
  }),
  deleteCourseType: (name) => set((state) => {
    if (state.settings.courseTypes.length <= 1) return state
    return {
      settings: { ...state.settings, courseTypes: state.settings.courseTypes.filter((courseType) => courseType !== name) },
      students: state.students.map((student) => {
        const subjects = student.subjects.length > 1 ? student.subjects.filter((subject) => subject !== name) : student.subjects
        return { ...student, subjects, subject: subjects[0] }
      }),
    }
  }),
  toggleDarkMode: () => set((state) => ({ settings: { ...state.settings, isDarkMode: !state.settings.isDarkMode } })),
  importData: (payload) => set({
    students: payload.students.map((student) => normalizeStudent(student)),
    lessons: payload.lessons.map((lesson) => ({ ...lesson, fee: lesson.fee !== undefined ? lesson.fee : 1200, paymentStatus: lesson.paymentStatus ?? 'unpaid' })),
    commutes: payload.commutes ?? [],
    settings: normalizeSettings(payload.settings),
  }),
  resetToDefault: () => set(createSeedData()),
}), {
  name: 'nomad-v2-storage',
  storage: createJSONStorage(() => localStorage),
  merge: (persistedState, currentState) => {
    const persisted = persistedState as Partial<AppState>
    return {
      ...currentState,
      ...persisted,
      students: persisted.students ? persisted.students.map((student) => normalizeStudent(student)) : currentState.students,
      lessons: persisted.lessons ? persisted.lessons.map((l) => ({ ...l, fee: l.fee !== undefined ? l.fee : 1200, paymentStatus: l.paymentStatus ?? 'unpaid' })) : currentState.lessons,
      commutes: Array.isArray(persisted.commutes) ? persisted.commutes : (currentState.commutes ?? []),
      settings: normalizeSettings(persisted.settings ?? currentState.settings),
    }
  },
}))
