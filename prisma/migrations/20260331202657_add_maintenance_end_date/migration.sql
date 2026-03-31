-- AlterTable
ALTER TABLE `Maintenance` ADD COLUMN `endDate` DATETIME(3) NULL,
    ADD COLUMN `inactiveDays` INTEGER NULL,
    ADD COLUMN `inactiveHours` INTEGER NULL;
