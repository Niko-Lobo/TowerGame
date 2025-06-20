// Import the file system module
var fs = require('fs');

// Game parameters - Adjusted for 50 steps
var TOTAL_STEPS = 50;
var LAMBDA_CRASH = 0.202; // Adjusted to produce ~9.61% crash probability at step 1
var MULTIPLIER_BASE = Math.pow(15000, 1/50); // Reach 15,000x at step 50 (~1.195)
var BASE_STAKE = 1.0; // Base stake for betting
var TARGET_RTP = 0.97; // Target RTP of the game (97%)
var CRASH_BEYOND_RANGE_PROB = 0.0001; // 0.01% chance for crash at step 51
var MULTIPLIER_CSV_FILE = "multiplier_array_50.csv";
var BONUS_ROUNDS_CSV_FILE = "bonus_rounds_50.csv"; // CSV file for bonus rounds
var SIMULATION_ROUNDS_CSV_FILE = "simulation_rounds.csv"; // CSV file for round data
var TARGET_MAX_MULTIPLIER = 15000.0; // Target multiplier at step 50

// Speed modes - Unchanged
var SPEED_MODES = {
    "Normal": 1,
    "Fast": 3,
    "Swift": 10
};

// Мистический бонус (Маг) parameters - Scaled for 50 steps
var MYSTIC_COST_MULTIPLIER = 10; // Retained for reference, not used
var MYSTIC_JUMP_STEPS = 8; // Scaled from 15 to ~8 steps (15/100 * 50 ≈ 7.5, rounded up)
var MYSTIC_JUMP_DISTRIBUTION = [
    [3, 5, 0.1994],  // Smaller jumps (3 to 5 steps)
    [6, 7, 0.2991],   // Slightly below target (6 to 7 steps)
    [8, 8, 0.2991],   // Target jump (8 steps)
    [9, 10, 0.14955], // Slightly above target (9 to 10 steps)
    [11, 13, 0.04985], // Larger jumps (11 to 13 steps)
    ["max", "max", 0.001], // Jump to step 50 (0.1% chance)
    [43, 49, 0.002] // Jump to steps 43-49 (0.2% chance)
];

// Драконий бонус parameters - Scaled for 50 steps
var DRAGON_COST_MULTIPLIER = 20; // Retained for reference, not used
var DRAGON_CRASH_PROB = 0.5; // 50% failure chance
var DRAGON_JUMP_STEPS = 13; // Scaled from 25 to ~13 steps (25/100 * 50 = 12.5, rounded up)
var DRAGON_JUMP_DISTRIBUTION = [
    [5, 8, 0.1491],   // Smaller jumps (5 to 8 steps)
    [9, 10, 0.1988],  // Below target (9 to 10 steps)
    [11, 12, 0.2485], // Slightly below target (11 to 12 steps)
    [13, 13, 0.2485], // Target jump (13 steps)
    [14, 15, 0.0994], // Slightly above target (14 to 15 steps)
    [16, 20, 0.0497], // Larger jumps (16 to 20 steps)
    ["max", "max", 0.002], // Jump to step 50 (0.2% chance)
    [43, 49, 0.004] // Jump to steps 43-49 (0.4% chance)
];

// Bonus RTP target - Unchanged
var BONUS_RTP = 0.95; // Target RTP for bonuses (95%)

