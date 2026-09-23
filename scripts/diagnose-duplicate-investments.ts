import { prisma } from '../lib/prisma';

async function diagnoseDuplicates() {
  console.log('====================================================');
  console.log('DIAGNOSTIC: EXISTING DUPLICATE INVESTMENTS');
  console.log('====================================================\n');

  // Query duplicates where (investorId, roomId, ideaId) has count > 1
  const duplicates: any[] = await prisma.$queryRaw`
    SELECT 
      investorId,
      roomId,
      ideaId,
      COUNT(*) as count,
      SUM(amount) as totalAmount,
      GROUP_CONCAT(amount ORDER BY createdAt ASC) as amounts,
      GROUP_CONCAT(createdAt ORDER BY createdAt ASC) as timestamps
    FROM Investment
    WHERE roomId IS NOT NULL
    GROUP BY investorId, roomId, ideaId
    HAVING COUNT(*) > 1
  `;

  console.log(`Found ${duplicates.length} duplicate groups with NOT-NULL roomId:\n`);

  for (const d of duplicates) {
    const user = await prisma.user.findUnique({ where: { id: d.investorId } });
    const idea = await prisma.idea.findUnique({ where: { id: d.ideaId } });
    const room = await prisma.room.findUnique({ where: { id: d.roomId } });

    console.log(`User:      ${user?.email || d.investorId} (${d.investorId})`);
    console.log(`Room:      ${room?.name || 'Unknown'} (${d.roomId})`);
    console.log(`Idea:      ${idea?.anonymousId || d.ideaId} (${d.ideaId})`);
    console.log(`Count:     ${d.count}`);
    console.log(`Total:     ${d.totalAmount} coins`);
    console.log(`Amounts:   ${d.amounts}`);
    console.log(`Timestamps:${d.timestamps}`);
    console.log('----------------------------------------------------');
  }

  // Also check NULL roomId just in case
  const nullRoomDuplicates: any[] = await prisma.$queryRaw`
    SELECT 
      investorId,
      ideaId,
      COUNT(*) as count,
      SUM(amount) as totalAmount,
      GROUP_CONCAT(amount ORDER BY createdAt ASC) as amounts,
      GROUP_CONCAT(createdAt ORDER BY createdAt ASC) as timestamps
    FROM Investment
    WHERE roomId IS NULL
    GROUP BY investorId, ideaId
    HAVING COUNT(*) > 1
  `;

  console.log(`\nFound ${nullRoomDuplicates.length} duplicate groups with NULL roomId:\n`);
  for (const d of nullRoomDuplicates) {
    const user = await prisma.user.findUnique({ where: { id: d.investorId } });
    const idea = await prisma.idea.findUnique({ where: { id: d.ideaId } });

    console.log(`User:      ${user?.email || d.investorId} (${d.investorId})`);
    console.log(`Room:      NULL`);
    console.log(`Idea:      ${idea?.anonymousId || d.ideaId} (${d.ideaId})`);
    console.log(`Count:     ${d.count}`);
    console.log(`Total:     ${d.totalAmount} coins`);
    console.log(`Amounts:   ${d.amounts}`);
    console.log(`Timestamps:${d.timestamps}`);
    console.log('----------------------------------------------------');
  }

  // Also show total investments
  const total = await prisma.investment.count();
  console.log(`\nTotal Investment records in DB: ${total}`);
}

diagnoseDuplicates().finally(() => prisma.$disconnect());
