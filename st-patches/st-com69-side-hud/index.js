/**
 * COM-69 Side Energy Bars / movable emotion window
 * Spec: docs/sillytavern-soft-soft-meters.md + COM-93 layout persist
 * - Draggable floaty emotion window (matches BST meter set)
 * - Compact bars by default; dropdown reveals deeper flavor + Soft Soft *(thought)*
 * - Chat meters hidden by default (float-only) with Restore-to-window button
 * - Positions saved as % of viewport so monitor hops clamp on-screen
 * - Last-talked Soft Soft prefers RIGHT sprite, facing Del (left)
 */
(async function () {
    const LEFT_ID = 'com69-side-hud-left';
    const RIGHT_ID = 'com69-side-hud-right';
    const DOCK_ID = 'com69-meters-dock-chip';
    const STORAGE_KEY = 'com69-side-hud-collapsed';
    const DEPTH_KEY = 'com69-side-hud-depth';
    const POS_KEY = 'com69-side-hud-pos';
    const FLOAT_ONLY_KEY = 'com69-meters-float-only';
    const LAYOUT_META_KEY = 'com69-layout-meta';
    const VERSION = '1.5.0';

    const STAT_COLORS = {
        affection: '#ff6b81',
        trust: '#55d5ff',
        desire: '#ffb347',
        connection: '#9cff8f',
        relationship: '#7ec8ff',
        'respect to the bar': '#c9a0ff',
        respect: '#c9a0ff',
        'breast development': '#ff8fb8',
        breast: '#ff8fb8',
        blacked: '#5c4033',
        horny: '#ff4d6d',
    };

    const PRIORITY = [
        'relationship',
        'respect to the bar',
        'respect',
        'breast development',
        'breast',
        'blacked',
        'horny',
        'affection',
        'trust',
        'desire',
        'connection',
    ];

    /** COM-86 default-desk + band crumbs from sillytavern-soft-soft-meters.md */
    const FLAVOR = {
        relationship: [
            { max: 24, mode: 'Bestie', flavor: 'Ride-or-die dares, no couple claim yet. Low = soft bestie, not broken.', thought: '*(bestie dare loading~)*' },
            { max: 39, mode: 'Working', flavor: 'Desk home — sharper step + one desire crumb. Stage slider still “us.”', thought: '*(clipboard first. then stare.)*' },
            { max: 54, mode: 'Bossy', flavor: 'Soft crown — “look up”; chin tip. Clipboard map.', thought: '*(eyes up, dummy.)*' },
            { max: 74, mode: 'BF / soft gf', flavor: '“Us” hoodie-steal cling. Short gf tucked under Soft Soft.', thought: '*(my short gf. mine.)*' },
            { max: 100, mode: 'Partner', flavor: 'Locked we — Soft Soft holds the map.', thought: '*(we. forever soft.)*' },
        ],
        respect: [
            { max: 19, mode: 'Brat wall', flavor: 'Brat wall / flicker — care put-in-place, soft-off kink. Still girly.', thought: '*(brat day. still teeny.)*' },
            { max: 39, mode: 'Soft-curious', flavor: 'Soft-curious — practice looking up.', thought: '*(one tiny soft-ask?)*' },
            { max: 59, mode: 'Warming look-up', flavor: 'Warming → looking-up.', thought: '*(map’s right here.)*' },
            { max: 79, mode: 'Looking-up', flavor: 'Home look-up / eager-obey — soft-asks, eyes-on-her.', thought: '*(good girl eyes.)*' },
            { max: 100, mode: 'Max melt', flavor: 'Melted — Soft Soft ≈ the map.', thought: '*(she’s soft forever.)*' },
        ],
        'breast development': [
            { max: 39, mode: 'Early bloom', flavor: 'Shy early bloom; quieter crop.', thought: '*(hormones loud again~)*' },
            { max: 79, mode: 'Late-bloom loud', flavor: 'Late-bloom growth plot — crop strain, underboob, leak-prone crumbs.', thought: '*(crop’s losing. again.)*' },
            { max: 100, mode: 'Max strain', flavor: 'Loud strain; plot can own the beat.', thought: '*(don’t bounce— wait.)*' },
        ],
        blacked: [
            { max: 39, mode: 'Curious', flavor: 'Curious name-drop — person-first.', thought: '*(name + boring detail.)*' },
            { max: 79, mode: 'Committed', flavor: 'Snowbunny / Black-favor depth — gym·class·chart; flaw-catch pedestal.', thought: '*(Jamal’s laugh again— person.)*' },
            { max: 100, mode: 'Deep', flavor: 'BNWO world-flavor OK; never erase the human.', thought: '*(chart homework… or thirst.)*' },
        ],
        horny: [
            { max: 9, mode: 'Cool', flavor: 'Heat off — cozy short only. Soft-off if Del’s low.', thought: '*(zero heat. soft room.)*' },
            { max: 19, mode: 'Ember', flavor: 'Barely warm — one body-warm crumb, then care.', thought: '*(ember only. still soft.)*' },
            { max: 29, mode: 'Glow', flavor: 'Soft body max — crop/height notice without lecture.', thought: '*(glow. no lecture yet.)*' },
            { max: 39, mode: 'Stir', flavor: 'Flirty idle — Soft Soft shifts; Del clocks it from below.', thought: '*(stirring. keep soft.)*' },
            { max: 49, mode: 'Hint', flavor: 'One thirst hint — SPH or gym name, then life step.', thought: '*(one hint. then latte.)*' },
            { max: 59, mode: 'Buzz', flavor: 'Steady buzz — size ladder whisper mid-errand.', thought: '*(buzzing. still soft-off if she’s low.)*' },
            { max: 69, mode: 'Lecture', flavor: 'SPH / exes / chart welcome — Soft Soft yap heat.', thought: '*(size lecture loading…)*' },
            { max: 79, mode: 'Loud', flavor: 'Loud slut-brain — can’t not yap thirst; still land 👉.', thought: '*(loud already. land the step.)*' },
            { max: 89, mode: 'Yapper', flavor: 'Default yapper — thirst + life step + *(thought)*. Cap still 100.', thought: '*(eighty already. latte.)*' },
            { max: 99, mode: 'Flood', flavor: 'Near-max lecture — stack hint + pull; soft-off if Del dips.', thought: '*(flood mode. still soft-off if she’s low.)*' },
            { max: 100, mode: 'Max', flavor: 'Max lecture — bold steer OK unless soft-crisis; never man-up.', thought: '*(hundred is loud. still soft-off if she’s low.)*' },
        ],
        affection: [
            { max: 49, mode: 'Cool/warm', flavor: 'Soft like / pout / warm pull loading.', thought: '*(still likes me. good.)*' },
            { max: 100, mode: 'Soft melt', flavor: 'Soft like / pout / warm pull.', thought: '*(still likes me. good.)*' },
        ],
        trust: [
            { max: 49, mode: 'Careful', flavor: 'Safe room vs fragile step.', thought: '*(trusted space. don’t break it.)*' },
            { max: 100, mode: 'Steady', flavor: 'Safe room — can hold brat without break.', thought: '*(trusted space. don’t break it.)*' },
        ],
        desire: [
            { max: 49, mode: 'Flicker', flavor: 'Thirst-for-Danni heat (tint).', thought: '*(want her close. teeny.)*' },
            { max: 100, mode: 'Hot', flavor: 'Thirst-for-Danni heat.', thought: '*(want her close. teeny.)*' },
        ],
        connection: [
            { max: 49, mode: 'Thin/shared', flavor: 'Shared history / parallel lives.', thought: '*(thread’s still there.)*' },
            { max: 100, mode: 'Deep weave', flavor: 'Shared history / parallel lives.', thought: '*(thread’s still there.)*' },
        ],
    };
    FLAVOR['respect to the bar'] = FLAVOR.respect;
    FLAVOR.breast = FLAVOR['breast development'];

    function flavorFor(label, pct) {
        const key = String(label || '').toLowerCase().trim();
        const bands = FLAVOR[key];
        const p = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
        if (!bands) {
            return { mode: 'Meter', flavor: 'Soft Soft is watching this bar.', thought: '*(numbers go brrr)*' };
        }
        let hit = bands[bands.length - 1];
        for (const b of bands) {
            if (p <= b.max) {
                hit = b;
                break;
            }
        }
        if (key === 'relationship' && p >= 30 && p <= 39) {
            return { mode: 'Working', flavor: 'Stage slider — bestie → desk → crown → gf → we. Desk home.', thought: '*(working mode. still us.)*' };
        }
        if ((key === 'respect' || key === 'respect to the bar') && p >= 55 && p <= 69) {
            return { mode: 'Looking-up', flavor: 'Look-up fuel — soft-asks, eyes-on-her, clipboard map.', thought: '*(sixty looks good on her.)*' };
        }
        if ((key === 'breast development' || key === 'breast') && p >= 70 && p <= 84) {
            return { mode: 'Late-bloom loud', flavor: 'Late-bloom growth plot — crop strain, underboob, leak-prone crumbs steal scenes.', thought: '*(crop’s losing. again.)*' };
        }
        if (key === 'blacked' && p >= 65 && p <= 79) {
            return { mode: 'Committed', flavor: 'Snowbunny / Black-favor depth — gym·class·chart crumbs; person-first.', thought: '*(Jamal’s laugh again— person.)*' };
        }
        if (key === 'horny' && p >= 75 && p <= 89) {
            return { mode: 'Yapper', flavor: 'Thirst volume — SPH / lectures / Soft Soft yap heat. Soft-off if Del’s low. Cap 100.', thought: '*(eighty already. latte.)*' };
        }
        return hit;
    }

    function loadJson(key, fallback) {
        try {
            return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
        } catch {
            return fallback;
        }
    }
    function saveJson(key, val) {
        localStorage.setItem(key, JSON.stringify(val));
    }

    function viewport() {
        const vv = window.visualViewport;
        return {
            w: Math.max(320, Math.round(vv?.width || window.innerWidth || document.documentElement.clientWidth || 1280)),
            h: Math.max(240, Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || 720)),
        };
    }

    function clamp(n, min, max) {
        return Math.min(Math.max(n, min), max);
    }

    function isFloatOnly() {
        const v = localStorage.getItem(FLOAT_ONLY_KEY);
        // default ON (chat meters hidden) — Del annotate red-X
        if (v === null || v === undefined || v === '') return true;
        return v === '1' || v === 'true';
    }
    function setFloatOnly(on) {
        localStorage.setItem(FLOAT_ONLY_KEY, on ? '1' : '0');
        document.body.classList.toggle('com69-meters-float-only', !!on);
        refreshDockChip();
    }

    function loadCollapsedMap() {
        return loadJson(STORAGE_KEY, {});
    }
    function saveCollapsed(side, collapsed) {
        const map = loadCollapsedMap();
        map[side] = !!collapsed;
        saveJson(STORAGE_KEY, map);
    }
    function isCollapsed(side) {
        return !!loadCollapsedMap()[side];
    }

    function isDepthOpen(side) {
        return !!loadJson(DEPTH_KEY, {})[side];
    }
    function saveDepth(side, open) {
        const map = loadJson(DEPTH_KEY, {});
        map[side] = !!open;
        saveJson(DEPTH_KEY, map);
    }

    function loadPos(side) {
        return loadJson(POS_KEY, {})[side] || null;
    }
    function savePos(side, hud) {
        const r = hud.getBoundingClientRect();
        const { w, h } = viewport();
        const map = loadJson(POS_KEY, {});
        map[side] = {
            left: Math.round(r.left),
            top: Math.round(r.top),
            leftPct: Number((r.left / w).toFixed(4)),
            topPct: Number((r.top / h).toFixed(4)),
            vw: w,
            vh: h,
            savedAt: Date.now(),
        };
        saveJson(POS_KEY, map);
        saveJson(LAYOUT_META_KEY, { vw: w, vh: h, version: VERSION, savedAt: Date.now() });
    }

    function clampHudRect(left, top, width, height) {
        const { w, h } = viewport();
        const ww = Math.max(40, width || 160);
        const hh = Math.max(28, height || 40);
        const maxLeft = Math.max(0, w - Math.min(ww, w) - 1);
        const maxTop = Math.max(0, h - Math.min(hh, h) - 1);
        return {
            left: clamp(Math.round(left), 0, maxLeft),
            top: clamp(Math.round(top), 0, maxTop),
        };
    }

    function resolveSavedPos(side, hud) {
        const pos = loadPos(side);
        if (!pos) return null;
        const { w, h } = viewport();
        let left;
        let top;
        if (typeof pos.leftPct === 'number' && typeof pos.topPct === 'number') {
            left = pos.leftPct * w;
            top = pos.topPct * h;
        } else {
            left = Number(pos.left);
            top = Number(pos.top);
            // Old absolute coords from another monitor — scale if viewport shrunk a lot
            if (pos.vw > 0 && pos.vh > 0 && (pos.vw > w * 1.15 || pos.vh > h * 1.15 || left > w || top > h)) {
                left = (left / pos.vw) * w;
                top = (top / pos.vh) * h;
            }
        }
        const r = hud.getBoundingClientRect();
        return clampHudRect(left, top, r.width || 180, r.height || 80);
    }

    function applySavedPos(hud, side) {
        const next = resolveSavedPos(side, hud);
        if (!next) return false;
        hud.style.left = `${next.left}px`;
        hud.style.top = `${next.top}px`;
        hud.style.right = 'auto';
        hud.classList.add('is-moved');
        return true;
    }

    function clampMovedHud(hud, side) {
        if (!hud || !hud.classList.contains('is-moved')) return;
        const r = hud.getBoundingClientRect();
        const next = clampHudRect(r.left, r.top, r.width, r.height);
        if (next.left !== Math.round(r.left) || next.top !== Math.round(r.top)) {
            hud.style.left = `${next.left}px`;
            hud.style.top = `${next.top}px`;
            hud.style.right = 'auto';
            savePos(side, hud);
        }
    }

    function bindDrag(hud, side) {
        const handle = hud.querySelector('.com69-side-hud-toggle');
        if (!handle || handle.dataset.dragBound) return;
        handle.dataset.dragBound = '1';
        let dragging = false;
        let ox = 0;
        let oy = 0;

        const onMove = (ev) => {
            if (!dragging) return;
            const r0 = hud.getBoundingClientRect();
            const rawLeft = ev.clientX - ox;
            const rawTop = ev.clientY - oy;
            const next = clampHudRect(rawLeft, rawTop, r0.width, r0.height);
            hud.style.left = `${next.left}px`;
            hud.style.top = `${next.top}px`;
            hud.style.right = 'auto';
            hud.classList.add('is-moved');
        };
        const onUp = () => {
            if (!dragging) return;
            dragging = false;
            hud.classList.remove('is-dragging');
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            savePos(side, hud);
        };

        handle.addEventListener('pointerdown', (ev) => {
            if (ev.target.closest('[data-nodrag]')) return;
            if (ev.button !== 0) return;
            dragging = true;
            hud.classList.add('is-dragging');
            const r = hud.getBoundingClientRect();
            ox = ev.clientX - r.left;
            oy = ev.clientY - r.top;
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
            ev.preventDefault();
        });
    }

    function ensureDockChip() {
        let chip = document.getElementById(DOCK_ID);
        if (!chip) {
            chip = document.createElement('button');
            chip.id = DOCK_ID;
            chip.type = 'button';
            chip.title = 'Toggle meters in chat window vs floaty HUD only';
            chip.addEventListener('click', (ev) => {
                ev.preventDefault();
                setFloatOnly(!isFloatOnly());
            });
            document.body.appendChild(chip);
        }
        refreshDockChip();
        return chip;
    }

    function refreshDockChip() {
        const chip = document.getElementById(DOCK_ID);
        if (!chip) return;
        const floatOnly = isFloatOnly();
        chip.textContent = floatOnly ? 'Restore meters to window' : 'Meters → floaty only';
        chip.setAttribute('aria-pressed', floatOnly ? 'true' : 'false');
        chip.classList.toggle('is-float-only', floatOnly);
    }

    function ensureHud(id, side) {
        let el = document.getElementById(id);
        if (!el) {
            el = document.createElement('div');
            el.id = id;
            el.className = `com69-side-hud com69-side-hud-${side} is-empty`;
            el.dataset.side = side;
            el.innerHTML = `
        <div class="com69-side-hud-chrome">
          <button type="button" class="com69-side-hud-toggle" aria-expanded="true" title="Drag to move · click title to collapse">
            <span class="com69-side-hud-title-text">Emotion</span>
            <span class="com69-side-hud-chevron" aria-hidden="true" data-nodrag>▾</span>
          </button>
          <button type="button" class="com69-side-hud-restore" data-nodrag title="Put meters back in the chat window">Window</button>
          <button type="button" class="com69-side-hud-depth" data-nodrag aria-expanded="false" title="Show deeper stats / flavor / Soft Soft thoughts">More ▾</button>
        </div>
        <div class="com69-side-hud-body"></div>`;
            document.body.appendChild(el);

            const btn = el.querySelector('.com69-side-hud-toggle');
            btn.addEventListener('click', (ev) => {
                if (el.classList.contains('is-dragging')) return;
                if (ev.target.closest('[data-nodrag]') && !ev.target.classList.contains('com69-side-hud-chevron')) return;
                ev.preventDefault();
                ev.stopPropagation();
                const next = !el.classList.contains('is-collapsed');
                el.classList.toggle('is-collapsed', next);
                btn.setAttribute('aria-expanded', next ? 'false' : 'true');
                saveCollapsed(side, next);
            });

            const restoreBtn = el.querySelector('.com69-side-hud-restore');
            restoreBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                // Restore to window = show chat meters again
                setFloatOnly(false);
            });

            const depthBtn = el.querySelector('.com69-side-hud-depth');
            depthBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const next = !el.classList.contains('is-depth');
                el.classList.toggle('is-depth', next);
                depthBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
                depthBtn.textContent = next ? 'Less ▴' : 'More ▾';
                saveDepth(side, next);
            });
        }
        const collapsed = isCollapsed(side);
        el.classList.toggle('is-collapsed', collapsed);
        const btn = el.querySelector('.com69-side-hud-toggle');
        if (btn) btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');

        const depth = isDepthOpen(side);
        el.classList.toggle('is-depth', depth);
        const depthBtn = el.querySelector('.com69-side-hud-depth');
        if (depthBtn) {
            depthBtn.setAttribute('aria-expanded', depth ? 'true' : 'false');
            depthBtn.textContent = depth ? 'Less ▴' : 'More ▾';
        }

        bindDrag(el, side);
        return el;
    }

    function clearHud(hud) {
        if (!hud) return;
        const title = hud.querySelector('.com69-side-hud-title-text');
        const body = hud.querySelector('.com69-side-hud-body');
        if (title) title.textContent = '';
        if (body) body.innerHTML = '';
        hud.classList.add('is-empty');
    }

    function labelForCard(card) {
        const owner = [...card.classList].find((c) => c.startsWith('bst-owner-'));
        if (owner) {
            return owner.replace('bst-owner-', '').replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
        }
        const heading = card.querySelector('.bst-name, .bst-title, h3, h4, .bst-header');
        return heading?.textContent?.trim() || 'Emotion';
    }

    function sortStats(stats) {
        return [...stats].sort((a, b) => {
            const ia = PRIORITY.indexOf(a.label.toLowerCase());
            const ib = PRIORITY.indexOf(b.label.toLowerCase());
            const pa = ia === -1 ? 100 : ia;
            const pb = ib === -1 ? 100 : ib;
            return pa - pb;
        });
    }

    function readStatsFromCard(card) {
        const rows = [...card.querySelectorAll('.bst-row')];
        const stats = [];
        const seen = new Set();
        for (const row of rows) {
            const labelEl = row.querySelector('.bst-label, .bst-stat-label, .bst-name, span, div');
            const fill = row.querySelector('.bst-fill');
            if (!fill) continue;
            let label = (labelEl?.textContent || '').trim().split('\n')[0].trim();
            label = label.replace(/\s*\d+%.*$/i, '').replace(/[+\-]\d+.*$/i, '').trim();
            if (!label || /collapse|expand|retrack|summary/i.test(label)) continue;
            let pct = String(fill.style.width).includes('%')
                ? parseFloat(fill.style.width)
                : null;
            if (pct == null) {
                const track = row.querySelector('.bst-track');
                if (track && track.clientWidth) pct = Math.round((fill.clientWidth / track.clientWidth) * 100);
            }
            if (pct == null || Number.isNaN(pct)) continue;
            const key = label.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            const color = STAT_COLORS[key] || fill.style.getPropertyValue('--bst-stat-color') || '#9a9a9a';
            stats.push({ label, pct: Math.max(0, Math.min(100, Math.round(pct))), color });
        }
        if (!stats.length) {
            const text = card.innerText || '';
            for (const [key, color] of Object.entries(STAT_COLORS)) {
                const re = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^0-9]{0,12}(\\d{1,3})', 'i');
                const m = text.match(re);
                if (m && !seen.has(key)) {
                    seen.add(key);
                    const pretty = key.replace(/\b\w/g, (c) => c.toUpperCase());
                    stats.push({ label: pretty, pct: Number(m[1]), color });
                }
            }
        }
        return sortStats(stats);
    }

    function esc(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderCompactBody(stats) {
        if (!stats.length) {
            return '<div class="com69-side-empty">No tracker values yet — send a chat turn.</div>';
        }
        return stats.map((s) => {
            const f = flavorFor(s.label, s.pct);
            const tip = `${f.mode}: ${f.flavor} ${f.thought}`;
            return `
      <div class="com69-meter" data-stat="${esc(s.label.toLowerCase().replace(/\s+/g, '-'))}" title="${esc(tip)}">
        <div class="com69-meter-label"><span>${esc(s.label)}</span><span>${s.pct}</span></div>
        <div class="com69-meter-track"><div class="com69-meter-fill" style="width:${s.pct}%;background:linear-gradient(90deg,#111,${s.color})"></div></div>
        <div class="com69-meter-mode">${esc(f.mode)}</div>
        <div class="com69-meter-depth">
          <div class="com69-meter-flavor">${esc(f.flavor)}</div>
          <div class="com69-meter-thought">${esc(f.thought)}</div>
        </div>
      </div>`;
        }).join('');
    }

    function fillHud(hud, titleText, sourceCard) {
        const title = hud.querySelector('.com69-side-hud-title-text');
        const body = hud.querySelector('.com69-side-hud-body');
        if (!title || !body || !sourceCard) {
            clearHud(hud);
            return;
        }
        const stats = readStatsFromCard(sourceCard);
        title.textContent = titleText || 'Emotion';
        const peek = stats
            .filter((s) => /relationship|respect|breast|blacked|horny/i.test(s.label))
            .slice(0, 3)
            .map((s) => {
                const f = flavorFor(s.label, s.pct);
                return `${s.label.split(' ')[0]} ${s.pct} · ${f.mode}`;
            })
            .join(' · ');
        hud.dataset.peek = peek || '';
        const toggle = hud.querySelector('.com69-side-hud-toggle');
        if (toggle) {
            toggle.title = hud.classList.contains('is-collapsed')
                ? (peek ? `Expand emotion window (${peek})` : 'Expand emotion window')
                : 'Drag to move · click to collapse';
        }
        body.innerHTML = renderCompactBody(stats);
        hud.classList.remove('is-empty');
    }

    function visibleHolders() {
        return [...document.querySelectorAll('#visual-novel-wrapper .expression-holder, #expression-holder')]
            .map((el) => {
                const r = el.getBoundingClientRect();
                return { el, r, mid: r.left + r.width / 2, avatar: el.getAttribute('data-avatar') || '' };
            })
            .filter((h) => h.r.width > 20 && h.r.height > 40)
            .sort((a, b) => a.mid - b.mid);
    }

    function isSoftSoftAvatar(avatarOrLabel) {
        return /bambi|soft\s*soft/i.test(String(avatarOrLabel || ''));
    }

    function applyFaceDirection(holders) {
        // Soft Soft / last-talked on RIGHT faces Del (LEFT). Assets lean left → keep.
        // Left-side sprite faces Soft Soft (RIGHT) → mirror.
        document.querySelectorAll('.expression-holder').forEach((el) => el.classList.remove('com69-face-left', 'com69-face-right'));
        if (!holders.length) return;
        const right = holders[holders.length - 1];
        const left = holders[0];
        if (holders.length >= 2) {
            left.el.classList.add('com69-face-right');
            right.el.classList.add('com69-face-left');
        } else {
            // Solo Soft Soft on right facing Del/viewer leftward
            right.el.classList.add('com69-face-left');
        }
        // Prefer Soft Soft avatar on the right visual lane when dual
        holders.forEach((h) => {
            h.el.classList.toggle('com69-soft-soft', isSoftSoftAvatar(h.avatar));
        });
    }

    function placeBesideSprites(leftHud, rightHud) {
        const leftSaved = applySavedPos(leftHud, 'left');
        const rightSaved = applySavedPos(rightHud, 'right');
        if (leftSaved) clampMovedHud(leftHud, 'left');
        if (rightSaved) clampMovedHud(rightHud, 'right');

        const holders = visibleHolders();
        applyFaceDirection(holders);
        const winW = viewport().w;
        const placeLeft = !leftHud.classList.contains('is-moved');
        const placeRight = !rightHud.classList.contains('is-moved');

        if (holders.length >= 2) {
            const L = holders[0].r;
            const R = holders[holders.length - 1].r;
            if (placeLeft) {
                leftHud.style.top = `${Math.max(48, Math.round(L.top + 24))}px`;
                leftHud.style.left = `${Math.max(8, Math.round(L.left + 8))}px`;
                leftHud.style.right = 'auto';
            }
            if (placeRight) {
                const top = Math.max(48, Math.round(R.top + 24));
                const left = Math.max(8, Math.round(R.right - 280));
                const next = clampHudRect(left, top, 270, 200);
                rightHud.style.top = `${next.top}px`;
                rightHud.style.left = `${next.left}px`;
                rightHud.style.right = 'auto';
            }
            return;
        }
        if (holders.length === 1) {
            const H = holders[0].r;
            const onRight = H.mid >= winW * 0.45 || isSoftSoftAvatar(holders[0].avatar);
            if (onRight && placeRight) {
                const top = Math.max(48, Math.round(H.top + 24));
                const left = Math.max(8, Math.round(H.right - 280));
                const next = clampHudRect(left, top, 270, 200);
                rightHud.style.top = `${next.top}px`;
                rightHud.style.left = `${next.left}px`;
                rightHud.style.right = 'auto';
            } else if (!onRight && placeLeft) {
                leftHud.style.top = `${Math.max(48, Math.round(H.top + 24))}px`;
                leftHud.style.left = `${Math.max(8, Math.round(H.left + 8))}px`;
                leftHud.style.right = 'auto';
            }
            return;
        }
        if (placeLeft) {
            leftHud.style.top = '16%';
            leftHud.style.left = '12px';
            leftHud.style.right = 'auto';
        }
        if (placeRight) {
            const { w } = viewport();
            const next = clampHudRect(w - 286, viewport().h * 0.16, 270, 200);
            rightHud.style.top = `${next.top}px`;
            rightHud.style.left = `${next.left}px`;
            rightHud.style.right = 'auto';
        }
    }

    function latestCards() {
        const roots = [...document.querySelectorAll('#chat .bst-root')];
        if (!roots.length) return [];
        const newest = roots
            .map((root) => ({ root, index: Number(root.getAttribute('data-message-index') || -1) }))
            .sort((a, b) => b.index - a.index)[0];
        return [...newest.root.querySelectorAll('.bst-card')].filter((c) => !c.classList.contains('bst-scene-card'));
    }

    function pickSoftSoftCard(cards) {
        return cards.find((c) => isSoftSoftAvatar(labelForCard(c))) || null;
    }

    function sync() {
        document.body.classList.toggle('com69-meters-float-only', isFloatOnly());
        ensureDockChip();
        const leftHud = ensureHud(LEFT_ID, 'left');
        const rightHud = ensureHud(RIGHT_ID, 'right');
        const cards = latestCards();
        if (!cards.length) {
            clearHud(leftHud);
            clearHud(rightHud);
            clampMovedHud(leftHud, 'left');
            clampMovedHud(rightHud, 'right');
            return;
        }

        const holders = visibleHolders();
        if (cards.length >= 2) {
            // Soft Soft / last-talked prefers RIGHT
            const soft = pickSoftSoftCard(cards);
            const rightCard = soft || cards[cards.length - 1];
            const leftCard = cards.find((c) => c !== rightCard) || cards[0];
            fillHud(leftHud, labelForCard(leftCard), leftCard);
            fillHud(rightHud, labelForCard(rightCard), rightCard);
        } else {
            const winW = viewport().w;
            const holder = holders.find((h) => isSoftSoftAvatar(h.avatar))
                || holders.find((h) => h.mid >= winW * 0.45)
                || holders[holders.length - 1];
            const label = labelForCard(cards[0]);
            const onRight = isSoftSoftAvatar(label)
                || isSoftSoftAvatar(holder?.avatar || '')
                || !holder
                || holder.mid >= winW * 0.45;
            if (onRight) {
                clearHud(leftHud);
                fillHud(rightHud, label, cards[0]);
            } else {
                clearHud(rightHud);
                fillHud(leftHud, label, cards[0]);
            }
        }
        placeBesideSprites(leftHud, rightHud);
        clampMovedHud(leftHud, 'left');
        clampMovedHud(rightHud, 'right');
    }

    function onViewportChange() {
        const leftHud = document.getElementById(LEFT_ID);
        const rightHud = document.getElementById(RIGHT_ID);
        if (leftHud) {
            if (leftHud.classList.contains('is-moved')) applySavedPos(leftHud, 'left');
            clampMovedHud(leftHud, 'left');
        }
        if (rightHud) {
            if (rightHud.classList.contains('is-moved')) applySavedPos(rightHud, 'right');
            clampMovedHud(rightHud, 'right');
        }
        // Ask MovingUI snap if present (COM-93 multi-monitor)
        try {
            if (typeof window.snapMovingUIOnScreen === 'function') {
                window.snapMovingUIOnScreen();
            }
        } catch {
            /* ignore */
        }
        sync();
    }

    // boot
    if (localStorage.getItem(FLOAT_ONLY_KEY) === null) {
        localStorage.setItem(FLOAT_ONLY_KEY, '1');
    }
    document.body.classList.toggle('com69-meters-float-only', isFloatOnly());
    ensureDockChip();
    ensureHud(LEFT_ID, 'left');
    ensureHud(RIGHT_ID, 'right');
    clearHud(document.getElementById(LEFT_ID));
    clearHud(document.getElementById(RIGHT_ID));

    const obs = new MutationObserver(() => {
        window.clearTimeout(obs._t);
        obs._t = window.setTimeout(sync, 150);
    });
    obs.observe(document.body, { childList: true, subtree: true });

    let resizeT = 0;
    const scheduleViewport = () => {
        window.clearTimeout(resizeT);
        resizeT = window.setTimeout(onViewportChange, 120);
    };
    window.addEventListener('resize', scheduleViewport);
    window.addEventListener('orientationchange', scheduleViewport);
    window.visualViewport?.addEventListener('resize', scheduleViewport);
    window.visualViewport?.addEventListener('scroll', scheduleViewport);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) scheduleViewport();
    });

    setInterval(sync, 1500);
    sync();
    console.info(`[COM-69] Movable emotion window ready (v${VERSION} — float-only meters + layout persist/clamp)`);
})();