// Load or generate multiplier array with pure geometric progression
function loadOrGenerateMultiplierArray() {
    if (fs.existsSync(MULTIPLIER_CSV_FILE)) {
        console.log(`Loading multiplier array from ${MULTIPLIER_CSV_FILE}...`);
        var fileContent = fs.readFileSync(MULTIPLIER_CSV_FILE, 'utf8');
        var lines = fileContent.trim().split('\n');
        var multiplier_array = [];
        for (let i = 1; i < lines.length; i++) {
            var [step, multiplier] = lines[i].split(',');
            multiplier_array[parseInt(step)] = parseFloat(multiplier);
        }
        return multiplier_array;
    } else {
        console.log(`Generating multiplier array and saving to ${MULTIPLIER_CSV_FILE}...`);
        var multiplier_array = Array.from({ length: TOTAL_STEPS + 1 }, (_, step) => Math.pow(MULTIPLIER_BASE, step));
        var csvContent = "Step,Multiplier\n";
        for (let step = 0; step < multiplier_array.length; step++) {
            csvContent += `${step},${multiplier_array[step]}\n`;
        }
        fs.writeFileSync(MULTIPLIER_CSV_FILE, csvContent, 'utf8');
        return multiplier_array;
    }
}

// Load the multiplier array
var multiplier_array = loadOrGenerateMultiplierArray();

function calculateCrashProbabilities() {
    // Initial exponential probabilities for steps 1 to 50
    let initialProbs = [];
    for (let step = 1; step <= TOTAL_STEPS; step++) {
        // P(crash at step n) = CDF(step) - CDF(step-1)
        let prob = Math.exp(-LAMBDA_CRASH * (step - 1)) - Math.exp(-LAMBDA_CRASH * step);
        initialProbs.push(prob);
    }

    // Normalize probabilities for steps 1 to 50, excluding step 51
    let totalProb = initialProbs.reduce((sum, prob) => sum + prob, 0);
    let normalizedProbs = initialProbs.map(prob => prob / totalProb);

    // Adjust for step 51 probability
    let prob51 = CRASH_BEYOND_RANGE_PROB;
    let probSteps1To50 = 1.0 - prob51;
    let adjustedProbs = normalizedProbs.map(prob => prob * probSteps1To50);

    // Calculate expected return
    let expectedReturn = adjustedProbs.reduce((sum, prob, i) => sum + prob * multiplier_array[i], 0);
    expectedReturn += prob51 * multiplier_array[TOTAL_STEPS];
    console.log(`Initial Expected Return: ${expectedReturn.toFixed(4)}`);

    // Scale to achieve target RTP
    let scalingFactor = TARGET_RTP / expectedReturn;
    console.log(`Scaling Factor: ${scalingFactor.toFixed(6)}`);
    let finalProbs = adjustedProbs.map(prob => prob * scalingFactor);
    let finalProb51 = prob51 * scalingFactor;

    // Re-normalize to ensure probabilities sum to 1
    totalProb = finalProbs.reduce((sum, prob) => sum + prob, 0) + finalProb51;
    finalProbs = finalProbs.map(prob => prob / totalProb);
    finalProb51 = finalProb51 / totalProb;

    // Verify RTP
    let finalRtp = finalProbs.reduce((sum, prob, i) => sum + prob * multiplier_array[i], 0);
    finalRtp += finalProb51 * multiplier_array[TOTAL_STEPS];
    console.log(`Calculated RTP: ${(finalRtp * 100).toFixed(2)}% (Target: ${(TARGET_RTP * 100).toFixed(2)}%)`);

    // Verify crash probability at step 1
    console.log(`Crash Probability at Step 1: ${(finalProbs[0] * 100).toFixed(2)}%`);

    return { finalProbs, finalProb51 };
}

// Pre-calculate crash probabilities
var { finalProbs: crash_probabilities, finalProb51: prob_crash_51 } = calculateCrashProbabilities();
var cumulative_crash_probabilities = crash_probabilities.map((_, i) =>
    crash_probabilities.slice(0, i + 1).reduce((sum, prob) => sum + prob, 0)
);

function getMultiplier(step) {
    return multiplier_array[step];
}

