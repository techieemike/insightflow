'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@/context/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { uploadFile, getDatasets, getDataset, getInsights, getChartData, getRecords, getChatHistory, sendChat, exportCsv, exportExcel, exportWord, updateRecord, transformDataset, executeQuery, exportQueryResults } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter, Legend } from 'recharts';
import toast from 'react-hot-toast';

const COLORS = ['#7C3AED','#8B5CF6','#A78BFA','#C4B5FD','#DDD6FE'];
const MAX_MB = 25;

function fmtChart(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(0);
}

type Tab = 'upload' | 'data' | 'insights' | 'query' | 'chat';

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('insights');
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) return <div className='min-h-screen bg-gray-950 text-white flex items-center justify-center'>Loading...</div>;

  return (
    <div className='min-h-screen bg-gray-950 text-white flex'>
      {/* Mobile header */}
      <div className='md:hidden fixed top-0 left-0 right-0 z-30 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 h-14'>
        <button onClick={() => setSidebarOpen(true)} className='text-gray-400 hover:text-white text-2xl' aria-label='Open menu'>☰</button>
        <h1 className='text-lg font-bold text-purple-400'>InsightFlow AI</h1>
        <div className='text-sm text-gray-400 truncate max-w-[100px]'>{user.name}</div>
      </div>

      {/* Backdrop */}
      {sidebarOpen && (
        <div className='md:hidden fixed inset-0 z-40 bg-black/60' onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transform transition-transform duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className='p-6 border-b border-gray-800 flex items-center justify-between'>
          <h1 className='text-xl font-bold text-purple-400'>InsightFlow AI</h1>
          <button onClick={() => setSidebarOpen(false)} className='md:hidden text-gray-400 hover:text-white text-lg' aria-label='Close menu'>✕</button>
        </div>
        <nav className='flex-1 p-4 space-y-1'>
          {[
            { id: 'upload' as Tab, icon: '📤', label: 'Upload' },
            { id: 'data' as Tab, icon: '📋', label: 'My Data' },
            { id: 'insights' as Tab, icon: '📊', label: 'Insights' },
            { id: 'query' as Tab, icon: '🔍', label: 'Query' },
            { id: 'chat' as Tab, icon: '💬', label: 'Chat' },
          ].map(item => (
            <button key={item.id} onClick={() => { setTab(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition
                ${tab === item.id ? 'bg-purple-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className='p-4 border-t border-gray-800'>
          <div className='text-sm text-gray-400 mb-2 truncate'>{user.name}</div>
          <button onClick={logout} className='text-xs text-gray-500 hover:text-red-400 transition'>Logout</button>
        </div>
      </div>

      {/* Content */}
      <div className='flex-1 flex flex-col overflow-hidden md:pt-0 pt-14'>
        {tab === 'upload' && <UploadSection onUpload={(id) => { setSelectedDatasetId(id); setTab('insights'); }} />}
        {tab === 'data' && <DataSection onSelect={(id) => { setSelectedDatasetId(id); setTab('insights'); }} />}
        {tab === 'insights' && <InsightsSection datasetId={selectedDatasetId} onNavigate={(id) => setTab('chat')} />}
        {tab === 'query' && <QuerySection datasetId={selectedDatasetId} />}
        {tab === 'chat' && <ChatSection datasetId={selectedDatasetId} onSwitchDataset={setSelectedDatasetId} />}
      </div>
    </div>
  );
}

function UploadSection({ onUpload }: { onUpload: (id: string) => void }) {
  return (
    <div className='p-4 md:p-8 overflow-y-auto'>
      <h2 className='text-2xl font-bold mb-4 md:mb-6'>Upload Data</h2>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        <UploadColumn
          title='Tabular Data'
          icon='📊'
          description='Upload CSV, TXT, XLSX, or XLS files for AI-powered analysis, charts, and SQL queries.'
          accept={{ 'text/csv': ['.csv'], 'text/plain': ['.txt'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }}
          exts={['.csv', '.txt', '.xlsx', '.xls']}
          onUpload={onUpload}
        />
        <UploadColumn
          title='Documents'
          icon='📄'
          description='Upload PDF or Word documents for AI summarization and Q&A.'
          accept={{ 'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] }}
          exts={['.pdf', '.docx']}
          onUpload={onUpload}
        />
      </div>
    </div>
  );
}

function UploadColumn({ title, icon, description, accept, exts, onUpload: onUploadCb }:
  { title: string; icon: string; description: string; accept: Record<string, string[]>; exts: string[]; onUpload: (id: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState('');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle'|'confirm'|'uploading'|'processing'|'done'>('idle');
  const [preview, setPreview] = useState<any>(null);

  const handleDrop = useCallback((files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) { toast.error(`File too large. Max ${MAX_MB} MB.`); return; }
    setFile(f);
    setDatasetName(f.name.replace(/\.[^.]+$/, ''));
    setStatus('confirm');
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    const name = datasetName.trim();
    if (!name) { toast.error('Please enter a dataset name.'); return; }
    setStatus('uploading'); setProgress(0);
    let simPct = 0;
    const simInterval = setInterval(() => {
      simPct = Math.min(90, simPct + (Math.random() * 8) + 2);
      setProgress(Math.round(simPct));
    }, 400);
    try {
      const { data } = await uploadFile(file, name, pct => { if (pct > 0 && pct > simPct) setProgress(pct); });
      clearInterval(simInterval);
      setProgress(100); setStatus('processing');
      setPreview(data); setStatus('done');
    } catch (err: any) {
      clearInterval(simInterval); setStatus('confirm');
      toast.error(err.response?.data?.message || 'Upload failed');
    }
  }, [file, datasetName]);

  const reset = useCallback(() => { setFile(null); setStatus('idle'); setPreview(null); setProgress(0); setDatasetName(''); }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept,
    maxFiles: 1,
  });

  if (status === 'idle') {
    return (
      <div>
        <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-6 md:p-10 text-center cursor-pointer transition-all h-full
          ${isDragActive ? 'border-purple-300 bg-white/10' : 'border-purple-400/60 bg-white/5 hover:bg-white/10'}`}>
          <input {...getInputProps()} />
          <div className='text-5xl mb-3'>{icon}</div>
          <p className='text-white text-lg font-semibold mb-1'>{isDragActive ? 'Drop it here!' : title}</p>
          <p className='text-gray-400 text-sm mb-4'>{description}</p>
          <div className='flex justify-center gap-2'>
            {exts.map(ext => <span key={ext} className='bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-xs'>{ext}</span>)}
          </div>
          <p className='text-gray-500 text-xs mt-3'>Maximum file size: {MAX_MB} MB</p>
        </div>
      </div>
    );
  }

  if (status === 'confirm' && file) {
    return (
      <div>
        <div className='bg-gray-800 rounded-2xl p-6'>
          <div className='flex items-center gap-3 mb-4'>
            <span className='text-2xl'>{icon}</span>
            <h3 className='text-lg font-bold'>Confirm Upload</h3>
          </div>
          <div className='mb-4'>
            <p className='text-sm text-gray-400 mb-1'>File</p>
            <p className='text-base font-semibold'>{file.name}</p>
            <div className='bg-gray-900 rounded-lg p-3 mt-2'>
              <div className='flex justify-between text-sm'>
                <span className='text-gray-400'>Size</span>
                <span className='text-white font-medium'>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              <div className='bg-gray-800 rounded-full h-1.5 mt-2'>
                <div className='bg-purple-500 h-1.5 rounded-full' style={{ width: `${Math.min(100, (file.size / (MAX_MB * 1024 * 1024)) * 100)}%` }} />
              </div>
              <p className='text-xs text-gray-500 mt-1'>{Math.min(100, Math.round(file.size / (MAX_MB * 1024 * 1024) * 100))}% of {MAX_MB} MB limit</p>
            </div>
          </div>
          <div className='mb-4'>
            <label className='text-sm text-gray-300 block mb-2 font-medium'>Dataset name</label>
            <input value={datasetName} onChange={e => setDatasetName(e.target.value)}
              placeholder='e.g. revenue_2024'
              className='bg-gray-900 border border-gray-600 rounded-xl px-4 py-2.5 text-base text-white w-full focus:outline-none focus:border-purple-500' />
            <p className='text-xs text-gray-500 mt-1'>Used as the identifier in SQL queries</p>
          </div>
          <div className='flex gap-2'>
            <button onClick={handleUpload}
              className='flex-1 bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2.5 rounded-xl transition text-sm'>
              Upload
            </button>
            <button onClick={reset}
              className='bg-gray-700 hover:bg-gray-600 text-gray-300 px-5 py-2.5 rounded-xl transition text-sm'>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className='bg-gray-800 rounded-2xl p-6'>
        {status === 'uploading' && (
          <div className='mb-4'>
            <div className='flex justify-between text-gray-400 text-sm mb-2'><span>Uploading...</span><span>{progress}%</span></div>
            <div className='bg-gray-800 rounded-full h-2'><div className='bg-purple-400 h-2 rounded-full transition-all' style={{ width: `${progress}%` }} /></div>
          </div>
        )}
        {status === 'processing' && <p className='text-center text-gray-400 py-6 animate-pulse'>Processing and generating insights...</p>}
            {preview && (
          <div>
            <div className='flex items-center gap-3 mb-4'>
              <span className='text-2xl'>{icon}</span>
              <h3 className='text-lg font-bold'>Upload Successful</h3>
            </div>
            <div className='grid grid-cols-2 gap-3 mb-4'>
              {(preview.fileType === 'document'
                ? [
                    { label: 'File', value: preview.fileName },
                    { label: 'Words', value: preview.totalRecords?.toLocaleString() },
                    { label: 'Type', value: 'Document' },
                    { label: 'Status', value: 'Ready' },
                  ]
                : [
                    { label: 'File', value: preview.fileName },
                    { label: 'Records', value: preview.totalRecords?.toLocaleString() },
                    { label: 'Columns', value: preview.columns?.length },
                    { label: 'Quality', value: preview.qualityScore != null ? `${preview.qualityScore}/100` : '—' },
                  ]
              ).map((item: any) => (
                <div key={item.label} className='bg-gray-900 rounded-xl p-3'>
                  <div className='text-gray-500 text-xs mb-1'>{item.label}</div>
                  <div className='font-semibold truncate text-sm'>{item.value}</div>
                </div>
              ))}
            </div>
            {preview.fileType === 'document' && preview.insights?.summary && (
              <div className='bg-gray-900 rounded-xl p-3 mb-4'>
                <div className='text-gray-500 text-xs mb-1'>AI Summary</div>
                <p className='text-sm text-gray-200'>{preview.insights.summary}</p>
              </div>
            )}
            {preview.duplicateCount > 0 && (
              <div className='bg-yellow-900/40 border border-yellow-600 rounded-xl p-3 mb-4 text-sm'>
                ⚠ {preview.duplicateCount} duplicate rows detected
              </div>
            )}
            <div className='flex gap-2'>
              <button onClick={() => onUploadCb(preview.datasetId)}
                className='flex-1 bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2.5 rounded-xl transition text-sm'>
                View Insights →
              </button>
              <button onClick={reset}
                className='bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2.5 rounded-xl transition text-sm'>
                Upload Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DataSection({ onSelect }: { onSelect: (id: string) => void }) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [filterCol, setFilterCol] = useState('');
  const [filterVal, setFilterVal] = useState('');
  const [numOp, setNumOp] = useState('eq');
  const [numVal, setNumVal] = useState('');
  const [numVal2, setNumVal2] = useState('');
  const [numericCols, setNumericCols] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editVal, setEditVal] = useState('');
  const [docView, setDocView] = useState<any>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const fetchDatasets = () => getDatasets().then(r => setDatasets(r.data));
  useEffect(() => { fetchDatasets(); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilterDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredDatasets = filterTypes.size > 0
    ? datasets.filter(d => filterTypes.has(d.type))
    : datasets;

  const toggleFilter = (type: string) => {
    setFilterTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const loadRecords = async (id: string, p: number) => {
    const params: any = { page: p, limit: 50, showDuplicates: false };
    if (filterCol && filterVal) { params.column = filterCol; params.value = filterVal; }
    if (filterCol && numericCols.has(filterCol) && numVal) {
      const v = Number(numVal);
      if (!isNaN(v)) {
        if (numOp === 'eq') { params.equalsCol = filterCol; params.equals = numVal; }
        else if (numOp === 'gte') { params.minCol = filterCol; params.min = numVal; }
        else if (numOp === 'gt') { params.minCol = filterCol; params.min = String(v + 0.01); }
        else if (numOp === 'lte') { params.maxCol = filterCol; params.max = numVal; }
        else if (numOp === 'lt') { params.maxCol = filterCol; params.max = String(v - 0.01); }
        else if (numOp === 'range') {
          if (numVal) { params.minCol = filterCol; params.min = numVal; }
          if (numVal2) { params.maxCol = filterCol; params.max = numVal2; }
        }
      }
    }
    const { data } = await getRecords(id, params).catch(() => ({ data: { records: [], total: 0, page: 1, limit: 50, pages: 0 } }));
    setRecords(data.records);
    setTotalPages(data.pages);
    setTotalRecords(data.total);
  };

  const applyFilter = () => { setPage(1); loadRecords(selectedId!, 1); };

  const selectDataset = async (id: string) => {
    setSelectedId(id);
    setDocView(null);
    setPage(1);
    const { data: ds } = await getDataset(id);
    setColumns(ds.columns);
    if (ds.type === 'document') {
      setDocView(ds);
      setRecords([]);
      return;
    }
    const { data: firstPage } = await getRecords(id, { page: 1, limit: 20, showDuplicates: false });
    const numSet = new Set<string>();
    for (const col of ds.columns) {
      const v = firstPage.records[0]?.[col];
      if (v !== undefined && v !== '' && !isNaN(Number(v))) numSet.add(col);
    }
    setNumericCols(numSet);
    loadRecords(id, 1);
  };

  const saveEdit = async (record: any, col: string) => {
    if (!selectedId) return;
    await updateRecord(selectedId, record.__id, { [col]: editVal });
    setEditingCell(null);
    loadRecords(selectedId, page);
  };

  if (selectedId && docView) {
    return (
      <div className='p-4 md:p-8 overflow-y-auto'>
        <div className='flex items-center gap-4 mb-6'>
          <button onClick={() => { setSelectedId(null); setDocView(null); setRecords([]); }} className='text-gray-400 hover:text-white text-sm'>&larr; Back</button>
          <h2 className='text-xl md:text-2xl font-bold truncate'>{docView.originalName}</h2>
          <button onClick={() => onSelect(selectedId)} className='ml-auto bg-purple-700 hover:bg-purple-600 px-4 py-2 rounded-lg text-sm whitespace-nowrap'>View Insights</button>
        </div>
        {docView.insights && (
          <div className='bg-gray-800 rounded-2xl p-6 mb-6'>
            <h3 className='text-lg font-bold mb-3 text-purple-400'>AI Summary</h3>
            <p className='text-gray-200 mb-3'>{docView.insights.summary}</p>
            <div className='space-y-1'>
              {docView.insights.keyPoints?.map((kp: string, i: number) => (
                <div key={i} className='flex gap-2 items-start text-sm'>
                  <span className='text-purple-400 mt-0.5'>•</span>
                  <span className='text-gray-300'>{kp}</span>
                </div>
              ))}
            </div>
            <div className='flex gap-4 mt-4 text-xs text-gray-500'>
              {docView.insights.wordCount != null && <span>{docView.insights.wordCount.toLocaleString()} words</span>}
              {docView.insights.estimatedReadMinutes != null && <span>~{docView.insights.estimatedReadMinutes} min read</span>}
            </div>
          </div>
        )}
        <div className='bg-gray-800 rounded-2xl p-6'>
          <h3 className='text-lg font-bold mb-3 text-purple-400'>Document Preview</h3>
          <div className='bg-gray-900 rounded-xl p-4 text-sm text-gray-300 whitespace-pre-wrap max-h-[600px] overflow-y-auto font-sans leading-relaxed'>
            {docView.contentPreview || 'No preview available.'}
          </div>
          <p className='text-xs text-gray-500 mt-2'>Showing first 1,000 characters</p>
        </div>
      </div>
    );
  }

  if (selectedId) {
    return (
      <div className='p-4 md:p-8 overflow-y-auto'>
        <div className='flex items-center gap-4 mb-6'>
          <button onClick={() => { setSelectedId(null); setRecords([]); }} className='text-gray-400 hover:text-white text-sm'>&larr; Back</button>
          <h2 className='text-xl md:text-2xl font-bold'>Records</h2>
          <button onClick={() => onSelect(selectedId)} className='ml-auto bg-purple-700 hover:bg-purple-600 px-4 py-2 rounded-lg text-sm whitespace-nowrap'>View Insights</button>
        </div>
        <div className='flex gap-3 mb-4 items-end'>
          <div>
            <label className='text-xs text-gray-500 block mb-1'>Filter column</label>
            <select value={filterCol} onChange={e => { setFilterCol(e.target.value); setNumVal(''); setNumVal2(''); setNumOp('eq'); setFilterVal(''); }} className='bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white'>
              <option value=''>None</option>
              {columns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {filterCol && numericCols.has(filterCol) ? (
            <>
              <div>
                <label className='text-xs text-gray-500 block mb-1'>Operator</label>
                <select value={numOp} onChange={e => setNumOp(e.target.value)} className='bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white'>
                  <option value='eq'>=</option>
                  <option value='gt'>&gt;</option>
                  <option value='gte'>&ge;</option>
                  <option value='lt'>&lt;</option>
                  <option value='lte'>&le;</option>
                  <option value='range'>Range</option>
                </select>
              </div>
              <div>
                <label className='text-xs text-gray-500 block mb-1'>{numOp === 'range' ? 'From' : 'Value'}</label>
                <input value={numVal} onChange={e => setNumVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyFilter()} placeholder='0' inputMode='decimal' className='bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white w-28' />
              </div>
              {numOp === 'range' && (
                <div>
                  <label className='text-xs text-gray-500 block mb-1'>To</label>
                  <input value={numVal2} onChange={e => setNumVal2(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyFilter()} placeholder='0' inputMode='decimal' className='bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white w-28' />
                </div>
              )}
            </>
          ) : filterCol ? (
            <div>
              <label className='text-xs text-gray-500 block mb-1'>Value</label>
              <input value={filterVal} onChange={e => setFilterVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyFilter()} placeholder='Search...' className='bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white w-48' />
            </div>
          ) : null}
          <button onClick={applyFilter} className='bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg text-sm'>Apply</button>
          {(filterCol || filterVal) && <span className='text-xs text-gray-400 ml-2'>{totalRecords.toLocaleString()} records</span>}
        </div>
        <div className='overflow-x-auto bg-gray-800 rounded-xl p-4'>
          {records.length === 0 ? (
            <p className='text-gray-400 text-center py-8'>No records match your filters</p>
          ) : (
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-gray-700'>
                  <th className='text-left text-gray-400 px-3 py-2'>#</th>
                  {columns.map(c => <th key={c} className='text-left text-gray-400 px-3 py-2'>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {records.map((r: any, ri: number) => (
                  <tr key={ri} className='border-b border-gray-700/50 hover:bg-gray-700/30'>
                    <td className='px-3 py-2 text-gray-500'>{(page - 1) * 50 + ri + 1}</td>
                    {columns.map(c => {
                      const isEditing = editingCell?.row === ri && editingCell?.col === c;
                      return (
                        <td key={c} className='px-3 py-2'
                          onDoubleClick={() => { setEditingCell({ row: ri, col: c }); setEditVal(String(r[c] ?? '')); }}>
                          {isEditing ? (
                            <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                              onBlur={() => saveEdit(r, c)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(r, c); if (e.key === 'Escape') setEditingCell(null); }}
                              className='bg-gray-700 border border-purple-500 rounded px-2 py-1 text-white w-full text-sm' />
                          ) : (
                            <span className='cursor-pointer hover:text-purple-300'>{String(r[c] ?? '')}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {totalPages > 1 && (
          <div className='flex justify-center gap-2 mt-4'>
            <button disabled={page <= 1} onClick={() => { setPage(p => p - 1); loadRecords(selectedId, page - 1); }} className='bg-gray-800 disabled:opacity-30 px-3 py-1 rounded text-sm'>Prev</button>
            <span className='text-gray-400 text-sm py-1'>Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => { setPage(p => p + 1); loadRecords(selectedId, page + 1); }} className='bg-gray-800 disabled:opacity-30 px-3 py-1 rounded text-sm'>Next</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className='p-4 md:p-8 overflow-y-auto'>
      <div className='flex items-center justify-between mb-4 md:mb-6'>
        <h2 className='text-xl md:text-2xl font-bold'>My Data</h2>
        <div className='relative' ref={filterRef}>
          <button onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className='bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-4 py-2 text-sm flex items-center gap-2'>
            <span>Filter</span>
            {filterTypes.size > 0 && <span className='bg-purple-600 text-white text-xs rounded-full px-2 py-0.5'>{filterTypes.size}</span>}
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' /></svg>
          </button>
          {showFilterDropdown && (
            <div className='absolute right-0 mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl py-2 w-48 z-50'>
              <div className='px-3 py-1.5 text-xs text-gray-500 font-medium'>File type</div>
              {[
                { value: 'tabular', label: 'Tabular (CSV, Excel)', icon: '📊' },
                { value: 'document', label: 'Documents (PDF, Word)', icon: '📄' },
              ].map(opt => {
                const selected = filterTypes.has(opt.value);
                return (
                  <button key={opt.value} onClick={() => toggleFilter(opt.value)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition ${selected ? 'bg-purple-700/30 text-purple-300' : 'text-gray-300 hover:bg-gray-700'}`}>
                    <span className='w-4 h-4 rounded border flex items-center justify-center text-xs'
                      style={{ borderColor: selected ? '#7C3AED' : '#6B7280', background: selected ? '#7C3AED' : 'transparent' }}>
                      {selected && '✓'}
                    </span>
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {datasets.length === 0 ? (
        <div className='text-center text-gray-500 mt-20'>
          <p className='text-4xl mb-4'>📋</p>
          <p>No datasets uploaded yet</p>
          <p className='text-sm mt-2'>Go to Upload to add your first dataset</p>
        </div>
      ) : filteredDatasets.length === 0 ? (
        <div className='text-center text-gray-500 mt-20'>
          <p className='text-4xl mb-4'>🔍</p>
          <p>No datasets match the selected filter</p>
        </div>
      ) : (
        <div className='space-y-3 max-w-4xl'>
          {filteredDatasets.map(d => (
            <div key={d.id} onClick={() => selectDataset(d.id)}
              className='bg-gray-800 hover:bg-gray-750 rounded-xl p-5 cursor-pointer transition border border-gray-700 hover:border-purple-500'>
              <div className='flex justify-between items-center'>
                <div className='flex items-center gap-3'>
                  <span className='text-2xl'>{d.type === 'document' ? '📄' : '📊'}</span>
                  <div>
                    <div className='flex items-center gap-2'>
                      <h3 className='font-semibold'>{d.originalName}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${d.type === 'document' ? 'bg-blue-900/50 text-blue-400' : 'bg-purple-900/50 text-purple-400'}`}>
                        {d.type === 'document' ? 'Document' : 'Tabular'}
                      </span>
                    </div>
                    <p className='text-sm text-gray-400 mt-0.5'>
                      {d.type === 'document' ? `${d.totalRecords?.toLocaleString()} words` : `${d.totalRecords?.toLocaleString()} records`}
                      {d.type === 'tabular' && d.qualityScore != null && ` | Quality: ${d.qualityScore}/100`}
                    </p>
                  </div>
                </div>
                <div className='text-right text-xs text-gray-500 flex items-center gap-2'>
                  {new Date(d.uploadedAt).toLocaleDateString()}
                  <span className={`px-2 py-0.5 rounded ${d.status === 'READY' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>{d.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InsightsSection({ datasetId, onNavigate }: { datasetId: string | null; onNavigate: (id: string) => void }) {
  const [dataset, setDataset] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [excludeDupes, setExcludeDupes] = useState(false);
  const [showTransform, setShowTransform] = useState(false);
  const [transformAction, setTransformAction] = useState('removeDuplicates');
  const [transformCol, setTransformCol] = useState('');
  const [transformFrom, setTransformFrom] = useState('');
  const [transformTo, setTransformTo] = useState('');
  const [transformMsg, setTransformMsg] = useState('');

  useEffect(() => {
    if (!datasetId) { setDataset(null); setInsights(null); setCharts(null); return; }
    Promise.all([getDataset(datasetId), getInsights(datasetId), getChartData(datasetId)])
      .then(([d, i, c]) => { setDataset(d.data); setInsights(i.data); setCharts(c.data); })
      .catch(() => {});
  }, [datasetId]);

  const handleExport = async (format: 'csv' | 'excel' | 'word') => {
    if (!datasetId) return;
    try {
      let data: any;
      let ext: string;
      if (format === 'word') {
        const res = await exportWord(datasetId);
        data = res.data; ext = 'docx';
      } else {
        const fn = format === 'csv' ? exportCsv : exportExcel;
        const res = await fn(datasetId, excludeDupes);
        data = res.data; ext = format === 'csv' ? 'csv' : 'xlsx';
      }
      const url = URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `insightflow-export.${ext}`; a.click();
    } catch { toast.error('Export failed'); }
  };

  if (!datasetId) return (
    <div className='p-4 md:p-8 flex flex-col items-center justify-center h-full text-gray-500'>
      <p className='text-6xl mb-4'>📊</p>
      <p className='text-xl font-semibold'>No dataset selected</p>
      <p className='text-sm mt-2 text-center'>Upload a file or select one from My Data</p>
    </div>
  );

  if (!dataset) return <div className='p-4 md:p-8 flex items-center justify-center text-gray-400'>Loading...</div>;

  if (dataset.type === 'document') {
    const ds = insights || {};
    return (
      <div className='p-4 md:p-8 overflow-y-auto'>
        <div className='flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 md:mb-6'>
          <div>
            <h2 className='text-xl md:text-2xl font-bold'>{dataset.originalName}</h2>
            <p className='text-gray-400 text-sm'>{dataset.totalRecords?.toLocaleString()} words | Document</p>
          </div>
          <div className='flex gap-3'>
            <button onClick={() => onNavigate(datasetId)} className='bg-purple-700 hover:bg-purple-600 px-4 py-2 rounded-lg text-sm'>AI Chat</button>
            <button onClick={() => handleExport('word')} className='bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm'>Word</button>
          </div>
        </div>

        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-6'>
          {[
            { label: 'Words', value: (ds.wordCount || dataset.totalRecords)?.toLocaleString() },
            { label: 'Est. Read Time', value: ds.estimatedReadMinutes ? `~${ds.estimatedReadMinutes} min` : '—' },
            { label: 'Status', value: dataset.status },
            { label: 'Uploaded', value: new Date(dataset.uploadedAt).toLocaleDateString() },
          ].map(s => (
            <div key={s.label} className='bg-gray-800 rounded-xl p-4'>
              <div className='text-gray-400 text-xs mb-1'>{s.label}</div>
              <div className='text-2xl font-bold text-white'>{s.value}</div>
            </div>
          ))}
        </div>

        {ds.summary && (
          <div className='bg-gray-800 rounded-2xl p-6 mb-6'>
            <h3 className='text-lg font-bold mb-4 text-purple-400'>AI Summary</h3>
            <p className='text-gray-200 leading-relaxed'>{ds.summary}</p>
          </div>
        )}

        {ds.keyPoints && ds.keyPoints.length > 0 && (
          <div className='bg-gray-800 rounded-2xl p-6 mb-6'>
            <h3 className='text-lg font-bold mb-4 text-purple-400'>Key Points</h3>
            <div className='space-y-2'>
              {ds.keyPoints.map((kp: string, i: number) => (
                <div key={i} className='flex gap-3 items-start'>
                  <span className='text-purple-400 mt-1'>✦</span>
                  <p className='text-gray-200'>{kp}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {dataset.contentPreview && (
          <div className='bg-gray-800 rounded-2xl p-6'>
            <h3 className='text-lg font-bold mb-4 text-purple-400'>Content Preview</h3>
            <div className='bg-gray-900 rounded-xl p-4 text-sm text-gray-300 whitespace-pre-wrap max-h-[400px] overflow-y-auto font-sans leading-relaxed'>
              {dataset.contentPreview}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className='p-4 md:p-8 overflow-y-auto'>
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 md:mb-6'>
        <div>
          <h2 className='text-xl md:text-2xl font-bold'>{dataset.originalName}</h2>
          <p className='text-gray-400 text-sm'>{dataset.totalRecords?.toLocaleString()} records | {dataset.columns?.length} columns</p>
        </div>
        <div className='flex gap-3'>
          <button onClick={() => onNavigate(datasetId)} className='bg-purple-700 hover:bg-purple-600 px-4 py-2 rounded-lg text-sm'>AI Chat</button>
          <button onClick={() => setShowTransform(!showTransform)} className='bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm'>Transform</button>
          <button onClick={() => handleExport('csv')} className='bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm'>CSV</button>
          <button onClick={() => handleExport('excel')} className='bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm'>Excel</button>
          <button onClick={() => handleExport('word')} className='bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm'>Word</button>
        </div>
      </div>

      <div className='grid grid-cols-2 md:grid-cols-5 gap-4 mb-6'>
        {[
          { label: 'Records', value: dataset.totalRecords?.toLocaleString() },
          { label: 'Columns', value: dataset.columns?.length },
          { label: 'Quality', value: dataset.qualityScore != null ? `${dataset.qualityScore}/100` : '—' },
          { label: 'Duplicates', value: dataset.duplicateCount, warn: dataset.duplicateCount > 0 },
          { label: 'Missing', value: dataset.missingCount },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.warn ? 'bg-yellow-900/40 border border-yellow-600' : 'bg-gray-800'}`}>
            <div className='text-gray-400 text-xs mb-1'>{s.label}</div>
            <div className={`text-2xl font-bold ${s.warn ? 'text-yellow-400' : 'text-white'}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {insights?.keyInsights && (
        <div className='bg-gray-800 rounded-2xl p-6 mb-6'>
          <h3 className='text-lg font-bold mb-4 text-purple-400'>AI Insights</h3>
          <div className='space-y-2'>
            {insights.keyInsights.map((insight: string, i: number) => (
              <div key={i} className='flex gap-3 items-start'>
                <span className='text-purple-400 mt-1'>✦</span>
                <p className='text-gray-200'>{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {insights?.topPerforming && insights.topPerforming.length > 0 && (
        <div className='bg-gray-800 rounded-2xl p-6 mb-6'>
          <h3 className='text-lg font-bold mb-4 text-purple-400'>Top Performers</h3>
          <div className='grid md:grid-cols-2 gap-4'>
            {insights.topPerforming.slice(0, 4).map((tp: any, i: number) => (
              <div key={i} className='bg-gray-900 rounded-xl p-4'>
                <div className='text-gray-400 text-xs mb-1'>{tp.category} → {tp.metric}</div>
                <div className='text-xl font-bold text-purple-300'>{tp.value}</div>
                <div className='text-sm text-gray-400'>Total: {fmtChart(tp.total)} | Avg: {fmtChart(tp.avg)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {charts?.charts && (
        <div className='grid md:grid-cols-2 gap-6 mb-6'>
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
                      {chart.data.map((_: any, j: number) => (
                        <Cell key={j} fill={COLORS[j % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1F2937', border: 'none' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {chart.type === 'scatter' && (
                <ResponsiveContainer width='100%' height={300}>
                  <ScatterChart>
                    <XAxis dataKey='x' name={chart.xKey} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                    <YAxis dataKey='y' name={chart.yKey} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#1F2937', border: 'none' }} />
                    <Scatter data={chart.data} fill='#7C3AED' opacity={0.6} />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
              {chart.type === 'heatmap' && (
                <div className='overflow-x-auto'>
                  <table className='w-full text-xs'>
                    <thead>
                      <tr>
                        <th className='text-left text-gray-400 px-2 py-1'>{chart.xKey}</th>
                        {chart.yKeys.map((yk: string) => (
                          <th key={yk} className='text-right text-gray-400 px-2 py-1'>{yk}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {chart.data.map((row: any, ri: number) => (
                        <tr key={ri}>
                          <td className='text-gray-300 px-2 py-1 font-medium'>{row.name}</td>
                          {chart.yKeys.map((yk: string) => {
                            const val = row[yk] || 0;
                            const maxVal = Math.max(...chart.data.map((r: any) => Math.max(...chart.yKeys.map((k: string) => r[k] || 0))));
                            const intensity = maxVal > 0 ? val / maxVal : 0;
                            return (
                              <td key={yk} className='text-right px-2 py-1 font-mono'
                                style={{ backgroundColor: `rgba(124, 58, 237, ${intensity * 0.6})`, color: intensity > 0.4 ? '#fff' : '#9CA3AF' }}>
                                {val.toLocaleString()}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className='bg-gray-800 rounded-xl p-4 flex items-center gap-4'>
        <label className='flex items-center gap-2 text-sm text-gray-300 cursor-pointer'>
          <input type='checkbox' checked={excludeDupes} onChange={e => setExcludeDupes(e.target.checked)} className='rounded' />
          Exclude duplicates from export
        </label>
        <span className='text-gray-500 text-xs'>({dataset.duplicateCount} duplicates)</span>
      </div>

      {showTransform && (
        <div className='bg-gray-800 rounded-2xl p-6 mt-6'>
          <h3 className='text-lg font-bold mb-4 text-purple-400'>Transform Dataset</h3>
          <div className='flex gap-4 mb-4 items-end'>
            <div>
              <label className='text-xs text-gray-500 block mb-1'>Action</label>
              <select value={transformAction} onChange={e => setTransformAction(e.target.value)} className='bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white'>
                <option value='removeDuplicates'>Remove Duplicates</option>
                <option value='fillMissing'>Fill Missing Values</option>
                <option value='dropColumn'>Drop Column</option>
                <option value='renameColumn'>Rename Column</option>
              </select>
            </div>
            {transformAction === 'dropColumn' && (
              <div>
                <label className='text-xs text-gray-500 block mb-1'>Column to drop</label>
                <select value={transformCol} onChange={e => setTransformCol(e.target.value)} className='bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white'>
                  <option value=''>Select...</option>
                  {(dataset.columns as string[]).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            {transformAction === 'renameColumn' && (
              <>
                <div>
                  <label className='text-xs text-gray-500 block mb-1'>From</label>
                  <select value={transformFrom} onChange={e => setTransformFrom(e.target.value)} className='bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white'>
                    <option value=''>Select...</option>
                    {(dataset.columns as string[]).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className='text-xs text-gray-500 block mb-1'>To</label>
                  <input value={transformTo} onChange={e => setTransformTo(e.target.value)} placeholder='New name' className='bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white' />
                </div>
              </>
            )}
            <button onClick={async () => {
              if (!datasetId) return;
              setTransformMsg('');
              try {
                const params = transformAction === 'dropColumn' ? { column: transformCol } :
                  transformAction === 'renameColumn' ? { from: transformFrom, to: transformTo } : undefined;
                const { data } = await transformDataset(datasetId, transformAction, params);
                setTransformMsg(JSON.stringify(data));
                const { data: ds } = await getDataset(datasetId);
                setDataset(ds);
              } catch (err: any) {
                setTransformMsg('Error: ' + (err.response?.data?.message || err.message));
              }
            }} className='bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg text-sm'>Run</button>
          </div>
          {transformMsg && <p className='text-sm text-gray-300 bg-gray-900 rounded-lg p-3'>{transformMsg}</p>}
        </div>
      )}
    </div>
  );
}

function QuerySection(_props: { datasetId: string | null }) {
  const [allDatasets, setAllDatasets] = useState<any[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [sql, setSql] = useState('');
  const [result, setResult] = useState<{ type: string; columns?: string[]; rows?: any[]; total?: number; affected?: number; preview?: boolean; name?: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCols, setShowCols] = useState(false);
  const [dataset, setDataset] = useState<any>(null);
  const [acSuggestions, setAcSuggestions] = useState<string[]>([]);
  const [acIndex, setAcIndex] = useState(-1);
  const [acPos, setAcPos] = useState<{ top: number; left: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  const fetchAll = () => getDatasets().then(r => setAllDatasets(r.data));
  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (!activeSlug) { setDataset(null); return; }
    const ds = allDatasets.find(d => d.originalName === activeSlug || d.slug === activeSlug);
    if (ds?.id) getDataset(ds.id).then(r => setDataset(r.data));
  }, [activeSlug, allDatasets]);

  const checkAutocomplete = () => {
    const ta = textareaRef.current;
    if (!ta) { setAcSuggestions([]); setAcPos(null); return; }
    const pos = ta.selectionStart;
    const before = sql.slice(0, pos);
    const m = before.match(/(?:FROM|JOIN|INTO|TABLE|UPDATE)\s+(\w*)$/i);
    if (!m) { setAcSuggestions([]); setAcPos(null); return; }
    const partial = m[1].toLowerCase();
    const slugs = allDatasets.map(d => d.slug || '').filter(Boolean);
    const matches = partial ? slugs.filter(s => s.toLowerCase().startsWith(partial)) : slugs;
    if (matches.length === 0) { setAcSuggestions([]); setAcPos(null); return; }

    // compute caret pixel position
    if (mirrorRef.current) {
      const textBefore = sql.slice(0, pos);
      const lineStart = textBefore.lastIndexOf('\n') + 1;
      const lines = textBefore.split('\n');
      const row = lines.length - 1;
      const mirror = mirrorRef.current;
      const span = mirror.children[0] as HTMLElement;
      if (span) {
        span.textContent = sql.slice(lineStart, pos) || '';
      }
      const taRect = ta.getBoundingClientRect();
      const rowHeight = parseInt(getComputedStyle(ta).lineHeight) || 20;
      setAcPos({
        left: taRect.left + (span ? span.offsetWidth : 0) + parseInt(getComputedStyle(ta).paddingLeft) + 4,
        top: taRect.top + row * rowHeight + parseInt(getComputedStyle(ta).paddingTop) + rowHeight + 4,
      });
    }
    setAcSuggestions(matches);
    setAcIndex(0);
  };

  const selectAutocomplete = (slug: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const before = sql.slice(0, pos);
    const m = before.match(/((?:FROM|JOIN|INTO|TABLE|UPDATE)\s+)(\w*)$/i);
    if (!m) return;
    const insertAt = pos - m[2].length;
    const updated = sql.slice(0, insertAt) + slug + sql.slice(pos);
    setSql(updated);
    setAcSuggestions([]);
    setAcPos(null);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(insertAt + slug.length, insertAt + slug.length);
    }, 0);
  };

  const run = async (confirm?: boolean) => {
    let query = sql.trim();
    if (textareaRef.current) {
      const { selectionStart, selectionEnd } = textareaRef.current;
      if (selectionStart !== selectionEnd) {
        query = sql.substring(selectionStart, selectionEnd).trim();
      }
    }
    if (!query) return;
    setError(''); setLoading(true);
    try {
      const { data } = await executeQuery(query, confirm);
      setResult(data);
      fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Query failed');
      setResult(null);
    } finally { setLoading(false); }
  };

  const exportResult = async (format: 'csv' | 'excel') => {
    if (!result?.rows || !result?.columns) return;
    try {
      const { data } = await exportQueryResults(result.columns, result.rows, format);
      const url = URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `query-results.${format === 'csv' ? 'csv' : 'xlsx'}`; a.click();
    } catch { toast.error('Export failed'); }
  };

  const insertSnippet = (snippet: string) => setSql(prev => prev ? prev + '\n' + snippet : snippet);

  const activeDs = allDatasets.find(d => d.originalName === activeSlug || d.slug === activeSlug);

  return (
    <div className='p-4 md:p-8 overflow-y-auto'>
      <div className='flex items-center gap-4 mb-4 flex-wrap'>
        <h2 className='text-xl md:text-2xl font-bold'>SQL Query</h2>
        <select value={activeSlug ?? '_all'} onChange={e => setActiveSlug(e.target.value === '_all' ? null : e.target.value)}
          className='bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white max-w-xs flex-1'>
          <option value='_all'>— All datasets —</option>
          {allDatasets.map(d => <option key={d.id} value={d.slug || d.originalName}>{d.originalName}</option>)}
        </select>
        {activeDs && (
          <span className='text-xs text-gray-500'>{activeDs.totalRecords?.toLocaleString() ?? '—'} records</span>
        )}
        {dataset && (
          <button onClick={() => setShowCols(!showCols)} className='text-xs text-gray-400 hover:text-white transition ml-auto'>
            {showCols ? 'Hide Columns' : 'Show Columns'}
          </button>
        )}
      </div>

      {showCols && dataset?.columns && (
        <div className='bg-gray-800 rounded-xl p-4 mb-4 text-sm'>
          <div className='text-gray-400 mb-2'>Available columns for <strong>{activeSlug}</strong>:</div>
          <div className='flex flex-wrap gap-2'>
            {(dataset.columns as string[]).map((c: string) => (
              <code key={c} className='bg-gray-900 text-purple-300 px-2 py-1 rounded text-xs'>{c}</code>
            ))}
          </div>
        </div>
      )}

      <textarea ref={textareaRef} value={sql} onChange={e => { setSql(e.target.value); setTimeout(checkAutocomplete, 0); }}
        placeholder={'SELECT * FROM dataset_name\nWHERE Revenue > 1000\n\n-- join tables:\nSELECT a.Region, a.Revenue, b.Units_sold\nFROM sales_2024 a\nJOIN units_2024 b ON a.Region = b.Region\n\n-- delete:\nDELETE FROM dataset_name WHERE Revenue = 0\n\n-- drop entire dataset:\nDROP TABLE dataset_name'}
        className='w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white font-mono text-sm focus:outline-none focus:border-purple-500 resize-y min-h-[180px]'
        onKeyDown={e => {
          if (acSuggestions.length > 0) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setAcIndex(i => Math.min(i + 1, acSuggestions.length - 1)); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setAcIndex(i => Math.max(i - 1, 0)); return; }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectAutocomplete(acSuggestions[acIndex]); return; }
            if (e.key === 'Escape') { setAcSuggestions([]); setAcPos(null); return; }
          }
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
        }} />
      <div ref={mirrorRef} className='absolute pointer-events-none opacity-0 font-mono text-sm whitespace-pre-wrap break-words' style={{ width: textareaRef.current?.offsetWidth ?? 600, padding: '16px' }}><span /></div>
      {acSuggestions.length > 0 && acPos && (
        <div className='fixed z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-1 min-w-[160px] max-h-[240px] overflow-y-auto'
          style={{ top: acPos.top, left: acPos.left }}>
          {acSuggestions.map((s, i) => (
            <button key={s} onMouseDown={e => { e.preventDefault(); selectAutocomplete(s); }}
              className={`w-full text-left px-4 py-1.5 text-sm font-mono transition ${i === acIndex ? 'bg-purple-700 text-white' : 'text-gray-200 hover:bg-gray-800'}`}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className='flex gap-2 mt-3 flex-wrap'>
        <button onClick={() => run()} disabled={loading || !sql.trim()}
          className='bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2'>
          {loading ? 'Running...' : '▶ Run'}
        </button>
        {activeDs && (
          <button onClick={() => insertSnippet(`SELECT * FROM ${activeDs.slug || activeDs.originalName}`)} className='bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-xs'>SELECT *</button>
        )}
        <button onClick={() => insertSnippet('WHERE col > 100')} className='bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-xs'>WHERE</button>
        <button onClick={() => insertSnippet('ORDER BY col DESC')} className='bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-xs'>ORDER BY</button>
        <button onClick={() => insertSnippet('GROUP BY col')} className='bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-xs'>GROUP BY</button>
        {activeDs && (
          <button onClick={() => insertSnippet(`DELETE FROM ${activeDs.slug || activeDs.originalName} WHERE col = value`)} className='bg-red-900/40 hover:bg-red-900/60 px-3 py-2 rounded-lg text-xs text-red-300'>DELETE</button>
        )}
      </div>

      {error && (
        <div className='bg-red-900/40 border border-red-600 rounded-xl p-4 mt-4 text-sm text-red-300 font-mono whitespace-pre-wrap'>{error}</div>
      )}

      {result && result.type === 'DROP' && (
        <div className={`rounded-xl p-4 mt-4 text-sm ${result.preview ? 'bg-yellow-900/40 border border-yellow-600' : 'bg-green-900/40 border border-green-600'}`}>
          {result.preview ? (
            <div className='flex items-center justify-between'>
              <span>⚠ This will <strong>DROP</strong> dataset &quot;{result.name}&quot; ({result.affected?.toLocaleString()} records)</span>
              <button onClick={() => run(true)} disabled={loading}
                className='bg-red-600 hover:bg-red-500 disabled:opacity-40 px-4 py-2 rounded-lg text-sm font-semibold'>Confirm Drop</button>
            </div>
          ) : (
            <span>✓ Dropped dataset &quot;{result.name}&quot; ({result.affected?.toLocaleString()} records)</span>
          )}
        </div>
      )}

      {result && result.type === 'DELETE' && (
        <div className={`rounded-xl p-4 mt-4 text-sm ${result.preview ? 'bg-yellow-900/40 border border-yellow-600' : 'bg-green-900/40 border border-green-600'}`}>
          {result.preview ? (
            <div className='flex items-center justify-between'>
              <span>⚠ This will <strong>DELETE</strong> {result.affected?.toLocaleString()} records</span>
              <button onClick={() => run(true)} disabled={loading}
                className='bg-red-600 hover:bg-red-500 disabled:opacity-40 px-4 py-2 rounded-lg text-sm font-semibold'>Confirm Deletion</button>
            </div>
          ) : (
            <span>✓ Deleted {result.affected?.toLocaleString()} records</span>
          )}
        </div>
      )}

      {result && result.type === 'SELECT' && result.rows && (
        <div className='mt-4'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm text-gray-400'>{result.total?.toLocaleString()} rows returned</span>
            <div className='flex gap-2'>
              <button onClick={() => exportResult('csv')} className='bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded text-xs'>CSV</button>
              <button onClick={() => exportResult('excel')} className='bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded text-xs'>Excel</button>
            </div>
          </div>
          <div className='overflow-x-auto bg-gray-800 rounded-xl p-4'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-gray-700'>
                  {result.columns?.map((c: string) => <th key={c} className='text-left text-gray-400 px-3 py-2 font-medium'>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row: any, i: number) => (
                  <tr key={i} className='border-b border-gray-700/50 hover:bg-gray-700/30'>
                    {result.columns?.map((c: string) => (
                      <td key={c} className='px-3 py-2 text-gray-200'>{String(row[c] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatSection({ datasetId, onSwitchDataset }: { datasetId: string | null; onSwitchDataset: (id: string) => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [datasetInfo, setDatasetInfo] = useState<{ id: string; originalName: string; totalRecords: number; slug: string; type: string } | null>(null);
  const [allDatasets, setAllDatasets] = useState<any[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getDatasets().then(r => setAllDatasets(r.data));
  }, []);

  useEffect(() => {
    if (!datasetId) { setMessages([]); setDatasetInfo(null); return; }
    getChatHistory(datasetId).then(r => setMessages(r.data));
    getDataset(datasetId).then(r => setDatasetInfo({ id: r.data.id, originalName: r.data.originalName, totalRecords: r.data.totalRecords, slug: r.data.slug, type: r.data.type })).catch(() => setDatasetInfo(null));
  }, [datasetId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading || !datasetId) return;
    const question = input.trim(); setInput('');
    setMessages(m => [...m, { role: 'user', content: question }]);
    setLoading(true);
    try {
      const { data } = await sendChat(datasetId, question);
      setMessages(m => [...m, { role: 'assistant', content: data.answer }]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to get answer');
    } finally { setLoading(false); }
  };

  const isDocument = datasetInfo?.type === 'document';
  const docSuggestions = ['Summarize this document.', 'What are the key takeaways?', 'Explain the main argument.', 'List important data points from this document.'];
  const tabularSuggestions = ['Which category performs best?', 'Summarize this dataset.', 'What trends exist?', 'Are there any anomalies?'];

  if (!datasetId) return (
    <div className='p-4 md:p-8 flex flex-col items-center justify-center h-full text-gray-500'>
      <p className='text-6xl mb-4'>💬</p>
      <p className='text-xl font-semibold text-center'>No dataset selected</p>
      <p className='text-sm mt-2 text-center'>Select a dataset from My Data or upload one to start chatting</p>
    </div>
  );

  return (
    <div className='flex flex-col h-full'>
      <div className='bg-gray-900 border-b border-gray-800 px-6 py-4'>
        <div className='flex items-center justify-between gap-4'>
          <h2 className='text-lg font-bold text-purple-400 whitespace-nowrap'>AI {isDocument ? 'Document' : 'Data'} Chat</h2>
          <select value={datasetInfo?.id ?? ''} onChange={e => onSwitchDataset(e.target.value)}
            className='bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white flex-1 max-w-xs'>
            {allDatasets.map(d => (
              <option key={d.id} value={d.id}>{d.originalName || d.slug}</option>
            ))}
          </select>
        </div>
        {datasetInfo && (
          <p className='text-xs text-gray-500 mt-1'>{datasetInfo.originalName} &middot; {datasetInfo.totalRecords?.toLocaleString()} {isDocument ? 'words' : 'records'} &middot; <span className={isDocument ? 'text-blue-400' : 'text-purple-400'}>{isDocument ? 'Document' : 'Tabular'}</span></p>
        )}
      </div>
      <div className='flex-1 overflow-y-auto p-6 space-y-4'>
        {messages.length === 0 && (
          <div className='text-center text-gray-500 mt-10'>
            <p className='mb-2'>Ask anything about this {isDocument ? 'document' : 'dataset'}</p>
            <div className='grid grid-cols-1 gap-2 max-w-md mx-auto'>
              {(isDocument ? docSuggestions : tabularSuggestions).map(s => (
                <button key={s} onClick={() => setInput(s)}
                  className='text-left bg-gray-800 hover:bg-gray-700 px-4 py-3 rounded-xl text-sm text-gray-300 transition'>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] sm:max-w-xl px-4 py-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-100'}`}>{msg.role === 'user' ? msg.content : <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({ children }) => <p className='mb-2 last:mb-0'>{children}</p>, ul: ({ children }) => <ul className='list-disc pl-5 mb-2 space-y-1'>{children}</ul>, ol: ({ children }) => <ol className='list-decimal pl-5 mb-2 space-y-1'>{children}</ol>, li: ({ children }) => <li>{children}</li>, strong: ({ children }) => <strong className='font-bold text-purple-300'>{children}</strong>, h1: ({ children }) => <h1 className='text-lg font-bold mb-2 mt-3'>{children}</h1>, h2: ({ children }) => <h2 className='text-base font-bold mb-2 mt-3 text-purple-400'>{children}</h2>, h3: ({ children }) => <h3 className='text-sm font-semibold mb-1 mt-2 text-purple-300'>{children}</h3>, code: ({ children }) => <code className='bg-gray-900 px-1.5 py-0.5 rounded text-xs font-mono text-purple-200'>{children}</code>, pre: ({ children }) => <pre className='bg-gray-900 rounded-xl p-3 mb-2 overflow-x-auto text-xs font-mono'>{children}</pre>, a: ({ children, href }) => <a href={href} className='text-purple-400 underline' target='_blank'>{children}</a> }}>{msg.content}</ReactMarkdown>}</div>
          </div>
        ))}
        {loading && <div className='flex justify-start'><div className='bg-gray-800 px-4 py-3 rounded-2xl text-sm text-gray-400 animate-pulse'>Thinking...</div></div>}
        <div ref={bottomRef} />
      </div>
      <div className='bg-gray-900 border-t border-gray-800 p-4'>
        <div className='flex gap-3'>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
            placeholder='Ask about your data...'
            className='flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500' />
          <button onClick={send} disabled={loading}
            className='bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-50 transition'>Send</button>
        </div>
      </div>
    </div>
  );
}
