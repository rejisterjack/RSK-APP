'use server';

import { revalidateTag } from 'next/cache';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface ChatActionResult {
	success: boolean;
	error?: string;
	data?: Record<string, unknown>;
}

/**
 * Server Action: Create a new chat.
 */
export async function createChat(
	title?: string,
	model?: string
): Promise<ChatActionResult> {
	const session = await auth();
	if (!session?.user?.id) {
		return { success: false, error: 'Authentication required' };
	}

	try {
		const chat = await prisma.chat.create({
			data: {
				title: title || 'New Chat',
				model: model || process.env.DEFAULT_MODEL || 'groq/llama-3.3-70b-versatile',
				userId: session.user.id,
				workspaceId: session.user.workspaceId,
			},
		});

		revalidateTag(`user-chats-${session.user.id}`, 'default');

		return {
			success: true,
			data: {
				id: chat.id,
				title: chat.title,
				model: chat.model,
				createdAt: chat.createdAt.toISOString(),
			},
		};
	} catch (error) {
		logger.warn('Create chat action failed', {
			error: error instanceof Error ? error.message : 'Unknown',
		});
		return { success: false, error: 'Failed to create chat' };
	}
}

/**
 * Server Action: Delete a chat.
 */
export async function deleteChat(chatId: string): Promise<ChatActionResult> {
	const session = await auth();
	if (!session?.user?.id) {
		return { success: false, error: 'Authentication required' };
	}

	try {
		const chat = await prisma.chat.findFirst({
			where: {
				id: chatId,
				OR: [
					{ userId: session.user.id },
					{ workspaceId: session.user.workspaceId ?? '' },
				],
			},
		});

		if (!chat) {
			return { success: false, error: 'Chat not found' };
		}

		await prisma.chat.delete({ where: { id: chatId } });

		revalidateTag(`user-chats-${session.user.id}`, 'default');

		return { success: true };
	} catch (error) {
		logger.warn('Delete chat action failed', {
			error: error instanceof Error ? error.message : 'Unknown',
		});
		return { success: false, error: 'Failed to delete chat' };
	}
}

/**
 * Server Action: Update chat title.
 */
export async function updateChatTitle(
	chatId: string,
	title: string
): Promise<ChatActionResult> {
	const session = await auth();
	if (!session?.user?.id) {
		return { success: false, error: 'Authentication required' };
	}

	if (!title.trim()) {
		return { success: false, error: 'Title cannot be empty' };
	}

	try {
		const chat = await prisma.chat.findFirst({
			where: {
				id: chatId,
				OR: [
					{ userId: session.user.id },
					{ workspaceId: session.user.workspaceId ?? '' },
				],
			},
		});

		if (!chat) {
			return { success: false, error: 'Chat not found' };
		}

		await prisma.chat.update({
			where: { id: chatId },
			data: { title: title.trim() },
		});

		return { success: true };
	} catch (error) {
		logger.warn('Update chat title action failed', {
			error: error instanceof Error ? error.message : 'Unknown',
		});
		return { success: false, error: 'Failed to update chat title' };
	}
}
