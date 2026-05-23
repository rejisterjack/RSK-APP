import type { Metadata } from 'next';
import { connection } from 'next/server';

import type React from 'react';

interface ChatLayoutProps {
  children: React.ReactNode;
}

export const metadata: Metadata = {
  title: 'Chat | RAG Starter Kit',
  description: 'Chat with your documents using AI-powered RAG',
};

export default async function ChatLayout({
  children,
}: ChatLayoutProps): Promise<React.ReactElement> {
  await connection();
  return <div className="h-full overflow-hidden">{children}</div>;
}
