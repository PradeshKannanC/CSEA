import { prisma } from '../lib/prisma';
import { createDatabaseSession, SESSION_COOKIE_NAME } from '../lib/auth/session';

async function verifyAdminOverview() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('No admin found');
  const sessionId = await createDatabaseSession(admin.id);

  const res = await fetch('http://localhost:3000/api/admin/overview', {
    headers: {
      Cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
    },
  });

  const data = await res.json();
  console.log('HTTP Status:', res.status);
  console.log('Admin Overview Response Success:', data.success);
  console.log('Admin Overview Stats:', JSON.stringify(data.stats, null, 2));

  // Clean up session
  await prisma.session.delete({ where: { id: sessionId } });

  if (!data.success || data.stats.totalDistributedCoins === undefined || data.stats.totalCoinsRemaining === undefined) {
    console.error('FAILED: Missing required stats fields.');
    process.exit(1);
  } else {
    console.log('SUCCESS: All admin overview stats verified correctly.');
    process.exit(0);
  }
}

verifyAdminOverview();
