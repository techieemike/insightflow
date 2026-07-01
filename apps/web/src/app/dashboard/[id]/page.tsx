'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getDataset, getInsights, getChartData, exportCsv, exportExcel } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
         LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import toast from 'react-hot-toast';

const COLORS = ['#7C3AED','#8B5CF6','#A78BFA','#C4B5FD','#DDD6FE'];

export default function DashboardPage() {
  const params = useParams();
  const id = params.id as string;
  const [dataset, setDataset] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [excludeDupes, setExcludeDupes] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDataset(id).then(d => setDataset(d.data)).catch(() => setDataset(null));
    getInsights(id).then(i => setInsights(i.data)).catch(() => setInsights(null));
    getChartData(id).then(c => setCharts(c.data)).catch(() => setCharts(null));
  }, [id]);

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      const fn = format === 'csv' ? exportCsv : exportExcel;
      const { data } = await fn(id, excludeDupes);
      const url = URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `insightflow-export.${format === 'csv' ? 'csv' : 'xlsx'}`;
      a.click();
    } catch { toast.error('Export failed'); }
  };

  if (!dataset) return <div className='min-h-screen bg-gray-950 text-white flex items-center justify-center'>Loading dashboard...</div>;

  return (
    <div className='min-h-screen bg-gray-950 text-white p-6'>
      <div className='max-w-7xl mx-auto'>
        <div className='flex items-center justify-between mb-8'>
          <div>
            <h1 className='text-3xl font-bold text-purple-400'>InsightFlow AI</h1>
            <p className='text-gray-400'>{dataset.originalName}</p>
          </div>
          <div className='flex gap-3'>
            <a href={`/chat/${id}`} className='bg-purple-700 hover:bg-purple-600 px-4 py-2 rounded-lg text-sm'>AI Chat</a>
            <button onClick={() => handleExport('csv')} className='bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm'>Export CSV</button>
            <button onClick={() => handleExport('excel')} className='bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm'>Export Excel</button>
          </div>
        </div>

        <div className='grid grid-cols-2 md:grid-cols-5 gap-4 mb-8'>
          {[
            { label: 'Total Records', value: dataset.totalRecords?.toLocaleString() },
            { label: 'Columns', value: dataset.columns?.length },
            { label: 'Quality Score', value: `${dataset.qualityScore}/100` },
            { label: 'Duplicates', value: dataset.duplicateCount, warn: dataset.duplicateCount > 0 },
            { label: 'Missing Values', value: dataset.missingCount },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-4 ${s.warn ? 'bg-yellow-900/40 border border-yellow-600' : 'bg-gray-800'}`}>
              <div className='text-gray-400 text-xs mb-1'>{s.label}</div>
              <div className={`text-2xl font-bold ${s.warn ? 'text-yellow-400' : 'text-white'}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {insights && (
          <div className='bg-gray-800 rounded-2xl p-6 mb-8'>
            <h2 className='text-xl font-bold mb-4 text-purple-400'>AI Insights</h2>
            <div className='space-y-3'>
              {(insights.keyInsights || []).map((insight: string, i: number) => (
                <div key={i} className='flex gap-3 items-start'>
                  <span className='text-purple-400 mt-1'>✦</span>
                  <p className='text-gray-200'>{insight}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {charts?.charts && (
          <div className='grid md:grid-cols-2 gap-6 mb-8'>
            {charts.charts.map((chart: any, i: number) => (
              <div key={i} className={`bg-gray-800 rounded-2xl p-6 ${['line','heatmap','scatter'].includes(chart.type) ? 'md:col-span-2' : ''}`}>
                <h3 className='font-bold mb-4 text-purple-300'>{chart.title}</h3>
                {chart.type === 'bar' && (
                  <ResponsiveContainer width='100%' height={250}>
                    <BarChart data={chart.data}>
                      <XAxis dataKey='name' tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#1F2937', border: 'none' }} />
                      <Bar dataKey={chart.dataKey} fill='#7C3AED' radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {chart.type === 'line' && (
                  <ResponsiveContainer width='100%' height={250}>
                    <LineChart data={chart.data}>
                      <XAxis dataKey='name' tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#1F2937', border: 'none' }} />
                      <Line type='monotone' dataKey='value' stroke='#7C3AED' strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                {chart.type === 'pie' && (
                  <ResponsiveContainer width='100%' height={250}>
                    <PieChart>
                      <Pie data={chart.data} dataKey='sum' nameKey='name' cx='50%' cy='50%' outerRadius={80} label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                        {chart.data.map((_: any, j: number) => <Cell key={j} fill={COLORS[j % COLORS.length]} />)}
                      </Pie>
                      <Legend />
                      <Tooltip contentStyle={{ background: '#1F2937', border: 'none' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            ))}
          </div>
        )}

        <div className='bg-gray-800 rounded-2xl p-4 flex items-center gap-4'>
          <label className='flex items-center gap-2 text-sm text-gray-300 cursor-pointer'>
            <input type='checkbox' checked={excludeDupes} onChange={e => setExcludeDupes(e.target.checked)} className='rounded' />
            Exclude duplicates from export
          </label>
          <span className='text-gray-500 text-xs'>({dataset.duplicateCount} duplicates)</span>
        </div>
      </div>
    </div>
  );
}