// src/types.ts
export type TaskStatus = 'Analyzing' | 'Planning' | 'Executing' | 'Testing' | 'Complete' | 'Error';

export interface JulesTask {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  progress: number;
  logs: string[];
  files: string[];
  link: string;
}
