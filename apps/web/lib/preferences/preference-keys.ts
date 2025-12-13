export const PreferenceKeys = {
  TASKS_VIEW_MODE: "tasks.viewMode",
  TASKS_CALENDAR_MODE: "tasks.calendar.mode",
  TASKS_SHOW_COMPLETED: "tasks.showCompleted",
  TASKS_SHOW_SUMMARY: "tasks.showSummary",
} as const

export type PreferenceKey = (typeof PreferenceKeys)[keyof typeof PreferenceKeys]