function calculateBonusCost(step, bonus_type) {
    var target_jump = (bonus_type === "Mystic") ? MYSTIC_JUMP_STEPS : DRAGON_JUMP_STEPS;
    if (step + target_jump >= TOTAL_STEPS) {
        return "N/A"; // Bonus cannot be activated
    }
    var target_step = Math.min(step + target_jump, TOTAL_STEPS);
    var current_multiplier = getMultiplier(step);
    var target_multiplier = getMultiplier(target_step);
    var cost = (target_multiplier - current_multiplier) / BONUS_RTP;
    return cost;
}

function getFreeBonusProbability(step) {
    // Linearly decreasing probability from 5% at step 0 to 0% at step 5
    return 0.05 * Math.max(0, (5 - step) / 5);
}

function generateCrashStep() {
    var u = Math.random();
    if (u < crash_probabilities.reduce((sum, prob) => sum + prob, 0)) { // Crash occurs at steps 1 to 50
        for (let step = 0; step < TOTAL_STEPS; step++) {
            if (u <= cumulative_crash_probabilities[step]) {
                return step + 1;
            }
        }
    }
    // Otherwise, crash occurs at step 51
    return TOTAL_STEPS + 1;
}

function generateNewCrashStep(start_step) {
    var remaining_steps = TOTAL_STEPS - start_step;
    if (remaining_steps <= 0) {
        return TOTAL_STEPS + 1; // No crash if at the top
    }

    var remaining_probs = crash_probabilities.slice(start_step);
    var total_prob = remaining_probs.reduce((sum, prob) => sum + prob, 0);
    if (total_prob === 0) {
        return TOTAL_STEPS + 1;
    }

    var normalized_probs = remaining_probs.map(prob => prob / total_prob);
    var cumulative_probs = normalized_probs.map((_, i) =>
        normalized_probs.slice(0, i + 1).reduce((sum, prob) => sum + prob, 0)
    );

    var u = Math.random();
    for (let i = 0; i < cumulative_probs.length; i++) {
        if (u <= cumulative_probs[i]) {
            return start_step + i + 1;
        }
    }
    return TOTAL_STEPS + 1; // Crash at 51
}

function simulateBonusJump(current_step, bonus_type) {
    var max_jump = Math.max(0, TOTAL_STEPS - current_step);
    if (max_jump === 0) {
        return { newStep: current_step, crashed: false };
    }

    var distribution = bonus_type === "Mystic" ? MYSTIC_JUMP_DISTRIBUTION : DRAGON_JUMP_DISTRIBUTION;

    if (bonus_type === "Dragon" && Math.random() < DRAGON_CRASH_PROB) {
        return { newStep: current_step, crashed: true };
    }

    var u = Math.random();
    let cumulative_prob = 0;
    for (var [start, end, prob] of distribution) {
        cumulative_prob += prob;
        if (u <= cumulative_prob) {
            let jump;
            if (start === "max" && end === "max") {
                jump = TOTAL_STEPS - current_step;
            } else if (start === 43 && end === 49) {
                var min_step = Math.max(43, current_step + 1);
                var max_step = 49;
                if (min_step > max_step) {
                    return { newStep: current_step, crashed: false };
                }
                jump = Math.floor(Math.random() * (max_step - min_step + 1)) + min_step - current_step;
            } else if (start === end) {
                jump = Math.min(start, max_jump);
            } else {
                var min_jump = Math.max(0, start);
                var max_jump_range = Math.min(end, max_jump);
                if (min_jump > max_jump_range) {
                    return { newStep: current_step, crashed: false };
                }
                jump = Math.floor(Math.random() * (max_jump_range - min_jump + 1)) + min_jump;
            }
            return { newStep: current_step + jump, crashed: false };
        }
    }
    return { newStep: current_step, crashed: false };
}

