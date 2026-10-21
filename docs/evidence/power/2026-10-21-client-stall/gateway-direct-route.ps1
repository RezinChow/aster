param([ValidateSet('Apply','Status','Remove')][string]$Action = 'Status')
$ErrorActionPreference = 'Stop'
$gatewayPrefix = '117.162.0.179/32'
$gatewayInterface = 4
$gatewayNextHop = '10.1.51.254'
$receiptPath = Join-Path $PSScriptRoot 'gateway-direct-route-receipt.json'

if ($Action -eq 'Status') {
    Find-NetRoute -RemoteIPAddress '117.162.0.179' |
        Select-Object IPAddress, InterfaceIndex, InterfaceAlias, DestinationPrefix, NextHop, RouteMetric |
        ConvertTo-Json
    exit
}

if ($Action -eq 'Apply') {
    if (Test-Path -LiteralPath $receiptPath) { throw 'Existing receipt retained; inspect status before another mutation.' }
    $gatewayAdapter = Get-NetAdapter -InterfaceIndex $gatewayInterface
    if (-not $gatewayAdapter.HardwareInterface -or $gatewayAdapter.Virtual -or $gatewayAdapter.Status -ne 'Up') {
        throw 'Proved physical adapter is unavailable.'
    }
    $gatewayDefault = @(Get-NetRoute -InterfaceIndex $gatewayInterface -DestinationPrefix '0.0.0.0/0' -PolicyStore ActiveStore)
    if ($gatewayDefault.Count -ne 1 -or $gatewayDefault[0].NextHop -ne $gatewayNextHop) { throw 'Physical next hop differs.' }
    $gatewayExisting = @(Get-NetRoute -DestinationPrefix $gatewayPrefix -PolicyStore ActiveStore -ErrorAction SilentlyContinue)
    if ($gatewayExisting.Count -ne 0) { throw 'An existing host route must be preserved.' }
    $gatewayBefore = @(Find-NetRoute -RemoteIPAddress '117.162.0.179' |
        Select-Object IPAddress, InterfaceIndex, InterfaceAlias, DestinationPrefix, NextHop, RouteMetric)
    $gatewayReceipt = [ordered]@{
        scope = 'Temporary ActiveStore host route for the one inference gateway destination'
        destination_prefix = $gatewayPrefix
        interface_index = $gatewayInterface
        next_hop = $gatewayNextHop
        policy_store = 'ActiveStore'
        existed_before = $false
        created_at_utc = [DateTime]::UtcNow.ToString('o')
        before = $gatewayBefore
        applied = $false
        rollback = 'powershell -File docs/evidence/power/2026-10-21-client-stall/gateway-direct-route.ps1 -Action Remove'
    }
    $gatewayReceipt | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $receiptPath -Encoding utf8
    New-NetRoute -DestinationPrefix $gatewayPrefix -InterfaceIndex $gatewayInterface -NextHop $gatewayNextHop -RouteMetric 1 -PolicyStore ActiveStore | Out-Null
    $gatewayAfter = @(Find-NetRoute -RemoteIPAddress '117.162.0.179')
    $gatewaySelected = @($gatewayAfter | Where-Object { $_.DestinationPrefix -eq $gatewayPrefix -and $_.InterfaceIndex -eq $gatewayInterface -and $_.NextHop -eq $gatewayNextHop })
    if ($gatewaySelected.Count -ne 1) { throw 'New route was not selected; inspect receipt and use explicit rollback.' }
    $gatewayReceipt.applied = $true
    $gatewayReceipt.after = @($gatewayAfter | Select-Object IPAddress, InterfaceIndex, InterfaceAlias, DestinationPrefix, NextHop, RouteMetric)
    $gatewayReceipt | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $receiptPath -Encoding utf8
    $gatewayReceipt | ConvertTo-Json -Depth 5
    exit
}

if (-not (Test-Path -LiteralPath $receiptPath)) { throw 'No ownership receipt; refuse removal.' }
$gatewayReceipt = Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json
if (-not $gatewayReceipt.applied -or $gatewayReceipt.existed_before -or $gatewayReceipt.destination_prefix -ne $gatewayPrefix -or $gatewayReceipt.interface_index -ne $gatewayInterface -or $gatewayReceipt.next_hop -ne $gatewayNextHop) {
    throw 'Receipt does not authorize removal of this route.'
}
$gatewayOwned = @(Get-NetRoute -DestinationPrefix $gatewayPrefix -InterfaceIndex $gatewayInterface -NextHop $gatewayNextHop -PolicyStore ActiveStore)
if ($gatewayOwned.Count -ne 1 -or $gatewayOwned[0].RouteMetric -ne 1) { throw 'Owned route changed; refuse removal.' }
$gatewayOwned[0] | Remove-NetRoute -Confirm:$false
Write-Output 'Owned temporary gateway route removed.'
