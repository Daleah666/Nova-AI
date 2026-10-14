<#
Subliminal Maker
Writes fresh affirmations from my-goals.txt into Mindzoom's affirmations folder.

  subliminal.ps1            open the menu
  subliminal.ps1 -Now       make today's subliminal now
  subliminal.ps1 -WithMe    make one together, step by step
  subliminal.ps1 -Daily     what the daily task runs: makes one only if today's is still missing
  subliminal.ps1 -On / -Off turn the daily task on or off
  subliminal.ps1 -Status    show what is set up
  subliminal.ps1 -Setup     first-time setup

Keep this file plain ASCII: Windows PowerShell 5.1 reads scripts without a BOM as ANSI.
#>
[CmdletBinding()]
param(
    [switch]$Now,
    [switch]$WithMe,
    [switch]$Daily,
    [switch]$On,
    [switch]$Off,
    [switch]$Status,
    [switch]$Setup,
    [string]$Root = $PSScriptRoot
)

$script:Layers = @('becoming', 'why', 'when')
$script:Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$script:NegativePattern = "\b(not|never|no|none|nothing|nobody|nowhere|stop|stopped|stopping|quit|without|lose|losing|hate|afraid|fear|scared|worry|worried|anxious)\b|n't\b"
$script:FuturePattern = "\b(will|gonna|wanna|someday|one day|want to|going to|try to|trying to|hope to|wish)\b"
$script:HealthPattern = "\b(cure|cured|cures|heal|healed|heals|disease|illness|medication|medicine|diagnosis|diagnosed|surgery|cancer|pain|painless)\b"

$script:Verbs = @(
    'act', 'accept', 'allow', 'be', 'become', 'begin', 'believe', 'breathe', 'build', 'call', 'care', 'chat',
    'choose', 'clean', 'create', 'dance', 'design', 'do', 'draw', 'dream', 'dress', 'drink', 'eat', 'edit',
    'embrace', 'enjoy', 'exercise', 'feel', 'finish', 'flirt', 'float', 'focus', 'get', 'give', 'glow', 'go',
    'grow', 'have', 'hear', 'hug', 'keep', 'laugh', 'learn', 'let', 'listen', 'live', 'look', 'love', 'make',
    'meditate', 'model', 'move', 'nap', 'open', 'paint', 'plan', 'play', 'pose', 'post', 'practice', 'put',
    'read', 'record', 'relax', 'render', 'rest', 'run', 'save', 'sculpt', 'see', 'share', 'shine', 'shop',
    'show', 'sing', 'sink', 'sit', 'sleep', 'smile', 'speak', 'spend', 'stand', 'start', 'stay', 'stream',
    'stretch', 'strut', 'study', 'sway', 'swim', 'take', 'talk', 'think', 'train', 'treat', 'trust', 'try',
    'upload', 'use', 'wake', 'walk', 'wear', 'work', 'write'
)
$script:DoubleLast = @('begin', 'chat', 'get', 'hug', 'let', 'nap', 'plan', 'put', 'run', 'shop', 'sit', 'strut', 'swim')

# ---------- files ----------

function Read-TextLines([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return @() }
    $text = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    return @($text -split "\r?\n")
}

function Write-TextLines([string]$Path, [string[]]$Lines) {
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $text = (@($Lines) -join "`r`n") + "`r`n"
    [System.IO.File]::WriteAllText($Path, $text, $script:Utf8NoBom)
}

function Get-MadeFolder([string]$Root) {
    $dir = Join-Path $Root 'made'
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    return $dir
}

function Add-LogLine([string]$Root, [string]$Message) {
    $path = Join-Path (Get-MadeFolder $Root) 'log.txt'
    $line = (Get-Date).ToString('yyyy-MM-dd HH:mm') + '  ' + $Message + "`r`n"
    [System.IO.File]::AppendAllText($path, $line, $script:Utf8NoBom)
}

function Read-Sections([string]$Path) {
    $sections = @{}
    $current = ''
    $sections[$current] = New-Object System.Collections.Generic.List[string]
    foreach ($raw in (Read-TextLines $Path)) {
        $line = $raw.Trim()
        if ($line -eq '' -or $line.StartsWith('#')) { continue }
        if ($line -match '^\[(.+)\]$') {
            $current = $Matches[1].Trim().ToLowerInvariant()
            if (-not $sections.ContainsKey($current)) { $sections[$current] = New-Object System.Collections.Generic.List[string] }
            continue
        }
        $sections[$current].Add($line)
    }
    return $sections
}

function Get-SectionLines($Sections, [string]$Name) {
    if ($Sections.ContainsKey($Name)) { return $Sections[$Name].ToArray() }
    return @()
}

function Read-Goals([string]$Path) {
    $s = Read-Sections $Path
    return [pscustomobject]@{
        Goals  = @(Get-SectionLines $s 'goals')
        Always = @(Get-SectionLines $s 'always include')
        Never  = @(Get-SectionLines $s 'never include')
    }
}

function Read-Settings([string]$Root) {
    $settings = [ordered]@{
        mindzoomFolder = ''
        dailyFileName  = '000 Daily Subliminal.txt'
        lines          = 30
        maxWords       = 16
        dailyTime      = '08:00'
        models         = [ordered]@{ anthropic = 'claude-sonnet-5-5'; xai = 'grok-4-latest'; openai = 'gpt-5' }
    }
    $path = Join-Path $Root 'settings.json'
    if (Test-Path -LiteralPath $path) {
        try {
            $saved = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
            foreach ($key in @($settings.Keys)) {
                if ($key -eq 'models') { continue }
                $value = $saved.$key
                if ($null -ne $value -and "$value" -ne '') { $settings[$key] = $value }
            }
            if ($null -ne $saved.models) {
                foreach ($key in @($settings.models.Keys)) {
                    $value = $saved.models.$key
                    if ($value) { $settings.models[$key] = [string]$value }
                }
            }
        } catch {
            Add-LogLine $Root "settings.json could not be read, so defaults were used: $($_.Exception.Message)"
        }
    }
    $settings.lines = [Math]::Max(5, [int]$settings.lines)
    $settings.maxWords = [Math]::Max(6, [int]$settings.maxWords)
    return [pscustomobject]$settings
}

function Save-Settings([string]$Root, $Settings) {
    $path = Join-Path $Root 'settings.json'
    $json = $Settings | ConvertTo-Json -Depth 4
    [System.IO.File]::WriteAllText($path, $json + "`r`n", $script:Utf8NoBom)
}

# ---------- phrase banks ----------

