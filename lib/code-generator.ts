import { randomInt } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Generate a random 4-digit code (e.g., 7391).
 * If retries exceed 3, increases width to avoid infinite loops in crowded spaces.
 */
function randomDigits(attempt: number): string {
  if (attempt >= 3) {
    // Expand to 5 or 6 digits on high congestion
    return String(randomInt(10000, 1000000));
  }
  return String(randomInt(1000, 10000));
}

/**
 * Generates a unique Room code (e.g., RM-8492)
 * Retries up to 5 times if collision occurs.
 */
export async function generateUniqueRoomCode(
  eventId?: string | null,
  client: DbClient = prisma
): Promise<string> {
  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = `RM-${randomDigits(attempt)}`;
    const existing = await client.room.findFirst({
      where: {
        code,
        ...(eventId ? { eventId } : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      return code;
    }
    console.warn(`[CodeGenerator] Room code collision on "${code}" (attempt ${attempt + 1}/${maxRetries}), retrying...`);
  }
  // Absolute fallback if all 5 retries collide
  return `RM-${Date.now().toString().slice(-4)}${randomInt(10, 99)}`;
}

/**
 * Generates a unique Team ID (e.g., TEAM-7391)
 * Retries up to 5 times if collision occurs.
 */
export async function generateUniqueTeamId(
  client: DbClient = prisma
): Promise<string> {
  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const teamId = `TEAM-${randomDigits(attempt)}`;
    const existing = await client.team.findFirst({
      where: {
        OR: [{ id: teamId }, { teamId }],
      },
      select: { id: true },
    });

    if (!existing) {
      return teamId;
    }
    console.warn(`[CodeGenerator] Team ID collision on "${teamId}" (attempt ${attempt + 1}/${maxRetries}), retrying...`);
  }
  return `TEAM-${Date.now().toString().slice(-4)}${randomInt(10, 99)}`;
}

/**
 * Generates a unique Submission ID (e.g., PNP-2024-8492)
 * Retries up to 5 times if collision occurs.
 */
export async function generateUniqueSubmissionId(
  client: DbClient = prisma
): Promise<string> {
  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const submissionId = `PNP-2024-${randomDigits(attempt)}`;
    const existing = await client.team.findFirst({
      where: { submissionId },
      select: { id: true },
    });

    if (!existing) {
      return submissionId;
    }
    console.warn(`[CodeGenerator] Submission ID collision on "${submissionId}" (attempt ${attempt + 1}/${maxRetries}), retrying...`);
  }
  return `PNP-2024-${Date.now().toString().slice(-4)}${randomInt(10, 99)}`;
}

/**
 * Generates a unique Idea Anonymous ID (e.g., IDEA-8492)
 * Retries up to 5 times if collision occurs.
 */
export async function generateUniqueIdeaAnonymousId(
  client: DbClient = prisma
): Promise<string> {
  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const anonymousId = `IDEA-${randomDigits(attempt)}`;
    const existing = await client.idea.findFirst({
      where: { anonymousId },
      select: { id: true },
    });

    if (!existing) {
      return anonymousId;
    }
    console.warn(`[CodeGenerator] Idea anonymousId collision on "${anonymousId}" (attempt ${attempt + 1}/${maxRetries}), retrying...`);
  }
  return `IDEA-${Date.now().toString().slice(-4)}${randomInt(10, 99)}`;
}
