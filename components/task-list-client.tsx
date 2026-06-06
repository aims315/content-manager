'use client'

import dynamic from 'next/dynamic'

const TaskList = dynamic(
  () => import('@/components/task-list').then((m) => ({ default: m.TaskList })),
  { ssr: false }
)

export function TaskListClient() {
  return <TaskList />
}
