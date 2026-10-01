$file = "components\LibraryView.tsx"
$lines = Get-Content $file
$result = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    # Delete 0-indexed lines 1332 to 1469 (which is 1-indexed 1333 to 1470)
    if ($i -ge 1332 -and $i -le 1469) { continue }
    $result += $lines[$i]
}
# Add the closing )} after line 1332 (now at index 1332)
$final = @()
for ($j = 0; $j -lt $result.Count; $j++) {
    $final += $result[$j]
    if ($j -eq 1331) {
        $final += "                    )}"
    }
}
$final | Set-Content $file -Encoding UTF8
Write-Host "Done. Lines deleted and closing tag added."
