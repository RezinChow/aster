param([Parameter(Mandatory=$true)][ValidateSet(18095,18096,18097,18098)][int]$RemotePort)
$ErrorActionPreference = 'Stop'
$taskStateDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../target/h200-xq'))
$null = [IO.Directory]::CreateDirectory($taskStateDirectory)
$taskLock = [IO.File]::Open((Join-Path $taskStateDirectory "tunnel-$RemotePort.lock"),
    [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
$taskChild = $null
$taskAttempt = 0
try {
    while (-not (Test-Path -LiteralPath (Join-Path $taskStateDirectory 'stop-download-tunnels'))) {
        $taskAttempt += 1
        $taskInfo = [Diagnostics.ProcessStartInfo]::new()
        $taskInfo.FileName = (Get-Command ssh).Source
        foreach ($taskArgument in @('-CAXY','-N','-o','BatchMode=yes','-o','ConnectTimeout=20',
                '-o','ExitOnForwardFailure=yes','-o','ServerAliveInterval=30','-o','ServerAliveCountMax=3',
                '-R',"127.0.0.1:${RemotePort}:127.0.0.1:18890",
                'yangchao-dev.yangchao.ailab-hrprdduanyan.ws@h.pjlab.org.cn')) {
            $taskInfo.ArgumentList.Add($taskArgument)
        }
        $taskInfo.UseShellExecute = $false
        $taskInfo.CreateNoWindow = $true
        $taskInfo.RedirectStandardInput = $true
        $taskInfo.RedirectStandardOutput = $true
        $taskInfo.RedirectStandardError = $true
        $taskChild = [Diagnostics.Process]::Start($taskInfo)
        $taskChild.StandardInput.Close()
        $taskErrorRead = $taskChild.StandardError.ReadToEndAsync()
        $taskOutputRead = $taskChild.StandardOutput.ReadToEndAsync()
        $taskState = [ordered]@{supervisor_pid=$PID; ssh_pid=$taskChild.Id; remote_port=$RemotePort;
            attempt=$taskAttempt; started_unix=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()}
        $taskDestination = Join-Path $taskStateDirectory "tunnel-$RemotePort.json"
        $taskTemporary = $taskDestination+'.tmp'
        [IO.File]::WriteAllText($taskTemporary, (ConvertTo-Json -InputObject $taskState), [Text.UTF8Encoding]::new($false))
        [IO.File]::Move($taskTemporary,$taskDestination,$true)
        ConvertTo-Json -InputObject $taskState -Compress
        $taskChild.WaitForExit()
        $taskError = $taskErrorRead.Result
        if ($taskError.Length -gt 8192) { $taskError = $taskError.Substring($taskError.Length-8192) }
        [pscustomobject]@{remote_port=$RemotePort; attempt=$taskAttempt; exit_code=$taskChild.ExitCode;
            ended_unix=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); diagnostic=$taskError.Trim()} | ConvertTo-Json -Compress
        Start-Sleep -Seconds 3
    }
} finally {
    if ($null -ne $taskChild -and -not $taskChild.HasExited) { $taskChild.Kill(); $taskChild.WaitForExit() }
    $taskLock.Dispose()
}
