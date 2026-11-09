param(
    [Parameter(Mandatory=$true)][string]$DocxPath,
    [Parameter(Mandatory=$true)][string]$PdfPath
)

$ErrorActionPreference = "Stop"

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0

    $doc = $word.Documents.Open((Resolve-Path $DocxPath).Path, $false, $true) # Open ReadOnly
    $doc.SaveAs([ref]([System.IO.Path]::GetFullPath($PdfPath)), [ref]17) # 17 = wdFormatPDF
    $doc.Close([ref]0) # 0 = wdDoNotSaveChanges
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
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
