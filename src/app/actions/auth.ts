'use server';

import { signIn } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface ActionResult {
	success: boolean;
	error?: string;
	data?: Record<string, unknown>;
}

/**
 * Server Action: Sign in with credentials.
 * Validates the user exists and calls NextAuth signIn.
 */
export async function signInWithCredentials(
	email: string,
	password: string,
	callbackUrl = '/chat'
): Promise<ActionResult> {
	if (!email || !password) {
		return { success: false, error: 'Email and password are required' };
	}

	try {
		const result = await signIn('credentials', {
			email,
			password,
			redirect: false,
			callbackUrl,
		});

		if (result?.error) {
			return { success: false, error: 'Invalid email or password' };
		}

		return { success: true, data: { callbackUrl } };
	} catch (error) {
		logger.warn('Sign in server action failed', {
			error: error instanceof Error ? error.message : 'Unknown',
		});
		return { success: false, error: 'An error occurred. Please try again.' };
	}
}

/**
 * Server Action: Register a new user account.
 * Validates input, checks for existing user, creates account.
 */
export async function registerUser(
	email: string,
	password: string,
	name?: string
): Promise<ActionResult> {
	if (!email || !password) {
		return { success: false, error: 'Email and password are required' };
	}

	if (password.length < 12) {
		return { success: false, error: 'Password must be at least 12 characters' };
	}

	try {
		const existing = await prisma.user.findUnique({ where: { email } });
		if (existing) {
			return { success: false, error: 'An account with this email already exists' };
		}

		const bcrypt = await import('bcryptjs');
		const hashedPassword = await bcrypt.hash(password, 12);

		const user = await prisma.user.create({
			data: {
				email,
				name: name || email.split('@')[0],
				password: hashedPassword,
			},
		});

		await signIn('credentials', {
			email,
			password,
			redirect: false,
		});

		return { success: true, data: { userId: user.id } };
	} catch (error) {
		logger.warn('Register server action failed', {
			error: error instanceof Error ? error.message : 'Unknown',
		});
		return { success: false, error: 'Failed to create account. Please try again.' };
	}
}
