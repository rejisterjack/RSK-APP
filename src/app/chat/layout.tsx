import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import type React from 'react';
import { ErrorBoundary } from '@/components/error/error-boundary';
import { auth } from '@/lib/auth';

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
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/chat');
  }

  return (
    <ErrorBoundary>
      <div className="h-full overflow-hidden">{children}</div>
    </ErrorBoundary>
  );
}
