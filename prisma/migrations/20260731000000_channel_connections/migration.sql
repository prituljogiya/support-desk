-- AlterTable Contact
ALTER TABLE "Contact" ADD COLUMN "whatsappE164" TEXT;

-- AlterTable Ticket
ALTER TABLE "Ticket" ADD COLUMN "channelConnectionId" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "customerExternalId" TEXT;

-- AlterTable Message
ALTER TABLE "Message" ADD COLUMN "direction" TEXT NOT NULL DEFAULT 'outbound';
ALTER TABLE "Message" ADD COLUMN "channel" TEXT;
ALTER TABLE "Message" ADD COLUMN "externalMessageId" TEXT;
ALTER TABLE "Message" ADD COLUMN "channelConnectionId" TEXT;

-- CreateTable ChannelConnection
CREATE TABLE "ChannelConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'built_in',
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "externalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "webhookSecret" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastError" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contact_organizationId_whatsappE164_key" ON "Contact"("organizationId", "whatsappE164");
CREATE INDEX "Contact_whatsappE164_idx" ON "Contact"("whatsappE164");
CREATE INDEX "Ticket_channelConnectionId_idx" ON "Ticket"("channelConnectionId");
CREATE UNIQUE INDEX "Message_channelConnectionId_externalMessageId_key" ON "Message"("channelConnectionId", "externalMessageId");
CREATE INDEX "Message_channel_idx" ON "Message"("channel");
CREATE UNIQUE INDEX "ChannelConnection_organizationId_type_key" ON "ChannelConnection"("organizationId", "type");
CREATE INDEX "ChannelConnection_organizationId_idx" ON "ChannelConnection"("organizationId");
CREATE INDEX "ChannelConnection_type_status_idx" ON "ChannelConnection"("type", "status");
CREATE INDEX "ChannelConnection_externalId_idx" ON "ChannelConnection"("externalId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_channelConnectionId_fkey" FOREIGN KEY ("channelConnectionId") REFERENCES "ChannelConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_channelConnectionId_fkey" FOREIGN KEY ("channelConnectionId") REFERENCES "ChannelConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChannelConnection" ADD CONSTRAINT "ChannelConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
