-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'IN_TRANSIT');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('VALID', 'EXPIRED', 'PENDING');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "User" 
  ALTER COLUMN "role" TYPE "Role" USING "role"::"Role";
ALTER TABLE "User" 
  ALTER COLUMN "role" SET DEFAULT 'OPERATOR';

-- AlterTable
ALTER TABLE "Vehicle" 
  ALTER COLUMN "status" TYPE "VehicleStatus" USING "status"::"VehicleStatus";
ALTER TABLE "Vehicle" 
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "VehicleDocument" 
  ALTER COLUMN "status" TYPE "DocumentStatus" USING "status"::"DocumentStatus";
ALTER TABLE "VehicleDocument" 
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Maintenance" 
  ALTER COLUMN "status" TYPE "MaintenanceStatus" USING "status"::"MaintenanceStatus";
ALTER TABLE "Maintenance" 
  ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