function Read-PhraseBank([string]$Path) {
    $s = Read-Sections $Path
    $keywords = @()
    foreach ($line in (Get-SectionLines $s '')) {
        if ($line -match '^keywords:\s*(.*)$') {
            $keywords = @($Matches[1] -split ',' | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })
        }
    }
    $layers = @{}
    foreach ($layer in $script:Layers) { $layers[$layer] = @(Get-SectionLines $s $layer) }
    return [pscustomobject]@{
        Name     = [System.IO.Path]::GetFileNameWithoutExtension($Path)
        Keywords = $keywords
        Layers   = $layers
    }
}

function Read-PhraseBanks([string]$Folder) {
    $banks = @()
    if (Test-Path -LiteralPath $Folder) {
        foreach ($file in (Get-ChildItem -LiteralPath $Folder -Filter '*.txt' | Sort-Object Name)) {
            $banks += Read-PhraseBank $file.FullName
        }
    }
    return $banks
}

function Get-MatchingThemes([string]$Goal, $Banks) {
    $words = @{}
    foreach ($t in ($Goal.ToLowerInvariant() -split "[^a-z0-9'\-]+")) {
        if (-not $t) { continue }
        $words[$t] = $true
        if ($t.Length -gt 3 -and $t.EndsWith('s')) { $words[$t.Substring(0, $t.Length - 1)] = $true }
    }
    return @($Banks | Where-Object {
            -not $_.Name.StartsWith('_') -and @($_.Keywords | Where-Object { $words.ContainsKey($_) }).Count -gt 0
        })
}

# ---------- turning goals into lines ----------

function ConvertTo-Capital([string]$Text) {
    if (-not $Text) { return $Text }
    return $Text.Substring(0, 1).ToUpperInvariant() + $Text.Substring(1)
}

function ConvertTo-Gerund([string]$Verb) {
    $v = $Verb.ToLowerInvariant()
    if ($v -eq 'be' -or $v -eq 'see') { return $v + 'ing' }
    if ($v.EndsWith('ie')) { return $v.Substring(0, $v.Length - 2) + 'ying' }
    if ($v.EndsWith('ee')) { return $v + 'ing' }
    if ($script:DoubleLast -contains $v) { return $v + $v.Substring($v.Length - 1) + 'ing' }
    if ($v.EndsWith('e')) { return $v.Substring(0, $v.Length - 1) + 'ing' }
    return $v + 'ing'
}

# "Stay girly and feminine" -> "staying girly and feminine"; "Confident at work" -> "being confident at work".
# Goals that are already sentences ("I am calm") return $null and get used as they are.
function Convert-GoalToPhrase([string]$Goal) {
    $g = $Goal.Trim().TrimEnd('.', '!', '?').Trim()
    if (-not $g) { return $null }
    if ($g -match "^(I|I'm|Im|My|Me)\b") { return $null }
    $g = $g -replace '^(?i)to\s+', ''
    $segments = @($g -split '(?i)\s+and\s+')
    for ($i = 0; $i -lt $segments.Count; $i++) {
        $parts = @($segments[$i].Trim() -split '\s+', 2)
        if (-not $parts[0]) { continue }
        $first = $parts[0]
        $lower = $first.ToLowerInvariant()
        $rest = ''
        if ($parts.Count -gt 1) { $rest = ' ' + $parts[1] }
        if ($script:Verbs -contains $lower) {
            $segments[$i] = (ConvertTo-Gerund $lower) + $rest
        } elseif ($i -eq 0) {
            if ($first -cne $first.ToUpperInvariant()) { $first = $lower }
            if ($lower.EndsWith('ing')) { $segments[$i] = $first + $rest } else { $segments[$i] = 'being ' + $first + $rest }
        }
    }
    return ($segments -join ' and ')
}

function Format-Line([string]$Line) {
    if ($null -eq $Line) { return '' }
    $s = $Line
    $s = $s.Replace([string][char]0x2019, "'").Replace([string][char]0x2018, "'")
    $s = $s.Replace([string][char]0x201C, '"').Replace([string][char]0x201D, '"')
    $s = $s.Replace([string][char]0x2013, '-').Replace([string][char]0x2014, ' - ').Replace([string][char]0x2026, '...')
    $s = $s -replace '[\uD800-\uDFFF]', ''
    $s = $s -replace '[\u2600-\u27BF\uFE0F\u200D]', ''
    $s = $s -replace '[\x00-\x1F\x7F]', ' '
    $s = $s -replace '^\s*(?:[-*>\u2022]+|\d+[.):-])\s*', ''
    $s = $s.Trim().Trim('"').Trim()
    $s = $s -replace '\s+', ' '
    if ($s.Length -eq 0) { return '' }
    $s = ConvertTo-Capital $s
    if ($s -notmatch '[.!?]$') { $s += '.' }
    return $s
}

# Returns why a line breaks the rules, or $null when it is fine.
function Get-LineProblem([string]$Line, [string[]]$Never, [int]$MaxWords = 16) {
    if ([string]::IsNullOrWhiteSpace($Line)) { return 'empty' }
    if ($Line.StartsWith('#')) { return 'note line' }
    if ($Line -match '[{}\[\]]') { return 'leftover template' }
    $lower = $Line.ToLowerInvariant()
    foreach ($n in @($Never)) {
        if ($n -and $lower.Contains($n.Trim().ToLowerInvariant())) { return "contains '$n'" }
    }
    if ($lower -match $script:NegativePattern) { return "negative word '$($Matches[0])'" }
    if ($lower -match $script:FuturePattern) { return "future word '$($Matches[0])'" }
    if ($lower -match $script:HealthPattern) { return "health claim '$($Matches[0])'" }
    $words = @($Line -split '\s+' | Where-Object { $_ }).Count
    if ($words -gt $MaxWords) { return "too long ($words words)" }
    return $null
}

function Get-LineKey([string]$Line) {
    return ($Line.ToLowerInvariant() -replace '[^a-z0-9]', '')
}

# Adds a line if it passes the rules and is new. Returns $true when added.
function Add-CleanLine($List, $Seen, [string]$Line, [string[]]$Never, [int]$MaxWords) {
    $clean = Format-Line $Line
    if (Get-LineProblem $clean $Never $MaxWords) { return $false }
    $key = Get-LineKey $clean
    if (-not $key -or $Seen.ContainsKey($key)) { return $false }
    $Seen[$key] = $true
    $List.Add($clean)
    return $true
}

function Get-Shuffled($Items, [System.Random]$Rng) {
    $a = @($Items)
    for ($i = $a.Count - 1; $i -gt 0; $i--) {
        $j = $Rng.Next($i + 1)
        $tmp = $a[$i]; $a[$i] = $a[$j]; $a[$j] = $tmp
    }
    return $a
}

