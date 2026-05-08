-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_userId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_planId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_userId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "usage_limits" DROP CONSTRAINT "usage_limits_subscriptionId_fkey";

-- DropTable
DROP TABLE "invoices";

-- DropTable
DROP TABLE "usage_limits";

-- DropTable
DROP TABLE "subscriptions";

-- DropTable
DROP TABLE "plans";

-- DropEnum
DROP TYPE "SubscriptionStatus";

-- DropEnum
DROP TYPE "InvoiceStatus";
