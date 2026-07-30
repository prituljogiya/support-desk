-- Plan pricing + active flag for super-admin plan editor
-- SQLite: must disable FKs to rebuild Plan while Organization.planId references it.

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "seatLimit" INTEGER NOT NULL DEFAULT 3,
    "features" TEXT NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "monthlyPriceCents" INTEGER NOT NULL DEFAULT 0,
    "yearlyPriceCents" INTEGER NOT NULL DEFAULT 0,
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Plan" ("id", "key", "name", "description", "seatLimit", "features", "sortOrder", "createdAt", "updatedAt")
SELECT "id", "key", "name", "description", "seatLimit", "features", "sortOrder", "createdAt", "updatedAt" FROM "Plan";
DROP TABLE "Plan";
ALTER TABLE "new_Plan" RENAME TO "Plan";
CREATE UNIQUE INDEX "Plan_key_key" ON "Plan"("key");

UPDATE "Plan" SET "monthlyPriceCents" = 0, "yearlyPriceCents" = 0 WHERE "key" = 'free';
UPDATE "Plan" SET "monthlyPriceCents" = 4900, "yearlyPriceCents" = 49000, "trialDays" = 14 WHERE "key" = 'pro';
UPDATE "Plan" SET "monthlyPriceCents" = 14900, "yearlyPriceCents" = 149000, "trialDays" = 30 WHERE "key" = 'enterprise';

PRAGMA foreign_keys=ON;
