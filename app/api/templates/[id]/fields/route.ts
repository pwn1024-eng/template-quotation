import { NextRequest, NextResponse } from 'next/server';
import { templateService } from '@/lib/services/template-service';
import { TemplateField } from '@/lib/types/template';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await templateService.getTemplateById(id);
    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      fields: template.metadata.fields || [],
      sections: template.metadata.sections || [],
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const template = await templateService.getTemplateById(id);
    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    const updatedMetadata = {
      ...template.metadata,
      fields: body.fields as TemplateField[],
      sections: body.sections || template.metadata.sections,
      name: body.name || template.metadata.name,
      description: body.description !== undefined ? body.description : template.metadata.description,
      active: body.active !== undefined ? body.active : template.metadata.active,
    };

    await templateService.updateTemplateMetadata(template.id, updatedMetadata);

    return NextResponse.json({ success: true, metadata: updatedMetadata });
  } catch (error: unknown) {
    console.error('Error updating template fields:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update fields' },
      { status: 500 }
    );
  }
}
