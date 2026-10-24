$ErrorActionPreference = 'Stop'
$taskRoot = 'D:\code\aster\target\h200-native'
$intent = Get-Content -LiteralPath (Join-Path $taskRoot 'xolotl-windows-shared-access-network-v1.json') -Raw | ConvertFrom-Json
if ($intent.schema -ne 'aster-windows-shared-api-network-v1' -or $intent.podAddress -ne '100.97.24.7' -or $intent.aliasInterfaceIndex -ne 1 -or $intent.firewallRuleName -ne 'Aster-Xolotl-Task-30003-LAN-20261024') { throw 'Exact task-owned network cleanup identity changed.' }
$removed = [ordered]@{aliasRemoved=$false;firewallRemoved=$false;port30003Listeners=@()}
if ($intent.firewallCreated) {
    $rule = Get-NetFirewallRule -Name $intent.firewallRuleName -ErrorAction SilentlyContinue
    if ($rule) {
        $ports = $rule | Get-NetFirewallPortFilter
        $addresses = $rule | Get-NetFirewallAddressFilter
        if ($rule.DisplayName -ne 'Aster Xolotl authenticated API for this LAN' -or $ports.LocalPort -ne '30003' -or $addresses.LocalAddress -ne '10.1.48.12' -or $addresses.RemoteAddress -ne '10.1.48.0/255.255.252.0') {
            # Some Windows versions normalize the CIDR representation differently.
            if ($rule.DisplayName -ne 'Aster Xolotl authenticated API for this LAN' -or $ports.LocalPort -ne '30003' -or $addresses.LocalAddress -ne '10.1.48.12' -or $addresses.RemoteAddress -ne '10.1.48.0/22') { throw 'Firewall rule filters differ; refusing removal.' }
        }
        Remove-NetFirewallRule -InputObject $rule
        $removed.firewallRemoved=$true
    }
}
if ($intent.aliasCreated) {
    $alias = @(Get-NetIPAddress -InterfaceIndex 1 -AddressFamily IPv4 -IPAddress $intent.podAddress -ErrorAction SilentlyContinue)
    if ($alias.Count -gt 1) { throw 'Ambiguous loopback alias cleanup.' }
    if ($alias.Count -eq 1) {
        if ($alias[0].PrefixLength -ne 32 -or -not $alias[0].SkipAsSource) { throw 'Loopback alias shape changed; refusing removal.' }
        $alias[0] | Remove-NetIPAddress -Confirm:$false
        $removed.aliasRemoved=$true
    }
}
$removed.port30003Listeners = @(Get-NetTCPConnection -State Listen -LocalPort 30003 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess)
$removed | ConvertTo-Json -Depth 6
