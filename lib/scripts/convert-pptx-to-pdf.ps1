param(
    [Parameter(Mandatory=$true)][string]$PptxPath,
    [Parameter(Mandatory=$true)][string]$PdfPath
)

$ErrorActionPreference = "Stop"

try {
    $ppt = New-Object -ComObject PowerPoint.Application
    $resolvedPptx = (Resolve-Path $PptxPath).Path
    $resolvedPdf = [System.IO.Path]::GetFullPath($PdfPath)

    # Open presentation (FileName, ReadOnly, Untitled, WithWindow)
    # WithWindow = 0 (msoFalse) avoids flashing windows
    $presentation = $ppt.Presentations.Open($resolvedPptx, -1, 0, 0)
    
    # 32 = ppSaveAsPDF
    $presentation.SaveAs($resolvedPdf, 32)
    $presentation.Close()
    $ppt.Quit()

    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) | Out-Null
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()

    if (Test-Path $PdfPath) {
        Write-Host "CONVERSION_SUCCESS"
        exit 0
    } else {
        Write-Error "PDF file was not created"
        exit 1
    }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
