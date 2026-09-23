import React from 'react';
import { getServerUser } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();

  if (!user) {
    redirect('/login?redirect=/admin');
  }

  if (user.role !== 'ADMIN') {
    if (user.role === 'TEAM_LEADER' || user.role === 'TEAM_MEMBER') {
      redirect('/team');
    }
    redirect('/dashboard');
  }

  return <>{children}</>;
}