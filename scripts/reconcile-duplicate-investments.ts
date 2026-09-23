import { prisma } from '../lib/prisma';

async function reconcileDuplicates() {
  console.log('====================================================');
  console.log('RECONCILING DUPLICATE INVESTMENTS (CONSOLIDATION)');
  console.log('====================================================\n');

  // Find all duplicates with non-null roomId
  const duplicateGroups: any[] = await prisma.$queryRaw`
    SELECT 
      investorId,
      roomId,
      ideaId,
      COUNT(*) as count,
      SUM(amount) as totalAmount
    FROM Investment
    WHERE roomId IS NOT NULL
    GROUP BY investorId, roomId, ideaId
    HAVING COUNT(*) > 1
  `;

  console.log(`Identified ${duplicateGroups.length} duplicate groups with non-null roomId to reconcile.`);

  for (const group of duplicateGroups) {
    const records = await prisma.investment.findMany({
      where: {
        investorId: group.investorId,
        roomId: group.roomId,
        ideaId: group.ideaId,
      },
      orderBy: { createdAt: 'asc' },
    });

    const primaryRecord = records[0];
    const secondaryRecords = records.slice(1);
    const sumAmount = records.reduce((acc, r) => acc + r.amount, 0);

    console.log(`\nReconciling Group: User ${group.investorId}, Room ${group.roomId}, Idea ${group.ideaId}`);
    console.log(`- Original records count: ${records.length}`);
    console.log(`- Amounts: ${records.map((r) => r.amount).join(', ')} (Total: ${sumAmount})`);
    console.log(`- Keeping Primary record: ${primaryRecord.id} (CreatedAt: ${primaryRecord.createdAt.toISOString()})`);
    console.log(`- Consolidating total amount (${sumAmount}) into primary record...`);

    await prisma.$transaction(async (tx) => {
      // Update primary record amount to the sum of all records
      await tx.investment.update({
        where: { id: primaryRecord.id },
        data: { amount: sumAmount },
      });

      // Point any wallet transactions referencing secondary records to primary record
      for (const sec of secondaryRecords) {
        await tx.walletTransaction.updateMany({
          where: { referenceId: sec.id },
          data: { referenceId: primaryRecord.id },
        });
      }

      // Remove secondary records
      const secIds = secondaryRecords.map((r) => r.id);
      await tx.investment.deleteMany({
        where: { id: { in: secIds } },
      });
    });

    console.log(`- Secondary records deleted: ${secondaryRecords.map((r) => r.id).join(', ')}`);
    console.log(`✓ Group reconciled successfully. No financial value was lost.`);
  }

  console.log('\n====================================================');
  console.log('VERIFYING ZERO REMAINING DUPLICATES:');
  const remaining: any[] = await prisma.$queryRaw`
    SELECT investorId, roomId, ideaId, COUNT(*) as count
    FROM Investment
    WHERE roomId IS NOT NULL
    GROUP BY investorId, roomId, ideaId
    HAVING COUNT(*) > 1
  `;
  console.log(`Remaining duplicate groups: ${remaining.length}`);
  console.log('====================================================\n');
}

reconcileDuplicates().finally(() => prisma.$disconnect());
