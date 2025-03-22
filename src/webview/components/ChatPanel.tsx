import React, { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';

interface Message {
    text: string;
    isUser: boolean;
}

interface ChatPanelProps {
    messages: Message[];
    onSendMessage: (text: string) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage }) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSendMessage(input.trim());
            setInput('');
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const handleTextareaInput = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message, index) => (
                    <div
                        key={index}
                        className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-lg p-3 ${
                                message.isUser
                                    ? 'bg-vscode-button text-vscode-button-fg'
                                    : 'bg-vscode-input-bg'
                            }`}
                        >
                            <div className="whitespace-pre-wrap break-words">
                                {message.text}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSubmit} className="p-4 border-t border-vscode-border">
                <div className="flex items-end gap-2">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onInput={handleTextareaInput}
                        placeholder="Type a message..."
                        className="flex-1 bg-vscode-input-bg text-vscode-input-fg rounded-lg px-4 py-2 resize-none overflow-hidden min-h-[40px] max-h-[200px]"
                        rows={1}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim()}
                        className="p-2 bg-vscode-button text-vscode-button-fg rounded-lg hover:bg-vscode-button-hover disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <PaperAirplaneIcon className="w-5 h-5" />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ChatPanel;
