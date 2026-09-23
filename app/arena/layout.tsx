import React from 'react';
import { getServerUser } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ArenaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();

  if (!user) {
    redirect('/login?redirect=/arena');
  }

  return <>{children}</>;
}
