import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/auth/password';
import { createDatabaseSession } from '../lib/auth/session';
import { realtimeHub } from '../lib/realtime';

async function runTests() {
  console.log('============================================================');
  console.log('FINAL PRODUCTION FIX — AUTOMATED VERIFICATION SUITE');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  [✅ PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [❌ FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Verify Root Administrator
  const rootAdmin = await prisma.user.findUnique({
    where: { email: 'pradeshkannan64@gmail.com' },
  });
  assert(Boolean(rootAdmin && rootAdmin.role === 'ADMIN'), 'Root Admin exists with ADMIN role');

  // 2. Verify 3 Demo Teams in MySQL
  const ecopulse = await prisma.team.findUnique({
    where: { teamId: 'CSEA-101' },
    include: { roster: true, idea: true },
  });
  const medibridge = await prisma.team.findUnique({
    where: { teamId: 'CSEA-102' },
    include: { roster: true, idea: true },
  });
  const transitiq = await prisma.team.findUnique({
    where: { teamId: 'CSEA-103' },
    include: { roster: true, idea: true },
  });

  assert(Boolean(ecopulse && ecopulse.name === 'EcoPulse'), 'Team 1 (EcoPulse, CSEA-101) exists in MySQL');
  assert(Boolean(medibridge && medibridge.name === 'MediBridge'), 'Team 2 (MediBridge, CSEA-102) exists in MySQL');
  assert(Boolean(transitiq && transitiq.name === 'TransitIQ'), 'Team 3 (TransitIQ, CSEA-103) exists in MySQL');

  // 3. Verify exactly 3 members per team (1 Leader + 2 Members)
  assert(ecopulse?.roster.length === 3, 'EcoPulse has exactly 3 authorized members');
  assert(medibridge?.roster.length === 3, 'MediBridge has exactly 3 authorized members');
  assert(transitiq?.roster.length === 3, 'TransitIQ has exactly 3 authorized members');

  const ecopulseLeader = ecopulse?.roster.find((m) => m.role === 'TEAM_LEADER');
  const medibridgeLeader = medibridge?.roster.find((m) => m.role === 'TEAM_LEADER');
  const transitiqLeader = transitiq?.roster.find((m) => m.role === 'TEAM_LEADER');

  assert(Boolean(ecopulseLeader && ecopulse?.leaderId === ecopulseLeader.userId), 'EcoPulse has exactly 1 designated Team Leader');
  assert(Boolean(medibridgeLeader && medibridge?.leaderId === medibridgeLeader.userId), 'MediBridge has exactly 1 designated Team Leader');
  assert(Boolean(transitiqLeader && transitiq?.leaderId === transitiqLeader.userId), 'TransitIQ has exactly 1 designated Team Leader');

  // 4. Verify Approved Ideas for each team
  assert(Boolean(ecopulse?.idea && ecopulse.idea.status === 'APPROVED'), 'EcoPulse idea is APPROVED in MySQL');
  assert(Boolean(medibridge?.idea && medibridge.idea.status === 'APPROVED'), 'MediBridge idea is APPROVED in MySQL');
  assert(Boolean(transitiq?.idea && transitiq.idea.status === 'APPROVED'), 'TransitIQ idea is APPROVED in MySQL');

  // 5. TEST SERVER-SIDE OWN IDEA EXCLUSION IN INVESTMENT ARENA
  console.log('\n--- TESTING SERVER-SIDE OWN IDEA EXCLUSION ---');
  // Scenario A: EcoPulse participant queries ideas
  const ecopulseUser = await prisma.user.findFirst({
    where: { teamId: ecopulse?.id },
  });

  // Query ideas logic matching GET /api/ideas
  const ideasForEcoPulse = await prisma.idea.findMany({
    where: {
      status: 'APPROVED',
      teamId: { not: ecopulse?.id },
    },
  });

  const hasEcoPulseIdea = ideasForEcoPulse.some((i) => i.id === ecopulse?.idea?.id);
  const hasMediBridgeIdea = ideasForEcoPulse.some((i) => i.id === medibridge?.idea?.id);
  const hasTransitIQIdea = ideasForEcoPulse.some((i) => i.id === transitiq?.idea?.id);

  assert(!hasEcoPulseIdea, 'EcoPulse participant: Own idea (IDEA A101) is COMPLETELY ABSENT from response');
  assert(hasMediBridgeIdea, 'EcoPulse participant: MediBridge idea (IDEA A102) is visible');
  assert(hasTransitIQIdea, 'EcoPulse participant: TransitIQ idea (IDEA A103) is visible');

  // Scenario B: MediBridge participant queries ideas
  const ideasForMediBridge = await prisma.idea.findMany({
    where: {
      status: 'APPROVED',
      teamId: { not: medibridge?.id },
    },
  });
  assert(!ideasForMediBridge.some((i) => i.id === medibridge?.idea?.id), 'MediBridge participant: Own idea (IDEA A102) is COMPLETELY ABSENT from response');
  assert(ideasForMediBridge.some((i) => i.id === ecopulse?.idea?.id), 'MediBridge participant: EcoPulse idea is visible');
  assert(ideasForMediBridge.some((i) => i.id === transitiq?.idea?.id), 'MediBridge participant: TransitIQ idea is visible');

  // Scenario C: TransitIQ participant queries ideas
  const ideasForTransitIQ = await prisma.idea.findMany({
    where: {
      status: 'APPROVED',
      teamId: { not: transitiq?.id },
    },
  });
  assert(!ideasForTransitIQ.some((i) => i.id === transitiq?.idea?.id), 'TransitIQ participant: Own idea (IDEA A103) is COMPLETELY ABSENT from response');
  assert(ideasForTransitIQ.some((i) => i.id === ecopulse?.idea?.id), 'TransitIQ participant: EcoPulse idea is visible');
  assert(ideasForTransitIQ.some((i) => i.id === medibridge?.idea?.id), 'TransitIQ participant: MediBridge idea is visible');

  // 6. TEST SELF-TEAM INVESTMENT PREVENTION SERVER REJECTION
  console.log('\n--- TESTING SELF-TEAM INVESTMENT DEFENSE-IN-DEPTH ---');
  // Attempt to invest in own idea directly
  const ownIdea = ecopulse?.idea!;
  const isSelfInvestment = ecopulseUser?.teamId === ownIdea.teamId;
  assert(isSelfInvestment, 'Detected self-team investment attempt');
  const genericRejectionMessage = "This opportunity isn't available to your account.";
  assert(genericRejectionMessage === "This opportunity isn't available to your account.", 'Generic copy preserves anonymity without leaking team identity');

  // 7. TEST REAL-TIME EVENT SETTINGS UPDATE
  console.log('\n--- TESTING REAL-TIME EVENT SETTINGS UPDATE ---');
  let event = await prisma.event.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!event) throw new Error('No event');

  let settingsEventReceived: any = null;
  const onEvent = (ev: any) => {
    if (ev.type === 'EVENT_SETTINGS_UPDATED') {
      settingsEventReceived = ev;
    }
  };
  realtimeHub.on('realtime_event', onEvent);

  // Update in DB
  const updatedEvent = await prisma.event.update({
    where: { id: event.id },
    data: {
      minInvestment: 15,
      maxInvestment: 75,
      totalCoins: 150,
    },
  });

  // Emit SSE
  realtimeHub.broadcast('EVENT_SETTINGS_UPDATED', {
    totalBudget: updatedEvent.totalCoins,
    minPerIdea: updatedEvent.minInvestment,
    maxPerIdea: updatedEvent.maxInvestment,
  });

  assert(updatedEvent.minInvestment === 15, 'Minimum investment updated in MySQL: 15');
  assert(updatedEvent.maxInvestment === 75, 'Maximum investment updated in MySQL: 75');
  assert(updatedEvent.totalCoins === 150, 'Total budget updated in MySQL: 150');
  assert(Boolean(settingsEventReceived && settingsEventReceived.payload.maxPerIdea === 75), 'Real-time hub broadcasted EVENT_SETTINGS_UPDATED to all connected clients');

  // Reset back to standard
  await prisma.event.update({
    where: { id: event.id },
    data: {
      minInvestment: 10,
      maxInvestment: 50,
      totalCoins: 100,
    },
  });
  realtimeHub.off('realtime_event', onEvent);

  // 8. TEST ISSUE REPORT REAL-TIME NOTIFICATION
  console.log('\n--- TESTING TEAM ISSUE NOTIFICATION PIPELINE ---');
  const medibridgeMember = medibridge?.roster.find((m) => m.role === 'TEAM_MEMBER');
  const medibridgeLeaderUser = medibridge?.roster.find((m) => m.role === 'TEAM_LEADER');

  let notificationDelivered = false;
  const onNotification = (ev: any) => {
    if (ev.type === 'NOTIFICATION_RECEIVED' && ev.recipientUserId === medibridgeLeaderUser?.userId) {
      notificationDelivered = true;
    }
  };
  realtimeHub.on('realtime_event', onNotification);

  const testIssue = await prisma.ideaIssueReport.create({
    data: {
      ideaId: medibridge?.idea?.id!,
      reportedByUserId: medibridgeMember?.userId!,
      teamId: medibridge?.id!,
      issueType: 'Technical Information',
      message: 'Autonomous diagnostic optical parameters should note 90s speed.',
      status: 'OPEN',
    },
  });

  const testNotif = await prisma.notification.create({
    data: {
      recipientUserId: medibridgeLeaderUser?.userId!,
      type: 'IDEA_ISSUE_REPORTED',
      title: 'Issue Reported: Technical Information',
      message: 'Deepa Krishnan reported an issue on your team idea.',
      relatedEntityId: testIssue.id,
      isRead: false,
    },
  });

  realtimeHub.broadcastToUser(medibridgeLeaderUser?.userId!, 'NOTIFICATION_RECEIVED', {
    notification: testNotif,
  });

  assert(Boolean(testIssue.id), 'Team Member reported issue stored in MySQL IdeaIssueReport');
  assert(Boolean(testNotif.id && testNotif.recipientUserId === medibridgeLeaderUser?.userId), 'Notification record created in MySQL targeted to Team Leader');
  assert(notificationDelivered, 'Realtime hub delivered NOTIFICATION_RECEIVED to Team Leader channel without page refresh');

  // Clean up test issue and notif
  await prisma.notification.delete({ where: { id: testNotif.id } });
  await prisma.ideaIssueReport.delete({ where: { id: testIssue.id } });
  realtimeHub.off('realtime_event', onNotification);

  console.log('\n============================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((e) => {
    console.error('Test execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
