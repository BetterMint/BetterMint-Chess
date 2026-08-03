# Frequently Asked Questions

- [Interpretation of the Stockfish evaluation](#interpretation-of-the-stockfish-evaluation)
- [Optimal settings](#optimal-settings)
- [The Elo rating of Stockfish](#the-elo-rating-of-stockfish)
- [Move annotations](#move-annotations)
- [Why is Stockfish regressing?](#why-is-stockfish-regressing)
- [Stockfish crashed](#stockfish-crashed)
- [Does Stockfish support chess variants?](#does-stockfish-support-chess-variants)
- [Can Stockfish use my GPU?](#can-stockfish-use-my-gpu)
- [Executing Stockfish opens a CMD window](#executing-stockfish-opens-a-cmd-window)
- [What is depth?](#what-is-depth)
- [How do Skill Level and UCI\_Elo work](#how-do-skill-level-and-uci_elo-work)
- [Stockfish is slower than expected](#stockfish-is-slower-than-expected)

## Interpretation of the Stockfish evaluation

### Centipawns

The evaluation of a position that results from search has traditionally been measured in `pawns` or `centipawns` (1 pawn = 100 centipawns). A value of 1, implied a 1 pawn advantage. However, with engines being so strong, and the NNUE evaluation being much less tied to material value, a new scheme was needed. The new normalized evaluation is now linked to the probability of winning, with a 1.0 pawn advantage being a 0.5 (that is 50%) win probability. An evaluation of 0.0 means equal chances for a win or a loss, but also nearly 100% chance of a draw.

Some GUIs will be able to show the win/draw/loss probabilities directly when the `UCI_ShowWDL` engine option is set to `True`.

The full plots of win, loss, and draw probability are given below. From these probabilities, one can also obtain the expected match score.

| Probabilities | Expected match score |
|---|---|
| <img src="https://user-images.githubusercontent.com/4202567/206894542-a5039063-09ff-4f4d-9bad-6e850588cac9.png" width="400"> | <img src="https://user-images.githubusercontent.com/4202567/206895934-f861a6a8-2e60-4592-a8f1-89d9aad8dac4.png" width="400"> |

The probability of winning or drawing a game, of course, depends on the opponent and the time control. With bullet games, the draw rate will be lower, and against a weak opponent, even a negative evaluation could result in a win. These graphs have been generated from a model derived from Fishtest data for Stockfish playing against Stockfish (so an equally strong opponent), at 60+0.6s per game. The curves are expected to evolve, i.e. as the engines get stronger, an evaluation of 0.0 will approach the 100% draw limit. These curves are for SF15.1 (Dec 2022).

### Tablebase scores

Since Stockfish 16 ([def2966](https://github.com/official-stockfish/Stockfish/commit/def2966)) a value of 200.00 pawns is reported when entering a tablebase won position.  
Values close to 200.00 refer to the distance in plies from the root to the probed position, where 1 cp is 1 ply distance. This means that a score of, for example, 199.50 means that the engine found a forced way to get from the current position to a tablebase winning position in 25 moves (50 ply).

## Optimal settings

To get the best possible evaluation or the strongest move for a given position, the key is to let Stockfish analyze long enough, using a recent release (or development version), properly selected for the CPU architecture.

The following settings are important as well:

### Threads

**Set it to the maximum minus 1 or 2 threads.**

Set the number of threads to the maximum available, possibly leaving 1 or 2 threads free for other tasks.  
SMT or Hyper-threading is beneficial, so normally the number of threads available is twice the number of cores available.  
Consumer hardware typically has at least 4-8 threads, Stockfish supports hundreds of threads.

> [!NOTE]
> [More detailed results](Useful-data#threading-efficiency-and-elo-gain) on the efficiency of threading are available.

### Hash

> [!TIP]
> The Hash can be any value, not just powers of two. The value is specified in MiB.

#### Gameplay

Some general guidelines (for games played using 1 thread) are:

- Ultra-bullet games (10s+0.1s) a value of 16 (default).
- Bullet games (60s+0.6s, aprox. 1+0 or 1+1) a value of 64.
- Blitz games (180s+1.8s, aprox. 3+2) a value of 192.

Longer time controls or games played with more threads will require more hash.  
60s+0.6s with 8 threads would require a hash of 64 * 8 = 512.

> [!NOTE]
> The data suggests that keeping the average hashfull below 30% is best to maintain strength.  
> [More detailed results](Useful-data#elo-cost-of-small-hash) on the cost of too little hash are available.

#### Analysis

Depending on how long you want to leave Stockfish analyzing a position for the amount of hash needed will vary.  
For shallow analysis (e.g. depth 24 or 1 million nodes), a hash of 64 or 128 should be enough.  
For deep analysis set it to as much as you can afford given the **available** memory in your system, leaving some memory for the operating system and other applications.

### MultiPV

**Set it to 1.**

A value higher than 1 weakens the quality of the best move computed, as resources are used to compute other moves.

> [!NOTE]
> [More detailed results](Useful-data#elo-cost-of-using-multipv) on the cost of MultiPV are available.

## The Elo rating of Stockfish

Calculating the Elo rating of Stockfish requires significant context. The Elo system is fundamentally relative, meaning that an accurate rating relies heavily on match conditions, such as time control, opening book, variant, and pool of opponents, as well as on the necessity of accurately knowing the rating of at least one player to determine the ratings of others.

Rating Stockfish against a human scale, such as FIDE Elo, has become virtually impossible. The gap in strength is so large that a human player cannot secure the necessary draws or wins for an accurate Elo measurement. The task is further complicated because achieving reliable results mandates very large data sets, typically tens of thousands of games, which no human can realistically complete.

Even when measured against other chess engines, accurate Elo calculation faces extreme technical caveats. Top engines playing at long time controls and from the standard starting position often achieve a near-100% draw rate, which obscures the true strength disparity and results in very small Elo differences. To counteract this, matches must use carefully constructed unbalanced opening books that introduce specific advantages to one side, making the book choice a critical factor.

## Move annotations

Stockfish does not provide move annotations such as blunders or brilliants, it only provides evaluations and what it considers the best move in the position. Websites and GUIs often add move annotations separately, using Stockfish's output as a basis for them.

## Why is Stockfish regressing?

Sometimes Elo gain in [regression tests](Regression-Tests) appears to decrease over time, but that does not necessarily mean Stockfish has regressed. Regression tests report an estimated Elo plus an error bound (shown next to the Elo); the true Elo is likely somewhere within that range. If successive tests' error bounds overlap, the difference in reported Elo is not statistically significant and a real regression is unlikely.

If a reported decrease lies outside those error bounds, meaning the ranges do not overlap and the drop is statistically significant, maintainers will investigate to identify possible causes such recent code changes. If a real regression is confirmed, they may revert the change or apply a fix and rerun the tests.

## Stockfish crashed

Stockfish may crash if fed incorrect FENs, or FENs with illegal positions. Full validation code is complex to write, and within the UCI protocol, there is no established mechanism to communicate such an error back to the GUI. Therefore, Stockfish is written with the expectation that the input FEN is correct.

On the other hand, the GUI must carefully check fens. If you find a GUI through which you can crash Stockfish, or any other engine, then by all means, report it to that GUI's developers.

## Does Stockfish support chess variants?

The official Stockfish engine only supports standard chess and Chess960 or Fischer Random Chess (FRC) as well as Double Fischer Random Chess (DFRC). However, various forks based on Stockfish support more variants, most notably the [Fairy-Stockfish project](https://github.com/ianfab/Fairy-Stockfish).

## Can Stockfish use my GPU?

No, Stockfish is a chess engine that uses the CPU only for chess evaluation. Its NNUE evaluation ([see this in-depth description](https://github.com/official-stockfish/nnue-pytorch/blob/master/docs/nnue.md)) is very effective on CPUs. With extremely short inference times (sub-micro-second), this network can not be efficiently evaluated on GPUs, in particular with the alpha-beta search that Stockfish employs. However, for training networks, Stockfish employs GPUs with effective code that is part of the [NNUE pytorch trainer](https://github.com/official-stockfish/nnue-pytorch). Other chess engines require GPUs for effective evaluation, as they are based on large convolutional or transformer networks, and use a search algorithm that allows for batching evaluations. See also the [Leela Chess Zero (Lc0) project](https://github.com/LeelaChessZero/lc0).

## Executing Stockfish opens a CMD window

![image](https://github.com/user-attachments/assets/08ad3bae-2fa5-4b77-a65e-ec272727a7d5)

Stockfish is a command line program, so **this behavior is intentional** and serves as the interface for interacting with the engine.

### User-friendly experience

If you prefer a **more user-friendly experience** with a **chessboard and additional features**, you can consider using a graphical user interface (GUI) alongside Stockfish. To set up a GUI, you can visit the [Download and Usage](Download-and-usage#download-a-chess-gui) page.

### Available commands

The CMD window allows you to input various commands and receive corresponding outputs from Stockfish. If you want to explore the available commands and their explanations, you can refer to the [Commands](UCI-&-Commands) page but this is **only recommended for advanced users and developers**.

## What is depth?

In technical terms, 'depth' is the counter of the [iterative deepening](Terminology#iterative-deepening) loop at the root of the game tree. In practical terms, 'depth' is how far a chess engine searches in half-moves, or 'plies'. In a pure minimax search (a search method where the engine assumes the opponent always makes the best move), you fully explore every line up to that depth, so a mate-in-5 requires depth 10. However, real chess engines don't do pure minimax searches; they prune, reduce, and extend branches to manage the huge branching factor (the number of possible moves from a given position).

Pruning cuts away branches that look unpromising so they aren't searched at all. Reductions shrink the search depth of low-priority branches (still searched, but more shallow). Extensions do the opposite: they search important branches (checks, captures, tactical lines) deeper than the current iteration. Because of these techniques, an engine's tree is not uniformly cut off at a single depth; most lines end earlier, some go deeper.

In practice, a reported 'depth' is a useful guide but not a strict guarantee that you've examined every move to that ply. Aggressive pruning (as in Stockfish) can drastically reduce the effective branching factor, allowing deeper searches in less time, significantly improving strength but at the cost of potentially missing moves that would have been found in a full minimax search to that depth.

## How do Skill Level and UCI_Elo work

`Skill Level` and `UCI_Elo` make Stockfish play weaker by intentionally choosing suboptimal moves.

`UCI_Elo` only applies when `UCI_LimitStrength` is enabled (`true`).  
`UCI_Elo` takes precedence over `Skill Level` if both are set.  
If `UCI_Elo` is set, the engine converts the given value internally into a `Skill Level`.  

### How does Stockfish choose a weak move?

Stockfish first identifies at least 4 candidate moves, which can be increased using the `MultiPV` UCI option. To play weakly, it uses a statistical rule that applies a randomized bias to the scores of the slightly worse moves among these candidates. The lower the set `Skill Level`, the bigger this random boost is, making it highly probable that the engine bypasses the truly best move and selects a suboptimal choice instead.

### When is the weak move selected?

The engine picks the suboptimal move during search at `depth = 1 + int(Skill Level)` (so level 0 => depth 1, level 10 => depth 11, etc.).

![Stockfish_Skill_Level_UCI_Elo](https://github.com/user-attachments/assets/601bb786-dc57-46aa-b9ca-7da7e0f282a6)

## Stockfish is slower than expected

### NNUE vs. Hand-Crafted Evaluation

Modern Stockfish builds use NNUE (neural-network-based evaluation). **NNUE gives stronger play but is significantly slower** than the old hand-crafted evaluation used in releases like Stockfish 11. Practically speaking, NNUE can run at under half the speed of earlier non‑NNUE Stockfish on the same hardware. Newer releases also ship larger NNUE networks than earlier NNUE builds like Stockfish 12, so expect lower nodes-per-second compared to them.

### Choose the correct binary for your CPU

Pick a Stockfish binary optimized for your processor architecture and instruction set. Using an unoptimized or mismatched binary (for example a generic 64-bit build when you have a CPU that supports AVX2 or other optimizations) can make the engine much slower.

### Operating system core scheduling (temporary fix)

Modern PCs (especially with Intel 12th Gen+ CPUs) have a mix of fast "Performance-cores" and slower "Efficiency-cores". Sometimes, your operating system can mistakenly run Stockfish on the slower E-cores, which significantly reduces the engine speed.

You can often resolve this with a **temporary** fix by manually telling the Operating System to prioritize Stockfish.  
You may need to do this each time you start a new Stockfish session, as the setting is not permanent.

On Windows:
1.  Start Stockfish (e.g., run the executable or begin analysis in your chess GUI).
2.  Open **Task Manager** (press `Ctrl` + `Shift` + `Esc`).
3.  Click on the **"Details"** tab.
4.  Find Stockfish in the list, right-click on it.
5.  Go to **Set priority** and choose **"Above Normal"**.

> [!NOTE]
> If you prefer to limit Stockfish to run on specific cores instead of having a higher general priority, in the same right-click menu, choose "Set affinity" and enable only the faster performance cores. This is also temporary and must be repeated each session.