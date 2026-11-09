import { NextRequest, NextResponse } from 'next/server';
import { templateService } from '@/lib/services/template-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shouldSync = searchParams.get('sync') === 'true';

    const templates = shouldSync
      ? await templateService.scanAndSyncTemplates()
      : await templateService.getAllTemplates();

    return NextResponse.json({ success: true, count: templates.length, templates });
  } catch (error: unknown) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const templates = await templateService.scanAndSyncTemplates();
    return NextResponse.json({ success: true, count: templates.length, templates });
  } catch (error: unknown) {
    console.error('Error scanning templates:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to scan templates' },
      { status: 500 }
    );
  }
}
