import React from 'react';
import { useTaskStore } from '../store';
import { JulesTask } from '../types';

const Timeline: React.FC = () => {
    const tasks = useTaskStore(state => Object.values(state.tasks));

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
            <h3 className="text-lg font-bold text-white mb-4">Tasks Timeline</h3>
            <div className="space-y-4">
                {tasks.map((task: JulesTask) => (
                    <div key={task.id}>
                        <span className="text-sm font-medium text-gray-300">{task.name}: {task.description}</span>
                        <div className="w-full bg-gray-700 rounded-full h-2.5">
                            <div 
                                className="bg-blue-500 h-2.5 rounded-full" 
                                style={{ width: `${task.progress}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Timeline;
