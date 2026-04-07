import React, { useMemo, useState } from 'react';
import { Bot, MessageSquare, Send, X } from 'lucide-react';
import { aiApi } from '../../services/api.js';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const initialMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Ask anything about Flyxa. I can help with features, workflows, and where to find things.',
};

export default function FlyxaChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);

  const canSend = input.trim() !== '' && !loading;

  const history = useMemo(
    () => messages
      .filter(message => message.id !== initialMessage.id)
      .slice(-6)
      .map(({ role, content }) => ({ role, content })),
    [messages]
  );

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
    };

    setMessages(current => [...current, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await aiApi.flyxaChat(question, history);
      setMessages(current => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.reply,
        },
      ]);
    } catch (error) {
      setMessages(current => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: error instanceof Error
            ? error.message
            : 'Something went wrong. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await sendMessage();
  };

  return (
    <div className="fixed bottom-5 right-5 z-[120] flex flex-col items-end gap-3">
      {open && (
        <div className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/96 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">
                <Bot size={17} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Ask Flyxa</p>
                <p className="text-xs text-slate-500">Product help and quick answers</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-900 hover:text-white"
              aria-label="Close chat"
            >
              <X size={17} />
            </button>
          </div>

          <div className="max-h-[24rem] space-y-3 overflow-y-auto px-4 py-4">
            {messages.map(message => (
              <div
                key={message.id}
                className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-3 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'border border-slate-800 bg-slate-900/85 text-slate-200'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/85 px-3.5 py-3 text-sm text-slate-400">
                  Thinking...
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-800/80 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={event => setInput(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                rows={1}
                placeholder="Ask about Flyxa..."
                className="min-h-[46px] flex-1 resize-none rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-400/70"
              />
              <button
                type="submit"
                disabled={!canSend}
                className="inline-flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-blue-500 text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-950/96 px-4 py-3 text-sm font-medium text-slate-100 shadow-[0_16px_40px_rgba(2,6,23,0.36)] transition-colors hover:border-slate-600 hover:bg-slate-900"
      >
        <MessageSquare size={17} />
        Ask Flyxa
      </button>
    </div>
  );
}
