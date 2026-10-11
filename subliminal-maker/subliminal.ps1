<#
Subliminal Maker
Writes fresh affirmations from my-goals.txt into Mindzoom's affirmations folder.

  subliminal.ps1            open the menu
  subliminal.ps1 -Now       make today's subliminal now
  subliminal.ps1 -Daily     what the daily task runs: makes one only if today's is still missing
  subliminal.ps1 -Status    show what is set up

Keep this file plain ASCII: Windows PowerShell 5.1 reads scripts without a BOM as ANSI.
#>
[CmdletBinding()]
param(
    [switch]$Now,
    [switch]$Daily,
    [switch]$Status,
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

function Write-Log([string]$Root, [string]$Message) {
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
            Write-Log $Root "settings.json could not be read, so defaults were used: $($_.Exception.Message)"
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
            Write-Log $Root ("$aiName skipped, phrase banks used instead: " + $aiProblem)
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
        try { return [version]$v } catch { }
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
    Write-Log $Root $msg

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

function Show-Status([string]$Root) {
    $settings = Read-Settings $Root
    $goals = Read-Goals (Join-Path $Root 'my-goals.txt')
    $folder = Resolve-MindzoomFolder $settings
    Write-Host ''
    Write-Host 'Subliminal Maker status' -ForegroundColor Cyan
    if ($folder) { Write-Host "  Mindzoom folder: $folder" } else { Write-Host '  Mindzoom folder: missing (run Setup)' -ForegroundColor Yellow }
    Write-Host ("  Goals: " + @($goals.Goals).Count + "   Always-include lines: " + @($goals.Always).Count + "   Never-include: " + @($goals.Never).Count)
    $last = Get-LastMade $Root
    if ($last) { Write-Host "  Last made: $last" } else { Write-Host '  Last made: still waiting for the first one' }
    Write-Host ''
}

# ---------- start ----------

if ($MyInvocation.InvocationName -eq '.') { return }

if ($Daily) {
    try {
        [void](Invoke-Make -Root $Root -Mode 'daily')
        exit 0
    } catch {
        Write-Log $Root ("daily run failed: " + $_.Exception.Message)
        exit 1
    }
}
if ($Status) { Show-Status $Root; exit 0 }
Show-Result (Invoke-Make -Root $Root -Mode 'now')
