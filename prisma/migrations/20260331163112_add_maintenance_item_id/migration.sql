-- AlterTable
ALTER TABLE `Maintenance` ADD COLUMN `maintenance_type_id` INTEGER NULL,
    ADD COLUMN `scheduledMaintenanceId` INTEGER NULL,
    MODIFY `type` ENUM('PREVENTIVE', 'CORRECTIVE') NULL;

-- AlterTable
ALTER TABLE `Vehicle` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateTable
CREATE TABLE `VehicleMovementEvidence` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `movementId` INTEGER NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VehicleMovementEvidence_movementId_fkey`(`movementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaintenanceTicketItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticketId` INTEGER NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `cost` DECIMAL(65, 30) NOT NULL DEFAULT 0.0,
    `affectedParts` INTEGER NOT NULL DEFAULT 1,
    `hasIva` BOOLEAN NOT NULL DEFAULT false,
    `laborCost` DECIMAL(65, 30) NOT NULL DEFAULT 0.0,
    `repairType` VARCHAR(191) NULL,
    `maintenanceTypeId` INTEGER NULL,

    INDEX `MaintenanceTicketItem_ticketId_fkey`(`ticketId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Fault` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vehicleId` INTEGER NOT NULL,
    `description` TEXT NOT NULL,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('PENDING', 'RESOLVED') NOT NULL DEFAULT 'PENDING',
    `reportedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,
    `maintenanceId` INTEGER NULL,
    `title` VARCHAR(191) NOT NULL,

    INDEX `Fault_vehicleId_fkey`(`vehicleId`),
    INDEX `Fault_maintenanceId_fkey`(`maintenanceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FaultEvidence` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `faultId` INTEGER NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FaultEvidence_faultId_fkey`(`faultId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduledMaintenance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vehicleId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `type` ENUM('PREVENTIVE', 'CORRECTIVE') NOT NULL DEFAULT 'PREVENTIVE',
    `maintenance_type_id` INTEGER NULL,
    `status` ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ScheduledMaintenance_vehicleId_fkey`(`vehicleId`),
    INDEX `ScheduledMaintenance_maintenanceTypeId_fkey`(`maintenance_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaintenanceType` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,

    UNIQUE INDEX `MaintenanceType_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Maintenance_scheduledMaintenanceId_fkey` ON `Maintenance`(`scheduledMaintenanceId`);

-- CreateIndex
CREATE INDEX `Maintenance_maintenanceTypeId_fkey` ON `Maintenance`(`maintenance_type_id`);

-- AddForeignKey
ALTER TABLE `VehicleMovementEvidence` ADD CONSTRAINT `VehicleMovementEvidence_movementId_fkey` FOREIGN KEY (`movementId`) REFERENCES `VehicleMovement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Maintenance` ADD CONSTRAINT `Maintenance_scheduledMaintenanceId_fkey` FOREIGN KEY (`scheduledMaintenanceId`) REFERENCES `ScheduledMaintenance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Maintenance` ADD CONSTRAINT `Maintenance_maintenance_type_id_fkey` FOREIGN KEY (`maintenance_type_id`) REFERENCES `MaintenanceType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceTicketItem` ADD CONSTRAINT `MaintenanceTicketItem_maintenanceTypeId_fkey` FOREIGN KEY (`maintenanceTypeId`) REFERENCES `MaintenanceType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceTicketItem` ADD CONSTRAINT `MaintenanceTicketItem_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `MaintenanceTicket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Fault` ADD CONSTRAINT `Fault_maintenanceId_fkey` FOREIGN KEY (`maintenanceId`) REFERENCES `Maintenance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Fault` ADD CONSTRAINT `Fault_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FaultEvidence` ADD CONSTRAINT `FaultEvidence_faultId_fkey` FOREIGN KEY (`faultId`) REFERENCES `Fault`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduledMaintenance` ADD CONSTRAINT `ScheduledMaintenance_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduledMaintenance` ADD CONSTRAINT `ScheduledMaintenance_maintenance_type_id_fkey` FOREIGN KEY (`maintenance_type_id`) REFERENCES `MaintenanceType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
