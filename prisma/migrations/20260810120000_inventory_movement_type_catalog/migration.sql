-- Reemplaza el enum InventoryStartType (hardcodeado en el schema/codigo,
-- causaba bugs como dos opciones de UI apuntando al mismo valor LOSS) por
-- catalogos relacionales: InventoryMovementCategory (agrupa + define signo)
-- e InventoryMovementType (tipo especifico, editable via API sin tocar codigo).

CREATE TABLE `InventoryMovementCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `sign` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `InventoryMovementCategory_name_key` (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `InventoryMovementType` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `isWriteOff` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `InventoryMovementType_name_key` (`name`),
    INDEX `InventoryMovementType_categoryId_fkey` (`categoryId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `InventoryMovementType`
  ADD CONSTRAINT `InventoryMovementType_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `InventoryMovementCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO `InventoryMovementCategory` (`name`, `label`, `sign`, `sortOrder`) VALUES
  ('INCOME', 'Ingresos (+)', 1, 1),
  ('EXPENSE', 'Salidas / Bajas (-)', -1, 2);

INSERT INTO `InventoryMovementType` (`name`, `label`, `categoryId`, `isWriteOff`, `sortOrder`)
SELECT 'PURCHASE', 'Compra Nueva (Facturada)', id, false, 1 FROM `InventoryMovementCategory` WHERE name = 'INCOME';
INSERT INTO `InventoryMovementType` (`name`, `label`, `categoryId`, `isWriteOff`, `sortOrder`)
SELECT 'TRANSFER_IN', 'Entrada por Traspaso', id, false, 2 FROM `InventoryMovementCategory` WHERE name = 'INCOME';
INSERT INTO `InventoryMovementType` (`name`, `label`, `categoryId`, `isWriteOff`, `sortOrder`)
SELECT 'ADJUSTMENT', 'Ajuste / Recuperado', id, false, 3 FROM `InventoryMovementCategory` WHERE name = 'INCOME';
INSERT INTO `InventoryMovementType` (`name`, `label`, `categoryId`, `isWriteOff`, `sortOrder`)
SELECT 'USAGE', 'Asignación / Entrega', id, false, 1 FROM `InventoryMovementCategory` WHERE name = 'EXPENSE';
INSERT INTO `InventoryMovementType` (`name`, `label`, `categoryId`, `isWriteOff`, `sortOrder`)
SELECT 'LOSS', 'Reporte de Extravío', id, true, 2 FROM `InventoryMovementCategory` WHERE name = 'EXPENSE';
INSERT INTO `InventoryMovementType` (`name`, `label`, `categoryId`, `isWriteOff`, `sortOrder`)
SELECT 'BREAKAGE', 'Reporte de Rotura/Desgaste', id, true, 3 FROM `InventoryMovementCategory` WHERE name = 'EXPENSE';
INSERT INTO `InventoryMovementType` (`name`, `label`, `categoryId`, `isWriteOff`, `sortOrder`)
SELECT 'TRANSFER_OUT', 'Salida por Traspaso', id, false, 4 FROM `InventoryMovementCategory` WHERE name = 'EXPENSE';

-- Agrega la FK nullable, backfillea desde la columna enum vieja, y recien
-- entonces la endurece a NOT NULL (el script de aplicacion verifica que no
-- queden filas huerfanas entre estos dos pasos antes de continuar).
ALTER TABLE `InventoryMovement` ADD COLUMN `movementTypeId` INTEGER NULL;

UPDATE `InventoryMovement` m
JOIN `InventoryMovementType` t ON t.name = m.type
SET m.movementTypeId = t.id;

ALTER TABLE `InventoryMovement` MODIFY `movementTypeId` INTEGER NOT NULL;

ALTER TABLE `InventoryMovement`
  ADD CONSTRAINT `InventoryMovement_movementTypeId_fkey`
  FOREIGN KEY (`movementTypeId`) REFERENCES `InventoryMovementType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX `InventoryMovement_movementTypeId_fkey` ON `InventoryMovement`(`movementTypeId`);

ALTER TABLE `InventoryMovement` DROP COLUMN `type`;
