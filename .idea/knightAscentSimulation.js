// Import the file system module
var fs = require('fs');

// Game parameters
var TOTAL_STEPS = 100;
var LAMBDA_CRASH = 0.101; // Adjusted previously
var MULTIPLIER_BASE = Math.pow(15000, 1/100); // Adjusted to reach 15,000x at step 100 (~1.0946)
var BASE_STAKE = 1.0; // Base stake for betting
var TARGET_RTP = 0.97; // Target RTP of the game (97%)
var CRASH_BEYOND_RANGE_PROB = 0.0001; // 0.01% chance for crash point to be 101
var MULTIPLIER_CSV_FILE = "multiplier_array.csv";
var BONUS_ROUNDS_CSV_FILE = "bonus_rounds.csv"; // CSV file for bonus rounds
var TARGET_MAX_MULTIPLIER = 15000.0; // Target multiplier at step 100

// Speed modes
var SPEED_MODES = {
    "Normal": 1,
    "Fast": 3,
    "Swift": 10
};

// Мистический бонус (Маг) parameters
var MYSTIC_COST_MULTIPLIER = 10; // Used in previous cost calculation, now replaced
var MYSTIC_JUMP_STEPS = 15; // Target jump for Mystic bonus
var MYSTIC_JUMP_DISTRIBUTION = [
    [5, 10, 0.1994],  // Smaller jumps (5 to 10 steps above current) - adjusted
    [11, 14, 0.2991],  // Slightly below target (11 to 14 steps) - adjusted
    [15, 15, 0.2991],  // Target jump (15 steps) - adjusted
    [16, 20, 0.14955], // Slightly above target (16 to 20 steps) - adjusted
    [21, 25, 0.04985], // Larger jumps (21 to 25 steps) - adjusted
    ["max", "max", 0.001], // Jump to step 100 (0.1% chance)
    [85, 99, 0.002] // Jump to steps 85-99 (0.2% chance)
];

// Драконий бонус parameters
var DRAGON_COST_MULTIPLIER = 20; // Used in previous cost calculation, now replaced
var DRAGON_CRASH_PROB = 0.5; // 50% failure chance
var DRAGON_JUMP_STEPS = 25; // Target jump for Dragon bonus
var DRAGON_JUMP_DISTRIBUTION = [
    [10, 15, 0.1491], // Smaller jumps (10 to 15 steps above current) - adjusted
    [16, 20, 0.1988],  // Below target (16 to 20 steps) - adjusted
    [21, 24, 0.2485], // Slightly below target (21 to 24 steps) - adjusted
    [25, 25, 0.2485], // Target jump (25 steps) - adjusted
    [26, 30, 0.0994],  // Slightly above target (26 to 30 steps) - adjusted
    [31, 40, 0.0497], // Larger jumps (31 to 40 steps) - adjusted
    ["max", "max", 0.002], // Jump to step 100 (0.2% chance)
    [85, 99, 0.004] // Jump to steps 85-99 (0.4% chance)
];

// Bonus RTP target
var BONUS_RTP = 0.95; // Target RTP for bonuses (95%)

// Load or generate multiplier array with pure geometric progression
function loadOrGenerateMultiplierArray() {
    // Check if the CSV file exists
    if (fs.existsSync(MULTIPLIER_CSV_FILE)) {
        console.log(`Loading multiplier array from ${MULTIPLIER_CSV_FILE}...`);
        // Read the CSV file
        var fileContent = fs.readFileSync(MULTIPLIER_CSV_FILE, 'utf8');
        var lines = fileContent.trim().split('\n');
        var multiplier_array = [];

        // Skip the header and parse each line
        for (let i = 1; i < lines.length; i++) {
            var [step, multiplier] = lines[i].split(',');
            multiplier_array[parseInt(step)] = parseFloat(multiplier);
        }
        return multiplier_array;
    } else {
        console.log(`Generating multiplier array and saving to ${MULTIPLIER_CSV_FILE}...`);
        // Generate the multiplier array with pure geometric progression
        var multiplier_array = Array.from({ length: TOTAL_STEPS + 1 }, (_, step) => Math.pow(MULTIPLIER_BASE, step));

        // Prepare CSV content
        var csvContent = "Step,Multiplier\n";
        for (let step = 0; step < multiplier_array.length; step++) {
            csvContent += `${step},${multiplier_array[step]}\n`;
        }

        // Save to CSV file
        fs.writeFileSync(MULTIPLIER_CSV_FILE, csvContent, 'utf8');
        return multiplier_array;
    }
}