function simulateRound(speed_mode, simulation_mode, game_number, enableFreeBonuses, cashoutStrategy) {
    var speed = SPEED_MODES[speed_mode];
    let crash_step = generateCrashStep();
    var cashout_step = cashoutStrategy === "R"
        ? Math.floor(Math.random() * (TOTAL_STEPS + 1))
        : parseInt(cashoutStrategy);
    let current_step = 0;
    let total_cost = BASE_STAKE;
    let total_winnings = 0;
    let used_bonus = null;
    let bonus_rounds = [];

    while (current_step < TOTAL_STEPS) {
        var bonus_triggered = false;
        var free_bonus = false;
        let bonus_type = null;

        if (simulation_mode === "Base" && enableFreeBonuses) {
            var free_bonus_prob = getFreeBonusProbability(current_step);
            if (Math.random() < free_bonus_prob) {
                bonus_triggered = true;
                free_bonus = true;
                bonus_type = "Mystic";
                var target_jump = MYSTIC_JUMP_STEPS;
                if (current_step + target_jump >= TOTAL_STEPS) {
                    bonus_triggered = false;
                    bonus_type = null;
                }
            }
        } else if (simulation_mode === "Mystic") {
            bonus_triggered = Math.random() < 0.5;
            if (bonus_triggered && current_step + MYSTIC_JUMP_STEPS < TOTAL_STEPS) {
                bonus_type = "Mystic";
            }
        } else if (simulation_mode === "Dragon") {
            bonus_triggered = Math.random() < 0.5;
            if (bonus_triggered && current_step + DRAGON_JUMP_STEPS < TOTAL_STEPS) {
                bonus_type = "Dragon";
            }
        }

        if (bonus_triggered && bonus_type) {
            if (current_step >= TOTAL_STEPS) {
                break;
            }

            var target_jump = (bonus_type === "Mystic") ? MYSTIC_JUMP_STEPS : DRAGON_JUMP_STEPS;
            var target_step = Math.min(current_step + target_jump, TOTAL_STEPS);
            var current_multiplier = getMultiplier(current_step);
            var target_multiplier = getMultiplier(target_step);
            var cost = free_bonus ? 0 : (target_multiplier - current_multiplier) / BONUS_RTP;
            total_cost += cost;

            var original_crash_point = crash_step;
            var redistributed_crash_point = "N/A";

            var { newStep, crashed } = simulateBonusJump(current_step, bonus_type);

            var payout = crashed ? 0 : getMultiplier(newStep);
            var bonus_rtp = cost > 0 ? (payout / cost) * 100 : (payout > 0 ? Infinity : 0);

            if (!crashed && crash_step > current_step && crash_step <= newStep) {
                crash_step = generateNewCrashStep(newStep);
                redistributed_crash_point = crash_step;
            }

            bonus_rounds.push({
                game_number: game_number,
                current_step: current_step,
                result_step: crashed ? current_step : newStep,
                cost: cost,
                rtp: bonus_rtp,
                game_crush_point: original_crash_point,
                redistributed_crush_point: redistributed_crash_point
            });

            if (crashed) {
                return { total_winnings, total_cost, final_step: current_step, outcome: "Crashed (Dragon Bonus)", used_bonus: bonus_type, crash_point: crash_step, cashout_point: cashout_step, bonus_rounds };
            }

            if (cashout_step > current_step && cashout_step <= newStep) {
                if (crash_step > cashout_step) {
                    total_winnings = BASE_STAKE * getMultiplier(cashout_step);
                    return { total_winnings, total_cost, final_step: cashout_step, outcome: "Cashed out", used_bonus, crash_point: crash_step, cashout_point: cashout_step, bonus_rounds };
                }
            }

            current_step = newStep;
            used_bonus = bonus_type;
        }

        var next_step = Math.min(current_step + speed, TOTAL_STEPS);

        if (cashout_step > current_step && cashout_step <= next_step) {
            if (crash_step > cashout_step) {
                total_winnings = BASE_STAKE * getMultiplier(cashout_step);
                return { total_winnings, total_cost, final_step: cashout_step, outcome: "Cashed out", used_bonus, crash_point: crash_step, cashout_point: cashout_step, bonus_rounds };
            }
        }

        if (crash_step <= next_step) {
            return { total_winnings, total_cost, final_step: current_step, outcome: "Crashed during move", used_bonus, crash_point: crash_step, cashout_point: cashout_step, bonus_rounds };
        }

        current_step = next_step;
    }

    if (crash_step > cashout_step || crash_step === TOTAL_STEPS + 1) {
        total_winnings = BASE_STAKE * getMultiplier(TOTAL_STEPS);
        return { total_winnings, total_cost, final_step: TOTAL_STEPS, outcome: "Reached the top", used_bonus, crash_point: crash_step, cashout_point: cashout_step, bonus_rounds };
    } else {
        return { total_winnings, total_cost, final_step: current_step, outcome: "Crashed during move", used_bonus, crash_point: crash_step, cashout_point: cashout_step, bonus_rounds };
    }
}

