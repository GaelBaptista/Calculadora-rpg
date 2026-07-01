// ==========================================================================
// TEST SUITE FOR TORMENTA20 ND CALCULATION CORE
// ==========================================================================

const ND_MAP = {
    '1/10': 0.1,
    '1/8': 0.125,
    '1/6': 1/6,
    '1/4': 0.25,
    '1/2': 0.5,
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    '11': 11, '12': 12, '13': 13, '14': 14, '15': 15, '16': 16, '17': 17, '18': 18, '19': 19, '20': 20
};

// Extracted calculator function from app.js
function testCalculateEncounter(threats) {
    if (threats.length === 0) return 0;
    
    // Step 1: Group threats by ND
    const groups = {};
    threats.forEach(t => {
        if (!groups[t.ndVal]) {
            groups[t.ndVal] = { ndVal: t.ndVal, qty: 0 };
        }
        groups[t.ndVal].qty += t.qty;
    });
    
    let combinedNDs = [];
    Object.values(groups).forEach(group => {
        const { ndVal, qty } = group;
        let groupResult = 0;
        
        if (ndVal < 1) {
            groupResult = ndVal * qty;
        } else {
            const add = qty > 1 ? Math.round(2 * Math.log2(qty)) : 0;
            groupResult = ndVal + add;
        }
        combinedNDs.push({ combinedNd: groupResult });
    });
    
    // Step 2: Recursive grouping
    let resolvedList = combinedNDs.map(x => x.combinedNd);
    let iterations = 0;
    let needsGroup = true;
    
    while (needsGroup && iterations < 10) {
        iterations++;
        const freq = {};
        resolvedList.forEach(v => freq[v] = (freq[v] || 0) + 1);
        
        const duplicates = Object.keys(freq).filter(k => freq[k] > 1).map(Number);
        
        if (duplicates.length === 0) {
            needsGroup = false;
        } else {
            let nextList = [];
            let processed = new Set();
            
            resolvedList.forEach(v => {
                if (processed.has(v)) return;
                
                const count = freq[v];
                if (count > 1) {
                    processed.add(v);
                    let result = 0;
                    if (v < 1) {
                        result = v * count;
                    } else {
                        const add = Math.round(2 * Math.log2(count));
                        result = v + add;
                    }
                    nextList.push(result);
                } else {
                    nextList.push(v);
                }
            });
            resolvedList = nextList;
        }
    }
    
    // Step 3: Combine different NDs
    resolvedList.sort((a, b) => b - a);
    
    const baseND = resolvedList[0];
    let runningND = baseND;
    
    if (resolvedList.length > 1) {
        for (let i = 1; i < resolvedList.length; i++) {
            const currentND = resolvedList[i];
            const diff = baseND - currentND;
            let addition = 0;
            
            if (diff <= 1) {
                addition = 1;
            } else if (diff <= 2) {
                addition = 0.5;
            } else if (diff <= 3) {
                addition = 0.25;
            } else {
                addition = 0;
            }
            runningND += addition;
        }
    }
    
    const roundedND = Math.floor(runningND);
    return { preciseND: runningND, roundedND: roundedND };
}

// TEST RUNNER
const testCases = [
    {
        name: "4x ND 1/4 (Goblins)",
        threats: [{ name: "Goblin", ndVal: 0.25, qty: 4 }],
        expectedRounded: 1
    },
    {
        name: "2x ND 1/2 (Lobos)",
        threats: [{ name: "Lobo de Caça", ndVal: 0.5, qty: 2 }],
        expectedRounded: 1
    },
    {
        name: "2x ND 1 (Guerreiros Orcs)",
        threats: [{ name: "Orc", ndVal: 1, qty: 2 }],
        expectedRounded: 3
    },
    {
        name: "4x ND 5 (Decúrias)",
        threats: [{ name: "Decúria", ndVal: 5, qty: 4 }],
        expectedRounded: 9
    },
    {
        name: "Exemplo do Livro: ND 7, ND 6, ND 5, ND 3 (Misto)",
        threats: [
            { name: "Centurião", ndVal: 7, qty: 1 },
            { name: "Governador", ndVal: 6, qty: 1 },
            { name: "Decúria", ndVal: 5, qty: 1 },
            { name: "Minauro", ndVal: 3, qty: 1 }
        ],
        expectedRounded: 8 // 7 base + 1 (diff 1) + 0.5 (diff 2) + 0 (diff 4) = 8.5 -> floor(8.5) = 8
    },
    {
        name: "Mistura de iguais e diferentes: 2x ND 5 e 1x ND 6",
        // 2x ND 5 -> ND 7 base. ND 6 (diff 1) -> +1. ND final = 8.
        threats: [
            { name: "Monstro ND 5", ndVal: 5, qty: 2 },
            { name: "Monstro ND 6", ndVal: 6, qty: 1 }
        ],
        expectedRounded: 8
    }
];

console.log("====================================================");
console.log("INICIANDO SUÍTE DE TESTES UNITÁRIOS - CALCULADORA T20");
console.log("====================================================\n");

let passedCount = 0;

testCases.forEach((tc, idx) => {
    const result = testCalculateEncounter(tc.threats);
    const passed = result.roundedND === tc.expectedRounded;
    
    if (passed) {
        console.log(`✅ [Teste #${idx + 1}] PASSOU: "${tc.name}"`);
        console.log(`   Esperado: ND ${tc.expectedRounded} | Obtido: ND ${result.roundedND} (Preciso: ${result.preciseND.toFixed(2)})\n`);
        passedCount++;
    } else {
        console.error(`❌ [Teste #${idx + 1}] FALHOU: "${tc.name}"`);
        console.error(`   Esperado: ND ${tc.expectedRounded} | Obtido: ND ${result.roundedND} (Preciso: ${result.preciseND.toFixed(2)})\n`);
    }
});

console.log("====================================================");
console.log(`RESULTADO FINAL: ${passedCount} / ${testCases.length} TESTES PASSARAM`);
console.log("====================================================");

// Exit code based on tests success
process.exit(passedCount === testCases.length ? 0 : 1);
