# Creates the four manager logins in the tracker's Supabase project.
# Run on Windows PowerShell 5+: paste the whole file into a PowerShell window,
# or:  powershell -ExecutionPolicy Bypass -File .\create-users.ps1
# It asks for the service_role key (Supabase -> Project Settings -> API Keys
# -> "Legacy API keys" tab -> service_role) and never stores it.

$U = 'https://hgchmqatrxsoraiaicfh.supabase.co'
$PASSWORD = 'Nmesis!0900'

$K = (Read-Host 'Paste the service_role key, then press Enter').Trim()
if ($K.StartsWith('sb_publishable') -or $K.Length -lt 40) {
  Write-Host "That is the public key, not the service_role key. Open the 'Legacy API keys' tab and copy service_role." -ForegroundColor Red; return
}
if ($K.StartsWith('eyJ')) {
  $payload = $K.Split('.')[1].Replace('-', '+').Replace('_', '/'); while ($payload.Length % 4) { $payload += '=' }
  $decoded = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload))
  if ($decoded -notmatch 'service_role') { Write-Host "That JWT is the '$((($decoded | ConvertFrom-Json).role))' key, not service_role." -ForegroundColor Red; return }
}
$H = @{ apikey = $K; Authorization = "Bearer $K"; 'Content-Type' = 'application/json'; Prefer = 'return=representation,resolution=merge-duplicates' }
try { $null = Invoke-RestMethod -Uri "$U/auth/v1/admin/users?per_page=1" -Headers $H }
catch { Write-Host "Supabase rejected the key: $($_.Exception.Message)" -ForegroundColor Red; return }
Write-Host "Key accepted." -ForegroundColor Green

$managers = @(
  @{ email='moaaz.hashem@nmesis.io';    full_name='Moaaz Hashem';      role='production'; discipline=$null; is_admin=$true;  ftrack_username=$null },
  @{ email='teodora.khalifa@nmesis.io'; full_name='Teodora Khalifa';   role='production'; discipline=$null; is_admin=$false; ftrack_username=$null },
  @{ email='kareem@nmesis.io';          full_name='Kareem Abd Elazim'; role='supervisor'; discipline='CG';  is_admin=$true;  ftrack_username='Kareem@nmesis.io' },
  @{ email='hesham@nmesis.io';          full_name='Hesham Mahmoud';    role='supervisor'; discipline='VFX'; is_admin=$false; ftrack_username=$null }
)
$existing = (Invoke-RestMethod -Uri "$U/auth/v1/admin/users?per_page=100" -Headers $H).users
$ids = @{}
foreach ($m in $managers) {
  $found = $existing | Where-Object { $_.email -eq $m.email } | Select-Object -First 1
  if ($found -and $found.identities.Count -gt 0) {
    Invoke-RestMethod -Method Put -Uri "$U/auth/v1/admin/users/$($found.id)" -Headers $H -Body (@{ password=$PASSWORD; email_confirm=$true } | ConvertTo-Json) | Out-Null
    $ids[$m.email] = $found.id; Write-Host "kept    $($m.email) (password reset)"; continue
  }
  if ($found) { Invoke-RestMethod -Method Delete -Uri "$U/auth/v1/admin/users/$($found.id)" -Headers $H | Out-Null; Write-Host "removed $($m.email) (no identity)" }
  $created = Invoke-RestMethod -Method Post -Uri "$U/auth/v1/admin/users" -Headers $H -Body (@{ email=$m.email; password=$PASSWORD; email_confirm=$true } | ConvertTo-Json)
  $ids[$m.email] = $created.id; Write-Host "created $($m.email)"
}
$profiles = @($managers | ForEach-Object { @{ id=$ids[$_.email]; username=$_.email.Split('@')[0]; full_name=$_.full_name; active=$true } })
Invoke-RestMethod -Method Post -Uri "$U/rest/v1/profiles?on_conflict=id" -Headers $H -Body (ConvertTo-Json $profiles -Depth 3) | Out-Null
$people = Invoke-RestMethod -Uri "$U/rest/v1/tk_people?select=id,ftrack_username,profile_id" -Headers $H
foreach ($m in $managers) {
  $uid = $ids[$m.email]
  $row = @{ full_name=$m.full_name; role=$m.role; discipline=$m.discipline; is_admin=$m.is_admin; active=$true; profile_id=$uid; ftrack_username=$m.ftrack_username }
  $hit = $people | Where-Object { $_.profile_id -eq $uid } | Select-Object -First 1
  if (-not $hit -and $m.ftrack_username) { $hit = $people | Where-Object { $_.ftrack_username -eq $m.ftrack_username } | Select-Object -First 1 }
  if ($hit) { Invoke-RestMethod -Method Patch -Uri "$U/rest/v1/tk_people?id=eq.$($hit.id)" -Headers $H -Body ($row | ConvertTo-Json) | Out-Null }
  else      { Invoke-RestMethod -Method Post  -Uri "$U/rest/v1/tk_people" -Headers $H -Body ($row | ConvertTo-Json) | Out-Null }
}
Invoke-RestMethod -Uri "$U/rest/v1/tk_people?select=full_name,role,discipline,is_admin,profile:profiles(username)&profile_id=not.is.null&order=full_name" -Headers $H | Format-Table full_name, role, discipline, is_admin, @{n='login'; e={ $_.profile.username }}
Write-Host "Done. Sign in at https://nmesis-pm-tracker.vercel.app with username 'kareem' and the password above." -ForegroundColor Green
