import { prisma } from '../lib/prisma';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000';

async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const sessionToken = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      id: sessionToken,
      userId,
      expiresAt,
    },
  });
  return sessionToken;
}

async function main() {
  console.log('=== STEP 2: TRACE EXACT ENDPOINTS FOR ABC PARTICIPANT ===\n');

  // ABC Participant: Pradesh
  const abcUser = await prisma.user.findFirst({
    where: { email: 'pradesh@student.tce.edu' },
  });
  if (!abcUser) throw new Error('ABC user not found');

  const sessionId = await createSession(abcUser.id);
  const headers = {
    Cookie: `pnp_session=${sessionId}`,
    'Content-Type': 'application/json',
  };

  // 1. GET /api/auth/me
  console.log('--- 1. GET /api/auth/me ---');
  const resAuthMe = await fetch(`${BASE_URL}/api/auth/me`, { headers });
  const dataAuthMe = await resAuthMe.json();
  console.log('Status:', resAuthMe.status);
  console.log('Data:', JSON.stringify(dataAuthMe, null, 2));

  // 2. GET /api/me/context
  console.log('\n--- 2. GET /api/me/context ---');
  const resContext = await fetch(`${BASE_URL}/api/me/context`, { headers });
  const dataContext = await resContext.json();
  console.log('Status:', resContext.status);
  console.log('Data:', JSON.stringify(dataContext, null, 2));

  // 3. GET /api/teams/mine
  console.log('\n--- 3. GET /api/teams/mine ---');
  const resMine = await fetch(`${BASE_URL}/api/teams/mine`, { headers });
  const dataMine = await resMine.json();
  console.log('Status:', resMine.status);
  console.log('Data:', JSON.stringify(dataMine, null, 2));

  // 4. GET /api/ideas
  console.log('\n--- 4. GET /api/ideas ---');
  const resIdeas = await fetch(`${BASE_URL}/api/ideas`, { headers });
  const dataIdeas = await resIdeas.json();
  console.log('Status:', resIdeas.status);
  console.log('Ideas count:', dataIdeas.ideas?.length);
  console.log('Data summary:', {
    success: dataIdeas.success,
    room: dataIdeas.room,
    diagnostics: dataIdeas.diagnostics,
    firstIdea: dataIdeas.ideas?.[0]
      ? {
          id: dataIdeas.ideas[0].id,
          anonymousId: dataIdeas.ideas[0].anonymousId,
          title: dataIdeas.ideas[0].title,
          teamId: dataIdeas.ideas[0].teamId,
          roomId: dataIdeas.ideas[0].roomId,
        }
      : null,
  });

  // Target idea for investment (an approved idea in the same room not belonging to ABC)
  const targetIdea = dataIdeas.ideas?.[0];
  console.log('\nTarget Idea for Investment:', targetIdea ? {
    id: targetIdea.id,
    anonymousId: targetIdea.anonymousId,
    title: targetIdea.title,
    teamId: targetIdea.teamId,
    roomId: targetIdea.roomId,
  } : 'NONE');

  // 5. POST /api/invest
  console.log('\n--- 5. POST /api/invest ---');
  if (targetIdea) {
    const resInvest = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ideaId: targetIdea.id,
        amount: 25,
      }),
    });
    const dataInvest = await resInvest.json();
    console.log('Status:', resInvest.status);
    console.log('Response:', JSON.stringify(dataInvest, null, 2));
  } else {
    console.log('Skipping POST /api/invest: no target idea found.');
  }

  // Cleanup session
  await prisma.session.deleteMany({ where: { id: sessionId } });
  await prisma.$disconnect();
}

main().catch(console.error);
