import { useTaskStore } from './store';
import { useTaskStream } from './hooks/useTaskStream';
import { useNotifications } from './hooks/useNotifications';
import TaskCard from './components/TaskCard';
import LogViewer from './components/LogViewer';
import Timeline from './components/Timeline';
import FilesModified from './components/FilesModified';
import CodePreview from './components/CodePreview';

const TASK_IDS = ['2', '3', '4'];

function App() {
  useTaskStream(TASK_IDS);
  useNotifications();
  const tasks = useTaskStore((state) => state.tasks);

  return (
    <div className="bg-gray-900 min-h-screen text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">FazAI - Multi-Task Monitor</h1>
          <p className="text-gray-400">Real-time progress of Jules sessions</p>
        </header>

        <main>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {TASK_IDS.map(id => (
              <TaskCard key={id} task={tasks[id]} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <Timeline />
            <FilesModified />
          </div>

          <div className="grid grid-cols-1 gap-8">
            <LogViewer />
            <CodePreview />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
