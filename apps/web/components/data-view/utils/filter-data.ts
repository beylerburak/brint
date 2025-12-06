import { BaseTask, FilterTab, TableTask } from "../types"

export function filterTasksByTab<T extends BaseTask>(
  tasks: T[],
  filterTab: FilterTab
): T[] {
  return tasks.filter((task) => {
    const now = new Date()
    const dueDate = new Date(task.dueDate)

    switch (filterTab) {
      case "todo":
        return task.status === "Not Started"
      case "inProgress":
        return task.status === "In Progress"
      case "overdue":
        return dueDate < now && task.status !== "Done"
      case "completed":
        return task.status === "Done"
      case "all":
      default:
        return true
    }
  })
}
