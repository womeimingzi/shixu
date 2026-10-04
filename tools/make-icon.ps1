$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$iconRoot = Join-Path (Split-Path $PSScriptRoot -Parent) 'build'
New-Item -ItemType Directory -Force -Path $iconRoot | Out-Null
$canvas = [System.Drawing.Bitmap]::new(512, 512)
$drawing = [System.Drawing.Graphics]::FromImage($canvas)
$drawing.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$drawing.Clear([System.Drawing.Color]::Transparent)
$background = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#BC674B'))
$cream = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#FFF6E4'))
$outline = [System.Drawing.Drawing2D.GraphicsPath]::new()
$outline.AddArc(16,16,144,144,180,90)
$outline.AddArc(352,16,144,144,270,90)
$outline.AddArc(352,352,144,144,0,90)
$outline.AddArc(16,352,144,144,90,90)
$outline.CloseFigure()
$drawing.FillPath($background,$outline)
# A simple code-drawn paw mark, separate from the hand-drawn mascot artwork.
$drawing.FillEllipse($cream,96,185,65,82)
$drawing.FillEllipse($cream,175,119,66,91)
$drawing.FillEllipse($cream,271,119,66,91)
$drawing.FillEllipse($cream,351,185,65,82)
$paw = [System.Drawing.Drawing2D.GraphicsPath]::new()
$paw.AddBezier(155,339,164,303,200,238,256,238)
$paw.AddBezier(256,238,311,238,346,301,356,339)
$paw.AddBezier(356,339,376,408,302,398,256,377)
$paw.AddBezier(256,377,210,399,135,409,155,339)
$paw.CloseFigure()
$drawing.FillPath($cream,$paw)
$canvas.Save((Join-Path $iconRoot 'icon.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$sizes = @(256,128,64,48,32,16)
$images = @()
foreach ($size in $sizes) {
  $scaled = [System.Drawing.Bitmap]::new($size,$size)
  $graphics = [System.Drawing.Graphics]::FromImage($scaled)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.DrawImage($canvas,0,0,$size,$size)
  $stream = [System.IO.MemoryStream]::new()
  $scaled.Save($stream,[System.Drawing.Imaging.ImageFormat]::Png)
  $images += ,$stream.ToArray()
  $graphics.Dispose(); $scaled.Dispose(); $stream.Dispose()
}
$output = [System.IO.File]::Create((Join-Path $iconRoot 'icon.ico'))
$writer = [System.IO.BinaryWriter]::new($output)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($index = 0; $index -lt $sizes.Count; $index++) {
  $dimension = if ($sizes[$index] -eq 256) { 0 } else { $sizes[$index] }
  $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
  $writer.Write([byte]0); $writer.Write([byte]0)
  $writer.Write([uint16]1); $writer.Write([uint16]32)
  $writer.Write([uint32]$images[$index].Length); $writer.Write([uint32]$offset)
  $offset += $images[$index].Length
}
foreach ($bytes in $images) { $writer.Write([byte[]]$bytes) }
$writer.Dispose(); $output.Dispose()
$paw.Dispose(); $outline.Dispose(); $cream.Dispose(); $background.Dispose(); $drawing.Dispose(); $canvas.Dispose()
Write-Output 'Created build/icon.png and build/icon.ico'
