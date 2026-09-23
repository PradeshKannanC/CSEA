import { prisma } from '../lib/prisma';
import { realtimeHub } from '../lib/realtime';

async function testNotifications() {
  console.log('--- STARTING REAL-TIME NOTIFICATION VERIFICATION TEST ---');

  // 1. Verify Database Connection
  await prisma.$queryRaw`SELECT 1`;
  console.log('1. Database connection verified.');

  // 2. Find or create a team leader user
  let leader = await prisma.user.findFirst({
    where: { role: 'TEAM_LEADER' },
  });

  if (!leader) {
    // Check if there is an admin or any user we can test with
    leader = await prisma.user.findFirst();
  }

  if (!leader) {
    console.error('No users found in database to test notifications. Please ensure admin or leader exists.');
    process.exit(1);
  }

  console.log(`2. Found test recipient user: ${leader.name} (${leader.email}, role: ${leader.role})`);

  // 3. Test realtimeHub event emission
  let receivedEvent: any = null;
  const unsubscribe = (event: any) => {
    if (event.recipientUserId === leader.id && event.type === 'NOTIFICATION_RECEIVED') {
      receivedEvent = event;
    }
  };
  realtimeHub.on('realtime_event', unsubscribe);

  // 4. Create a Notification in MySQL
  const testNotification = await prisma.notification.create({
    data: {
      recipientUserId: leader.id,
      type: 'IDEA_ISSUE_REPORTED',
      title: 'Automated Test: Team Issue Reported',
      message: 'A test participant reported an issue with proposal slides.',
      isRead: false,
    },
  });
  console.log(`3. Created notification in MySQL: ${testNotification.id}`);

  // 5. Broadcast to user via realtimeHub
  realtimeHub.broadcastToUser(leader.id, 'NOTIFICATION_RECEIVED', {
    notification: {
      id: testNotification.id,
      type: testNotification.type,
      title: testNotification.title,
      message: testNotification.message,
      isRead: testNotification.isRead,
      createdAt: testNotification.createdAt.toISOString(),
    },
  });

  // Verify event received by subscriber
  if (receivedEvent && receivedEvent.payload.notification.id === testNotification.id) {
    console.log('4. Real-time event hub delivered NOTIFICATION_RECEIVED to recipient channel.');
  } else {
    console.error('FAIL: Real-time event hub did not deliver event correctly.');
    process.exit(1);
  }

  // 6. Query unread count for user
  const unreadCount = await prisma.notification.count({
    where: { recipientUserId: leader.id, isRead: false },
  });
  console.log(`5. Recipient unread notifications count: ${unreadCount} (should be >= 1)`);
  if (unreadCount < 1) {
    console.error('FAIL: Unread count query failed.');
    process.exit(1);
  }

  // 7. Mark as read
  await prisma.notification.update({
    where: { id: testNotification.id },
    data: { isRead: true },
  });

  const updatedNotification = await prisma.notification.findUnique({
    where: { id: testNotification.id },
  });
  console.log(`6. Notification marked as read. isRead: ${updatedNotification?.isRead}`);
  if (!updatedNotification?.isRead) {
    console.error('FAIL: isRead was not updated.');
    process.exit(1);
  }

  // 8. Clean up test notification
  await prisma.notification.delete({
    where: { id: testNotification.id },
  });
  console.log('7. Cleaned up test notification record from MySQL.');

  realtimeHub.off('realtime_event', unsubscribe);
  console.log('--- ALL NOTIFICATION VERIFICATIONS PASSED SUCCESSFULLY ---');
}

testNotifications()
  .catch((err) => {
    console.error('Test failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
