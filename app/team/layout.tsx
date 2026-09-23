import React from 'react';
import { getServerUser } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();

  if (!user) {
    redirect('/login?redirect=/team');
  }

  if (user.role === 'ADMIN') {
    redirect('/admin');
  }

  return <>{children}</>;
}
