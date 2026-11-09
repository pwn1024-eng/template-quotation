import { NextRequest, NextResponse } from 'next/server';
import { templateService } from '@/lib/services/template-service';
import { analyzeDocxTemplate } from '@/lib/services/template-analyzer';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await templateService.getTemplateById(id);
    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    if (template.format !== 'docx') {
      return NextResponse.json({
        success: true,
        message: 'Presentation template (PPTX) cannot be analyzed with DOCX engine',
        metadata: template.metadata,
      });
    }

    // Run deep analysis
    const analysis = await analyzeDocxTemplate(template.fullPath, template.id, template.name);
    // Persist updated metadata
    await templateService.updateTemplateMetadata(template.id, analysis.metadata);

    return NextResponse.json({
      success: true,
      metadata: analysis.metadata,
      diagnostics: analysis.diagnostics,
    });
  } catch (error: unknown) {
    console.error('Error analyzing template:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
