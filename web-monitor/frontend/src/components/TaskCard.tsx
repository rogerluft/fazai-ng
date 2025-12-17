import React from 'react';
import { JulesTask } from '../types';

interface TaskCardProps {
  task: JulesTask;
}

const getStatusColor = (status: JulesTask['status']) => {
    switch (status) {
        case 'Executing':
            return 'text-blue-400';
        case 'Planning':
            return 'text-yellow-400';
        case 'Testing':
            return 'text-purple-400';
        case 'Complete':
            return 'text-green-400';
        case 'Error':
            return 'text-red-400';
        default:
            return 'text-gray-400';
    }
}

const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  if (!task) {
    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg animate-pulse">
            <div className="h-6 bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2 mb-4"></div>
            <div className="w-full bg-gray-700 h-4 rounded-full mb-2">
                <div className="bg-gray-600 h-4 rounded-full"></div>
            </div>
            <div className="h-4 bg-gray-700 rounded w-1/4"></div>
        </div>
    );
  }

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col h-full">
      <h3 className="text-lg font-bold text-white truncate">{task.name}: {task.description}</h3>
      <a href={task.link} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:underline mb-3">
        Jules Session
      </a>
      
      <div className="flex-grow">
          <div className="w-full bg-gray-700 rounded-full h-4 mb-2">
            <div
              className="bg-green-500 h-4 rounded-full transition-all duration-500"
              style={{ width: `${task.progress}%` }}
            ></div>
          </div>
          <p className="text-sm mb-2">{task.progress}%</p>
          <p className={`text-sm font-semibold ${getStatusColor(task.status)}`}>{task.status}</p>
      </div>

    </div>
  );
};

export default TaskCard;
