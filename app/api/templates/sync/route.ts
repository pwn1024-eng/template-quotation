import { NextResponse } from 'next/server';
import { templateService } from '@/lib/services/template-service';

export async function POST() {
  try {
    const templates = await templateService.scanAndSyncTemplates();
    return NextResponse.json({
      success: true,
      message: `Successfully scanned and synchronized ${templates.length} templates.`,
      count: templates.length,
      templates,
    });
  } catch (error: unknown) {
    console.error('Error scanning templates:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to scan templates' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}