function Get-FocusIndex([datetime]$Date, [int]$GoalCount) {
    if ($GoalCount -le 0) { return -1 }
    $day = [int][Math]::Floor(($Date.Date - [datetime]'2000-01-01').TotalDays)
    return $day % $GoalCount
}

# Candidate lines for one goal, grouped by layer.
function Get-GoalPool([string]$Goal, $Banks) {
    $pool = @{}
    foreach ($layer in $script:Layers) { $pool[$layer] = New-Object System.Collections.Generic.List[string] }
    $phrase = Convert-GoalToPhrase $Goal
    if ($null -eq $phrase) {
        $pool['becoming'].Add($Goal)
    } else {
        $cap = ConvertTo-Capital $phrase
        foreach ($t in @($Banks | Where-Object { $_.Name -eq '_templates' })) {
            foreach ($layer in $script:Layers) {
                foreach ($line in $t.Layers[$layer]) { $pool[$layer].Add($line.Replace('{G}', $cap).Replace('{g}', $phrase)) }
            }
        }
    }
    foreach ($theme in (Get-MatchingThemes $Goal $Banks)) {
        foreach ($layer in $script:Layers) {
            foreach ($line in $theme.Layers[$layer]) { $pool[$layer].Add($line) }
        }
    }
    return $pool
}

function Get-GoalQuotas([int]$GoalCount, [int]$FocusIndex, [int]$Count) {
    $quotas = @(0) * $GoalCount
    if ($GoalCount -eq 1) { $quotas[0] = $Count; return $quotas }
    $focus = [int][Math]::Ceiling($Count / 2.0)
    $quotas[$FocusIndex] = $focus
    $others = $GoalCount - 1
    $left = $Count - $focus
    $k = 0
    for ($i = 0; $i -lt $GoalCount; $i++) {
        if ($i -eq $FocusIndex) { continue }
        $quotas[$i] = [int][Math]::Floor($left / $others)
        if ($k -lt ($left % $others)) { $quotas[$i]++ }
        $k++
    }
    return $quotas
}

# Builds lines from the phrase banks. The spotlight goal gets about half; every goal gets all three layers.
function New-OfflineLines {
    param($Goals, [int]$FocusIndex, $Banks, [int]$Count, [string[]]$Never, [int]$MaxWords, [System.Random]$Rng, $Seen)
    $out = New-Object System.Collections.Generic.List[string]
    $goals = @($Goals)
    if ($goals.Count -gt 0 -and $Count -gt 0) {
        $quotas = Get-GoalQuotas $goals.Count $FocusIndex $Count
        for ($gi = 0; $gi -lt $goals.Count; $gi++) {
            $pool = Get-GoalPool $goals[$gi] $Banks
            $queues = @{}
            foreach ($layer in $script:Layers) { $queues[$layer] = New-Object System.Collections.Queue(, @(Get-Shuffled $pool[$layer] $Rng)) }
            $added = 0
            $li = $gi % $script:Layers.Count
            $emptyRounds = 0
            while ($added -lt $quotas[$gi] -and $emptyRounds -lt $script:Layers.Count) {
                $q = $queues[$script:Layers[$li]]
                $li = ($li + 1) % $script:Layers.Count
                $took = $false
                while ($q.Count -gt 0) {
                    if (Add-CleanLine $out $Seen $q.Dequeue() $Never $MaxWords) { $took = $true; break }
                }
                if ($took) { $added++; $emptyRounds = 0 } else { $emptyRounds++ }
            }
        }
    }
    if ($out.Count -lt $Count) {
        $extra = @()
        foreach ($b in @($Banks | Where-Object { $_.Name -eq 'mindset' })) { foreach ($layer in $script:Layers) { $extra += $b.Layers[$layer] } }
        $rest = @()
        foreach ($b in @($Banks | Where-Object { $_.Name -ne 'mindset' -and -not $_.Name.StartsWith('_') })) { foreach ($layer in $script:Layers) { $rest += $b.Layers[$layer] } }
        foreach ($line in @(Get-Shuffled $extra $Rng) + @(Get-Shuffled $rest $Rng)) {
            if ($out.Count -ge $Count) { break }
            [void](Add-CleanLine $out $Seen $line $Never $MaxWords)
        }
    }
    return , $out
}

# ---------- optional AI ----------

$script:ProviderNames = @{ anthropic = 'Claude'; xai = 'Grok'; openai = 'OpenAI' }

function Get-KeyProvider([string]$Key) {
    if ($Key.StartsWith('sk-ant-')) { return 'anthropic' }
    if ($Key.StartsWith('xai-')) { return 'xai' }
    if ($Key.StartsWith('sk-')) { return 'openai' }
    return ''
}

function Get-AiKey([string]$Root) {
    $key = ''
    foreach ($line in (Read-TextLines (Join-Path $Root 'my-key.txt'))) {
        $t = $line.Trim()
        if ($t -and -not $t.StartsWith('#')) { $key = $t; break }
    }
    if (-not $key) {
        foreach ($name in @('ANTHROPIC_API_KEY', 'XAI_API_KEY', 'OPENAI_API_KEY')) {
            $v = [Environment]::GetEnvironmentVariable($name)
            if ($v) { $key = $v.Trim(); break }
        }
    }
    if (-not $key) { return $null }
    return [pscustomobject]@{ Key = $key; Provider = (Get-KeyProvider $key) }
}

function New-AiPrompt($Goals, [string]$Focus, [string[]]$Never, [int]$Count, [int]$MaxWords) {
    $system = @(
        "You write personal affirmations for the user's own subliminal player. The user picked these goals for themself.",
        'Rules for every line:',
        '- First person, present tense, as if it is already true.',
        "- Positive wording only. Avoid these words: not, never, no, stop, will, want to, and contractions like don't or can't.",
        "- One idea per line, at most $MaxWords words, plain words, no emojis, no numbering.",
        '- Mix three kinds of lines: who I am becoming; why I care; when-then triggers like "When X happens, I do Y".',
        '- Mindset, habits, confidence, and feelings only. No health or medical claims.',
        'Reply with only a JSON array of strings.'
    ) -join "`n"
    $user = New-Object System.Collections.Generic.List[string]
    $user.Add('My goals:')
    foreach ($g in @($Goals)) { $user.Add('- ' + $g) }
    if ($Focus) { $user.Add("Today's spotlight goal (give it about half the lines): $Focus") }
    if (@($Never).Count -gt 0) { $user.Add('Never use these words or phrases: ' + (@($Never) -join ', ')) }
    $user.Add("Write $Count lines.")
    return [pscustomobject]@{ System = $system; User = ($user -join "`n") }
}