// Load the multiplier array
var multiplier_array = loadOrGenerateMultiplierArray();

function calculateCrashProbabilities() {
    // Initial exponential probabilities for steps 1 to 100
    let initialProbs = [];
    for (let step = 1; step <= TOTAL_STEPS; step++) {
        // P(crash at step n) = CDF(step) - CDF(step-1)
        let prob = Math.exp(-LAMBDA_CRASH * (step - 1)) - Math.exp(-LAMBDA_CRASH * step);
        initialProbs.push(prob);
    }

    // Normalize the probabilities for steps 1 to 100, accounting for the probability of crash at step 101
    let totalProb = initialProbs.reduce((sum, prob) => sum + prob, 0);
    let normalizedProbs = initialProbs.map(prob => prob / totalProb);

    // Adjust for the probability of crash at step 101
    let prob101 = CRASH_BEYOND_RANGE_PROB;
    let probSteps1To100 = 1.0 - prob101;
    let adjustedProbs = normalizedProbs.map(prob => prob * probSteps1To100);

    // Calculate the expected return with these probabilities
    // If crash at step i+1, player wins multiplier of step i
    // If crash at step 101, player wins multiplier of step 100
    let expectedReturn = adjustedProbs.reduce((sum, prob, i) => sum + prob * multiplier_array[i], 0);
    expectedReturn += prob101 * multiplier_array[TOTAL_STEPS];
    console.log(`Initial Expected Return: ${expectedReturn.toFixed(2)}`);

    // Scale probabilities to achieve the target RTP
    let scalingFactor = TARGET_RTP / expectedReturn;
    console.log(`Scaling Factor: ${scalingFactor.toFixed(6)}`);
    let finalProbs = adjustedProbs.map(prob => prob * scalingFactor);
    prob101 *= scalingFactor;

    // Re-normalize to ensure probabilities sum to 1
    totalProb = finalProbs.reduce((sum, prob) => sum + prob, 0) + prob101;
    finalProbs = finalProbs.map(prob => prob / totalProb);
    let finalProb101 = prob101 / totalProb;

    // Verify RTP
    let finalRtp = finalProbs.reduce((sum, prob, i) => sum + prob * multiplier_array[i], 0);
    finalRtp += finalProb101 * multiplier_array[TOTAL_STEPS];
    console.log(`Calculated RTP: ${(finalRtp * 100).toFixed(2)}% (Target: ${(TARGET_RTP * 100).toFixed(2)}%)`);

    // Verify crash probability at step 1
    console.log(`Crash Probability at Step 1: ${(finalProbs[0] * 100).toFixed(2)}%`);

    return { finalProbs, finalProb101 };
}

// Pre-calculate crash probabilities
var { finalProbs: crash_probabilities, finalProb101: prob_crash_101 } = calculateCrashProbabilities();
var cumulative_crash_probabilities = crash_probabilities.map((_, i) =>
    crash_probabilities.slice(0, i + 1).reduce((sum, prob) => sum + prob, 0)
);

function getMultiplier(step) {
    return multiplier_array[step];
}

function calculateBonusCost(step, bonus_type) {
    var target_jump = (bonus_type === "Mystic") ? MYSTIC_JUMP_STEPS : DRAGON_JUMP_STEPS;
    // Check if the bonus can be activated at this step
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
    // Linearly decreasing probability from 5% at step 0 to 0% at step 10
    return 0.05 * Math.max(0, (10 - step) / 10);
}

function generateCrashStep() {
    var u = Math.random();
    if (u < crash_probabilities.reduce((sum, prob) => sum + prob, 0)) { // Crash occurs at steps 1 to 100
        for (let step = 0; step < TOTAL_STEPS; step++) {
            if (u <= cumulative_crash_probabilities[step]) {
                return step + 1;
            }
        }
    }
    // Otherwise, crash occurs at step 101
    return TOTAL_STEPS + 1;
}

function generateNewCrashStep(start_step) {
    var remaining_steps = TOTAL_STEPS - start_step;
    if (remaining_steps <= 0) {
        return TOTAL_STEPS + 1; // No crash if at the top
    }

    // Use the same crash probabilities, but shift to the remaining range
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
    return TOTAL_STEPS + 1; // Crash at 101
}

