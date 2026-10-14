#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.0' }
# Run from the subliminal-maker folder:  Invoke-Pester ./tests

BeforeAll {
    $script:MakerDir = Split-Path -Parent $PSScriptRoot
    . (Join-Path $script:MakerDir 'subliminal.ps1')

    $script:SavedEnv = @{}
    foreach ($name in @('LOCALAPPDATA', 'APPDATA', 'ANTHROPIC_API_KEY', 'XAI_API_KEY', 'OPENAI_API_KEY')) {
        $script:SavedEnv[$name] = [Environment]::GetEnvironmentVariable($name)
        [Environment]::SetEnvironmentVariable($name, $null)
    }

    function New-TestMaker {
        $dir = Join-Path $TestDrive ([guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $dir | Out-Null
        foreach ($item in @('subliminal.ps1', 'my-goals.txt', 'settings.json', 'phrases')) {
            Copy-Item -Path (Join-Path $script:MakerDir $item) -Destination $dir -Recurse
        }
        return $dir
    }

    function New-FakeMindzoom([string]$Version = 'Mindzoom3.1.0') {
        $lad = Join-Path $TestDrive ([guid]::NewGuid().ToString('N'))
        $aff = Join-Path (Join-Path (Join-Path $lad 'Mindzoom') $Version) 'affirmations'
        New-Item -ItemType Directory -Path $aff -Force | Out-Null
        $env:LOCALAPPDATA = $lad
        return $aff
    }
}

AfterAll {
    foreach ($name in $script:SavedEnv.Keys) { [Environment]::SetEnvironmentVariable($name, $script:SavedEnv[$name]) }
}

Describe 'Reading my-goals.txt' {
    It 'reads the three sections and skips notes' {
        $path = Join-Path $TestDrive 'goals.txt'
        Set-Content -LiteralPath $path -Value @('# note', '[goals]', 'Be calm', '# another', 'Post my art', '', '[always include]', 'I love me.', '[never include]', 'sad')
        $g = Read-Goals $path
        $g.Goals | Should -Be @('Be calm', 'Post my art')
        $g.Always | Should -Be @('I love me.')
        $g.Never | Should -Be @('sad')
    }

    It 'reads the shipped goals file' {
        $g = Read-Goals (Join-Path $script:MakerDir 'my-goals.txt')
        $g.Goals.Count | Should -BeGreaterThan 0
    }
}

Describe 'Turning goals into phrases' {
    It 'turns "<Goal>" into "<Expected>"' -ForEach @(
        @{ Goal = 'Stay girly and feminine all day'; Expected = 'staying girly and feminine all day' }
        @{ Goal = 'Create and post my 3D art'; Expected = 'creating and posting my 3D art' }
        @{ Goal = 'Confident at work'; Expected = 'being confident at work' }
        @{ Goal = 'Be a confident artist.'; Expected = 'being a confident artist' }
        @{ Goal = 'Get up early'; Expected = 'getting up early' }
        @{ Goal = 'To sit tall'; Expected = 'sitting tall' }
        @{ Goal = 'Dancing every day'; Expected = 'dancing every day' }
        @{ Goal = '3D modeling daily'; Expected = 'being 3D modeling daily' }
    ) {
        Convert-GoalToPhrase $Goal | Should -BeExactly $Expected
    }

    It 'leaves sentences like "<Goal>" alone' -ForEach @(
        @{ Goal = 'I am calm' }, @{ Goal = "I'm pretty" }, @{ Goal = 'My art is loved' }
    ) {
        Convert-GoalToPhrase $Goal | Should -BeNullOrEmpty
    }
}

Describe 'The rules filter' {
    It 'tidies "<Raw>"' -ForEach @(
        @{ Raw = '1. i am glowing'; Expected = 'I am glowing.' }
        @{ Raw = '- I shine'; Expected = 'I shine.' }
        @{ Raw = '"I am soft"'; Expected = 'I am soft.' }
        @{ Raw = 'I love my art! '; Expected = 'I love my art!' }
    ) {
        Format-Line $Raw | Should -BeExactly $Expected
    }

    It 'turns curly quotes into plain ones and drops emoji' {
        $raw = 'I' + [char]0x2019 + 'm happy ' + [char]::ConvertFromUtf32(0x1F496)
        Format-Line $raw | Should -BeExactly "I'm happy."
    }

    It 'drops "<Line>" because of <Why>' -ForEach @(
        @{ Line = 'I do not worry.'; Why = 'negative' }
        @{ Line = "I don't slouch."; Why = 'negative' }
        @{ Line = 'I will be confident.'; Why = 'future' }
        @{ Line = 'I want to be calm.'; Why = 'future' }
        @{ Line = 'My body heals itself.'; Why = 'health' }
        @{ Line = 'I am a very very very very very very very very very very very long line indeed.'; Why = 'too long' }
        @{ Line = 'I am sad and pretty.'; Why = 'contains' }
        @{ Line = '{G} comes naturally.'; Why = 'template' }
    ) {
        Get-LineProblem $Line @('sad') 16 | Should -Match $Why
    }

    It 'keeps a good line' {
        Get-LineProblem 'I am soft, pretty, and confident.' @() 16 | Should -BeNullOrEmpty
    }

    It 'every built-in phrase follows the rules' {
        $bad = @()
        foreach ($bank in (Read-PhraseBanks (Join-Path $script:MakerDir 'phrases'))) {
            foreach ($layer in $script:Layers) {
                foreach ($line in $bank.Layers[$layer]) {
                    $check = $line.Replace('{G}', 'Being calm').Replace('{g}', 'being calm')
                    $problem = Get-LineProblem (Format-Line $check) @() 16
                    if ($problem) { $bad += "$($bank.Name): $line ($problem)" }
                }
            }
        }
        $bad | Should -BeNullOrEmpty
    }

    It 'every theme has keywords and all three layers' {
        foreach ($bank in (Read-PhraseBanks (Join-Path $script:MakerDir 'phrases'))) {
            if ($bank.Name.StartsWith('_')) { continue }
            $bank.Keywords.Count | Should -BeGreaterThan 0 -Because $bank.Name
            foreach ($layer in $script:Layers) { $bank.Layers[$layer].Count | Should -BeGreaterThan 2 -Because "$($bank.Name) $layer" }
        }
    }
}

Describe 'Daily spotlight' {
    It 'moves to the next goal each day and loops around' {
        $d = [datetime]'2026-10-11'
        $picks = 0..5 | ForEach-Object { Get-FocusIndex $d.AddDays($_) 3 }
        ($picks | Select-Object -Unique).Count | Should -Be 3
        $picks[0] | Should -Be $picks[3]
        $picks[1] | Should -Be (($picks[0] + 1) % 3)
    }

    It 'gives the spotlight goal about half the lines' {
        $q = Get-GoalQuotas 3 1 30
        ($q | Measure-Object -Sum).Sum | Should -Be 30
        $q[1] | Should -Be 15
    }
}

Describe 'Making a subliminal' {
    BeforeEach {
        $root = New-TestMaker
    }

    It 'makes the set number of unique lines, with always-include lines first' {
        $r = New-Subliminal -Root $root -Date ([datetime]'2026-10-11') -Seed 42 -NoAi
        $r.Lines.Count | Should -Be 30
        $r.Lines[0] | Should -Be 'I love being me.'
        ($r.Lines | ForEach-Object { Get-LineKey $_ } | Select-Object -Unique).Count | Should -Be 30
        foreach ($line in ($r.Lines | Select-Object -Skip 1)) { Get-LineProblem $line @() 16 | Should -BeNullOrEmpty -Because $line }
    }

    It 'gives the same lines for the same day and seed' {
        $a = New-Subliminal -Root $root -Date ([datetime]'2026-10-11') -Seed 7 -NoAi
        $b = New-Subliminal -Root $root -Date ([datetime]'2026-10-11') -Seed 7 -NoAi
        $a.Lines | Should -Be $b.Lines
    }

    It 'never uses a never-include word' {
        Add-Content -LiteralPath (Join-Path $root 'my-goals.txt') -Value 'girly'
        $r = New-Subliminal -Root $root -Seed 3 -NoAi
        ($r.Lines | Where-Object { $_ -match 'girly' }).Count | Should -Be 0
        $r.Lines.Count | Should -Be 30
    }

    It 'still works with an empty goals list' {
        Set-Content -LiteralPath (Join-Path $root 'my-goals.txt') -Value @('[goals]', '[always include]', '[never include]')
        $r = New-Subliminal -Root $root -Seed 3 -NoAi
        $r.Lines.Count | Should -Be 30
    }
}

Describe 'Saving into Mindzoom' {
    BeforeEach {
        $root = New-TestMaker
        $aff = New-FakeMindzoom
        $mzFile = Join-Path $aff '000 Daily Subliminal.txt'
    }

    AfterEach {
        $env:LOCALAPPDATA = $null
    }

    It 'writes plain lines with no BOM, Windows line endings, and no notes' {
        $saved = Invoke-Make -Root $root -Mode 'daily' -Date ([datetime]'2026-10-11')
        $saved.MindzoomPath | Should -Be $mzFile
        $bytes = [System.IO.File]::ReadAllBytes($mzFile)
        ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB) | Should -BeFalse
        $text = [System.IO.File]::ReadAllText($mzFile)
        $text | Should -Match "`r`n"
        ($text -replace "`r`n", '') | Should -Not -Match "`n"
        ($text -split "`r`n" | Where-Object { $_.StartsWith('#') }).Count | Should -Be 0
        (Get-Content -LiteralPath $saved.ArchivePath -TotalCount 1) | Should -Match '^# Subliminal made 2026-10-11'
    }

    It 'makes the daily one only once per day' {
        $first = Invoke-Make -Root $root -Mode 'daily' -Date ([datetime]'2026-10-11 08:00')
        $before = [System.IO.File]::ReadAllText($mzFile)
        $second = Invoke-Make -Root $root -Mode 'daily' -Date ([datetime]'2026-10-11 19:00')
        $first | Should -Not -BeNullOrEmpty
        $second | Should -BeNullOrEmpty
        [System.IO.File]::ReadAllText($mzFile) | Should -BeExactly $before
        @(Get-ChildItem (Join-Path $root 'made') -Filter '2026-*').Count | Should -Be 1
        @(Get-Content (Join-Path (Join-Path $root 'made') 'log.txt')).Count | Should -Be 1
    }

    It 'makes a fresh one the next day' {
        [void](Invoke-Make -Root $root -Mode 'daily' -Date ([datetime]'2026-10-11'))
        $before = [System.IO.File]::ReadAllText($mzFile)
        $next = Invoke-Make -Root $root -Mode 'daily' -Date ([datetime]'2026-10-12')
        $next | Should -Not -BeNullOrEmpty
        [System.IO.File]::ReadAllText($mzFile) | Should -Not -BeExactly $before
    }

    It 'stops if another copy is running' {
        $lock = Enter-Lock $root
        try {
            Invoke-Make -Root $root -Mode 'now' | Should -BeNullOrEmpty
        } finally {
            $lock.Dispose()
        }
        Invoke-Make -Root $root -Mode 'now' | Should -Not -BeNullOrEmpty
    }

    It 'keeps a copy in made/ when Mindzoom is missing' {
        $env:LOCALAPPDATA = Join-Path $TestDrive 'nothing-here'
        $saved = Invoke-Make -Root $root -Mode 'now'
        $saved.MindzoomPath | Should -BeNullOrEmpty
        Test-Path -LiteralPath $saved.ArchivePath | Should -BeTrue
    }
}

Describe 'Finding Mindzoom' {
    AfterEach {
        $env:LOCALAPPDATA = $null
    }

    It 'picks the newest version folder' {
        $lad = Join-Path $TestDrive 'lad1'
        foreach ($v in @('Mindzoom3.9.0', 'Mindzoom3.10.0', 'Mindzoom2.0')) {
            New-Item -ItemType Directory -Path (Join-Path (Join-Path (Join-Path $lad 'Mindzoom') $v) 'affirmations') -Force | Out-Null
        }
        Find-MindzoomFolder $lad '' | Should -Match 'Mindzoom3\.10\.0'
    }

    It 'uses Mindzoom\affirmations when there is no version folder' {
        $lad = Join-Path $TestDrive 'lad2'
        New-Item -ItemType Directory -Path (Join-Path (Join-Path $lad 'Mindzoom') 'affirmations') -Force | Out-Null
        Find-MindzoomFolder $lad '' | Should -Be (Join-Path (Join-Path $lad 'Mindzoom') 'affirmations')
    }

    It 'returns nothing when Mindzoom is missing' {
        Find-MindzoomFolder (Join-Path $TestDrive 'empty') '' | Should -BeNullOrEmpty
    }

    It 'prefers a folder saved in settings, and falls back when it is gone' {
        $aff = New-FakeMindzoom
        $mine = Join-Path $TestDrive 'mine'
        New-Item -ItemType Directory -Path $mine | Out-Null
        Resolve-MindzoomFolder ([pscustomobject]@{ mindzoomFolder = $mine }) | Should -Be $mine
        Resolve-MindzoomFolder ([pscustomobject]@{ mindzoomFolder = (Join-Path $TestDrive 'gone') }) | Should -Be $aff
    }
}

Describe 'Settings' {
    It 'falls back to defaults when settings.json is broken' {
        $root = New-TestMaker
        Set-Content -LiteralPath (Join-Path $root 'settings.json') -Value '{ broken'
        $s = Read-Settings $root
        $s.lines | Should -Be 30
        $s.models.anthropic | Should -Not -BeNullOrEmpty
        Get-Content (Join-Path (Join-Path $root 'made') 'log.txt') | Should -Match 'defaults were used'
    }

    It 'keeps changed values and fills in missing ones' {
        $root = New-TestMaker
        Set-Content -LiteralPath (Join-Path $root 'settings.json') -Value '{ "lines": 12, "models": { "xai": "grok-x" } }'
        $s = Read-Settings $root
        $s.lines | Should -Be 12
        $s.models.xai | Should -Be 'grok-x'
        $s.dailyFileName | Should -Be '000 Daily Subliminal.txt'
    }
}

Describe 'Optional AI' {
    BeforeEach {
        $root = New-TestMaker
    }

    It 'knows the key type from how it starts' {
        Get-KeyProvider 'sk-ant-abc' | Should -Be 'anthropic'
        Get-KeyProvider 'xai-abc' | Should -Be 'xai'
        Get-KeyProvider 'sk-proj-abc' | Should -Be 'openai'
        Get-KeyProvider 'hello' | Should -Be ''
    }

    It 'reads a JSON list even inside a code fence' {
        $text = "Here you go`n" + '```json' + "`n" + '["I am calm", "I glow"]' + "`n" + '```'
        ConvertFrom-AiText $text | Should -Be @('I am calm', 'I glow')
    }

    It 'treats an answer without a list as no lines' {
        ConvertFrom-AiText 'I am unable to help with that.' | Should -BeNullOrEmpty
    }

    It 'uses filtered AI lines and fills the rest from the phrase banks' {
        Set-Content -LiteralPath (Join-Path $root 'my-key.txt') -Value 'sk-ant-test'
        Mock Invoke-RestMethod {
            [pscustomobject]@{ content = @([pscustomobject]@{ type = 'text'; text = '["1. I sparkle all day", "I will be brave", "I glow from inside"]' }) }
        }
        $r = New-Subliminal -Root $root -Seed 1
        $r.Source | Should -Match '^Claude AI \(2\) \+ phrase banks'
        $r.Lines | Should -Contain 'I sparkle all day.'
        $r.Lines | Should -Not -Contain 'I will be brave.'
        $r.Lines.Count | Should -Be 30
        Should -Invoke Invoke-RestMethod -Times 1 -Exactly -ParameterFilter { $Uri -eq 'https://api.anthropic.com/v1/messages' }
    }

    It 'falls back to the phrase banks after one failed try, without logging the key' {
        Set-Content -LiteralPath (Join-Path $root 'my-key.txt') -Value 'xai-secret-123'
        Mock Invoke-RestMethod { throw 'model grok-old not found for key xai-secret-123' }
        $r = New-Subliminal -Root $root -Seed 1
        $r.Source | Should -Be 'offline phrase banks'
        $r.AiProblem | Should -Match 'not found'
        $r.Lines.Count | Should -Be 30
        Should -Invoke Invoke-RestMethod -Times 1 -Exactly
        $log = Get-Content (Join-Path (Join-Path $root 'made') 'log.txt') -Raw
        $log | Should -Match 'Grok skipped'
        $log | Should -Not -Match 'xai-secret-123'
    }

    It 'skips the AI for an unknown key type' {
        Set-Content -LiteralPath (Join-Path $root 'my-key.txt') -Value 'mystery-key'
        Mock Invoke-RestMethod { throw 'should stay unused' }
        $r = New-Subliminal -Root $root -Seed 1
        $r.AiProblem | Should -Match 'should start with'
        Should -Invoke Invoke-RestMethod -Times 0 -Exactly
    }
}

Describe 'Make one with me' {
    It 'turns the three answers into goals and an I am line' {
        $a = New-WithMeGoals 'happy and calm' 'post my 3D art' 'a confident girly artist'
        $a.Goals | Should -Be @('Feel happy and calm', 'post my 3D art', 'Be a confident girly artist')
        $a.Lines | Should -Be @('I am a confident girly artist.')
    }

    It 'adds "Do" when the second answer has no action word' {
        (New-WithMeGoals '' 'yoga' '').Goals | Should -Be @('Do yoga')
    }

    It 'returns no goals when every answer is blank' {
        (New-WithMeGoals '' ' ' '').Goals.Count | Should -Be 0
    }

    It 'adds new goals inside the [goals] section and skips repeats' {
        $root = New-TestMaker
        $path = Join-Path $root 'my-goals.txt'
        $count = Add-GoalsToFile $path @('stay girly and feminine all day', 'feel calm', 'be a dancer')
        $count | Should -Be 2
        $g = Read-Goals $path
        $g.Goals | Should -Contain 'Feel calm'
        $g.Goals | Should -Contain 'Be a dancer'
        $g.Always | Should -Be @('I love being me.')
        $lines = Read-TextLines $path
        [array]::IndexOf($lines, 'Be a dancer') | Should -BeLessThan ([array]::IndexOf($lines, '[always include]'))
    }

    It 'makes safe file names' {
        Get-SafeFileName '  Confident: Artist?  ' | Should -Be 'Confident Artist'
    }
}
