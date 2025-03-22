import * as React from 'react';

interface AutoDetectToggleProps {
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
}

export default function AutoDetectToggle({ enabled, onToggle }: AutoDetectToggleProps) {
    return (
        <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Auto-Detect</span>
            <button
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    enabled ? 'bg-blue-500' : 'bg-gray-200'
                }`}
                onClick={() => onToggle(!enabled)}
                role="switch"
                aria-checked={enabled}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
            </button>
        </div>
    );
}
