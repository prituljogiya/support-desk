-- Business profile fields for super-admin tenant intelligence

PRAGMA defer_foreign_keys=TRUE;

CREATE TABLE "new_Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "logoUrl" TEXT,
    "brandColor" TEXT,
    "freshdeskDomain" TEXT,
    "freshdeskApiKey" TEXT,
    "freshdeskWebhookSecret" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "customDomain" TEXT,
    "whiteLabel" BOOLEAN NOT NULL DEFAULT false,
    "storageUsedBytes" INTEGER NOT NULL DEFAULT 0,
    "industry" TEXT,
    "companySize" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "billingEmail" TEXT,
    "billingContact" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "segment" TEXT,
    "mrrCents" INTEGER NOT NULL DEFAULT 0,
    "trialEndsAt" DATETIME,
    "contractEndsAt" DATETIME,
    "healthScore" INTEGER NOT NULL DEFAULT 100,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Organization_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Organization" (
  "id", "name", "slug", "planId", "stripeCustomerId", "stripeSubscriptionId",
  "logoUrl", "brandColor", "freshdeskDomain", "freshdeskApiKey", "freshdeskWebhookSecret",
  "disabled", "customDomain", "whiteLabel", "storageUsedBytes", "createdAt", "updatedAt"
)
SELECT
  "id", "name", "slug", "planId", "stripeCustomerId", "stripeSubscriptionId",
  "logoUrl", "brandColor", "freshdeskDomain", "freshdeskApiKey", "freshdeskWebhookSecret",
  "disabled", "customDomain", "whiteLabel", "storageUsedBytes", "createdAt", "updatedAt"
FROM "Organization";
DROP TABLE "Organization";
ALTER TABLE "new_Organization" RENAME TO "Organization";
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX "Organization_planId_idx" ON "Organization"("planId");
CREATE INDEX "Organization_industry_idx" ON "Organization"("industry");
CREATE INDEX "Organization_country_idx" ON "Organization"("country");
CREATE INDEX "Organization_segment_idx" ON "Organization"("segment");
CREATE INDEX "Organization_disabled_idx" ON "Organization"("disabled");
