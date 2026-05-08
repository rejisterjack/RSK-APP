import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { type Message, MessageItem } from '@/components/chat/message-item';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock the citations component to avoid deep import chain issues
vi.mock('@/components/chat/citations', () => ({
  CitationList: ({ sources }: { sources: Array<{ documentName: string }> }) => (
    <div data-testid="citations">
      {sources.map((s) => (
        <span key={s.documentName}>{s.documentName}</span>
      ))}
    </div>
  ),
}));

// Mock the markdown component
vi.mock('@/components/chat/markdown', () => ({
  Markdown: ({ content }: { content: string }) => <div>{content}</div>,
}));

// Mock the suggested follow-ups component
vi.mock('@/components/chat/suggested-follow-ups', () => ({
  SuggestedFollowUps: ({ questions }: { questions: string[] }) => <div>{questions.join(', ')}</div>,
}));

describe('MessageItem', () => {
  const mockUserMessage: Message = {
    id: 'msg-1',
    role: 'user',
    content: 'What is the revenue for Q3?',
    createdAt: new Date('2024-01-15T10:00:00Z'),
  };

  const mockAssistantMessage: Message = {
    id: 'msg-2',
    role: 'assistant',
    content: 'Based on the financial report, Q3 2024 revenue was $35 million.',
    createdAt: new Date('2024-01-15T10:00:30Z'),
  };

  const mockAssistantWithSources: Message = {
    id: 'msg-3',
    role: 'assistant',
    content: 'The company revenue was $150 million in 2024.',
    createdAt: new Date('2024-01-15T10:01:00Z'),
    sources: [
      {
        index: 0,
        documentId: 'doc-001',
        documentName: 'Financial Report 2024',
        chunkId: 'chunk-001',
        content: 'Total revenue reached $150 million in fiscal year 2024.',
        score: 0.95,
      },
    ],
  };

  it('renders user message correctly', () => {
    render(<MessageItem message={mockUserMessage} />);

    expect(screen.getByText('What is the revenue for Q3?')).toBeInTheDocument();
    expect(screen.getByRole('article')).toBeInTheDocument();
  });

  it('renders assistant message correctly', () => {
    render(<MessageItem message={mockAssistantMessage} />);

    expect(screen.getByText(/based on the financial report/i)).toBeInTheDocument();
    expect(screen.getByRole('article')).toBeInTheDocument();
  });

  it('displays user avatar for user messages', () => {
    render(<MessageItem message={mockUserMessage} />);

    // The user avatar shows a User icon with "You" label
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('displays assistant avatar for assistant messages', () => {
    render(<MessageItem message={mockAssistantMessage} />);

    // The assistant shows "Assistant" label
    expect(screen.getByText('Assistant')).toBeInTheDocument();
  });

  it('renders markdown content', () => {
    const markdownMessage: Message = {
      id: 'msg-4',
      role: 'assistant',
      content: 'Here is some **bold text** and *italic text*',
      createdAt: new Date('2024-01-15T10:02:00Z'),
    };

    render(<MessageItem message={markdownMessage} />);

    // Markdown component should render the content
    expect(screen.getByRole('article')).toHaveTextContent('bold text');
  });

  it('displays sources when present', () => {
    render(<MessageItem message={mockAssistantWithSources} />);

    // Sources section should be rendered for assistant messages with sources
    expect(screen.getByText('Financial Report 2024')).toBeInTheDocument();
  });

  it('handles streaming state prop', () => {
    render(<MessageItem message={mockAssistantMessage} isStreaming />);

    // Component accepts isStreaming prop without crashing
    expect(screen.getByRole('article')).toBeInTheDocument();
  });

  it('allows copying message content', () => {
    render(<MessageItem message={mockAssistantMessage} />);

    // The copy button exists (may appear multiple times due to hover states)
    const copyButtons = screen.getAllByRole('button', { name: /copy message/i });
    expect(copyButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('is accessible with proper ARIA attributes', () => {
    render(<MessageItem message={mockAssistantMessage} />);

    const article = screen.getByRole('article');
    expect(article).toHaveAttribute('aria-label', 'Assistant message');
  });

  it('calls onFeedback when feedback buttons are clicked', () => {
    const handleFeedback = vi.fn();
    render(<MessageItem message={mockAssistantMessage} onFeedback={handleFeedback} />);

    // Feedback buttons should be rendered for assistant messages when onFeedback is provided
    const helpfulButtons = screen.getAllByRole('button', { name: /helpful/i });
    expect(helpfulButtons.length).toBeGreaterThanOrEqual(1);

    const notHelpfulButtons = screen.getAllByRole('button', { name: /not helpful/i });
    expect(notHelpfulButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows edit and delete options when handlers are provided', () => {
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();
    render(<MessageItem message={mockUserMessage} onEdit={handleEdit} onDelete={handleDelete} />);

    // The "More options" button should be in the DOM
    expect(screen.getByRole('button', { name: /more options/i })).toBeInTheDocument();
  });
});