function Invoke-AiRequest($AiKey, $Settings, [string]$System, [string]$User) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $provider = $AiKey.Provider
    $model = [string]$Settings.models.$provider
    if ($provider -eq 'anthropic') {
        $uri = 'https://api.anthropic.com/v1/messages'
        $headers = @{ 'x-api-key' = $AiKey.Key; 'anthropic-version' = '2023-06-01' }
        $body = @{ model = $model; max_tokens = 2000; system = $System; messages = @(@{ role = 'user'; content = $User }) }
    } else {
        $base = 'https://api.openai.com'
        if ($provider -eq 'xai') { $base = 'https://api.x.ai' }
        $uri = $base + '/v1/chat/completions'
        $headers = @{ Authorization = 'Bearer ' + $AiKey.Key }
        $body = @{ model = $model; messages = @(@{ role = 'system'; content = $System }, @{ role = 'user'; content = $User }) }
    }
    # Windows PowerShell 5.1 sends string bodies as Latin-1, so send UTF-8 bytes.
    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 6))
    $response = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body $bytes -ContentType 'application/json; charset=utf-8' -TimeoutSec 90
    if ($provider -eq 'anthropic') {
        return (@($response.content) | Where-Object { $_.type -eq 'text' } | ForEach-Object { $_.text }) -join "`n"
    }
    return [string]$response.choices[0].message.content
}

# Only a JSON list counts. Anything else (like a refusal) gives no lines.
function ConvertFrom-AiText([string]$Text) {
    if (-not $Text) { return @() }
    $start = $Text.IndexOf('[')
    $end = $Text.LastIndexOf(']')
    if ($start -lt 0 -or $end -le $start) { return @() }
    try {
        $items = $Text.Substring($start, $end - $start + 1) | ConvertFrom-Json
        return @($items | ForEach-Object { [string]$_ })
    } catch {
        return @()
    }
}

function Get-ErrorText($ErrorRecord) {
    $text = $ErrorRecord.Exception.Message
    if ($ErrorRecord.ErrorDetails -and $ErrorRecord.ErrorDetails.Message) { $text += ' ' + $ErrorRecord.ErrorDetails.Message }
    $text = $text -replace '\s+', ' '
    if ($text.Length -gt 300) { $text = $text.Substring(0, 300) }
    return $text
}

# One attempt only. Any failure returns no lines plus a reason, and the phrase banks fill in.
function Get-AiLines {
    param([string]$Root, $Settings, $GoalData, [string]$Focus, [int]$Count)
    $result = [pscustomobject]@{ Lines = @(); Provider = ''; Problem = '' }
    $ai = Get-AiKey $Root
    if ($null -eq $ai) { return $result }
    $result.Provider = $ai.Provider
    if (-not $ai.Provider) {
        $result.Problem = 'the key in my-key.txt should start with sk-ant- (Claude), xai- (Grok), or sk- (OpenAI)'
        return $result
    }
    $prompt = New-AiPrompt $GoalData.Goals $Focus $GoalData.Never $Count $Settings.maxWords
    try {
        $text = Invoke-AiRequest $ai $Settings $prompt.System $prompt.User
        $result.Lines = @(ConvertFrom-AiText $text)
        if ($result.Lines.Count -eq 0) { $result.Problem = 'the AI answered without a list of lines (it may have said no)' }
    } catch {
        $result.Problem = (Get-ErrorText $_).Replace($ai.Key, '[key]')
    }
    return $result
}

# ---------- making one ----------

