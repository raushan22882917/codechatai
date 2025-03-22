import React from 'react';
import { DocumentTextIcon } from '@heroicons/react/24/outline';

interface StatusBarProps {
    message: string;
    loading: boolean;
    currentFile: string;
}

const StatusBar: React.FC<StatusBarProps> = ({ message, loading, currentFile }) => {
    return (
        <div className="px-4 py-2 bg-vscode-input-bg border-b border-vscode-border flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
                {loading && (
                    <div className="w-4 h-4 rounded-full border-2 border-vscode-button border-r-transparent animate-spin" />
                )}
                <span>{message || 'Ready'}</span>
            </div>
            {currentFile && (
                <div className="flex items-center gap-2 text-vscode-fg/60">
                    <DocumentTextIcon className="w-4 h-4" />
                    <span className="truncate max-w-[300px]">{currentFile}</span>
                </div>
            )}
        </div>
    );
};

export default StatusBar;
