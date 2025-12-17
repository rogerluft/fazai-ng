import React, { useRef, useEffect, useState } from 'react';
import { useTaskStore } from '../store';

const LogViewer: React.FC = () => {
  const tasks = useTaskStore((state) => state.tasks);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);

  const allLogs = Object.values(tasks)
    .flatMap(task => task.logs.map(log => ({ log, taskId: task.id, timestamp: Date.now() })))
    .sort((a,b) => a.timestamp - b.timestamp);


  useEffect(() => {
    if (isAutoScrollEnabled && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [allLogs, isAutoScrollEnabled]);

  return (
    <div className="bg-black p-4 rounded-lg shadow-inner h-96 flex flex-col">
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-bold text-white">Live Logs</h3>
            <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={isAutoScrollEnabled}
                    onChange={() => setIsAutoScrollEnabled(!isAutoScrollEnabled)}
                    className="form-checkbox h-5 w-5 text-green-500 bg-gray-800 border-gray-600 rounded focus:ring-green-500"
                />
                <span className="text-sm text-gray-300">Auto-scroll</span>
            </label>
        </div>
      <div ref={logContainerRef} className="flex-grow overflow-y-auto font-mono text-sm text-gray-300">
        {allLogs.map((logEntry, index) => (
          <p key={index} className="whitespace-pre-wrap">
            <span className="text-gray-500 mr-2">{new Date(logEntry.timestamp).toLocaleTimeString()}</span>
            {logEntry.log}
          </p>
        ))}
      </div>
    </div>
  );
};

export default LogViewer;