function simulateGame(num_rounds, simulation_mode, enableFreeBonuses, cashoutStrategy) {
    console.log("\nCrash Probabilities by Step:");
    console.log("Step | Probability (%)");
    console.log("-".repeat(20));
    for (let step = 0; step < TOTAL_STEPS; step++) {
        console.log(`${(step + 1).toString().padStart(4)} | ${((crash_probabilities[step] * 100).toFixed(7))}%`);
    }
    console.log(`Crash at Step 51: ${(prob_crash_51 * 100).toFixed(7)}%`);
    console.log("-".repeat(20));
    console.log(`Sum of Probabilities: ${((crash_probabilities.reduce((sum, prob) => sum + prob, 0) + prob_crash_51) * 100).toFixed(2)}%`);

    console.log("\nBonus Costs by Step:");
    console.log("Step | Mystic Bonus Cost | Dragon Bonus Cost");
    console.log("-".repeat(50));
    for (let step = 0; step < TOTAL_STEPS; step++) {
        var mystic_cost = calculateBonusCost(step, "Mystic");
        var dragon_cost = calculateBonusCost(step, "Dragon");
        console.log(
            `${step.toString().padStart(4)} | ` +
            `${typeof mystic_cost === "string" ? "N/A".padStart(17) : "$" + mystic_cost.toFixed(2).padStart(16)} | ` +
            `${typeof dragon_cost === "string" ? "N/A".padStart(17) : "$" + dragon_cost.toFixed(2).padStart(16)}`
        );
    }
    console.log("-".repeat(50));

    var csvContent = "Game Number,Current Step,Result Step,Cost,RTP,Game Crush Point,Redistributed Crush Point\n";
    fs.writeFileSync(BONUS_ROUNDS_CSV_FILE, csvContent, 'utf8');

    var roundsCsvContent = "Game Number,Final Step,Multiplier,Outcome,Winnings,Cost,Crash Point,Cashout Point,Used Bonus\n";
    fs.writeFileSync(SIMULATION_ROUNDS_CSV_FILE, roundsCsvContent, 'utf8');

    console.log(`\nSimulating ${num_rounds} rounds in ${simulation_mode} mode...`);
    if (simulation_mode === "Base") {
        console.log(`Free bonuses in Base mode: ${enableFreeBonuses ? "Enabled" : "Disabled"}`);
    }
    console.log(`Cashout strategy: ${cashoutStrategy === "R" ? "Random (0-50)" : `Fixed at step ${cashoutStrategy}`}`);

    let total_winnings = 0;
    let total_cost = 0;
    let total_steps = 0;
    let crashes = 0;
    let cash_outs = 0;
    let reached_top = 0;

    var crash_counts = Array(TOTAL_STEPS + 2).fill(0); // Steps 0 to 51
    var cashout_counts = Array(TOTAL_STEPS + 1).fill(0); // Steps 0 to 50
    var crash_point_counts = Array(TOTAL_STEPS + 2).fill(0); // Steps 0 to 51
    var cashout_point_counts = Array(TOTAL_STEPS + 1).fill(0); // Steps 0 to 50

    var speed_mode_counts = { "Normal": 0, "Fast": 0, "Swift": 0 };

    let mode_winnings = 0;
    let mode_cost = 0;

    for (let round_num = 1; round_num <= num_rounds; round_num++) {
        var speed_mode = Object.keys(SPEED_MODES)[Math.floor(Math.random() * 3)];
        speed_mode_counts[speed_mode]++;

        var { total_winnings: winnings, total_cost: cost, final_step, outcome, used_bonus, crash_point, cashout_point, bonus_rounds } = simulateRound(speed_mode, simulation_mode, round_num, enableFreeBonuses, cashoutStrategy);
        total_winnings += winnings;
        total_cost += cost;
        total_steps += final_step;

        mode_winnings += winnings;
        mode_cost += cost;

        crash_point_counts[crash_point]++;
        cashout_point_counts[cashout_point]++;

        if (outcome.includes("Crashed")) {
            crashes++;
            crash_counts[final_step]++;
        } else if (outcome === "Cashed out") {
            cash_outs++;
            cashout_counts[final_step]++;
        } else if (outcome === "Reached the top") {
            reached_top++;
            cashout_counts[TOTAL_STEPS]++;
        }

        for (var bonus of bonus_rounds) {
            var csvLine = `${bonus.game_number},${bonus.current_step},${bonus.result_step},${bonus.cost.toFixed(2)},${bonus.rtp.toFixed(2)},${bonus.game_crush_point},${bonus.redistributed_crush_point}\n`;
            fs.appendFileSync(BONUS_ROUNDS_CSV_FILE, csvLine, 'utf8');
        }

        var roundCsvLine = `${round_num},${final_step},${getMultiplier(final_step).toFixed(2)},${outcome},${winnings.toFixed(2)},${cost.toFixed(2)},${crash_point},${cashout_point},${used_bonus || ""}\n`;
        fs.appendFileSync(SIMULATION_ROUNDS_CSV_FILE, roundCsvLine, 'utf8');
    }

    var mode_rtp = mode_cost > 0 ? (mode_winnings / mode_cost * 100) : 0;

    var crash_percents = crash_counts.map(count => count / num_rounds * 100);
    var cashout_percents = cashout_counts.map(count => count / num_rounds * 100);
    var crash_point_percents = crash_point_counts.map(count => count / num_rounds * 100);
    var cashout_point_percents = cashout_point_counts.map(count => count / num_rounds * 100);

    var speed_mode_percents = Object.fromEntries(
        Object.entries(speed_mode_counts).map(([mode, count]) => [mode, count / num_rounds * 100])
    );

    console.log("\nSimulation Statistics:");
    console.log(`Total Rounds: ${num_rounds}`);
    console.log(`Total Winnings: $${total_winnings.toFixed(2)}`);
    console.log(`Total Cost: $${total_cost.toFixed(2)}`);
    console.log(`Net Profit: $${(total_winnings - total_cost).toFixed(2)}`);
    console.log(`Average Step Reached: ${(total_steps / num_rounds).toFixed(2)}`);
    console.log(`Crashes: ${crashes} (${(crashes / num_rounds * 100).toFixed(2)}%)`);
    console.log(`Cash Outs: ${cash_outs} (${(cash_outs / num_rounds * 100).toFixed(2)}%)`);
    console.log(`Reached Top: ${reached_top} (${(reached_top / num_rounds * 100).toFixed(2)}%)`);
    console.log("\nRTP Calculations:");
    if (simulation_mode === "Base") {
        console.log(`Base Game RTP: ${mode_rtp.toFixed(2)}% (Winnings: $${mode_winnings.toFixed(2)}, Cost: $${mode_cost.toFixed(2)})`);
    } else if (simulation_mode === "Mystic") {
        console.log(`Мистический Бонус RTP: ${mode_rtp.toFixed(2)}% (Winnings: $${mode_winnings.toFixed(2)}, Cost: $${mode_cost.toFixed(2)})`);
    } else if (simulation_mode === "Dragon") {
        console.log(`Драконий Бонус RTP: ${mode_rtp.toFixed(2)}% (Winnings: $${mode_winnings.toFixed(2)}, Cost: $${mode_cost.toFixed(2)})`);
    }

    console.log("\nSpeed Mode Distribution:");
    console.log("Mode  | % Rounds");
    console.log("-".repeat(20));
    for (var [mode, percent] of Object.entries(speed_mode_percents)) {
        console.log(`${mode.padEnd(6)}| ${percent.toFixed(7)}%`);
    }

    console.log("\nPer-Step Statistics:");
    console.log("Step | % Crashes   | % Cashouts  | % Crash Points | % Cashout Points");
    console.log("-".repeat(75));
    for (let step = 1; step <= TOTAL_STEPS; step++) {
        console.log(
            `${step.toString().padStart(4)} | ` +
            `${crash_percents[step].toFixed(7)}% | ` +
            `${cashout_percents[step].toFixed(7)}% | ` +
            `${crash_point_percents[step].toFixed(7)}% | ` +
            `${cashout_point_percents[step].toFixed(7)}%`
        );
    }
    console.log(
        ` 51 | ${crash_percents[TOTAL_STEPS + 1].toFixed(7)}% | ` +
        `${'N/A'.padEnd(11)} | ` +
        `${crash_point_percents[TOTAL_STEPS + 1].toFixed(7)}% | ` +
        `${'N/A'.padEnd(11)}`
    );
}

