import * as React from 'react';
import { useState, useEffect } from 'react';
import { TestCase } from '../../services/testGenerator';
import TestCaseList from './TestCaseList';
import AutoDetectToggle from './AutoDetectToggle';

declare global {
    interface Window {
        acquireVsCodeApi: () => {
            postMessage: (message: any) => void;
            getState: () => any;
            setState: (state: any) => void;
        };
    }
}

interface Message {
    type: string;
    tests?: TestCase[];
    message?: string;
    loading?: boolean;
}

export const App: React.FC = () => {
    const [tests, setTests] = useState<TestCase[]>([]);
    const [status, setStatus] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [autoDetectEnabled, setAutoDetectEnabled] = useState<boolean>(false);

    useEffect(() => {
        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data as Message;
            
            switch (message.type) {
                case 'testsUpdated':
                    if (message.tests) {
                        setTests(message.tests);
                    }
                    break;
                case 'updateStatus':
                    if (message.message) {
                        setStatus(message.message);
                        setLoading(message.loading || false);
                    }
                    break;
            }
        });
    }, []);

    const handleGenerateTests = () => {
        const vscode = window.acquireVsCodeApi();
        vscode.postMessage({
            type: 'generateTests',
            code: '',  // Current file's code will be fetched by the extension
            language: 'typescript'  // Current file's language will be detected by the extension
        });
    };

    const handleRunTests = () => {
        const vscode = window.acquireVsCodeApi();
        vscode.postMessage({ type: 'runTests' });
    };

    const handleAcceptTest = (testId: string) => {
        const vscode = window.acquireVsCodeApi();
        vscode.postMessage({ type: 'acceptTest', testId });
    };

    const handleRejectTest = (testId: string) => {
        const vscode = window.acquireVsCodeApi();
        vscode.postMessage({ type: 'rejectTest', testId });
    };

    const handleAutoDetectToggle = (enabled: boolean) => {
        setAutoDetectEnabled(enabled);
        const vscode = window.acquireVsCodeApi();
        vscode.postMessage({ type: 'toggleAutoDetect', enabled });
    };

    return (
        <div className="p-4 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-2">
                <button
    className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50"
    onClick={handleGenerateTests}
    disabled={loading}
>
    Generate Tests
</button>

                    <button
                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                        onClick={handleRunTests}
                        disabled={loading || tests.length === 0}
                    >
                        Run Tests
                    </button>
                </div>
                <AutoDetectToggle
                    enabled={autoDetectEnabled}
                    onToggle={handleAutoDetectToggle}
                />
            </div>

            <div className="mb-4">
                <div className="flex items-center">
                    <div className="text-sm text-gray-600">
                        {status}
                    </div>
                    {loading && (
                        <div className="ml-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-grow overflow-auto">
                <TestCaseList
                    tests={tests}
                    onAccept={handleAcceptTest}
                    onReject={handleRejectTest}
                />
            </div>
        </div>
    );
};
