'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { sendChat, getChatHistory } from '@/lib/api';

export default function ChatPage() {
  const params = useParams();
  const id = params.id as string;
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    getChatHistory(id).then(r => setMessages(r.data));
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');
    setMessages(m => [...m, { role: 'user', content: question }]);
    setLoading(true);
    try {
      const { data } = await sendChat(id, question);
      setMessages(m => [...m, { role: 'assistant', content: data.answer }]);
    } finally { setLoading(false); }
  };

  const suggestions = [
    'Which category performs best?',
    'What trends exist in this data?',
    'Summarize this dataset.',
    'Which records are anomalies?',
    'Compare performance across groups.',
  ];

  return (
    <div className='min-h-screen bg-gray-950 text-white flex flex-col'>
      <div className='bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4'>
        <a href={`/dashboard/${id}`} className='text-gray-400 hover:text-white'>← Back</a>
        <h1 className='text-lg font-bold text-purple-400'>AI Data Chat</h1>
      </div>

      <div className='flex-1 overflow-y-auto p-6 space-y-4 max-w-3xl mx-auto w-full'>
        {messages.length === 0 && (
          <div>
            <p className='text-gray-400 text-center mb-6'>Ask anything about your dataset</p>
            <div className='grid grid-cols-1 gap-2'>
              {suggestions.map(s => (
                <button key={s} onClick={() => setInput(s)}
                  className='text-left bg-gray-800 hover:bg-gray-700 px-4 py-3 rounded-xl text-sm text-gray-300 transition'>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xl px-4 py-3 rounded-2xl text-sm
              ${msg.role === 'user' ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-100'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className='flex justify-start'>
            <div className='bg-gray-800 px-4 py-3 rounded-2xl text-sm text-gray-400 animate-pulse'>Thinking...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className='bg-gray-900 border-t border-gray-800 p-4 max-w-3xl mx-auto w-full'>
        <div className='flex gap-3'>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder='Ask about your data...'
            className='flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
              text-white placeholder-gray-500 focus:outline-none focus:border-purple-500' />
          <button onClick={send} disabled={loading}
            className='bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl
              font-semibold disabled:opacity-50 transition'>Send</button>
        </div>
      </div>
    </div>
  );
}