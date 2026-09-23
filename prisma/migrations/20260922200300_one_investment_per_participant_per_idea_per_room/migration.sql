-- CreateIndex
CREATE INDEX `Investment_investorId_roomId_idx` ON `Investment`(`investorId`, `roomId`);

-- CreateIndex
CREATE UNIQUE INDEX `Investment_investorId_roomId_ideaId_key` ON `Investment`(`investorId`, `roomId`, `ideaId`);