function main() {
    var readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log("Select the mode to simulate:");
    console.log("1: Base Game (No Bonuses)");
    console.log("2: Мистический Бонус (Bonus 1)");
    console.log("3: Драконий Бонус (Bonus 2)");

    readline.question("Enter your choice (1, 2, or 3): ", (choice) => {
        let simulation_mode;
        if (choice === "1") {
            simulation_mode = "Base";
        } else if (choice === "2") {
            simulation_mode = "Mystic";
        } else if (choice === "3") {
            simulation_mode = "Dragon";
        } else {
            console.log("Invalid choice. Please enter 1, 2, or 3.");
            readline.close();
            return;
        }

        readline.question("Enter the number of rounds to simulate: ", (num_rounds_input) => {
            var num_rounds = parseInt(num_rounds_input);
            if (isNaN(num_rounds) || num_rounds <= 0) {
                console.log("Invalid number of rounds. Please enter a positive integer.");
                readline.close();
                return;
            }

            function askFreeBonuses(callback) {
                if (simulation_mode === "Base") {
                    readline.question("Enable free bonuses in Base mode? (y/n): ", (free_bonus_input) => {
                        var enableFreeBonuses = free_bonus_input.toLowerCase() === 'y';
                        callback(enableFreeBonuses);
                    });
                } else {
                    callback(false);
                }
            }

            function askCashoutStrategy(enableFreeBonuses) {
                readline.question("Enter cashout strategy (R for random, or step number 0-50): ", (strategy_input) => {
                    if (strategy_input.toLowerCase() === 'r') {
                        simulateGame(num_rounds, simulation_mode, enableFreeBonuses, "R");
                        readline.close();
                    } else {
                        var step = parseInt(strategy_input);
                        if (isNaN(step) || step < 0 || step > TOTAL_STEPS) {
                            console.log(`Invalid strategy. Please enter 'R' or a number between 0 and ${TOTAL_STEPS}.`);
                            askCashoutStrategy(enableFreeBonuses);
                        } else {
                            simulateGame(num_rounds, simulation_mode, enableFreeBonuses, step);
                            readline.close();
                        }
                    }
                });
            }

            askFreeBonuses((enableFreeBonuses) => {
                askCashoutStrategy(enableFreeBonuses);
            });
        });
    });
}

main();