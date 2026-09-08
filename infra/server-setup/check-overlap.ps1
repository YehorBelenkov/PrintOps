# Asks the agent to display every table onto a busy dashboard, then checks that no two
# panels overlap. Overlap was possible because an explicit row was used verbatim.
param([string]$Url = 'http://localhost:3010/api/assistant')

$body = @'
{"command":"display all our database tables","state":{"title":"PrintOps","gridColumns":12,
"theme":{"mode":"dark","accent":"#3b82f6","radius":10,"density":"normal"},"navigation":[],
"panels":[
{"id":"queue","name":"Print Queue","widget":"production","col":1,"colSpan":8,"row":1,"rowSpan":2,"style":{}},
{"id":"rev","name":"Revenue","widget":"revenue","col":9,"colSpan":4,"row":1,"rowSpan":2,"style":{}},
{"id":"ship","name":"Shipping","widget":"shipping","col":1,"colSpan":6,"row":3,"rowSpan":2,"style":{}}
]},"history":[]}
'@

$body | Out-File -Encoding ascii "$env:TEMP\overlap.json" -NoNewline
$raw = curl.exe -s -m 250 -X POST $Url -H "Content-Type: application/json" --data-binary "@$env:TEMP\overlap.json"
$data = $raw | ConvertFrom-Json

$panels = $data.state.panels
"panels: $($panels.Count)"
$panels | ForEach-Object {
  "{0,-16} col {1}-{2}  row {3}-{4}" -f $_.name, $_.col, ($_.col + $_.colSpan - 1), $_.row, ($_.row + $_.rowSpan - 1)
}

$clashes = 0
for ($i = 0; $i -lt $panels.Count; $i++) {
  for ($j = $i + 1; $j -lt $panels.Count; $j++) {
    $a = $panels[$i]; $b = $panels[$j]
    $rowHit = ($a.row -lt ($b.row + $b.rowSpan)) -and ($b.row -lt ($a.row + $a.rowSpan))
    $colHit = ($a.col -lt ($b.col + $b.colSpan)) -and ($b.col -lt ($a.col + $a.colSpan))
    if ($rowHit -and $colHit) { "OVERLAP: $($a.name) <-> $($b.name)"; $clashes++ }
  }
}
if ($clashes -eq 0) { "no overlaps" } else { "$clashes overlapping pairs" }
