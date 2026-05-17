import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

const DEPLOY_WEBHOOK_SECRET = process.env.DEPLOY_WEBHOOK_SECRET ?? '';

export async function POST(req: Request) {
  if (!DEPLOY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Deploy webhook not configured' }, { status: 501 });
  }

  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (token !== DEPLOY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  revalidatePath('/docs');

  return NextResponse.json({
    revalidated: true,
    paths: ['/docs'],
    at: new Date().toISOString(),
  });
}
