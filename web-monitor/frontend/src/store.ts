import {create} from 'zustand';
import { JulesTask } from './types';

interface TaskStore {
  tasks: Record<string, JulesTask>;
  setTasks: (tasks: JulesTask[]) => void;
  updateTask: (task: JulesTask) => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: {},
  setTasks: (tasks) => {
    const taskMap = tasks.reduce((acc, task) => {
      acc[task.id] = task;
      return acc;
    }, {} as Record<string, JulesTask>);
    set({ tasks: taskMap });
  },
  updateTask: (task) =>
    set((state) => ({
      tasks: {
        ...state.tasks,
        [task.id]: {
            ...state.tasks[task.id],
            ...task
        }
      },
    })),
}));
