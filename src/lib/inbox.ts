import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { messageRecipients, messages } from '@/db/schema';

export async function inboxFor(userId: string) {
  return db
    .select({ id: messageRecipients.id, readAt: messageRecipients.readAt, body: messageRecipients.body, createdAt: messages.createdAt, subject: messages.subject, category: messages.category, senderName: messages.senderName, attachmentKind: messages.attachmentKind, attachmentRef: messages.attachmentRef })
    .from(messageRecipients)
    .innerJoin(messages, eq(messages.id, messageRecipients.messageId))
    .where(and(eq(messageRecipients.userId, userId), isNull(messageRecipients.deletedAt)))
    .orderBy(desc(messages.createdAt))
    .limit(100);
}
