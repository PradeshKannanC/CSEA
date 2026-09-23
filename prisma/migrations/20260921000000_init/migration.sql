-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'TEAM_LEADER', 'TEAM_MEMBER', 'INVESTOR') NOT NULL DEFAULT 'INVESTOR',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `emailVerified` BOOLEAN NOT NULL DEFAULT false,
    `avatarInitials` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `teamId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_email_idx`(`email`),
    INDEX `User_teamId_idx`(`teamId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Team` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `submissionId` VARCHAR(191) NOT NULL,
    `cohort` VARCHAR(191) NOT NULL DEFAULT 'Alpha 2024',
    `leaderId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Team_teamId_key`(`teamId`),
    UNIQUE INDEX `Team_submissionId_key`(`submissionId`),
    UNIQUE INDEX `Team_leaderId_key`(`leaderId`),
    INDEX `Team_teamId_idx`(`teamId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeamMember` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'TEAM_LEADER', 'TEAM_MEMBER', 'INVESTOR') NOT NULL DEFAULT 'TEAM_MEMBER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TeamMember_teamId_idx`(`teamId`),
    INDEX `TeamMember_email_idx`(`email`),
    INDEX `TeamMember_userId_idx`(`userId`),
    UNIQUE INDEX `TeamMember_teamId_email_key`(`teamId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Session_userId_idx`(`userId`),
    INDEX `Session_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Event` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT 'PITCH AND PROSPER Arena 2024',
    `status` ENUM('DRAFT', 'OPEN', 'PAUSED', 'CLOSED', 'ADMIN_REVEALED', 'REVEALED') NOT NULL DEFAULT 'DRAFT',
    `round` INTEGER NOT NULL DEFAULT 1,
    `totalCoins` INTEGER NOT NULL DEFAULT 100,
    `minInvestment` INTEGER NOT NULL DEFAULT 10,
    `maxInvestment` INTEGER NOT NULL DEFAULT 50,
    `totalDistributedCoins` INTEGER NOT NULL DEFAULT 14200,
    `investmentStartsAt` DATETIME(3) NULL,
    `investmentEndsAt` DATETIME(3) NULL,
    `revealedAt` DATETIME(3) NULL,
    `targetTeamsCount` INTEGER NOT NULL DEFAULT 50,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Idea` (
    `id` VARCHAR(191) NOT NULL,
    `anonymousId` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `track` VARCHAR(191) NOT NULL,
    `categoryTag` VARCHAR(191) NOT NULL,
    `problemStatement` TEXT NOT NULL,
    `solution` TEXT NOT NULL,
    `innovation` TEXT NOT NULL,
    `impact` TEXT NOT NULL,
    `whyInvest` TEXT NOT NULL,
    `technology` TEXT NOT NULL,
    `status` ENUM('DRAFT', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `isLocked` BOOLEAN NOT NULL DEFAULT false,
    `lockedAt` DATETIME(3) NULL,
    `submittedAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `totalInvested` INTEGER NOT NULL DEFAULT 0,
    `investorCount` INTEGER NOT NULL DEFAULT 0,
    `velocity` ENUM('HIGH', 'STABLE', 'MODERATE', 'LOW') NOT NULL DEFAULT 'STABLE',
    `rank` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Idea_anonymousId_key`(`anonymousId`),
    UNIQUE INDEX `Idea_teamId_key`(`teamId`),
    INDEX `Idea_teamId_idx`(`teamId`),
    INDEX `Idea_anonymousId_idx`(`anonymousId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Investment` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NULL,
    `investorId` VARCHAR(191) NOT NULL,
    `ideaId` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Investment_eventId_idx`(`eventId`),
    INDEX `Investment_investorId_idx`(`investorId`),
    INDEX `Investment_ideaId_idx`(`ideaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Wallet` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `totalCoins` INTEGER NOT NULL DEFAULT 100,
    `availableCoins` INTEGER NOT NULL DEFAULT 100,
    `investedCoins` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Wallet_userId_key`(`userId`),
    INDEX `Wallet_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WalletTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `walletId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `referenceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WalletTransaction_walletId_idx`(`walletId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Result` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NULL,
    `ideaId` VARCHAR(191) NOT NULL,
    `rank` INTEGER NOT NULL,
    `totalCoins` INTEGER NOT NULL,
    `investorCount` INTEGER NOT NULL DEFAULT 0,
    `teamName` VARCHAR(191) NOT NULL,
    `members` JSON NOT NULL,
    `track` VARCHAR(191) NOT NULL,
    `trophy` VARCHAR(191) NULL,
    `revealedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Result_eventId_idx`(`eventId`),
    INDEX `Result_ideaId_idx`(`ideaId`),
    INDEX `Result_rank_idx`(`rank`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_userId_idx`(`userId`),
    INDEX `AuditLog_action_idx`(`action`),
    INDEX `AuditLog_entity_idx`(`entity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IdeaIssueReport` (
    `id` VARCHAR(191) NOT NULL,
    `ideaId` VARCHAR(191) NOT NULL,
    `reportedByUserId` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `issueType` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `status` ENUM('OPEN', 'REVIEWED', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `IdeaIssueReport_ideaId_idx`(`ideaId`),
    INDEX `IdeaIssueReport_teamId_idx`(`teamId`),
    INDEX `IdeaIssueReport_reportedByUserId_idx`(`reportedByUserId`),
    INDEX `IdeaIssueReport_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `recipientUserId` VARCHAR(191) NOT NULL,
    `type` ENUM('IDEA_ISSUE_REPORTED', 'IDEA_STATUS_CHANGED', 'TEAM_UPDATE', 'EVENT_UPDATE', 'SYSTEM') NOT NULL DEFAULT 'SYSTEM',
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `relatedEntityId` VARCHAR(191) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Notification_recipientUserId_idx`(`recipientUserId`),
    INDEX `Notification_isRead_idx`(`isRead`),
    INDEX `Notification_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordResetToken_tokenHash_key`(`tokenHash`),
    INDEX `PasswordResetToken_userId_idx`(`userId`),
    INDEX `PasswordResetToken_tokenHash_idx`(`tokenHash`),
    INDEX `PasswordResetToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Team` ADD CONSTRAINT `Team_leaderId_fkey` FOREIGN KEY (`leaderId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamMember` ADD CONSTRAINT `TeamMember_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamMember` ADD CONSTRAINT `TeamMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Idea` ADD CONSTRAINT `Idea_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Investment` ADD CONSTRAINT `Investment_investorId_fkey` FOREIGN KEY (`investorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Investment` ADD CONSTRAINT `Investment_ideaId_fkey` FOREIGN KEY (`ideaId`) REFERENCES `Idea`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Wallet` ADD CONSTRAINT `Wallet_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WalletTransaction` ADD CONSTRAINT `WalletTransaction_walletId_fkey` FOREIGN KEY (`walletId`) REFERENCES `Wallet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Result` ADD CONSTRAINT `Result_ideaId_fkey` FOREIGN KEY (`ideaId`) REFERENCES `Idea`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IdeaIssueReport` ADD CONSTRAINT `IdeaIssueReport_ideaId_fkey` FOREIGN KEY (`ideaId`) REFERENCES `Idea`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IdeaIssueReport` ADD CONSTRAINT `IdeaIssueReport_reportedByUserId_fkey` FOREIGN KEY (`reportedByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_recipientUserId_fkey` FOREIGN KEY (`recipientUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

