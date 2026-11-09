import { NextRequest, NextResponse } from 'next/server';
import { settingsService } from '@/lib/services/settings-service';

export async function GET() {
  try {
    const settings = await settingsService.getSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error: unknown) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const updated = await settingsService.updateSettings(body);
    return NextResponse.json({ success: true, settings: updated });
  } catch (error: unknown) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
