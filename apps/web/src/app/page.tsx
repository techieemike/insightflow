'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/dashboard' : '/login');
  }, [user, loading, router]);

  return (
    <div className='min-h-screen bg-gray-950 flex items-center justify-center'>
      <div className='animate-pulse text-purple-400 text-lg'>Loading...</div>
    </div>
  );
}
  