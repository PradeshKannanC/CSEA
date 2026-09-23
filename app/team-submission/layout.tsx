import React from 'react';
import { getServerUser } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function TeamSubmissionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();

  if (!user) {
    redirect('/login?redirect=/team-submission');
  }

  if (user.role !== 'TEAM_LEADER' && user.role !== 'ADMIN') {
    redirect('/team');
  }

  return <>{children}</>;
}