function simulateBonusJump(current_step, bonus_type) {
    var max_jump = Math.max(0, TOTAL_STEPS - current_step); // Ensure max_jump is non-negative

    if (max_jump === 0) {
        return { newStep: current_step, crashed: false }; // Can't jump further if at the top
    }

    // Determine jump distribution based on bonus type
    var distribution = bonus_type === "Mystic" ? MYSTIC_JUMP_DISTRIBUTION : DRAGON_JUMP_DISTRIBUTION;

    // Check for immediate crash (only for Dragon Bonus)
    if (bonus_type === "Dragon" && Math.random() < DRAGON_CRASH_PROB) {
        return { newStep: current_step, crashed: true }; // Immediate crash
    }

    // Select jump range based on distribution
    var u = Math.random();
    let cumulative_prob = 0;
    for (var [start, end, prob] of distribution) {
        cumulative_prob += prob;
        if (u <= cumulative_prob) {
            let jump;
            if (start === "max" && end === "max") {
                // Special case: jump to step 100
                jump = TOTAL_STEPS - current_step;
            } else if (start === 85 && end === 99) {
                // Jump to high win area (steps 85-99)
                var min_step = Math.max(85, current_step + 1); // Ensure we jump forward
                var max_step = 99;
                if (min_step > max_step) {
                    return { newStep: current_step, crashed: false }; // Invalid range, no jump
                }
                jump = Math.floor(Math.random() * (max_step - min_step + 1)) + min_step - current_step;
            } else if (start === end) { // Exact step (e.g., target jump)
                jump = Math.min(start, max_jump);
            } else {
                // Ensure the range for randint is valid
                var min_jump = Math.max(0, start);
                var max_jump_range = Math.min(end, max_jump);
                if (min_jump > max_jump_range) {
                    // If the range is invalid, skip the jump (treat as no jump)
                    return { newStep: current_step, crashed: false };
                }
                jump = Math.floor(Math.random() * (max_jump_range - min_jump + 1)) + min_jump;
            }
            return { newStep: current_step + jump, crashed: false };
        }
    }
    return { newStep: current_step, crashed: false }; // Fallback (shouldn't happen)
}