function New-Subliminal {
    param(
        [string]$Root,
        [datetime]$Date = (Get-Date),
        [int]$Seed = 0,
        $Settings,
        $GoalData,
        [switch]$NoAi
    )
    if ($null -eq $Settings) { $Settings = Read-Settings $Root }
    if ($null -eq $GoalData) { $GoalData = Read-Goals (Join-Path $Root 'my-goals.txt') }
    if ($Seed -eq 0) { $rng = New-Object System.Random } else { $rng = New-Object System.Random($Seed) }
    $banks = Read-PhraseBanks (Join-Path $Root 'phrases')
    $goals = @($GoalData.Goals)
    $never = @($GoalData.Never)
    $focusIndex = Get-FocusIndex $Date $goals.Count
    $focus = ''
    if ($focusIndex -ge 0) { $focus = $goals[$focusIndex] }

    $seen = @{}
    $always = New-Object System.Collections.Generic.List[string]
    foreach ($line in $GoalData.Always) {
        $key = Get-LineKey $line
        if ($key -and -not $seen.ContainsKey($key)) { $seen[$key] = $true; $always.Add($line.Trim()) }
    }
    $target = [Math]::Max(5, [int]$Settings.lines - $always.Count)

    $made = New-Object System.Collections.Generic.List[string]
    $aiCount = 0
    $aiName = ''
    $aiProblem = ''
    if (-not $NoAi) {
        $ai = Get-AiLines -Root $Root -Settings $Settings -GoalData $GoalData -Focus $focus -Count $target
        if ($ai.Provider) { $aiName = $script:ProviderNames[$ai.Provider] }
        if (-not $aiName) { $aiName = 'AI' }
        foreach ($line in $ai.Lines) {
            if ($made.Count -ge $target) { break }
            if (Add-CleanLine $made $seen $line $never $Settings.maxWords) { $aiCount++ }
        }
        if ($ai.Problem) {
            $aiProblem = $ai.Problem
            Add-LogLine $Root ("$aiName skipped, phrase banks used instead: " + $aiProblem)
        }
    }

    $offline = New-OfflineLines -Goals $goals -FocusIndex $focusIndex -Banks $banks -Count ($target - $made.Count) `
        -Never $never -MaxWords $Settings.maxWords -Rng $rng -Seen $seen
    foreach ($line in $offline) { $made.Add($line) }

    $source = 'offline phrase banks'
    if ($aiCount -gt 0 -and $offline.Count -gt 0) { $source = "$aiName AI ($aiCount) + phrase banks ($($offline.Count))" }
    elseif ($aiCount -gt 0) { $source = "$aiName AI" }

    $lines = @($always) + @(Get-Shuffled $made $rng)
    return [pscustomobject]@{
        Lines     = $lines
        Focus     = $focus
        Source    = $source
        AiProblem = $aiProblem
    }
}

function Get-Slug([string]$Text) {
    $slug = ($Text.ToLowerInvariant() -replace '[^a-z0-9]+', '-').Trim('-')
    if ($slug.Length -gt 40) { $slug = $slug.Substring(0, 40).Trim('-') }
    if (-not $slug) { $slug = 'subliminal' }
    return $slug
}

function Find-MindzoomFolder([string]$LocalAppData = $env:LOCALAPPDATA, [string]$AppData = $env:APPDATA) {
    foreach ($base in @($LocalAppData, $AppData)) {
        if (-not $base) { continue }
        $mz = Join-Path $base 'Mindzoom'
        if (-not (Test-Path -LiteralPath $mz)) { continue }
        $versions = @(Get-ChildItem -LiteralPath $mz -Directory -ErrorAction SilentlyContinue |
                Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'affirmations') } |
                Sort-Object { Get-VersionKey $_.Name } -Descending)
        if ($versions.Count -gt 0) { return (Join-Path $versions[0].FullName 'affirmations') }
        $direct = Join-Path $mz 'affirmations'
        if (Test-Path -LiteralPath $direct) { return $direct }
    }
    return $null
}

function Get-VersionKey([string]$Name) {
    $m = [regex]::Match($Name, '\d+(\.\d+){0,3}')
    if ($m.Success) {
        $v = $m.Value
        if ($v -notmatch '\.') { $v += '.0' }
        $parsed = $null
        if ([version]::TryParse($v, [ref]$parsed)) { return $parsed }
    }
    return [version]'0.0'
}

function Resolve-MindzoomFolder($Settings) {
    $saved = [string]$Settings.mindzoomFolder
    if ($saved -and (Test-Path -LiteralPath $saved)) { return $saved }
    return Find-MindzoomFolder
}

function Get-LastMade([string]$Root) {
    $path = Join-Path (Get-MadeFolder $Root) 'last-made.txt'
    $lines = @(Read-TextLines $path)
    if ($lines.Count -gt 0) { return $lines[0].Trim() }
    return ''
}

# Writes the Mindzoom copy (plain lines only) and the archive copy (with # notes), then logs it.
function Save-Subliminal {
    param([string]$Root, $Result, $Settings, [datetime]$Date = (Get-Date), [string]$Mode = 'now', [string]$FileName = '')
    if (-not $FileName) { $FileName = [string]$Settings.dailyFileName }
    $made = Get-MadeFolder $Root
    $day = $Date.ToString('yyyy-MM-dd')

    $archive = Join-Path $made ($day + '_' + (Get-Slug $Result.Focus) + '.txt')
    $n = 2
    while (Test-Path -LiteralPath $archive) {
        $archive = Join-Path $made ($day + '_' + (Get-Slug $Result.Focus) + '_' + $n + '.txt')
        $n++
    }
    $notes = @(
        ('# Subliminal made ' + $Date.ToString('yyyy-MM-dd HH:mm') + " ($Mode)"),
        ('# Spotlight goal: ' + $Result.Focus),
        ('# Made by: ' + $Result.Source),
        ('# Lines: ' + @($Result.Lines).Count),
        ''
    )
    Write-TextLines $archive ($notes + @($Result.Lines))

    $mindzoomPath = $null
    $problem = ''
    $folder = Resolve-MindzoomFolder $Settings
    if ($folder) {
        try {
            $mindzoomPath = Join-Path $folder $FileName
            Write-TextLines $mindzoomPath @($Result.Lines)
        } catch {
            $problem = $_.Exception.Message
            $mindzoomPath = $null
        }
    } else {
        $problem = 'Mindzoom folder was missing'
    }

    if ($Mode -ne 'custom') { Write-TextLines (Join-Path $made 'last-made.txt') @($day) }
    $where = 'made/ only'
    if ($mindzoomPath) { $where = 'Mindzoom' }
    $msg = "$Mode | spotlight: $($Result.Focus) | $($Result.Source) | $(@($Result.Lines).Count) lines | saved to $where"
    if ($problem) { $msg += " ($problem)" }
    Add-LogLine $Root $msg

    return [pscustomobject]@{
        Lines        = @($Result.Lines)
        Focus        = $Result.Focus
        Source       = $Result.Source
        MindzoomPath = $mindzoomPath
        ArchivePath  = $archive
        Problem      = $problem
        AiProblem    = $Result.AiProblem
    }
}

function Enter-Lock([string]$Root) {
    $path = Join-Path (Get-MadeFolder $Root) '.lock'
    try {
        return [System.IO.File]::Open($path, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
    } catch {
        return $null
    }
}

# One pass only: a lock stops two copies running at once, and daily mode stops if today's is already made.
function Invoke-Make {
    param([string]$Root, [string]$Mode = 'now', [datetime]$Date = (Get-Date), [int]$Seed = 0)
    $lock = Enter-Lock $Root
    if ($null -eq $lock) { return $null }
    try {
        if ($Mode -eq 'daily' -and (Get-LastMade $Root) -eq $Date.ToString('yyyy-MM-dd')) { return $null }
        if ($Mode -eq 'daily' -and $Seed -eq 0) { $Seed = [int]$Date.ToString('yyyyMMdd') }
        $settings = Read-Settings $Root
        $result = New-Subliminal -Root $Root -Date $Date -Seed $Seed -Settings $settings
        return Save-Subliminal -Root $Root -Result $result -Settings $settings -Date $Date -Mode $Mode
    } finally {
        $lock.Dispose()
    }
}

# Waits up to $Seconds for the lock so a daily run in progress never throws away your edits.
function Wait-Lock([string]$Root, [int]$Seconds = 15) {
    for ($i = 0; $i -lt $Seconds; $i++) {
        $lock = Enter-Lock $Root
        if ($null -ne $lock) { return $lock }
        Start-Sleep -Seconds 1
    }
    return $null
}

# ---------- make one with me ----------

# Turns the three answers into goals the engine understands, plus an "I am ..." line.
function New-WithMeGoals([string]$Feel, [string]$More, [string]$Becoming) {
    $goals = New-Object System.Collections.Generic.List[string]
    $lines = New-Object System.Collections.Generic.List[string]
    $f = ([string]$Feel).Trim().TrimEnd('.', '!')
    if ($f) {
        if ($f -match '^(?i)(feel|feeling)\b') { $goals.Add($f) } else { $goals.Add('Feel ' + $f) }
    }
    $m = ([string]$More).Trim().TrimEnd('.', '!')
    if ($m) {
        $first = @($m -split '\s+')[0].ToLowerInvariant()
        if ($script:Verbs -contains $first -or $first.EndsWith('ing') -or $m -match "^(?i)(I|I'm|My)\b") { $goals.Add($m) } else { $goals.Add('Do ' + $m) }
    }
    $b = ([string]$Becoming).Trim().TrimEnd('.', '!')
    if ($b) {
        if ($b -match "^(?i)(I am|I'm|Im)\s+(.+)$") { $b = $Matches[2] }
        $goals.Add('Be ' + $b)
        $lines.Add('I am ' + $b + '.')
    }
    return [pscustomobject]@{ Goals = $goals.ToArray(); Lines = $lines.ToArray() }
}

function Get-SafeFileName([string]$Name) {
    $n = ([string]$Name -replace '[\\/:*?"<>|]', '').Trim()
    $n = $n -replace '\s+', ' '
    if ($n.Length -gt 60) { $n = $n.Substring(0, 60).Trim() }
    return $n
}

# Adds goals to the [goals] section of my-goals.txt, skipping ones already there.
function Add-GoalsToFile([string]$Path, [string[]]$Goals) {
    $lines = New-Object System.Collections.Generic.List[string]
    foreach ($l in (Read-TextLines $Path)) { $lines.Add($l) }
    while ($lines.Count -gt 0 -and $lines[$lines.Count - 1] -eq '') { $lines.RemoveAt($lines.Count - 1) }
    $existing = @{}
    foreach ($g in (Read-Goals $Path).Goals) { $existing[$g.ToLowerInvariant()] = $true }
    $new = @($Goals | Where-Object { $_ -and -not $existing.ContainsKey($_.Trim().ToLowerInvariant()) } | ForEach-Object { ConvertTo-Capital $_.Trim() })
    if ($new.Count -eq 0) { return 0 }

    $header = -1
    for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i].Trim().ToLowerInvariant() -eq '[goals]') { $header = $i; break } }
    if ($header -lt 0) {
        $lines.Add('')
        $lines.Add('[goals]')
        foreach ($g in $new) { $lines.Add($g) }
    } else {
        $next = $lines.Count
        for ($i = $header + 1; $i -lt $lines.Count; $i++) { if ($lines[$i].Trim() -match '^\[.+\]$') { $next = $i; break } }
        $at = $next
        while ($at -gt $header + 1 -and $lines[$at - 1].Trim() -eq '') { $at-- }
        $lines.InsertRange($at, [string[]]$new)
    }
    Write-TextLines $Path $lines.ToArray()
    return $new.Count
}

function Show-NumberedLines($Lines) {
    Write-Host ''
    for ($i = 0; $i -lt $Lines.Count; $i++) { Write-Host ('{0,3}  {1}' -f ($i + 1), $Lines[$i]) }
    Write-Host ''
}

function Invoke-WithMe([string]$Root) {
    $settings = Read-Settings $Root
    $goalsPath = Join-Path $Root 'my-goals.txt'
    $goalData = Read-Goals $goalsPath
    Write-Host ''
    Write-Host "Let's make one together. Press Enter to skip any question." -ForegroundColor Cyan
    $feel = Read-Host '1) How do you want to feel? (example: happy, pretty, and calm)'
    $more = Read-Host '2) What do you want to do more of? (example: post my 3D art)'
    $becoming = Read-Host '3) Who are you becoming? (example: a confident girly artist)'
    $answers = New-WithMeGoals $feel $more $becoming
    if ($answers.Goals.Count -eq 0) { Write-Host 'No answers, so nothing was made.'; return }

    $data = [pscustomobject]@{ Goals = $answers.Goals; Always = @($answers.Lines) + @($goalData.Always); Never = $goalData.Never }
    Write-Host 'Writing your lines...'
    $result = New-Subliminal -Root $Root -Settings $settings -GoalData $data
    if ($result.AiProblem) { Write-Host ("The AI had a problem, so the phrase banks filled in: " + $result.AiProblem) -ForegroundColor Yellow }
    $lines = New-Object System.Collections.Generic.List[string]
    foreach ($l in $result.Lines) { $lines.Add($l) }

    while ($true) {
        Show-NumberedLines $lines
        Write-Host 'Type a number to drop that line (or a few, like 3 7 12), + and your own line to add one,'
        Write-Host 'R for fresh lines, or just press Enter when it looks good.'
        $answer = Read-Host '>'
        if (-not $answer -or -not $answer.Trim()) { break }
        if ($answer -match '^\s*\+\s*(.+)$') {
            $lines.Add((Format-Line $Matches[1]))
            continue
        }
        if ($answer -match '^\s*[rR]\s*$') {
            $result = New-Subliminal -Root $Root -Settings $settings -GoalData $data
            $lines.Clear()
            foreach ($l in $result.Lines) { $lines.Add($l) }
            continue
        }
        $numbers = @([regex]::Matches($answer, '\d+') | ForEach-Object { [int]$_.Value } | Where-Object { $_ -ge 1 -and $_ -le $lines.Count } | Sort-Object -Unique -Descending)
        if ($numbers.Count -eq 0) { Write-Host 'Type a number, + and a line, R, or press Enter.' -ForegroundColor Yellow; continue }
        foreach ($n in $numbers) { $lines.RemoveAt($n - 1) }
    }
    if ($lines.Count -eq 0) { Write-Host 'Every line was dropped, so nothing was saved.'; return }

    Write-Host ''
    Write-Host 'Save it as:'
    Write-Host "  1  Today's daily subliminal (replaces today's file in Mindzoom)"
    Write-Host '  2  Its own Mindzoom file with a name you pick'
    $choice = Read-Host 'Pick 1 or 2 (Enter = 1)'
    $mode = 'with me'
    $fileName = ''
    if ($choice -and $choice.Trim() -eq '2') {
        $name = Get-SafeFileName (Read-Host 'Name it (example: Confident Artist)')
        if (-not $name) { $name = 'Made With Me' }
        $fileName = '001 ' + $name + '.txt'
        $mode = 'custom'
    }
    $final = [pscustomobject]@{
        Lines     = $lines.ToArray()
        Focus     = $answers.Goals[0]
        Source    = $result.Source + ', picked with you'
        AiProblem = ''
    }
    $lock = Wait-Lock $Root
    try {
        $saved = Save-Subliminal -Root $Root -Result $final -Settings $settings -Mode $mode -FileName $fileName
    } finally {
        if ($null -ne $lock) { $lock.Dispose() }
    }
    Show-Result $saved

    $keep = Read-Host 'Add your answers to my-goals.txt so the daily ones use them too? (y/N)'
    if ($keep -match '^\s*[yY]') {
        $added = Add-GoalsToFile $goalsPath $answers.Goals
        Write-Host "Added $added goal(s) to my-goals.txt."
    }
}

# ---------- screens ----------

function Show-Result($Saved) {
    if ($null -eq $Saved) {
        Write-Host 'Another copy is making one right now. Try again in a minute.' -ForegroundColor Yellow
        return
    }
    Write-Host ''
    Write-Host ("Made " + $Saved.Lines.Count + " lines (" + $Saved.Source + ").") -ForegroundColor Green
    if ($Saved.AiProblem) { Write-Host ("The AI had a problem, so the phrase banks filled in: " + $Saved.AiProblem) -ForegroundColor Yellow }
    if ($Saved.Focus) { Write-Host ("Today's spotlight: " + $Saved.Focus) }
    if ($Saved.MindzoomPath) {
        Write-Host ("In Mindzoom as: " + (Split-Path -Leaf $Saved.MindzoomPath))
    } else {
        Write-Host 'Mindzoom folder was missing, so it is saved in the made folder only. Run Setup to pick the folder.' -ForegroundColor Yellow
    }
    Write-Host ("Copy kept in: " + $Saved.ArchivePath)
    Write-Host ''
    $preview = [Math]::Min(6, $Saved.Lines.Count)
    for ($i = 0; $i -lt $preview; $i++) { Write-Host ('  ' + $Saved.Lines[$i]) -ForegroundColor Magenta }
    if ($Saved.Lines.Count -gt $preview) { Write-Host ('  ...and ' + ($Saved.Lines.Count - $preview) + ' more') }
    Write-Host ''
}

function Get-WriterText([string]$Root) {
    $ai = Get-AiKey $Root
    if ($null -eq $ai) { return 'phrase banks' }
    if (-not $ai.Provider) { return 'phrase banks (key type unknown)' }
    return $script:ProviderNames[$ai.Provider] + ' AI + phrase banks'
}

function Show-Status([string]$Root) {
    $settings = Read-Settings $Root
    $goals = Read-Goals (Join-Path $Root 'my-goals.txt')
    $folder = Resolve-MindzoomFolder $settings
    Write-Host ''
    Write-Host 'Subliminal Maker status' -ForegroundColor Cyan
    Write-Host ('  Daily: ' + (Get-DailyText) + '  at ' + $settings.dailyTime + ' and when you log in')
    if ($folder) { Write-Host "  Mindzoom folder: $folder" } else { Write-Host '  Mindzoom folder: missing (run Setup)' -ForegroundColor Yellow }
    Write-Host ('  Daily file name: ' + $settings.dailyFileName)
    Write-Host ('  Written by: ' + (Get-WriterText $Root))
    Write-Host ("  Goals: " + @($goals.Goals).Count + "   Always-include lines: " + @($goals.Always).Count + "   Never-include: " + @($goals.Never).Count)
    $last = Get-LastMade $Root
    if ($last) { Write-Host "  Last made: $last" } else { Write-Host '  Last made: still waiting for the first one' }
    Write-Host ('  History and log: ' + (Get-MadeFolder $Root))
    Write-Host ''
}

# ---------- daily task ----------

$script:TaskName = 'Subliminal Maker Daily'

function Test-TaskSupport {
    return [bool](Get-Command Register-ScheduledTask -ErrorAction SilentlyContinue)
}

function Get-DailyTask {
    if (-not (Test-TaskSupport)) { return $null }
    return Get-ScheduledTask -TaskName $script:TaskName -ErrorAction SilentlyContinue
}

function Get-DailyText {
    if ($null -eq (Get-DailyTask)) { return 'OFF' }
    $info = Get-ScheduledTaskInfo -TaskName $script:TaskName -ErrorAction SilentlyContinue
    if ($info -and $info.NextRunTime) { return 'ON (next: ' + $info.NextRunTime.ToString('ddd HH:mm') + ')' }
    return 'ON'
}

function Get-DailyTime($Settings) {
    try {
        return [datetime]::ParseExact([string]$Settings.dailyTime, 'HH:mm', [System.Globalization.CultureInfo]::InvariantCulture)
    } catch {
        return [datetime]::Today.AddHours(8)
    }
}

# A normal Windows scheduled task for your own account: visible in Task Scheduler, removed completely by Disable-Daily.
function Enable-Daily([string]$Root) {
    if (-not (Test-TaskSupport)) {
        Write-Host 'The daily task needs Windows.' -ForegroundColor Yellow
        return $false
    }
    $settings = Read-Settings $Root
    $scriptPath = Join-Path $Root 'subliminal.ps1'
    $argument = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $scriptPath + '" -Daily'
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argument -WorkingDirectory $Root
    $user = $env:USERDOMAIN + '\' + $env:USERNAME
    $morning = New-ScheduledTaskTrigger -Daily -At (Get-DailyTime $settings)
    $logon = New-ScheduledTaskTrigger -AtLogOn -User $user
    $taskSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew
    $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
    $description = 'Makes a fresh subliminal from my-goals.txt once a day and puts it in Mindzoom. Turn it off from the Subliminal Maker menu.'
    try {
        Register-ScheduledTask -TaskName $script:TaskName -Action $action -Trigger @($morning, $logon) -Settings $taskSettings `
            -Principal $principal -Description $description -Force -ErrorAction Stop | Out-Null
        Add-LogLine $Root 'daily task turned ON (morning + login)'
        return $true
    } catch {
        try {
            Register-ScheduledTask -TaskName $script:TaskName -Action $action -Trigger @($morning) -Settings $taskSettings `
                -Principal $principal -Description $description -Force -ErrorAction Stop | Out-Null
            Write-Host 'Windows only allowed the morning time (the at-login start needs admin), so that is what is set.' -ForegroundColor Yellow
            Add-LogLine $Root 'daily task turned ON (morning only)'
            return $true
        } catch {
            Write-Host ('Windows said no to the daily task: ' + $_.Exception.Message) -ForegroundColor Red
            Add-LogLine $Root ('daily task could not be turned on: ' + $_.Exception.Message)
            return $false
        }
    }
}

function Disable-Daily([string]$Root) {
    if (-not (Test-TaskSupport)) { return $false }
    if (Get-DailyTask) {
        Unregister-ScheduledTask -TaskName $script:TaskName -Confirm:$false
        Add-LogLine $Root 'daily task turned OFF'
    }
    return $true
}

function Switch-Daily([string]$Root) {
    if ($null -ne (Get-DailyTask)) {
        $answer = Read-Host 'Daily is ON. Turn it off? (y/N)'
        if ($answer -match '^\s*[yY]') {
            if (Disable-Daily $Root) { Write-Host 'Daily is OFF. Your Mindzoom file stays as it is until you make a new one.' }
        }
        return
    }
    if (Enable-Daily $Root) {
        $settings = Read-Settings $Root
        Write-Host ('Daily is ON. A fresh one lands in Mindzoom every day at ' + $settings.dailyTime + ' (or when you log in, if that is later).') -ForegroundColor Green
    }
}

# ---------- menu and setup ----------

function Open-Goals([string]$Root) {
    $path = Join-Path $Root 'my-goals.txt'
    if ($env:OS -ne 'Windows_NT') {
        Write-Host "Open this file to change your goals: $path"
        return
    }
    Write-Host 'Opening my-goals.txt in Notepad. Save and close it when you are done.'
    Start-Process -FilePath 'notepad.exe' -ArgumentList ('"' + $path + '"') -Wait
    $answer = Read-Host 'Make a fresh one now with your changes? (Y/n)'
    if ($answer -notmatch '^\s*[nN]') { Show-Result (Invoke-Make -Root $Root -Mode 'now') }
}

function New-DesktopShortcut([string]$Root) {
    try {
        $desktop = [Environment]::GetFolderPath('Desktop')
        $shell = New-Object -ComObject WScript.Shell
        $link = $shell.CreateShortcut((Join-Path $desktop 'Subliminal Maker.lnk'))
        $link.TargetPath = Join-Path $Root 'Subliminal.bat'
        $link.WorkingDirectory = $Root
        $link.Description = 'Make, change, or turn on your daily subliminal'
        $link.Save()
        return $true
    } catch {
        return $false
    }
}

function Read-SecretLine([string]$Prompt) {
    if ([Console]::IsInputRedirected) { return ([string](Read-Host -Prompt $Prompt)).Trim() }
    $secure = Read-Host -Prompt $Prompt -AsSecureString
    if ($null -eq $secure -or $secure.Length -eq 0) { return '' }
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim() }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Invoke-Setup([string]$Root) {
    Write-Host ''
    Write-Host 'Subliminal Maker setup' -ForegroundColor Magenta
    Write-Host ''
    $settings = Read-Settings $Root

    $found = Find-MindzoomFolder
    if ($found) {
        Write-Host "1) Found Mindzoom's affirmations folder: $found" -ForegroundColor Green
        $settings.mindzoomFolder = ''
    } else {
        Write-Host "1) Mindzoom's affirmations folder was missing from the usual spot." -ForegroundColor Yellow
        Write-Host '   Paste its path here (or drag the folder into this window), or press Enter to skip.'
        while ($true) {
            $typed = ([string](Read-Host '   Folder')).Trim().Trim('"')
            if (-not $typed) { break }
            if (Test-Path -LiteralPath $typed -PathType Container) {
                $settings.mindzoomFolder = (Resolve-Path -LiteralPath $typed).Path
                Write-Host '   Saved.' -ForegroundColor Green
                break
            }
            Write-Host '   That folder is missing. Try again, or press Enter to skip.'
        }
    }
    Save-Settings $Root $settings

    Write-Host ''
    $ai = Get-AiKey $Root
    if ($ai -and $ai.Provider) {
        Write-Host ('2) AI key found: ' + $script:ProviderNames[$ai.Provider]) -ForegroundColor Green
    } else {
        Write-Host '2) Optional: paste an AI key so an AI writes fresh lines each day.'
        Write-Host '   Claude keys start with sk-ant-, Grok keys with xai-, OpenAI keys with sk-.'
        Write-Host '   Press Enter to skip. It works without one, using the built-in phrase banks.'
        $key = Read-SecretLine '   Key'
        if ($key) {
            Write-TextLines (Join-Path $Root 'my-key.txt') @($key)
            $provider = Get-KeyProvider $key
            if ($provider) { Write-Host ('   Saved your ' + $script:ProviderNames[$provider] + ' key in my-key.txt.') -ForegroundColor Green }
            else { Write-Host '   Saved, but that key type is unknown, so the phrase banks will be used.' -ForegroundColor Yellow }
        }
    }

    Write-Host ''
    if ($env:OS -eq 'Windows_NT' -and (New-DesktopShortcut $Root)) {
        Write-Host '3) Added a "Subliminal Maker" shortcut to your desktop.' -ForegroundColor Green
    } else {
        Write-Host '3) Open Subliminal.bat in this folder any time for the menu.'
    }

    Write-Host ''
    $daily = Read-Host '4) Turn on the daily subliminal? It runs every morning and when you log in. (Y/n)'
    if ($daily -notmatch '^\s*[nN]') {
        if (Enable-Daily $Root) { Write-Host ('   Daily is ON (' + $settings.dailyTime + ' and at login).') -ForegroundColor Green }
    }

    Write-Host ''
    Write-Host '5) Making your first one now...'
    Show-Result (Invoke-Make -Root $Root -Mode 'now')
    Write-Host ('Last step: in Mindzoom, pick "' + [System.IO.Path]::GetFileNameWithoutExtension([string]$settings.dailyFileName) + '" as your affirmations.') -ForegroundColor Cyan
    Write-Host 'Leave it picked. The words inside change by themselves every day.'
}

function Show-Menu([string]$Root) {
    while ($true) {
        $settings = Read-Settings $Root
        $mindzoom = 'found'
        if (-not (Resolve-MindzoomFolder $settings)) { $mindzoom = 'missing (run Setup)' }
        Write-Host ''
        Write-Host '  Subliminal Maker' -ForegroundColor Magenta
        Write-Host '  ----------------'
        Write-Host ('  Daily: ' + (Get-DailyText) + '   Mindzoom: ' + $mindzoom + '   Writer: ' + (Get-WriterText $Root))
        Write-Host ''
        Write-Host "  1  Make today's subliminal now"
        Write-Host '  2  Make one with me'
        Write-Host '  3  Edit my goals'
        Write-Host '  4  Turn daily ON or OFF'
        Write-Host '  5  Status'
        Write-Host '  Q  Quit'
        Write-Host ''
        $choice = Read-Host '  Pick one'
        if ($null -eq $choice) { return }
        switch ($choice.Trim().ToUpperInvariant()) {
            '1' { Show-Result (Invoke-Make -Root $Root -Mode 'now') }
            '2' { Invoke-WithMe $Root }
            '3' { Open-Goals $Root }
            '4' { Switch-Daily $Root }
            '5' { Show-Status $Root }
            'Q' { return }
            default { Write-Host '  Pick 1 to 5, or Q to quit.' -ForegroundColor Yellow }
        }
    }
}

# ---------- start ----------

if ($MyInvocation.InvocationName -eq '.') { return }

if ($Daily) {
    try {
        [void](Invoke-Make -Root $Root -Mode 'daily')
        exit 0
    } catch {
        Add-LogLine $Root ("daily run failed: " + $_.Exception.Message)
        exit 1
    }
}
if ($Now) { Show-Result (Invoke-Make -Root $Root -Mode 'now'); exit 0 }
if ($WithMe) { Invoke-WithMe $Root; exit 0 }
if ($Status) { Show-Status $Root; exit 0 }
if ($On) { if (Enable-Daily $Root) { Write-Host 'Daily is ON.' }; exit 0 }
if ($Off) { [void](Disable-Daily $Root); Write-Host 'Daily is OFF.'; exit 0 }
if ($Setup) { Invoke-Setup $Root; exit 0 }
Show-Menu $Root
