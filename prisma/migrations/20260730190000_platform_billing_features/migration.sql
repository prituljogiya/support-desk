-- Billing events + global feature flags on PlatformSetting

PRAGMA defer_foreign_keys=TRUE;

CREATE TABLE "new_PlatformSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emailJson" TEXT NOT NULL DEFAULT '{}',
    "smsJson" TEXT NOT NULL DEFAULT '{}',
    "whatsappJson" TEXT NOT NULL DEFAULT '{}',
    "aiJson" TEXT NOT NULL DEFAULT '{}',
    "storageJson" TEXT NOT NULL DEFAULT '{}',
    "cdnJson" TEXT NOT NULL DEFAULT '{}',
    "queueJson" TEXT NOT NULL DEFAULT '{}',
    "cacheJson" TEXT NOT NULL DEFAULT '{}',
    "securityJson" TEXT NOT NULL DEFAULT '{}',
    "featuresJson" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PlatformSetting" ("id", "emailJson", "smsJson", "whatsappJson", "aiJson", "storageJson", "cdnJson", "queueJson", "cacheJson", "securityJson", "updatedAt")
SELECT "id", "emailJson", "smsJson", "whatsappJson", "aiJson", "storageJson", "cdnJson", "queueJson", "cacheJson", "securityJson", "updatedAt" FROM "PlatformSetting";
DROP TABLE "PlatformSetting";
ALTER TABLE "new_PlatformSetting" RENAME TO "PlatformSetting";

CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "type" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'succeeded',
    "description" TEXT,
    "invoiceNumber" TEXT,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "meta" TEXT NOT NULL DEFAULT '{}',
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "BillingEvent_type_idx" ON "BillingEvent"("type");
CREATE INDEX "BillingEvent_occurredAt_idx" ON "BillingEvent"("occurredAt");
CREATE INDEX "BillingEvent_organizationId_idx" ON "BillingEvent"("organizationId");
