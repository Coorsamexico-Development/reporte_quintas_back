-- AlterTable
ALTER TABLE `Fault` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `FaultEvidence` MODIFY `url` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `InventoryMovement` MODIFY `notes` TEXT NULL;

-- AlterTable
ALTER TABLE `InventoryMovementEvidence` MODIFY `url` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `Maintenance` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    MODIFY `description` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `MaintenanceEvidence` MODIFY `url` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `PartExchange` ADD COLUMN `cost` DECIMAL(65, 30) NULL DEFAULT 0.0,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    MODIFY `description` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `ScheduledMaintenance` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `TireRotation` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    MODIFY `description` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `roleId` INTEGER NULL,
    MODIFY `role` VARCHAR(191) NOT NULL DEFAULT 'OPERATOR';

-- AlterTable
ALTER TABLE `Vehicle` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `VehicleDocumentEvidence` MODIFY `url` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `VehicleMovement` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    MODIFY `reason` TEXT NULL;

-- AlterTable
ALTER TABLE `VehicleMovementEvidence` MODIFY `url` TEXT NOT NULL;

-- CreateTable
CREATE TABLE `PartExchangeEvidence` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `partExchangeId` INTEGER NOT NULL,
    `url` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PartExchangeEvidence_partExchangeId_fkey`(`partExchangeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `permissions` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Role_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_UserAllowedCedis` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_UserAllowedCedis_AB_unique`(`A`, `B`),
    INDEX `_UserAllowedCedis_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PartExchangeEvidence` ADD CONSTRAINT `PartExchangeEvidence_partExchangeId_fkey` FOREIGN KEY (`partExchangeId`) REFERENCES `PartExchange`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_UserAllowedCedis` ADD CONSTRAINT `_UserAllowedCedis_A_fkey` FOREIGN KEY (`A`) REFERENCES `Cedis`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_UserAllowedCedis` ADD CONSTRAINT `_UserAllowedCedis_B_fkey` FOREIGN KEY (`B`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
