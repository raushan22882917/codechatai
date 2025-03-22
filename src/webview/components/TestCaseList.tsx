import * as React from 'react';
import { TestCase } from '../../services/testGenerator';

interface TestCaseListProps {
    tests: TestCase[];
    onAccept: (testId: string) => void;
    onReject: (testId: string) => void;
}

export default function TestCaseList({ tests, onAccept, onReject }: TestCaseListProps) {
    const testsByCategory = tests.reduce((acc, test) => {
        if (!acc[test.category]) {
            acc[test.category] = [];
        }
        acc[test.category].push(test);
        return acc;
    }, {} as Record<string, TestCase[]>);

    return (
        <div className="space-y-6">
            {Object.entries(testsByCategory).map(([category, categoryTests]) => (
                <div key={category} className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4">{category}</h3>
                    <div className="space-y-4">
                        {categoryTests.map((test) => (
                            <div key={test.id} className="bg-white p-4 rounded-lg shadow">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium">{test.title}</h4>
                                    <div className="flex items-center space-x-2">
                                        <span className={`px-2 py-1 text-sm rounded ${
                                            test.status === 'passed' ? 'bg-green-100 text-green-800' :
                                            test.status === 'failed' ? 'bg-red-100 text-red-800' :
                                            test.status === 'accepted' ? 'bg-blue-100 text-blue-800' :
                                            test.status === 'rejected' ? 'bg-gray-100 text-gray-800' :
                                            'bg-yellow-100 text-yellow-800'
                                        }`}>
                                            {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
                                        </span>
                                        {test.status === 'pending' && (
                                            <>
                                                <button
                                                    onClick={() => onAccept(test.id)}
                                                    className="p-1 text-green-600 hover:text-green-800"
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    onClick={() => onReject(test.id)}
                                                    className="p-1 text-red-600 hover:text-red-800"
                                                >
                                                    ✕
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="mb-2">
                                    <div className="text-sm text-gray-600">Input:</div>
                                    <div className="font-mono text-sm bg-gray-50 p-2 rounded mt-1">
                                        {test.input}
                                    </div>
                                </div>
                                <div className="mb-2">
                                    <div className="text-sm text-gray-600">Expected Output:</div>
                                    <div className="font-mono text-sm bg-gray-50 p-2 rounded mt-1">
                                        {test.expectedOutput}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-gray-600">Test Code:</div>
                                    <pre className="font-mono text-sm bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                                        {test.code}
                                    </pre>
                                </div>
                                {test.error && (
                                    <div className="mt-2 text-red-600 text-sm">
                                        Error: {test.error}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
