// ==========================================================================
// TORMENTA20 — Motor de Tesouro (planilha oficial Guilherme Dei Svaldi)
// ==========================================================================
const T20Treasure = (function() {
    let DATA = null;

    function init(data) {
        DATA = data;
    }

    function ensureData() {
        if (!DATA && typeof window !== 'undefined' && window.T20_TREASURE_DATA) {
            DATA = window.T20_TREASURE_DATA;
        }
        if (!DATA) throw new Error('Dados de tesouro não carregados.');
    }

    function roll(sides) {
        return Math.floor(Math.random() * sides) + 1;
    }

    function rollD100() {
        return roll(100);
    }

    function rollD6() {
        return roll(6);
    }

    function lookup(entries, value) {
        if (!entries) return null;
        for (const e of entries) {
            const [lo, hi] = e.range;
            if (value >= lo && value <= hi) return e;
        }
        return null;
    }

    function ndTableKey(ndVal) {
        if (ndVal < 1) return 'frac';
        const key = String(Math.floor(ndVal));
        return DATA.ndTable[key] ? key : '20';
    }

    function rollDice(count, sides, modifier = 0) {
        let sum = modifier;
        for (let i = 0; i < count; i++) sum += roll(sides);
        return sum;
    }

    function parseDiceCount(expr) {
        const m = expr.match(/(\d+)d(\d+)(?:\+(\d+))?/i);
        if (!m) return 1;
        const count = rollDice(parseInt(m[1], 10), parseInt(m[2], 10), m[3] ? parseInt(m[3], 10) : 0);
        return Math.max(1, count);
    }

    function normalizeResult(text) {
        return (text || '')
            .replace(/\u00d7/g, 'x')
            .replace(/×/g, 'x')
            .trim();
    }

    function isEmptyResult(text) {
        const t = normalizeResult(text);
        return !t || t === '—' || t === '-' || t === 'Nenhum';
    }

    function rollMoneyFormula(text) {
        const t = normalizeResult(text);
        const wealthMatch = t.match(/^(\d+d\d+(?:\+\d+)?)\s+riquezas?\s+(menores?|médias?|medias?|maiores?)/i);
        if (wealthMatch) {
            const count = parseDiceCount(wealthMatch[1]);
            const tier = wealthMatch[2].toLowerCase().startsWith('men') ? 'menor'
                : wealthMatch[2].toLowerCase().startsWith('mai') ? 'maior' : 'media';
            return { type: 'wealth', tier, count };
        }

        const singleWealth = t.match(/^(\d+)\s+riquezas?\s+(menores?|médias?|medias?|maiores?)/i)
            || t.match(/^(\d+)d(\d+)\+(\d+)\s+riquezas?\s+(menores?|médias?|medias?|maiores?)/i)
            || t.match(/riqueza\s+(menor|média|media|maior)/i);

        if (/riqueza\s+menor/i.test(t) || /riquezas?\s+menores?/i.test(t)) {
            let count = 1;
            const countMatch = t.match(/(\d+)d(\d+)(?:\+(\d+))?/i);
            if (countMatch) count = parseDiceCount(countMatch[0]);
            else if (/(\d+)\s+riquezas?/i.test(t)) count = parseInt(t.match(/(\d+)/)[1], 10);
            return { type: 'wealth', tier: 'menor', count };
        }
        if (/riqueza\s+m[eé]dia/i.test(t) || /riquezas?\s+m[eé]dias?/i.test(t)) {
            let count = 1;
            const countMatch = t.match(/(\d+)d(\d+)(?:\+(\d+))?/i);
            if (countMatch) count = parseDiceCount(countMatch[0]);
            else if (/(\d+)\s+riquezas?/i.test(t)) count = parseInt(t.match(/(\d+)/)[1], 10);
            return { type: 'wealth', tier: 'media', count };
        }
        if (/riqueza\s+maior/i.test(t) || /riquezas?\s+maiores?/i.test(t)) {
            let count = 1;
            const countMatch = t.match(/(\d+)d(\d+)(?:\+(\d+))?/i);
            if (countMatch) count = parseDiceCount(countMatch[0]);
            else if (/(\d+)\s+riquezas?/i.test(t)) count = parseInt(t.match(/(\d+)/)[1], 10);
            return { type: 'wealth', tier: 'maior', count };
        }

        const coinMatch = t.match(/(\d+)d(\d+)(?:\+(\d+))?x([\d.]+)\s*(T\$|TC|TO)/i);
        if (coinMatch) {
            const total = rollDice(
                parseInt(coinMatch[1], 10),
                parseInt(coinMatch[2], 10),
                coinMatch[3] ? parseInt(coinMatch[3], 10) : 0
            ) * parseFloat(coinMatch[4]);
            return { type: 'coins', amount: total, unit: coinMatch[5].toUpperCase() };
        }

        return { type: 'unknown', raw: t };
    }

    function summarizeWealthExample(examples) {
        if (!examples) return 'Riqueza variada';
        const first = examples.split(';')[0].trim();
        if (first.length > 80) return first.slice(0, 77) + '...';
        return first.replace(/^\d[\d,.]* espaço[s]?:\s*/i, '');
    }

    function rollWealth(tier, log) {
        const table = DATA.riquezas[tier] || DATA.riquezas.menor;
        const d100 = rollD100();
        const entry = lookup(table, d100);
        if (!entry) {
            log.push(`Riqueza ${tier}: d100=${d100} (sem entrada)`);
            return { label: `Riqueza ${tier}`, detail: '—' };
        }

        const formula = entry.formula.replace(/\(.*?\)/g, '').trim();
        const fm = formula.match(/(\d+)d(\d+)/);
        let value = 0;
        if (fm) value = rollDice(parseInt(fm[1], 10), parseInt(fm[2], 10));

        let spaceDesc = '';
        if (DATA.riquezas.space && DATA.riquezas.space.length) {
            const spRoll = roll(20);
            const sp = lookup(DATA.riquezas.space, spRoll);
            if (sp) spaceDesc = ` (${sp.spaces} espaço${sp.spaces === 1 ? '' : 's'})`;
        }

        const label = `Riqueza ${tier}: ${summarizeWealthExample(entry.examples)}`;
        log.push(`Riqueza ${tier}: d100=${d100} → ${formula} = ${value} T$${spaceDesc}`);
        return { label, detail: `${value} T$ (venda)${spaceDesc}`, valueT$: value };
    }

    function rollFromTable(table, log, label) {
        const d100 = rollD100();
        const entry = lookup(table, d100);
        const name = entry ? entry.name : '—';
        log.push(`${label}: d100=${d100} → ${name}`);
        return name;
    }

    function equipTypeFromRoll(typeRoll) {
        if (typeRoll <= 3) return 'arma';
        if (typeRoll <= 5) return 'armadura';
        return 'esoterico';
    }

    function magicTypeFromRoll(typeRoll) {
        if (typeRoll <= 2) return 'arma';
        if (typeRoll === 3) return 'armadura';
        if (typeRoll === 4) return 'esoterico';
        return 'acessorio';
    }

    function rollEquipment(log, double = false) {
        const times = double ? 2 : 1;
        const items = [];
        for (let t = 0; t < times; t++) {
            const typeRoll = rollD6();
            const type = equipTypeFromRoll(typeRoll);
            log.push(`Equipamento${double ? ' (2D)' : ''}: 1d6=${typeRoll} → ${type}`);
            const name = rollFromTable(DATA.equipamentos[type], log, `Equipamento (${type})`);
            items.push(name);
        }
        return items.join(' + ');
    }

    function rollPotions(count, log, double = false) {
        const times = (double ? 2 : 1) * Math.max(1, count || 1);
        const potions = [];
        for (let i = 0; i < times; i++) {
            const name = rollFromTable(DATA.pocoes, log, `Poção ${i + 1}`);
            potions.push(name);
        }
        return potions;
    }

    function rollImprovements(type, count, log, double = false) {
        const table = DATA.superiores[type] || DATA.superiores.arma;
        const rolls = (double ? 2 : 1) * Math.max(1, count || 1);
        const names = [];
        for (let i = 0; i < rolls; i++) {
            names.push(rollFromTable(table, log, `Melhoria superior ${i + 1}`));
        }
        return names;
    }

    function rollMagicEnchants(type, count, log) {
        if (type === 'acessorio') return [];
        const table = DATA.magicos[type];
        const names = [];
        for (let i = 0; i < count; i++) {
            const d100 = rollD100();
            let entry = lookup(table, d100);
            if (entry && /específic|especific|Role na tabela/i.test(entry.name)) {
                const specKey = type + '_especifica';
                entry = lookup(DATA.magicos[specKey], rollD100()) || entry;
                log.push(`Mágico (${type}) encanto ${i + 1}: item específico → ${entry.name}`);
            } else {
                log.push(`Mágico (${type}) encanto ${i + 1}: d100=${d100} → ${entry ? entry.name : '—'}`);
            }
            if (entry) names.push(entry.name);
        }
        return names;
    }

    function rollAccessory(category, log, double = false) {
        const table = DATA.acessorios[category] || DATA.acessorios.menor;
        const times = double ? 2 : 1;
        const items = [];
        for (let i = 0; i < times; i++) {
            items.push(rollFromTable(table, log, `Acessório mágico (${category})`));
        }
        return items;
    }

    function resolveItemResult(rawText, log) {
        const text = normalizeResult(rawText);
        if (isEmptyResult(text)) return [];

        const results = [];
        const hasExtra = /\+\s*%/.test(text);
        const double = /\b2D\b/i.test(text);
        const clean = text.replace(/\s*\+\s*%/g, '').replace(/\s*2D/gi, '').trim();

        if (/^item diverso/i.test(clean)) {
            const name = rollFromTable(DATA.itensDiversos, log, 'Item diverso');
            results.push({ type: 'item', label: name });
            return results;
        }

        if (/^equipamento/i.test(clean)) {
            const label = rollEquipment(log, double);
            results.push({ type: 'item', label });
            return results;
        }

        const potionMatch = clean.match(/(\d+)d(\d+)(?:\+(\d+))?\s*po[cç][oõ]es?/i) || clean.match(/^(\d+)\s*po[cç][aã]o/i);
        if (potionMatch || /^po[cç]/i.test(clean)) {
            let count = 1;
            if (potionMatch && potionMatch[1] && potionMatch[2]) {
                count = parseDiceCount(potionMatch[0]);
            } else if (potionMatch && potionMatch[1] && !potionMatch[2]) {
                count = parseInt(potionMatch[1], 10);
            }
            const potions = rollPotions(count, log, double);
            potions.forEach(p => results.push({ type: 'item', label: p }));
            if (hasExtra) {
                const extra = rollWealth('menor', log);
                results.push({ type: 'wealth', label: extra.label, detail: extra.detail });
            }
            return results;
        }

        const superiorMatch = clean.match(/superior\s*\((\d+)\s*melhorias?\)/i);
        if (superiorMatch) {
            const impCount = parseInt(superiorMatch[1], 10);
            const typeRoll = rollD6();
            const eqType = equipTypeFromRoll(typeRoll);
            log.push(`Superior: equipamento base 1d6=${typeRoll} → ${eqType}`);
            const baseName = rollFromTable(DATA.equipamentos[eqType], log, `Equipamento base (${eqType})`);
            const imps = rollImprovements(eqType, impCount, log, double);
            results.push({
                type: 'item',
                label: `${baseName} (Superior: ${imps.join(', ')})`
            });
            return results;
        }

        const magicMatch = clean.match(/m[aá]gico\s*\((menor|m[eé]dio|maior)\)/i);
        if (magicMatch) {
            const tier = magicMatch[1].toLowerCase().startsWith('men') ? 'menor'
                : magicMatch[1].toLowerCase().startsWith('mai') ? 'maior' : 'medio';
            const enchantCount = tier === 'menor' ? 1 : tier === 'medio' ? 2 : 3;
            const typeRoll = rollD6();
            const mType = magicTypeFromRoll(typeRoll);
            log.push(`Mágico (${tier}): tipo 1d6=${typeRoll} → ${mType}`);

            if (mType === 'acessorio') {
                const acc = rollAccessory(tier === 'maior' ? 'maior' : tier === 'medio' ? 'medio' : 'menor', log, double);
                acc.forEach(a => results.push({ type: 'item', label: a }));
            } else {
                const enchants = rollMagicEnchants(mType, enchantCount, log);
                const base = rollFromTable(DATA.equipamentos[mType], log, `Item mágico base (${mType})`);
                results.push({
                    type: 'item',
                    label: `${base} [${enchants.join(', ')}] (mágico ${tier})`
                });
            }
            return results;
        }

        results.push({ type: 'item', label: clean });
        return results;
    }

    function resolveMoneyResult(rawText, log, moneyMultiplier) {
        const text = normalizeResult(rawText);
        if (isEmptyResult(text)) return [];

        const hasExtra = /\+\s*%/.test(text);
        const parsed = rollMoneyFormula(text.replace(/\s*\+\s*%/g, ''));
        const results = [];

        if (parsed.type === 'coins') {
            let amount = Math.round(parsed.amount * moneyMultiplier);
            log.push(`Dinheiro: ${text} = ${amount} ${parsed.unit}`);
            results.push({ type: 'coins', unit: parsed.unit, amount });
        } else if (parsed.type === 'wealth') {
            for (let i = 0; i < parsed.count; i++) {
                const w = rollWealth(parsed.tier, log);
                results.push({ type: 'wealth', label: w.label, detail: w.detail, valueT$: w.valueT$ });
            }
        } else {
            log.push(`Dinheiro (não parseado): ${text}`);
            results.push({ type: 'note', label: text });
        }

        if (hasExtra) {
            const extra = rollWealth('menor', log);
            results.push({ type: 'wealth', label: extra.label + ' (+%)', detail: extra.detail });
        }

        return results;
    }

    function rollColumn(entries, log, prefix, resolver, multiplier = 1) {
        const d100 = rollD100();
        const entry = lookup(entries, d100);
        const resultText = entry ? entry.result : '—';
        log.push(`${prefix}: d100=${d100} → ${resultText}`);
        if (!entry || isEmptyResult(resultText)) return [];
        return resolver(resultText, log, multiplier);
    }

    function rollForNd(ndVal, options = {}) {
        ensureData();
        const {
            treasureType = 'padrao',
            moneyMultiplier = 1,
            sourceLabel = `ND ${formatNd(ndVal)}`
        } = options;

        if (treasureType === 'nenhum') {
            return { money: [], items: [], log: [`[${sourceLabel}] Sem tesouro (Nenhum).`] };
        }

        const key = ndTableKey(ndVal);
        const table = DATA.ndTable[key];
        if (!table) {
            return { money: [], items: [], log: [`[${sourceLabel}] Tabela ND não encontrada.`] };
        }

        let moneyMult = moneyMultiplier;
        if (treasureType === 'metade') moneyMult *= 0.5;

        const rolls = treasureType === 'dobro' ? 2 : 1;
        const money = [];
        const items = [];
        const log = [`--- ${sourceLabel} (tabela ND ${key}) ---`];

        for (let r = 0; r < rolls; r++) {
            if (rolls > 1) log.push(`>> Rolagem ${r + 1} de ${rolls} (Dobro)`);
            money.push(...rollColumn(table.money, log, 'Dinheiro', resolveMoneyResult, moneyMult));
            items.push(...rollColumn(table.items, log, 'Itens', (text, lg) => resolveItemResult(text, lg)));
        }

        return { money, items, log };
    }

    function formatNd(ndVal) {
        if (Math.abs(ndVal - 0.25) < 0.01) return '1/4';
        if (Math.abs(ndVal - 0.5) < 0.01) return '1/2';
        if (Math.abs(ndVal - 0.125) < 0.01) return '1/8';
        if (ndVal < 1) return ndVal.toFixed(2);
        return String(Math.floor(ndVal));
    }

    function categorizeLoot(name) {
        const n = (name || '').toLowerCase();
        if (n.includes('riqueza')) return 'wealth';
        if (n.includes('poção') || n.includes('pocao')) return 'potion';
        if (n.includes('mágico') || n.includes('magico') || n.includes('encanto') || n.includes('[')) return 'magic';
        if (n.includes('superior') || n.includes('melhoria')) return 'superior';
        if (n.includes('equipamento') || n.includes('arma') || n.includes('armadura')) return 'gear';
        return 'item';
    }

    function aggregateResults(allRolls) {
        const coins = { T$: 0, TC: 0, TO: 0 };
        const itemCounts = {};
        const wealthEntries = [];
        const logs = [];

        allRolls.forEach(roll => {
            logs.push(...roll.log);

            roll.money.forEach(m => {
                if (m.type === 'coins' && coins[m.unit] !== undefined) {
                    coins[m.unit] += m.amount;
                }
                if (m.type === 'wealth') {
                    wealthEntries.push({
                        label: m.label || 'Riqueza',
                        detail: m.detail || '',
                        valueT$: m.valueT$ || 0
                    });
                }
            });

            roll.items.forEach(it => {
                if (it.type === 'wealth') {
                    wealthEntries.push({
                        label: it.label || 'Riqueza',
                        detail: it.detail || '',
                        valueT$: it.valueT$ || 0
                    });
                }
                if (it.type === 'item') {
                    const key = it.label || 'Item';
                    if (!itemCounts[key]) {
                        itemCounts[key] = { name: key, count: 0, category: categorizeLoot(key) };
                    }
                    itemCounts[key].count += 1;
                }
            });
        });

        const moneyChips = [];
        if (coins.T$) moneyChips.push({ kind: 'coin', unit: 'T$', amount: Math.round(coins.T$), label: 'Tibares' });
        if (coins.TO) moneyChips.push({ kind: 'coin', unit: 'TO', amount: Math.round(coins.TO), label: 'Ouro' });
        if (coins.TC) moneyChips.push({ kind: 'coin', unit: 'TC', amount: Math.round(coins.TC), label: 'Cobre' });

        wealthEntries.forEach(w => {
            moneyChips.push({
                kind: 'wealth',
                unit: 'T$',
                amount: w.valueT$,
                label: w.label,
                detail: w.detail
            });
        });

        const itemList = Object.values(itemCounts).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

        const moneyParts = moneyChips
            .filter(c => c.kind === 'coin')
            .map(c => `${c.amount.toLocaleString('pt-BR')} ${c.unit}`);
        const wealthTotal = wealthEntries.reduce((s, w) => s + (w.valueT$ || 0), 0);
        if (wealthTotal) moneyParts.push(`${wealthTotal.toLocaleString('pt-BR')} T$ (riquezas)`);

        const itemsFormatted = itemList.length
            ? itemList.map(i => (i.count > 1 ? `${i.count}× ${i.name}` : i.name)).join('; ')
            : 'Nenhum';

        return {
            moneyChips,
            itemList,
            totalItems: itemList.reduce((s, i) => s + i.count, 0),
            moneyText: moneyParts.length ? moneyParts.join(' + ') : 'Nenhum dinheiro',
            itemsText: itemsFormatted,
            logText: logs.join('\n'),
            logLines: logs
        };
    }

    function rollThreats(threats, options) {
        ensureData();
        const allRolls = [];
        threats.forEach(t => {
            const qty = t.qty || 1;
            const tType = t.treasureType || options.defaultTreasureType || 'padrao';
            for (let i = 0; i < qty; i++) {
                allRolls.push(rollForNd(t.ndVal, {
                    ...options,
                    treasureType: tType,
                    sourceLabel: `${t.name} (ND ${formatNd(t.ndVal)})`
                }));
            }
        });
        return aggregateResults(allRolls);
    }

    function rollEncounterNd(encounterNd, options) {
        ensureData();
        const roll = rollForNd(encounterNd, {
            ...options,
            sourceLabel: `Encontro ND ${Math.floor(encounterNd)}`
        });
        return aggregateResults([roll]);
    }

    return {
        init,
        rollForNd,
        rollThreats,
        rollEncounterNd,
        aggregateResults
    };
})();

if (typeof window !== 'undefined') {
    window.T20Treasure = T20Treasure;
    if (window.T20_TREASURE_DATA) {
        T20Treasure.init(window.T20_TREASURE_DATA);
    }
}
