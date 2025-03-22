import * as React from 'react';
import { useState, useRef, useEffect } from 'react';

interface Message {
    type: 'user' | 'assistant';
    content: string;
    timestamp: string;
    codeBlocks?: Array<{
        code: string;
        language: string;
        accepted?: boolean;
        rejected?: boolean;
    }>;
}

interface ChatViewProps {
    onSendMessage: (message: string) => void;
    onAcceptCode: (code: string) => void;
    onRejectCode: (code: string) => void;
}

export default function ChatView({ onSendMessage, onAcceptCode, onRejectCode }: ChatViewProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
        adjustTextareaHeight();
    };

    const adjustTextareaHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleSendMessage = () => {
        if (inputValue.trim()) {
            const newMessage: Message = {
                type: 'user',
                content: inputValue,
                timestamp: new Date().toLocaleTimeString()
            };
            setMessages(prev => [...prev, newMessage]);
            onSendMessage(inputValue);
            setInputValue('');
            setIsTyping(true);
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleAcceptCode = (code: string) => {
        onAcceptCode(code);
        const updatedMessages = messages.map(msg => {
            if (msg.codeBlocks) {
                const updatedBlocks = msg.codeBlocks.map(block => {
                    if (block.code === code) {
                        return { ...block, accepted: true, rejected: false };
                    }
                    return block;
                });
                return { ...msg, codeBlocks: updatedBlocks };
            }
            return msg;
        });
        setMessages(updatedMessages);
    };

    const handleRejectCode = (code: string) => {
        onRejectCode(code);
        const updatedMessages = messages.map(msg => {
            if (msg.codeBlocks) {
                const updatedBlocks = msg.codeBlocks.map(block => {
                    if (block.code === code) {
                        return { ...block, rejected: true, accepted: false };
                    }
                    return block;
                });
                return { ...msg, codeBlocks: updatedBlocks };
            }
            return msg;
        });
        setMessages(updatedMessages);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {messages.map((message, index) => (
                    <div
                        key={index}
                        className={`flex ${
                            message.type === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                    >
                        <div
                            className={`max-w-[80%] rounded-lg p-3 ${
                                message.type === 'user'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 text-gray-900'
                            }`}
                        >
                            <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                            {message.codeBlocks?.map((block, blockIndex) => (
                                <div key={blockIndex} className="mt-2">
                                    <pre className="bg-gray-800 text-white p-3 rounded overflow-x-auto">
                                        <code className={`language-${block.language}`}>
                                            {block.code}
                                        </code>
                                    </pre>
                                    {!block.accepted && !block.rejected && (
                                        <div className="flex justify-end mt-2 space-x-2">
                                            <button
                                                onClick={() => handleAcceptCode(block.code)}
                                                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                                            >
                                                Accept
                                            </button>
                                            <button
                                                onClick={() => handleRejectCode(block.code)}
                                                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                    {block.accepted && (
                                        <div className="text-green-500 text-sm mt-1">
                                            ✓ Code accepted
                                        </div>
                                    )}
                                    {block.rejected && (
                                        <div className="text-red-500 text-sm mt-1">
                                            ✕ Code rejected
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div className="text-xs mt-1 opacity-70">{message.timestamp}</div>
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex items-center text-gray-500 text-sm">
                        <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                        AI is typing...
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="border-t p-4">
                <div className="flex items-end space-x-2">
                    <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyPress={handleKeyPress}
                        placeholder="Type your message..."
                        className="flex-grow min-h-[40px] max-h-[200px] p-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={1}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim()}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Send
                    </button>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                    Press Enter to send, Shift + Enter for new line
                </div>
            </div>
        </div>
    );
}