function simulateRound(speed_mode, simulation_mode, game_number) {
    var speed = SPEED_MODES[speed_mode];
    let crash_step = generateCrashStep();
    var cashout_step = Math.floor(Math.random() * (TOTAL_STEPS + 1)); // Random cashout point between 0 and 100
    let current_step = 0;
    let total_cost = BASE_STAKE; // Initial cost is the base stake
    let total_winnings = 0;
    let used_bonus = null;
    let bonus_rounds = []; // Array to store data for each bonus round in this game

    while (current_step < TOTAL_STEPS) {
        // Decide to use a bonus based on simulation mode
        var bonus_triggered = false;
        var free_bonus = false;
        let bonus_type = null;

        if (simulation_mode === "Base") {
            // In Normal mode, small chance of a free bonus, mostly in the beginning
            var free_bonus_prob = getFreeBonusProbability(current_step);
            if (Math.random() < free_bonus_prob) {
                bonus_triggered = true;
                free_bonus = true;
                // Randomly choose Mystic or Dragon bonus
                bonus_type = Math.random() < 0.5 ? "Mystic" : "Dragon";
                // Check if the bonus can be activated at this step
                var target_jump = (bonus_type === "Mystic") ? MYSTIC_JUMP_STEPS : DRAGON_JUMP_STEPS;
                if (current_step + target_jump >= TOTAL_STEPS) {
                    bonus_triggered = false; // Cannot activate bonus at this step
                    bonus_type = null;
                }
            }
        } else if (simulation_mode === "Mystic") {
            bonus_triggered = Math.random() < 0.5; // 50% chance as per previous update
            // Mystic bonus can only be activated if current_step + MYSTIC_JUMP_STEPS < TOTAL_STEPS
            if (bonus_triggered && current_step + MYSTIC_JUMP_STEPS < TOTAL_STEPS) {
                bonus_type = "Mystic";
            }
        } else if (simulation_mode === "Dragon") {
            bonus_triggered = Math.random() < 0.5; // 50% chance as per previous update
            // Dragon bonus can only be activated if current_step + DRAGON_JUMP_STEPS < TOTAL_STEPS
            if (bonus_triggered && current_step + DRAGON_JUMP_STEPS < TOTAL_STEPS) {
                bonus_type = "Dragon";
            }
        }

        if (bonus_triggered && bonus_type) {
            if (current_step >= TOTAL_STEPS) {
                break; // Prevent further bonuses if at the top
            }

            // Calculate the cost based on the target jump (0 if free bonus)
            var target_jump = (bonus_type === "Mystic") ? MYSTIC_JUMP_STEPS : DRAGON_JUMP_STEPS;
            var target_step = Math.min(current_step + target_jump, TOTAL_STEPS);
            var current_multiplier = getMultiplier(current_step);
            var target_multiplier = getMultiplier(target_step);
            var cost = free_bonus ? 0 : (target_multiplier - current_multiplier) / BONUS_RTP; // Cost to achieve 95% RTP
            total_cost += cost;

            // Store the original crash point before the jump
            var original_crash_point = crash_step;
            var redistributed_crash_point = "N/A"; // Default if no redistribution occurs

            var { newStep, crashed } = simulateBonusJump(current_step, bonus_type);

            // Calculate RTP for this bonus round
            var payout = crashed ? 0 : getMultiplier(newStep);
            var bonus_rtp = cost > 0 ? (payout / cost) * 100 : (payout > 0 ? Infinity : 0);

            // Check if the bonus jump skipped the crash point and redistributed it
            if (!crashed && crash_step > current_step && crash_step <= newStep) {
                crash_step = generateNewCrashStep(newStep);
                redistributed_crash_point = crash_step;
            }

            // Log the bonus round data
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

            // Check if the bonus jump skipped the cashout point
            if (cashout_step > current_step && cashout_step <= newStep) {
                // If crash point is further, player cashes out and wins
                if (crash_step > cashout_step) {
                    total_winnings = BASE_STAKE * getMultiplier(cashout_step);
                    return { total_winnings, total_cost, final_step: cashout_step, outcome: "Cashed out", used_bonus, crash_point: crash_step, cashout_point: cashout_step, bonus_rounds };
                }
            }

            current_step = newStep;
            used_bonus = bonus_type;
        }

        // Move to the next step based on speed mode
        var next_step = Math.min(current_step + speed, TOTAL_STEPS);

        // Check if the cashout point is reached
        if (cashout_step > current_step && cashout_step <= next_step) {
            // If crash point is further, player cashes out and wins
            if (crash_step > cashout_step) {
                total_winnings = BASE_STAKE * getMultiplier(cashout_step);
                return { total_winnings, total_cost, final_step: cashout_step, outcome: "Cashed out", used_bonus, crash_point: crash_step, cashout_point: cashout_step, bonus_rounds };
            }
        }

        // Check if the crash occurs during the move
        if (crash_step <= next_step) {
            return { total_winnings, total_cost, final_step: current_step, outcome: "Crashed during move", used_bonus, crash_point: crash_step, cashout_point: cashout_step, bonus_rounds };
        }

        current_step = next_step;
    }

    // If reached the top without crashing or cashing out
    // Check if cashout point is 100 or crash point is 101
    if (crash_step > cashout_step || crash_step === TOTAL_STEPS + 1) {
        total_winnings = BASE_STAKE * getMultiplier(TOTAL_STEPS);
        return { total_winnings, total_cost, final_step: TOTAL_STEPS, outcome: "Reached the top", used_bonus, crash_point: crash_step, cashout_point: cashout_step, bonus_rounds };
    } else {
        return { total_winnings, total_cost, final_step: current_step, outcome: "Crashed during move", used_bonus, crash_point: crash_step, cashout_point: cashout_step, bonus_rounds };
    }
}

