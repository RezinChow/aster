$ErrorActionPreference = 'Stop'
$taskRoot = 'D:\code\aster\target\h200-native'
$receiptPath = Join-Path $taskRoot 'xolotl-windows-shared-access-network-v1.json'
if (Test-Path -LiteralPath $receiptPath) { throw 'Network intent exists; inspect it before changing any address or firewall rule.' }
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Elevated network configuration is unavailable.' }
$podAddress = '100.97.24.7'
$lanAddress = '10.1.48.12'
$lanSubnet = '10.1.48.0/22'
$ruleName = 'Aster-Xolotl-Task-30003-LAN-20261024'
$lan = @(Get-NetIPAddress -AddressFamily IPv4 -IPAddress $lanAddress)
if ($lan.Count -ne 1 -or $lan[0].InterfaceIndex -ne 4 -or $lan[0].PrefixLength -ne 22) { throw 'The explicit LAN interface/address/subnet changed.' }
if (@(Get-NetIPAddress -AddressFamily IPv4 -IPAddress $podAddress -ErrorAction SilentlyContinue).Count -ne 0) { throw 'The pod alias already exists; refusing to adopt it.' }
if (Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue) { throw 'The firewall rule already exists; refusing to adopt it.' }
$receipt = [ordered]@{schema='aster-windows-shared-api-network-v1';phase='prepared';unix=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds();podAddress=$podAddress;aliasInterfaceIndex=1;lanAddress=$lanAddress;lanInterfaceIndex=4;lanSubnet=$lanSubnet;port=30003;firewallRuleName=$ruleName;aliasCreated=$false;firewallCreated=$false;leaseEndsUnix=1792859870.529365}
function Save-Receipt { $receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $receiptPath -Encoding utf8 }
Save-Receipt
try {
    # One /32 alias on the software loopback. No default gateway, DNS, VPN, or physical NIC address changes.
    $created = New-NetIPAddress -InterfaceIndex 1 -AddressFamily IPv4 -IPAddress $podAddress -PrefixLength 32 -SkipAsSource $true -PolicyStore ActiveStore
    $receipt.aliasCreated=$true
    Save-Receipt
    $alias = @(Get-NetIPAddress -InterfaceIndex 1 -AddressFamily IPv4 -IPAddress $podAddress)
    if ($alias.Count -ne 1 -or $alias[0].PrefixLength -ne 32 -or -not $alias[0].SkipAsSource) { throw 'The exact loopback alias was not created.' }
    New-NetFirewallRule -Name $ruleName -DisplayName 'Aster Xolotl authenticated API for this LAN' -Direction Inbound -Action Allow -Enabled True -Profile Any -Protocol TCP -LocalAddress $lanAddress -LocalPort 30003 -RemoteAddress $lanSubnet -InterfaceAlias $lan[0].InterfaceAlias | Out-Null
    $receipt.firewallCreated=$true
    $receipt.phase='configured'
    Save-Receipt
    $receipt | ConvertTo-Json -Depth 8
} catch {
    $receipt.phase='failed'
    $receipt.error=$_.Exception.Message
    Save-Receipt
    throw
}
