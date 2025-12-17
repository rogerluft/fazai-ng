import React from 'react';

const CodePreview: React.FC = () => {
    return (
        <div className="bg-black p-4 rounded-lg shadow-inner h-full">
            <h3 className="text-lg font-bold text-white mb-4">Code Preview</h3>
            <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Select a file to see the diff</p>
            </div>
        </div>
    );
};

export default CodePreview;
