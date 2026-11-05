import type { Lesson } from '../types'

// 紀錄本次會話已提醒過的課程 ID，避免重複彈出通知
const notifiedLessonIds = new Set<string>()

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    return false
  }
  if (Notification.permission === 'granted') {
    return true
  }
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export const sendNotification = (title: string, body: string): boolean => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false
  }
  try {
    const notif = new Notification(title, {
      body,
      icon: '/MainIcon.jpg',
      badge: '/MainIcon.jpg',
      vibrate: [200, 100, 200, 100, 200],
    } as NotificationOptions)
    notif.onclick = () => {
      window.focus()
      notif.close()
    }
    return true
  } catch (error) {
    console.warn('通知發送失敗', error)
    return false
  }
}

export const checkLessonReminders = (
  lessons: Lesson[],
  leadMinutes: number = 15
) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return
  }

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  lessons.forEach((lesson) => {
    if (lesson.date !== todayStr || lesson.status !== 'scheduled') {
      return
    }
    if (notifiedLessonIds.has(lesson.id)) {
      return
    }

    const [sh, sm] = lesson.startTime.split(':').map(Number)
    const lessonStartMin = sh * 60 + sm
    const diff = lessonStartMin - currentMinutes

    // 當課程在 0 ~ leadMinutes 分鐘之內即將開始
    if (diff >= 0 && diff <= leadMinutes) {
      notifiedLessonIds.add(lesson.id)
      sendNotification(
        `上課提醒（${diff === 0 ? '現在' : `${diff} 分鐘後`}）🔔`,
        `【${lesson.studentName}】的 ${lesson.subject} 課堂即將於 ${lesson.startTime} 開始！\n地點：${lesson.location}`
      )
    }
  })
}
