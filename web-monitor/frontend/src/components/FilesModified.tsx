import React from 'react';
import { useTaskStore } from '../store';

const FilesModified: React.FC = () => {
    const tasks = useTaskStore(state => Object.values(state.tasks));
    const allFiles = tasks.flatMap(task => task.files);

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg h-full">
            <h3 className="text-lg font-bold text-white mb-4">Files Modified: {allFiles.length}</h3>
            <div className="overflow-y-auto h-48 font-mono text-sm text-gray-300">
                {allFiles.map((file, index) => (
                    <p key={index}>{file}</p>
                ))}
            </div>
        </div>
    );
};

export default FilesModified;
