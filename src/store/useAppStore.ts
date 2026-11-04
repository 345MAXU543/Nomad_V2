import dayjs from 'dayjs'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { AppSettings, BackupPayload, Lesson, LessonStatus, PaymentStatus, Student } from '../types'

type AppState = BackupPayload & {
  addStudent: (student: Omit<Student, 'id'>) => void
  updateStudent: (id: string, data: Partial<Student>) => void
  deleteStudent: (id: string) => void
  toggleStudentActive: (id: string) => void
  addLesson: (lesson: Omit<Lesson, 'id'>) => void
  addLessons: (lessons: Omit<Lesson, 'id'>[]) => void
  updateLesson: (id: string, data: Partial<Lesson>) => void
  deleteLesson: (id: string) => void
  deleteRecurringLessons: (recurringGroupId: string, fromDate?: string) => void
  updateLessonStatus: (id: string, status: LessonStatus) => void
  updateLessonPaymentStatus: (id: string, status: PaymentStatus) => void
  batchUpdateLessonPaymentStatus: (ids: string[], status: PaymentStatus) => void
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
  }
}

export const createSeedData = (): BackupPayload => {
  const students: Student[] = [
    { id: 'student-lin', name: '林小安', subjects: ['鋼琴', '編曲'], locationType: '工作室', defaultLocation: '教室 A', phone: '0912-345-678', active: true, avatarColor: '#7c3aed', gender: '女', defaultFee: 1200, billingCycle: 'monthly' },
    { id: 'student-chen', name: '陳宇恩', subjects: ['吉他', '小提琴'], locationType: '到府', defaultLocation: '到府授課・中山區', phone: '0922-345-678', active: true, avatarColor: '#0f766e', gender: '男', defaultFee: 1400, billingCycle: 'perLesson' },
    { id: 'student-huang', name: '黃以樂', subjects: ['鋼琴'], locationType: '工作室', defaultLocation: '教室 B', phone: '0932-345-678', active: true, avatarColor: '#2563eb', gender: '女', defaultFee: 1000, billingCycle: 'monthly' },
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
      lesson('lesson-before-yesterday', students[0], -2, '19:00', '20:00', 'scheduled', 'paid'),
      lesson('lesson-tomorrow-1', students[2], 1, '11:00', '12:00', 'scheduled', 'unpaid'),
      lesson('lesson-tomorrow-2', students[3], 1, '15:30', '16:30', 'scheduled', 'unpaid'),
    ],
    settings: normalizeSettings({}),
  }
}

export const useAppStore = create<AppState>()(persist((set) => ({
  ...createSeedData(),
  addStudent: (student) => set((state) => ({ students: [...state.students, normalizeStudent({ ...student, id: createId() })] })),
  updateStudent: (id, data) => set((state) => {
    const updated = state.students.map((student) => student.id === id ? normalizeStudent({ ...student, ...data }) : student)
    const changed = updated.find((student) => student.id === id)
    const today = dayjs().format('YYYY-MM-DD')
    return { students: updated, lessons: changed ? state.lessons.map((lesson) => lesson.studentId === id && lesson.status === 'scheduled' && lesson.date > today ? { ...lesson, studentName: changed.name, subject: changed.subjects.includes(lesson.subject) ? lesson.subject : changed.subjects[0] } : lesson) : state.lessons }
  }),
  deleteStudent: (id) => set((state) => ({ students: state.students.filter((student) => student.id !== id), lessons: state.lessons.filter((lesson) => lesson.studentId !== id) })),
  toggleStudentActive: (id) => set((state) => ({ students: state.students.map((student) => student.id === id ? { ...student, active: !student.active } : student) })),
  addLesson: (lesson) => set((state) => {
    const student = state.students.find((s) => s.id === lesson.studentId)
    const fee = lesson.fee !== undefined ? lesson.fee : (student?.defaultFee ?? state.settings.defaultFee ?? 1200)
    return { lessons: [...state.lessons, { ...lesson, fee, paymentStatus: lesson.paymentStatus ?? 'unpaid', id: createId() }] }
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
  deleteLesson: (id) => set((state) => ({ lessons: state.lessons.filter((lesson) => lesson.id !== id) })),
  deleteRecurringLessons: (recurringGroupId, fromDate) => set((state) => ({
    lessons: state.lessons.filter((lesson) => {
      if (lesson.recurringGroupId !== recurringGroupId) return true
      if (fromDate && lesson.date < fromDate) return true
      return false
    }),
  })),
  updateLessonStatus: (id, status) => set((state) => ({ lessons: state.lessons.map((lesson) => lesson.id === id ? { ...lesson, status } : lesson) })),
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
      settings: normalizeSettings(persisted.settings ?? currentState.settings),
    }
  },
}))