function simulateGame(num_rounds, simulation_mode) {
    // Print crash probabilities before simulation
    console.log("\nCrash Probabilities by Step:");
    console.log("Step | Probability (%)");
    console.log("-".repeat(20));
    for (let step = 0; step < TOTAL_STEPS; step++) {
        console.log(`${(step + 1).toString().padStart(4)} | ${((crash_probabilities[step] * 100).toFixed(7))}%`);
    }
    console.log(`Crash at Step 101: ${(prob_crash_101 * 100).toFixed(7)}%`);
    console.log("-".repeat(20));
    console.log(`Sum of Probabilities: ${((crash_probabilities.reduce((sum, prob) => sum + prob, 0) + prob_crash_101) * 100).toFixed(2)}%`);

    // Print bonus costs table
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

    // Initialize CSV file for bonus rounds (overwrite existing file)
    var csvContent = "Game Number,Current Step,Result Step,Cost,RTP,Game Crush Point,Redistributed Crush Point\n";
    fs.writeFileSync(BONUS_ROUNDS_CSV_FILE, csvContent, 'utf8');

    console.log(`\nSimulating ${num_rounds} rounds in ${simulation_mode} mode...`);

    let total_winnings = 0;
    let total_cost = 0;
    let total_steps = 0;
    let crashes = 0;
    let cash_outs = 0;
    let reached_top = 0;

    // Track per-step metrics
    var crash_counts = Array(TOTAL_STEPS + 2).fill(0); // Steps 0 to 101
    var cashout_counts = Array(TOTAL_STEPS + 1).fill(0); // Steps 0 to 100
    var crash_point_counts = Array(TOTAL_STEPS + 2).fill(0); // Steps 0 to 101
    var cashout_point_counts = Array(TOTAL_STEPS + 1).fill(0); // Steps 0 to 100

    // Track speed mode usage
    var speed_mode_counts = { "Normal": 0, "Fast": 0, "Swift": 0 };

    // Track winnings and costs for the selected mode
    let mode_winnings = 0;
    let mode_cost = 0;

    for (let round_num = 1; round_num <= num_rounds; round_num++) {
        // Randomly select speed mode for each round
        var speed_mode = Object.keys(SPEED_MODES)[Math.floor(Math.random() * 3)];
        speed_mode_counts[speed_mode]++;

        var { total_winnings: winnings, total_cost: cost, final_step, outcome, used_bonus, crash_point, cashout_point, bonus_rounds } = simulateRound(speed_mode, simulation_mode, round_num);
        total_winnings += winnings;
        total_cost += cost;
        total_steps += final_step;

        // Update RTP metrics for the selected mode
        mode_winnings += winnings;
        mode_cost += cost;

        // Record crash point and cashout point
        crash_point_counts[crash_point]++;
        cashout_point_counts[cashout_point]++;

        // Record crash or cashout step
        if (outcome.includes("Crashed")) {
            crashes++;
            crash_counts[final_step]++;
        } else if (outcome === "Cashed out") {
            cash_outs++;
            cashout_counts[final_step]++;
        } else if (outcome === "Reached the top") {
            reached_top++;
            // Reached top counts as a cashout at step 100
            cashout_counts[TOTAL_STEPS]++;
        }

        // Append bonus round data to CSV
        for (var bonus of bonus_rounds) {
            var csvLine = `${bonus.game_number},${bonus.current_step},${bonus.result_step},${bonus.cost.toFixed(2)},${bonus.rtp.toFixed(2)},${bonus.game_crush_point},${bonus.redistributed_crush_point}\n`;
            fs.appendFileSync(BONUS_ROUNDS_CSV_FILE, csvLine, 'utf8');
        }

        if (round_num % 100000 === 0 || round_num === num_rounds) { // Print progress for large simulations
            console.log(`Round ${round_num}: Step ${final_step}, Multiplier ${getMultiplier(final_step).toFixed(2)}x, Outcome: ${outcome}, Winnings: $${winnings.toFixed(2)}, Cost: $${cost.toFixed(2)}`);
        }
    }

    // Calculate RTP for the selected mode
    var mode_rtp = mode_cost > 0 ? (mode_winnings / mode_cost * 100) : 0;

    // Calculate per-step percentages
    var crash_percents = crash_counts.map(count => count / num_rounds * 100);
    var cashout_percents = cashout_counts.map(count => count / num_rounds * 100);
    var crash_point_percents = crash_point_counts.map(count => count / num_rounds * 100);
    var cashout_point_percents = cashout_point_counts.map(count => count / num_rounds * 100);

    // Calculate speed mode percentages
    var speed_mode_percents = Object.fromEntries(
        Object.entries(speed_mode_counts).map(([mode, count]) => [mode, count / num_rounds * 100])
    );

    // Statistics
    console.log("\nSimulation Statistics:");
    console.log(`Total Rounds: ${num_rounds}`);
    console.log(`Total Winnings: $${total_winnings.toFixed(2)}`);
    console.log(`Total Cost: $${total_cost.toFixed(2)}`);
    console.log(`Net Profit: $${(total_winnings - total_cost).toFixed(2)}`);
    console.log(`Average Step Reached: ${total_steps / num_rounds}`);
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

    // Speed Mode Distribution
    console.log("\nSpeed Mode Distribution:");
    console.log("Mode  | % Rounds");
    console.log("-".repeat(20));
    for (var [mode, percent] of Object.entries(speed_mode_percents)) {
        console.log(`${mode.padEnd(6)}| ${percent.toFixed(7)}%`);
    }

    // Per-step statistics
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
        ` 101 | ${crash_percents[TOTAL_STEPS + 1].toFixed(7)}% | ` +
        `${'N/A'.padEnd(11)} | ` +
        `${crash_point_percents[TOTAL_STEPS + 1].toFixed(7)}% | ` +
        `${'N/A'.padEnd(11)}`
    );
}

// Main function to run the simulation
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

            simulateGame(num_rounds, simulation_mode);
            readline.close();
        });
    });
}

main();