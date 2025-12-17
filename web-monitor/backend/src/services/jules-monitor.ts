// src/services/jules-monitor.ts
import { EventEmitter } from 'events';

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

class JulesMonitor extends EventEmitter {
  private tasks: Map<string, JulesTask> = new Map();

  constructor() {
    super();
    this.initializeTasks();
    this.startSimulation();
  }

  private initializeTasks() {
    const tasks: Omit<JulesTask, 'status' | 'progress' | 'logs' | 'files'>[] = [
      { id: '2', name: 'Task 2', description: 'Cloudflare', link: 'https://jules.google.com/session/6445581090661442002' },
      { id: '3', name: 'Task 3', description: 'SpamExperts', link: 'https://jules.google.com/session/9012941222133762590' },
      { id: '4', name: 'Task 4', description: 'OPNsense', link: 'https://jules.google.com/session/6496604053403795636' },
    ];

    tasks.forEach(task => {
      this.tasks.set(task.id, {
        ...task,
        status: 'Analyzing',
        progress: 0,
        logs: [`[${task.name}] Initializing...`],
        files: [],
      });
    });
  }

  public getTasks(): JulesTask[] {
    return Array.from(this.tasks.values());
  }

  public getTask(id: string): JulesTask | undefined {
    return this.tasks.get(id);
  }

  private startSimulation() {
    setInterval(() => {
      this.tasks.forEach(task => {
        if (task.status === 'Complete' || task.status === 'Error') return;

        const random = Math.random();
        if (random < 0.7) { // 70% chance to update progress and log
          this.updateProgress(task.id);
        } else if (random < 0.85) { // 15% chance to change status
          this.changeStatus(task.id);
        } else { // 15% chance to add a file
          this.addFile(task.id);
        }
      });
    }, 1500);
  }
  
  private updateProgress(id: string) {
    const task = this.tasks.get(id)!;
    if (task.progress >= 100) {
        task.status = 'Complete';
        const log = `[${task.name}] ✅ Task finished.`;
        task.logs.push(log);
        this.emit('update', { ...task });
        this.emit(`log:${id}`, log);
        return;
    }
    
    task.progress = Math.min(100, task.progress + Math.floor(Math.random() * 5) + 1);
    
    const log = this.generateLog(task);
    task.logs.push(log);

    this.emit('update', { ...task });
    this.emit(`log:${id}`, log);
  }

  private changeStatus(id: string) {
    const task = this.tasks.get(id)!;
    const statuses: TaskStatus[] = ['Analyzing', 'Planning', 'Executing', 'Testing'];
    const currentIndex = statuses.indexOf(task.status);
    if (currentIndex < statuses.length - 1) {
      const newStatus = statuses[currentIndex + 1];
      task.status = newStatus;
      const log = `[${task.name}] Changed status to ${newStatus}`;
      task.logs.push(log);
      this.emit('update', { ...task, status: newStatus });
      this.emit(`log:${id}`, log);
    } else {
        this.updateProgress(id); // If already in "Testing", just add progress.
    }
  }

  private addFile(id: string) {
    const task = this.tasks.get(id)!;
    const file = `src/components/${task.description.toLowerCase()}/Component${task.files.length + 1}.tsx`;
    task.files.push(file);
    const log = `[${task.name}] 📄 Modified file: ${file}`;
    task.logs.push(log);
    this.emit('update', { ...task });
    this.emit(`log:${id}`, log);
    this.emit(`file:${id}`, file);
  }

  private generateLog(task: JulesTask): string {
    const logs: string[] = [
        `Reading ${task.description.toLowerCase()}-manager.ts...`,
        `Analyzing API structure...`,
        `Adding new method...`,
        `Writing tests for new method...`,
        `Running tests...`,
        `✅ Build passing`,
        `Refactoring module for better performance.`,
        `Could not find type definition for 'xyz'.`,
        `⚠️ Build has warnings.`,
        `Finalizing changes...`,
    ];
    return `[${task.name}] ${logs[Math.floor(Math.random() * logs.length)]}`;
  }
}

export const julesMonitor = new JulesMonitor();
