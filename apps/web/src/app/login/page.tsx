'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login, register } = useAuth();
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isRegister && !name)) {
      toast.error('All fields are required');
      return;
    }
    if (isRegister && !/^[a-zA-Z0-9]+$/.test(password)) {
      toast.error('Password must be alphanumeric only');
      return;
    }
    setLoading(true);
    try {
      if (isRegister) await register(email, password, name, accessCode);
      else await login(email, password);
      toast.success(isRegister ? 'Account created!' : 'Welcome back!');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900 flex items-center justify-center p-6'>
      <div className='bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md'>
        <h1 className='text-3xl font-bold text-white text-center mb-2'>InsightFlow AI</h1>
        <p className='text-purple-200 text-center mb-8'>
          {isRegister ? 'Create your account' : 'Sign in to continue'}</p>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {isRegister && (
            <div>
              <label className='text-purple-200 text-sm block mb-1'>Name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className='w-full bg-white/10 border border-purple-400/30 rounded-xl px-4 py-3 text-white
                  placeholder-purple-300/50 focus:outline-none focus:border-purple-400'
                placeholder='Your name' />
            </div>
          )}
          <div>
            <label className='text-purple-200 text-sm block mb-1'>Email</label>
            <input type='email' value={email} onChange={e => setEmail(e.target.value)}
              className='w-full bg-white/10 border border-purple-400/30 rounded-xl px-4 py-3 text-white
                placeholder-purple-300/50 focus:outline-none focus:border-purple-400'
              placeholder='you@example.com' />
          </div>
          <div>
            <label className='text-purple-200 text-sm block mb-1'>Password</label>
            <div className='relative'>
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                className='w-full bg-white/10 border border-purple-400/30 rounded-xl px-4 py-3 pr-12 text-white
                  placeholder-purple-300/50 focus:outline-none focus:border-purple-400'
                placeholder={isRegister ? 'Alphanumeric (letters & numbers only)' : 'Your password'} />
              <button type='button' onClick={() => setShowPassword(!showPassword)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-purple-300 hover:text-white transition text-lg'>
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          {isRegister && (
            <div>
              <label className='text-purple-200 text-sm block mb-1'>Access Code</label>
              <input value={accessCode} onChange={e => setAccessCode(e.target.value)}
                className='w-full bg-white/10 border border-purple-400/30 rounded-xl px-4 py-3 text-white
                  placeholder-purple-300/50 focus:outline-none focus:border-purple-400'
                placeholder='Enter invite code' />
            </div>
          )}
          <button type='submit' disabled={loading}
            className='w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 rounded-xl
              disabled:opacity-50 transition'>
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p className='text-purple-300 text-center mt-6 text-sm'>
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => setIsRegister(!isRegister)}
            className='text-purple-200 hover:text-white underline font-semibold'>
            {isRegister ? 'Sign In' : 'Register'}
          </button>
        </p>
      </div>
    </div>
  );
}
