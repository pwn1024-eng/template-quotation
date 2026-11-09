import { NextRequest, NextResponse } from 'next/server';
import { versionService } from '@/lib/services/version-service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const versions = await versionService.getVersions(id);
    return NextResponse.json({ success: true, versions });
  } catch (error: unknown) {
    console.error('Error fetching versions:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
