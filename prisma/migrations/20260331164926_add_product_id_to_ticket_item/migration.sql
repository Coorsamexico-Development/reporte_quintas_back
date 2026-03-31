-- AlterTable
ALTER TABLE `MaintenanceTicketItem` ADD COLUMN `productId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `MaintenanceTicketItem` ADD CONSTRAINT `MaintenanceTicketItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
