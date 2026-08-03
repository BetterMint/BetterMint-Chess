# UCI & Commands

The [Universal Chess Interface](https://backscattering.de/chess/uci/) (UCI) is a standard text-based protocol used to communicate with a chess engine and is the recommended way to do so for typical graphical user interfaces (GUI) or chess tools. Stockfish implements the majority of its options.

Developers can see the default values for the UCI options available in Stockfish by typing `./stockfish uci` in a terminal, but most users should typically use a chess GUI to interact with Stockfish.

- [Standard commands](#standard-commands)
  - [`quit`](#quit)
  - [`uci`](#uci)
  - [`setoption`](#setoption)
  - [`position`](#position)
  - [`ucinewgame`](#ucinewgame)
  - [`isready`](#isready)
  - [`go`](#go)
  - [`stop`](#stop)
  - [`ponderhit`](#ponderhit)
- [Non-standard commands](#non-standard-commands)
  - [`bench`](#bench)
  - [`speedtest`](#speedtest)
  - [`d`](#d)
  - [`eval`](#eval)
  - [`compiler`](#compiler)
  - [`export_net [filenameBigNet] [filenameSmallNet]`](#export_net-filenamebignet-filenamesmallnet)
  - [`flip`](#flip)
  - [`help`](#help)
  - [`license`](#license)

## Standard commands

### `quit`

Quit the program as soon as possible.

### `uci`

Tell the engine to use the UCI (universal chess interface).  
This will be sent once, by a GUI, as a first command after the program boots to tell the engine to switch to UCI mode.  
After receiving the `uci` command the engine will identify itself with the `id` command and send the `option` commands to tell the GUI which engine settings the engine supports.  
After that, the engine will send `uciok` to acknowledge the UCI mode.  
If no `uciok` is sent within a certain time period, the engine task will be killed by the GUI.

<details>
  <summary>Example</summary>
  <i>Note that a different Stockfish version than the one used below may have a different output, with different values and other available options. Please run this command yourself to know what values are available in your specific version.</i>

  ```
  > uci
  id name Stockfish 16.1
  id author the Stockfish developers (see AUTHORS file)

  option name Debug Log File type string default
  option name Threads type spin default 1 min 1 max 1024
  option name Hash type spin default 16 min 1 max 33554432
  option name Clear Hash type button
  option name Ponder type check default false
  option name MultiPV type spin default 1 min 1 max 256
  option name Skill Level type spin default 20 min 0 max 20
  option name Move Overhead type spin default 10 min 0 max 5000
  option name nodestime type spin default 0 min 0 max 10000
  option name UCI_Chess960 type check default false
  option name UCI_LimitStrength type check default false
  option name UCI_Elo type spin default 1320 min 1320 max 3190
  option name UCI_ShowWDL type check default false
  option name SyzygyPath type string default <empty>
  option name SyzygyProbeDepth type spin default 1 min 1 max 100
  option name Syzygy50MoveRule type check default true
  option name SyzygyProbeLimit type spin default 7 min 0 max 7
  option name EvalFile type string default nn-b1a57edbea57.nnue
  option name EvalFileSmall type string default nn-baff1ede1f90.nnue
  uciok
  ```
</details>

### `setoption`

Usage: `setoption name <id> [value <x>]`  

This is sent to the engine when the user wants to change the internal parameters of the engine. For the `button` type no value is needed.  
One string will be sent for each parameter and this will only be sent when the engine is waiting.  

Examples:
```
> setoption name Threads value 6
> setoption name SyzygyPath value C:\Chess\tb\tb345;C:\Chess\tb\wdl6;C:\Chess\tb\wdl7
> setoption name UCI_ShowWDL value true
> setoption name Clear Hash
```

List of options:

  * #### `Threads`

    `type spin default 1 min 1 max 1024`

    The number of CPU threads used for searching a position. For best performance, set this equal to the number of CPU cores available.

  * #### `Hash`

    `type spin default 16 min 1 max 33554432`

    The size of the hash table in MB. It is recommended to set Hash after setting Threads.

  * #### `MultiPV`

    `type spin default 1 min 1 max 500`

    Output the N best lines (principal variations, PVs) when searching.
    Leave at 1 for the best performance.

  * #### `NumaPolicy`

    `type string default auto`

    Binds threads to a specific NUMA node to enhance performance on multi-CPU or multi-NUMA domain systems. Options:
       * `none` - assumes a single NUMA node, no thread binding
       * `system` - uses NUMA information available from the system and binds the threads accordingly
       * `auto` - default; automatically selects `system` or `none` based on the system   
       * `hardware` - uses NUMA information from the underlying hardware and binds the threads accordingly, overrides any previous affinities.  
       _Should be used if Stockfish doesn't utilize all threads, e.g. Windows 10 or certain GUI's like ChessBase._
       * `[[custom]]` - precisely specify the available CPUs per numa domain. ':' separates numa nodes; ',' separates cpu indices; supports "first-last" range syntax for cpu indices, for example `0-15,32-47:16-31,48-63`

  * #### `Clear Hash`

    `type button`

    Clear the hash table.

  * #### `Ponder`

    `type check default false`

    Let Stockfish ponder its next move while the opponent is thinking.

  * #### `EvalFile`

    `type string default nn-[SHA256 first 12 digits].nnue`

    The name of the file of the NNUE evaluation parameters. Depending on the GUI the filename might have to include the full path to the folder/directory that contains the file. Other locations, such as the directory that contains the binary and the working directory, are also searched.

  * #### `EvalFileSmall`

    `type string default nn-[SHA256 first 12 digits].nnue`

    Same as EvalFile.

  * #### `UCI_Chess960`

    `type check default false`

    An option handled by your GUI. If true, Stockfish will play Chess960.

  * #### `UCI_ShowWDL`

    `type check default false`

    If enabled, show approximate WDL statistics as part of the engine output.
    These WDL numbers model expected game outcomes for a given evaluation and game ply for engine self-play at fishtest LTC conditions (60+0.6s per game).

  * #### `UCI_LimitStrength`

    `type check default false`

    Enable weaker play aiming for an Elo rating as set by `UCI_Elo`. This option overrides `Skill Level`.

  * #### `UCI_Elo`

    `type spin default 1320 min 1320 max 3190`

    If `UCI_LimitStrength` is enabled, it aims for an engine strength of the given Elo.  
    This Elo rating has been calibrated at a time control of 120s+1s and anchored to CCRL 40/4.  
    It takes precedence over `Skill Level` if both are set.  
    See also: [How do Skill Level and UCI_Elo work](Stockfish-FAQ#how-do-skill-level-and-uci_elo-work)

  * #### `Skill Level`

    `type spin default 20 min 0 max 20`

    Lower the `Skill Level` in order to make Stockfish play weaker (see also `UCI_LimitStrength`).  
    Internally, MultiPV is enabled, and with a certain probability depending on the `Skill Level`, a weaker move will be played.  
    See also: [How do Skill Level and UCI_Elo work](Stockfish-FAQ#how-do-skill-level-and-uci_elo-work)

  * #### `SyzygyPath`

    `type string default <empty>`

    Path to the folders/directories storing the Syzygy tablebase files. Multiple directories are to be separated by `;` on Windows and by `:` on Unix-based operating systems. Do not use spaces around the `;` or `:`.

    Example: `C:\tablebases\wdl345;C:\tablebases\wdl6;D:\tablebases\dtz345;D:\tablebases\dtz6`

    It is recommended to store .rtbw files on an SSD. There is no loss in storing the .rtbz files on a regular HDD. It is recommended to verify all md5 checksums of the downloaded tablebase files (`md5sum -c checksum.md5`) as corruption will lead to engine crashes.

  * #### `SyzygyProbeDepth`

    `type spin default 1 min 1 max 100`

    Minimum remaining search depth for which a position is probed. Set this option to a higher value to probe less aggressively if you experience too much slowdown (in terms of nps) due to tablebase probing.

  * #### `Syzygy50MoveRule`

    `type check default true`

    Disable to let fifty-move rule draws detected by Syzygy tablebase probes count as wins or losses. This is useful for ICCF correspondence games.

  * #### `SyzygyProbeLimit`

    `type spin default 7 min 0 max 7`

    Limit Syzygy tablebase probing to positions with at most this many pieces left (including kings and pawns).

  * #### `Move Overhead`

    `type spin default 10 min 0 max 5000`

    Assume a time delay of x ms due to network and GUI overheads. Specifying a value larger than the default is needed to avoid time losses or near instantaneous moves, in particular for time controls without increment (e.g. sudden death). The default is suitable for engine-engine matches played locally on dedicated hardware, while it needs to be increased on a loaded system, when playing over a network, or when using certain GUIs such as Arena or ChessGUI.

  * #### `nodestime`

    `type spin default 0 min 0 max 10000`

    Tells the engine to use nodes searched instead of wall time to account for elapsed time. Useful for engine testing. When this option is set, the engine is only limited by the total amount of nodes searched per game; this limit is calculated once per game. The initial time control values in milliseconds (time `time` and increment per move `inc`) are used as input values to calculate the total number of nodes per game (`totalnodes`). The increment per move `inc` is used as if it was just one move per game. The formula is `totalnodes = (time + inc * 1) * nodestime`. Suppose you specified `nodestime = 600`, and the time control per game is 300 seconds plus 3 seconds increment per move ("300+3s"), or 300000 milliseconds plus 3000 milliseconds increment per move. In that case, the maximum total number of nodes searched per game by the engine is `totalnodes = (300000 + 3000 * 1) * 600 = 181800000` (one hundred eighty-one million, eight hundred thousand) nodes, regardless of how much wall time it will actually take.


  * #### `Debug Log File`

    `type string default`

    Write all communication to and from the engine into a text file.

### `position`

Usage: `position [fen <fenstring> | startpos ]  moves <move1> .... <movei>`

Set up the position described in `fenstring`.  
If the game was played from the start position the string `startpos` must be sent.  

> [!NOTE]
> - If this position is from a different game than the last position sent to the engine, the GUI should have sent a `ucinewgame` in between.
> - Using `moves` is the recommended way to set up game positions because the move history allows the engine to correctly handle threefold repetition detection.

Examples:
```
> position startpos
> position startpos moves e2e4 e7e5 g1f3 b8c6 f1b5
> position fen 8/1B6/8/5p2/8/8/5Qrq/1K1R2bk w - - 0 1
> position fen 8/3P3k/n2K3p/2p3n1/1b4N1/2p1p1P1/8/3B4 w - - 0 1 moves g4f6 h7g7 f6h5 g7g6 d1c2
```

### `ucinewgame`

This is sent to the engine when the next search (started with `position` and `go`) will be from a different game. This can be a new game the engine should play or a new game it should analyze but also the next position from a test suite with positions only.  
If the GUI hasn't sent a `ucinewgame` before the first `position` command, the engine won't expect any further `ucinewgame` commands as the GUI is probably not supporting the `ucinewgame` command.  
So the engine will not rely on this command even though all new GUIs should support it.  
As the engine's reaction to `ucinewgame` can take some time the GUI should always send `isready` after `ucinewgame` to wait for the engine to finish its operation. The engine will respond with `readyok`.

> [!NOTE]
> This clears the hash and any information which was collected during the previous search.

<details>
  <summary>Example</summary>

  ```
  > ucinewgame
  > isready
  readyok
  > position startpos
  > go depth 1
  info string NNUE evaluation using nn-ad9b42354671.nnue enabled
  info depth 1 seldepth 1 multipv 1 score cp 18 nodes 20 nps 10000 hashfull 0 tbhits 0 time 2 pv e2e4
  bestmove e2e4
  > ucinewgame
  > isready
  readyok
  > position fen r2q1rk1/p2bbppp/Q7/2p1P2P/8/2p1B3/PPP2P1P/2KR3R w - - 0 17
  ```
</details>

### `isready`

This is used to synchronize the engine with the GUI.  
When the GUI has sent a command or multiple commands that can take some time to complete, this command can be used to wait for the engine to be ready again or to ping the engine to find out if it is still alive.  
e.g. this should be sent after setting the path to the tablebases as this can take some time.  
This command is also required once, before the engine is asked to do any searching, to wait for the engine to finish initializing.  
This command will always be answered with `readyok` and can be sent also when the engine is calculating in which case the engine will also immediately answer with `readyok` without stopping the search.

Example:
```
> isready
readyok
```

### `go`

Start calculating on the current position set up with the `position` command.  
There are a number of parameters that can follow this command and all will be sent in the same string.  
Usually at least one parameter is sent to limit the search but it is not required.

> [!NOTE]
> - If no parameter is sent, then `go depth 245` will be executed.
> - Mixing and matching different ways of limiting the search time (depth, nodes, movetime, wtime + winc + btime + binc) will result in the search ending when it hits any one of those limits. For example, you can limit the search to a maximum depth and time with `go depth x movetime y`.

<details>
  <summary>Example: go infinite</summary>

  ```
  > position startpos
  > go infinite
  info depth 1 seldepth 1 multipv 1 score cp 18 nodes 20 nps 4000 hashfull 0 tbhits 0 time 5 pv e2e4
  info depth 2 seldepth 2 multipv 1 score cp 46 nodes 66 nps 11000 hashfull 0 tbhits 0 time 6 pv d2d4
  info depth 3 seldepth 2 multipv 1 score cp 51 nodes 120 nps 20000 hashfull 0 tbhits 0 time 6 pv e2e4
  info depth 4 seldepth 2 multipv 1 score cp 58 nodes 144 nps 18000 hashfull 0 tbhits 0 time 8 pv d2d4
  info depth 5 seldepth 2 multipv 1 score cp 58 nodes 174 nps 15818 hashfull 0 tbhits 0 time 11 pv d2d4 a7a6
  info depth 6 seldepth 7 multipv 1 score cp 34 nodes 1303 nps 81437 hashfull 0 tbhits 0 time 16 pv e2e4 c7c5 g1f3 b8c6 c2c3
  info depth 7 seldepth 6 multipv 1 score cp 29 nodes 3126 nps 120230 hashfull 1 tbhits 0 time 26 pv d2d4 g8f6 e2e3 d7d5 c2c4 d5c4
  info depth 8 seldepth 7 multipv 1 score cp 26 nodes 5791 nps 152394 hashfull 4 tbhits 0 time 38 pv g1f3 g8f6 d2d4 d7d5 e2e3
  info depth 9 seldepth 9 multipv 1 score cp 31 nodes 8541 nps 174306 hashfull 5 tbhits 0 time 49 pv g1f3 c7c5 e2e4 e7e6 d2d4 c5d4 f3d4
  info depth 10 seldepth 13 multipv 1 score cp 25 nodes 20978 nps 209780 hashfull 10 tbhits 0 time 100 pv e2e4 c7c5 g1f3 b8c6 f1c4 e7e6 e1g1 g8f6
  info depth 11 seldepth 13 multipv 1 score cp 32 nodes 29040 nps 220000 hashfull 14 tbhits 0 time 132 pv e2e4 c7c5 c2c3 g8f6 e4e5 f6d5 d2d4
  info depth 12 seldepth 14 multipv 1 score cp 38 nodes 41207 nps 242394 hashfull 18 tbhits 0 time 170 pv e2e4 e7e6 d2d4 d7d5 b1c3 d5e4 c3e4
  > stop
  info depth 13 seldepth 14 multipv 1 score cp 38 nodes 45531 nps 247451 hashfull 21 tbhits 0 time 184 pv e2e4 e7e6 d2d4 d7d5 b1c3 d5e4 c3e4
  bestmove e2e4 ponder e7e6
  ```
</details>

<details>
  <summary>Example: go depth</summary>

  ```
  > position startpos
  > go depth 5
  info depth 1 seldepth 2 multipv 1 score cp 17 nodes 20 nps 20000 hashfull 0 tbhits 0 time 1 pv e2e4
  info depth 2 seldepth 3 multipv 1 score cp 34 nodes 45 nps 22500 hashfull 0 tbhits 0 time 2 pv e2e4
  info depth 3 seldepth 4 multipv 1 score cp 42 nodes 72 nps 36000 hashfull 0 tbhits 0 time 2 pv e2e4
  info depth 4 seldepth 7 multipv 1 score cp 39 nodes 512 nps 128000 hashfull 0 tbhits 0 time 4 pv g1f3 d7d5 d2d4
  info depth 5 seldepth 7 multipv 1 score cp 58 nodes 609 nps 152250 hashfull 0 tbhits 0 time 4 pv e2e4
  bestmove e2e4 ponder d7d6
  ```
</details>

<details>
  <summary>Example: go nodes</summary>
  
  ```
  > position startpos
  > go nodes 1000
  info depth 1 seldepth 2 multipv 1 score cp 17 nodes 20 nps 909 hashfull 0 tbhits 0 time 22 pv e2e4
  info depth 2 seldepth 3 multipv 1 score cp 34 nodes 45 nps 1956 hashfull 0 tbhits 0 time 23 pv e2e4
  info depth 3 seldepth 4 multipv 1 score cp 42 nodes 72 nps 3130 hashfull 0 tbhits 0 time 23 pv e2e4
  info depth 4 seldepth 7 multipv 1 score cp 39 nodes 512 nps 21333 hashfull 0 tbhits 0 time 24 pv g1f3 d7d5 d2d4
  info depth 5 seldepth 7 multipv 1 score cp 58 nodes 609 nps 25375 hashfull 0 tbhits 0 time 24 pv e2e4
  info depth 6 seldepth 8 multipv 1 score cp 57 nodes 752 nps 30080 hashfull 0 tbhits 0 time 25 pv e2e4 d7d5 e4d5 d8d5 g1f3
  info depth 7 seldepth 10 multipv 1 score cp 54 upperbound nodes 1003 nps 38576 hashfull 0 tbhits 0 time 26 pv e2e4 c7c6
  bestmove e2e4 ponder c7c6
  ```
</details>


<details>
  <summary>Example: go mate</summary>

  Mating
  ```
  > position startpos moves g2g4 e7e5 f2f3
  > go mate 1
  info depth 1 seldepth 1 multipv 1 score mate 1 nodes 31 nps 10333 hashfull 0 tbhits 0 time 3 pv d8h4
  bestmove d8h4
  ```
  Being mated (since Stockfish 17)
  ```
  > position fen rn1q1r2/p4pk1/1p3R1p/2ppP2Q/3P4/2P4P/P1P3P1/1R4K1 w - - 0 1 moves h5h6
  > go mate 2
  info depth 1 seldepth 3 multipv 1 score cp -536 nodes 2 nps 400 hashfull 0 tbhits 0 time 5 pv g7g8
  info depth 2 seldepth 3 multipv 1 score cp -536 nodes 4 nps 800 hashfull 0 tbhits 0 time 5 pv g7g8
  info depth 3 seldepth 3 multipv 1 score cp -536 nodes 6 nps 1200 hashfull 0 tbhits 0 time 5 pv g7g8
  info depth 4 seldepth 3 multipv 1 score cp -536 nodes 8 nps 1600 hashfull 0 tbhits 0 time 5 pv g7g8
  info depth 5 seldepth 5 multipv 1 score cp -551 nodes 14 nps 2333 hashfull 0 tbhits 0 time 6 pv g7g8 h6g5 g8h7
  info depth 6 seldepth 4 multipv 1 score cp -551 nodes 23 nps 3833 hashfull 0 tbhits 0 time 6 pv g7g8 h6g5 g8h7
  info depth 7 seldepth 5 multipv 1 score mate -2 nodes 36 nps 6000 hashfull 0 tbhits 0 time 6 pv g7g8 h6g5 g8h7 f6h6
  bestmove g7g8 ponder h6g5
  ```
</details>

<details>
  <summary>Example: MultiPV</summary>

  ```
  > setoption name MultiPV value 2
  > position startpos
  > go depth 5
  info depth 1 seldepth 1 multipv 1 score cp 18 nodes 39 nps 19500 hashfull 0 tbhits 0 time 2 pv e2e4
  info depth 1 seldepth 1 multipv 2 score cp 12 nodes 39 nps 19500 hashfull 0 tbhits 0 time 2 pv g1f3
  info depth 2 seldepth 2 multipv 1 score cp 43 nodes 113 nps 56500 hashfull 0 tbhits 0 time 2 pv g1f3
  info depth 2 seldepth 2 multipv 2 score cp 18 nodes 113 nps 56500 hashfull 0 tbhits 0 time 2 pv e2e4
  info depth 3 seldepth 3 multipv 1 score cp 75 nodes 169 nps 56333 hashfull 0 tbhits 0 time 3 pv d2d4 c7c6 b1d2
  info depth 3 seldepth 2 multipv 2 score cp 43 nodes 169 nps 56333 hashfull 0 tbhits 0 time 3 pv g1f3
  info depth 4 seldepth 4 multipv 1 score cp 75 nodes 326 nps 108666 hashfull 0 tbhits 0 time 3 pv d2d4 c7c6 b1d2
  info depth 4 seldepth 3 multipv 2 score cp 47 nodes 326 nps 108666 hashfull 0 tbhits 0 time 3 pv b1c3 e7e5 e2e4
  info depth 5 seldepth 4 multipv 1 score cp 30 nodes 933 nps 233250 hashfull 0 tbhits 0 time 4 pv e2e4 g8f6
  info depth 5 seldepth 5 multipv 2 score cp 12 nodes 933 nps 233250 hashfull 0 tbhits 0 time 4 pv b1c3 e7e5 e2e4 c7c6
  bestmove e2e4 ponder g8f6
  ```
</details>

<details>
  <summary>Example: UCI_ShowWDL</summary>

  ```
  > setoption name UCI_ShowWDL value true
  > position startpos
  > go depth 5
  info depth 1 seldepth 1 multipv 1 score cp 18 wdl 22 974 4 nodes 20 nps 10000 hashfull 0 tbhits 0 time 2 pv e2e4
  info depth 2 seldepth 2 multipv 1 score cp 46 wdl 82 917 1 nodes 66 nps 33000 hashfull 0 tbhits 0 time 2 pv d2d4
  info depth 3 seldepth 2 multipv 1 score cp 51 wdl 105 894 1 nodes 120 nps 60000 hashfull 0 tbhits 0 time 2 pv e2e4
  info depth 4 seldepth 2 multipv 1 score cp 58 wdl 140 859 1 nodes 144 nps 48000 hashfull 0 tbhits 0 time 3 pv d2d4
  info depth 5 seldepth 2 multipv 1 score cp 58 wdl 140 859 1 nodes 174 nps 58000 hashfull 0 tbhits 0 time 3 pv d2d4 a7a6
  bestmove d2d4 ponder a7a6
  ```
</details>

Parameters:

  * #### `searchmoves <move1> .... <movei>`

    Restrict search to these moves only.  
    Example: After `position startpos` and `go infinite searchmoves e2e4 d2d4` the engine will only search the two moves e2e4 and d2d4 in the initial position.

  * #### `ponder`

    Start searching in pondering mode. It won't exit the search in ponder mode, even if it's mate!  
    This means that the last move sent in in the position string is the ponder move.  
    The engine can do what it wants to do, but after a `ponderhit` command it will execute the suggested move to ponder on.  
    This means that the ponder move sent by the GUI can be interpreted as a recommendation about which move to ponder.  
    However, if the engine decides to ponder on a different move, it won't display any mainlines as they are likely to be misinterpreted by the GUI because the GUI expects the engine to ponder on the suggested move.

  * #### `wtime <x>`

    Tell the engine that White has x ms left on the clock.

  * #### `btime <x>`

    Tell the engine that Black has x ms left on the clock.

  * #### `winc <x>`

    Tell the engine that White's increment per move in ms if x > 0.

  * #### `binc <x>`

    Tell the engine that Black's increment per move in ms if x > 0.

  * #### `movestogo <x>`

    Tell the engine that there are x moves to the next time control  
    _Note: this will only be sent if x > 0, if you don't get this and get the wtime and btime it's sudden death._

  * #### `depth <x>`

    Stop the search when depth x has been reached.

  * #### `nodes <x>`

    Stop the search when approximately x number of nodes have been reached.

  * #### `mate <x>`

    Stop the search when/if a mate in x or less moves is found.  
    It will stop if the side to move is mating and since Stockfish 17 when getting mated too.

  * #### `movetime <x>`

    Stop the search when approximately x ms have passed.

  * #### `infinite`

    Search until the `stop` command is given. Stockfish won't exit the search without being told so in this mode!

  * #### `perft <x>`

    A debugging function to walk the move generation tree of strictly legal moves to count all the leaf nodes of a certain depth.  
    The [`bench`](#bench) command can be used to measure the speed of perft.

### `stop`

Stop calculating as soon as possible

<details>
  <summary>Example</summary>

  ```
  > position startpos
  > go infinite
  info string NNUE evaluation using nn-ad9b42354671.nnue enabled
  info depth 1 seldepth 1 multipv 1 score cp 18 nodes 20 nps 20000 hashfull 0 tbhits 0 time 1 pv e2e4
  info depth 2 seldepth 2 multipv 1 score cp 46 nodes 66 nps 33000 hashfull 0 tbhits 0 time 2 pv d2d4
  info depth 3 seldepth 2 multipv 1 score cp 51 nodes 120 nps 60000 hashfull 0 tbhits 0 time 2 pv e2e4
  info depth 4 seldepth 2 multipv 1 score cp 58 nodes 144 nps 72000 hashfull 0 tbhits 0 time 2 pv d2d4
  info depth 5 seldepth 2 multipv 1 score cp 58 nodes 174 nps 87000 hashfull 0 tbhits 0 time 2 pv d2d4 a7a6
  info depth 6 seldepth 7 multipv 1 score cp 34 nodes 1303 nps 217166 hashfull 0 tbhits 0 time 6 pv e2e4 c7c5 g1f3 b8c6 c2c3
  info depth 7 seldepth 6 multipv 1 score cp 29 nodes 3126 nps 260500 hashfull 1 tbhits 0 time 12 pv d2d4 g8f6 e2e3 d7d5 c2c4 d5c4
  info depth 8 seldepth 7 multipv 1 score cp 26 nodes 5791 nps 304789 hashfull 4 tbhits 0 time 19 pv g1f3 g8f6 d2d4 d7d5 e2e3
  info depth 9 seldepth 9 multipv 1 score cp 31 nodes 8541 nps 294517 hashfull 5 tbhits 0 time 29 pv g1f3 c7c5 e2e4 e7e6 d2d4 c5d4 f3d4
  info depth 10 seldepth 13 multipv 1 score cp 25 nodes 20978 nps 299685 hashfull 10 tbhits 0 time 70 pv e2e4 c7c5 g1f3 b8c6 f1c4 e7e6 e1g1 g8f6
  info depth 11 seldepth 13 multipv 1 score cp 32 nodes 29040 nps 296326 hashfull 14 tbhits 0 time 98 pv e2e4 c7c5 c2c3 g8f6 e4e5 f6d5 d2d4
  > stop
  info depth 12 seldepth 14 multipv 1 score cp 38 nodes 41207 nps 300781 hashfull 18 tbhits 0 time 137 pv e2e4 e7e6 d2d4 d7d5 b1c3 d5e4 c3e4
  info depth 13 seldepth 15 multipv 1 score cp 32 upperbound nodes 51476 nps 301029 hashfull 21 tbhits 0 time 171 pv e2e4 c7c5
  bestmove e2e4 ponder c7c5
  ```
</details>

### `ponderhit`

The user has played the expected move.  
This will be sent if the engine was told to ponder on the same move the user has played.  
The engine will continue searching but switch from pondering to normal search.

<details>
  <summary>Example</summary>

  ```
  > setoption name Ponder value true
  > position startpos moves e2e4
  > go movetime 1000
  info string NNUE evaluation using nn-52471d67216a.nnue enabled
  info depth 1 seldepth 1 multipv 1 score cp -13 nodes 22 nps 22000 hashfull 0 tbhits 0 time 1 pv e7e5
  info depth 2 seldepth 2 multipv 1 score cp -11 nodes 71 nps 71000 hashfull 0 tbhits 0 time 1 pv e7e6
  info depth 3 seldepth 2 multipv 1 score cp -11 nodes 189 nps 94500 hashfull 0 tbhits 0 time 2 pv e7e6
  info depth 4 seldepth 2 multipv 1 score cp -11 nodes 248 nps 124000 hashfull 0 tbhits 0 time 2 pv e7e6
  info depth 5 seldepth 5 multipv 1 score cp -37 nodes 1383 nps 345750 hashfull 1 tbhits 0 time 4 pv d7d5 e4d5 d8d5
  info depth 6 seldepth 5 multipv 1 score cp -30 nodes 2545 nps 318125 hashfull 1 tbhits 0 time 8 pv c7c5 g1f3 e7e6
  info depth 7 seldepth 7 multipv 1 score cp -30 nodes 4201 nps 350083 hashfull 2 tbhits 0 time 12 pv c7c5 g1f3 e7e6 d2d4 c5d4 f3d4
  info depth 8 seldepth 10 multipv 1 score cp -43 nodes 10574 nps 377642 hashfull 4 tbhits 0 time 28 pv c7c5 g1f3 e7e6 d2d4 c5d4 f1e2
  info depth 9 seldepth 11 multipv 1 score cp -35 nodes 16924 nps 360085 hashfull 6 tbhits 0 time 47 pv e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 g8f6
  info depth 10 seldepth 13 multipv 1 score cp -41 nodes 34866 nps 325850 hashfull 12 tbhits 0 time 107 pv e7e5 g1f3 b8c6 f1b5 g8f6 b1c3 f8c5 e1g1 d7d6 d2d4 e5d4 f3d4
  info depth 11 seldepth 14 multipv 1 score cp -38 nodes 43562 nps 325089 hashfull 15 tbhits 0 time 134 pv e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 d5e4 c3e4
  info depth 12 seldepth 16 multipv 1 score cp -41 nodes 56507 nps 326630 hashfull 23 tbhits 0 time 173 pv e7e6 d2d4 d7d5 b1c3 f8b4 g1e2 d5e4 a2a3 b4c3 e2c3
  info depth 13 seldepth 15 multipv 1 score cp -32 nodes 73728 nps 323368 hashfull 28 tbhits 0 time 228 pv e7e6 d2d4 d7d5 b1c3 g8f6 e4e5 f6d7 f2f4 c7c5 c3e2 c5d4 e2d4
  info depth 14 seldepth 17 multipv 1 score cp -31 nodes 90766 nps 318477 hashfull 37 tbhits 0 time 285 pv e7e6 d2d4 d7d5 b1c3 g8f6 e4e5 f6d7 f2f4 c7c5 c3e2 b8c6 g1f3 f8e7 c2c3 e8g8
  info depth 15 seldepth 17 multipv 1 score cp -35 nodes 193951 nps 317432 hashfull 76 tbhits 0 time 611 pv e7e5 g1f3 b8c6 f1c4 g8f6 d2d3 f8e7 b1c3 d7d6 h2h3 e8g8
  info depth 16 seldepth 17 multipv 1 score cp -23 nodes 255750 nps 322916 hashfull 98 tbhits 0 time 792 pv e7e5 g1f3 b8c6 f1c4 g8f6 b1c3 f8c5 d2d3 h7h6 c1e3 c5e3 f2e3 d7d6 c4b3
  info depth 17 seldepth 20 multipv 1 score cp -27 upperbound nodes 323628 nps 322338 hashfull 132 tbhits 0 time 1004 pv e7e5 g1f3
  bestmove e7e5 ponder g1f3
  ```
  Stockfish plays `1. ... e5` and expects `2. Nf3`
  ```
  > position startpos moves e2e4 e7e5 g1f3
  > go ponder movetime 1000
  info string NNUE evaluation using nn-52471d67216a.nnue enabled
  info depth 1 seldepth 1 multipv 1 score cp -30 nodes 47 nps 23500 hashfull 0 tbhits 0 time 2 pv g8f6 d2d4
  info depth 2 seldepth 2 multipv 1 score cp -30 nodes 86 nps 43000 hashfull 0 tbhits 0 time 2 pv g8f6 d2d4
  info depth 3 seldepth 4 multipv 1 score cp -30 nodes 144 nps 72000 hashfull 0 tbhits 0 time 2 pv g8f6 d2d4 e5d4 e4e5
  info depth 4 seldepth 5 multipv 1 score cp -30 nodes 189 nps 94500 hashfull 0 tbhits 0 time 2 pv g8f6 d2d4 e5d4 e4e5 f6e4
  info depth 5 seldepth 6 multipv 1 score cp -29 nodes 252 nps 126000 hashfull 0 tbhits 0 time 2 pv g8f6 d2d4 e5d4 e4e5 f6e4 d1d4
  info depth 6 seldepth 7 multipv 1 score cp -29 nodes 355 nps 177500 hashfull 0 tbhits 0 time 2 pv g8f6 d2d4 e5d4 e4e5 f6e4 d1d4 d7d5 e5d6
  info depth 7 seldepth 8 multipv 1 score cp -29 nodes 591 nps 295500 hashfull 0 tbhits 0 time 2 pv g8f6 d2d4 e5d4 e4e5 f6e4 d1d4 d7d5 e5d6
  info depth 8 seldepth 11 multipv 1 score cp -29 nodes 1676 nps 279333 hashfull 0 tbhits 0 time 6 pv g8f6 d2d4 e5d4 e4e5 f6e4 d1d4 d7d5 e5d6
  info depth 9 seldepth 10 multipv 1 score cp -29 nodes 2414 nps 301750 hashfull 0 tbhits 0 time 8 pv g8f6 d2d4 e5d4 e4e5 f6e4 d1d4 d7d5 e5d6 e4d6
  info depth 10 seldepth 12 multipv 1 score cp -26 nodes 5045 nps 296764 hashfull 1 tbhits 0 time 17 pv g8f6 d2d4 e5d4 e4e5 f6e4 d1d4 d7d5 e5d6 e4d6 c1g5 b8c6
  info depth 11 seldepth 12 multipv 1 score cp -26 nodes 8612 nps 277806 hashfull 2 tbhits 0 time 31 pv g8f6 d2d4 e5d4 e4e5 f6e4 d1d4 d7d5 e5d6 e4d6 d4c3 d8e7 f1e2
  info depth 12 seldepth 17 multipv 1 score cp -34 nodes 18839 nps 303854 hashfull 6 tbhits 0 time 62 pv g8f6 d2d4 f6e4 f1d3 d7d5 f3e5 f8d6 b1d2 e4d2 c1d2 b8c6 d1h5 g7g6 e5c6 b7c6 h5e2 d8e7
  info depth 13 seldepth 19 multipv 1 score cp -36 nodes 59966 nps 310704 hashfull 25 tbhits 0 time 193 pv b8c6 f1c4 g8f6 d2d3 f8e7 e1g1 e8g8 f1e1 d7d6 a2a4 c8e6
  info depth 14 seldepth 19 multipv 1 score cp -28 nodes 128004 nps 312968 hashfull 61 tbhits 0 time 409 pv g8f6 d2d4 f6e4 f1d3 d7d5 f3e5 f8d6 c2c4 e8g8 c4d5 d6b4 b1d2 e4d2 c1d2
  info depth 15 seldepth 22 multipv 1 score cp -31 nodes 191379 nps 314251 hashfull 92 tbhits 0 time 609 pv b8c6 f1c4 g8f6 d2d3 f8e7 e1g1 d7d6 a2a4 e8g8 f1e1 c6a5 c4a2 c7c5 b1c3 a5c6 a2c4 c8e6 c3d5 e6d5 e4d5
  info depth 16 seldepth 24 multipv 1 score cp -32 nodes 319240 nps 316392 hashfull 150 tbhits 0 time 1009 pv b8c6 f1c4 g8f6 d2d3 f8e7 e1g1 d7d6 a2a4 e8g8 a4a5 c8e6 c4e6 f7e6 a5a6 b7b5 c2c3 d8c8 b1d2 a8b8 b2b4
  ```
  The opponent plays the expected `2. Nf3`
  ```
  > ponderhit
  info depth 17 seldepth 24 multipv 1 score cp -32 nodes 351706 nps 307973 hashfull 161 tbhits 0 time 1142 pv b8c6 f1c4 g8f6 d2d3 f8e7 e1g1 d7d6 a2a4 e8g8 a4a5 c8e6 c4e6 f7e6 a5a6 b7b5 c2c3 d8c8 b1d2 a8b8 b2b4
  bestmove b8c6 ponder f1c4
  ```
  Stockfish plays `2. ... Nc6` and expects `3. Bc4`
  ```
  > position startpos moves e2e4 e7e5 g1f3 b8c6 f1c4
  > go ponder movetime 1000
  info string NNUE evaluation using nn-52471d67216a.nnue enabled
  info depth 1 seldepth 1 multipv 1 score cp -34 nodes 39 nps 39000 hashfull 0 tbhits 0 time 1 pv d7d6
  info depth 2 seldepth 2 multipv 1 score cp -38 nodes 95 nps 47500 hashfull 0 tbhits 0 time 2 pv d7d6 d2d4 e5d4
  info depth 3 seldepth 3 multipv 1 score cp -38 nodes 164 nps 82000 hashfull 0 tbhits 0 time 2 pv d7d6 d2d4 e5d4
  info depth 4 seldepth 4 multipv 1 score cp -38 nodes 231 nps 115500 hashfull 0 tbhits 0 time 2 pv d7d6 d2d4 e5d4 f3d4
  ...
  ```
</details>

---

## Non-standard commands

### `bench`

> [!NOTE]
> * **String parameters are case-sensitive**. In case of invalid values of string parameters, the error is not given, and the behavior is undefined (the program does not fall back to a default value).
> * The `[file path]` may contain **one or more positions**, each on a separate line.

This runs a standard search benchmark on a pre-selected assortment of positions. It prints the total combined nodes searched, as well as time taken.

This command serves two primary purposes:

* The total number of nodes searched with default parameters can be used as a "signature" or "fingerprint" of the exact search algorithm version in the binary being used. The main utility of the nodecount signature is to ensure that, when testing possible new patches on Fishtest, the author and workers are working on the exact same code. It also can be used to verify which version or release you have locally although the commit hash is a more direct way to do this.
* It can be used as a basic nodes-per-second speed benchmark, although we recommend using the [`speedtest` command](#speedtest) instead.

Usage: `bench [ttSize] [threads] [limit] [fenFile] [limitType]`

The standardized nodecount signature of a version is obtained using all default parameters.
Each functional commit in the Stockfish commit history includes a standardized nodecount signature. For example, the nodecount signature of [Stockfish 15](https://github.com/official-stockfish/Stockfish/commit/e6e324eb28fd49c1fc44b3b65784f85a773ec61c) is `8129754`.

| Parameter   |  Default  | Values                                                    | Meaning                          |
|-------------|:---------:|-----------------------------------------------------------|----------------------------------|
| `ttSize`    |    `16`   |                                                           | Hash value                       |
| `threads`   |    `1`    |                                                           | Number of threads                |
| `limit`     |    `13`   |                                                           | The limit of `limitType`         |
| `fenFile`   | `default` | `default`, `current` or `[file path]`                     | The positions used for the bench |
| `limitType` |  `depth`  | A [go parameter](#go) (e.g. `depth` or `nodes`) or `eval` | The type of limit                |

<details>
  <summary>Basic example of usage</summary>

  ```
  > position startpos
  > bench 16 1 1 current depth

  Position: 1/1 (rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1)
  info string NNUE evaluation using nn-c38c3d8d3920.nnue
  info depth 1 seldepth 1 multipv 1 score cp 25 nodes 20 nps 10000 hashfull 0 tbhits 0 time 2 pv d2d4
  bestmove d2d4

  ===========================
  Total time (ms) : 2
  Nodes searched  : 21
  Nodes/second    : 10500
  ```
</details>

<details>
  <summary>The bench command may also be used in the command line when executing Stockfish.</summary>

  ```
  ./stockfish bench
  ```
  Running the bench with specific parameters and redirecting the output of the benchmark to a file called "outputFile".
  ```
  ./stockfish bench 16 1 1 inputFile > outputFile
  ```
  Running the benchmark with specific parameters in the starting position indefinitely and redirecting the output.
  Note than in this case, the `limit` is ignored.
  ```
  ./stockfish bench 4096 16 _ current infinite > outputFile
  ```
</details>

<details>
  <summary>You can use the bench command to measure the speed of perft</summary>

  ```
  > position startpos
  > bench 16 1 5 current perft

  Position: 1/1 (rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1)
  a2a3: 181046
  b2b3: 215255
  c2c3: 222861
  d2d3: 328511
  e2e3: 402988
  f2f3: 178889
  g2g3: 217210
  h2h3: 181044
  a2a4: 217832
  b2b4: 216145
  c2c4: 240082
  d2d4: 361790
  e2e4: 405385
  f2f4: 198473
  g2g4: 214048
  h2h4: 218829
  b1a3: 198572
  b1c3: 234656
  g1f3: 233491
  g1h3: 198502

  Nodes searched: 4865609


  ===========================
  Total time (ms) : 40
  Nodes searched  : 4865609
  Nodes/second    : 121640225
  ```
</details>

### `speedtest`

> [!NOTE]  
> In official releases this command is only available since Stockfish 17.1.

Measures the speed of the computer with a realistic and stable hardware benchmark. By default, Stockfish will run on all available threads, using a reasonable hash, on a number of positions that represent at typical game. The output is the achieved Nodes/second. 

The simplest and intended usage is: `./stockfish speedtest`

Usage: `speedtest [threads] [hash (MiB)] [runtime (s)]`

<details>
 <summary>Example with output</summary>

```
C:\dev\stockfish-master\src>stockfish.exe speedtest
Stockfish dev-20240928-nogit by the Stockfish developers (see AUTHORS file)
info string Using 16 threads
Warmup position 3/3
Position 258/258
===========================
Version                    : Stockfish dev-20240928-nogit
Compiled by                : g++ (GNUC) 13.2.0 on MinGW64
Compilation architecture   : x86-64-vnni256
Compilation settings       : 64bit VNNI BMI2 AVX2 SSE41 SSSE3 SSE2 POPCNT
Compiler __VERSION__ macro : 13.2.0
Large pages                : yes
User invocation            : speedtest
Filled invocation          : speedtest 16 2048 150
Available processors       : 0-15
Thread count               : 16
Thread binding             : none
TT size [MiB]              : 2048
Hash max, avg [per mille]  :
    single search          : 40, 21
    single game            : 631, 428
Total nodes searched       : 2099917842
Total search time [s]      : 153.937
Nodes/second               : 13641410
```

</details>

| Parameter | Default       |
|-----------|:-------------:|
| `threads` | all           |
| `hash`    | threads * 128 |
| `runtime` | 150           |

### `d`

Display the current position, with ASCII art and FEN.

<details>
  <summary>Example</summary>

  ```
  > d

  +---+---+---+---+---+---+---+---+
  | r | n | b | q | k | b | n | r | 8
  +---+---+---+---+---+---+---+---+
  | p | p | p | p | p | p | p | p | 7
  +---+---+---+---+---+---+---+---+
  |   |   |   |   |   |   |   |   | 6
  +---+---+---+---+---+---+---+---+
  |   |   |   |   |   |   |   |   | 5
  +---+---+---+---+---+---+---+---+
  |   |   |   |   |   |   |   |   | 4
  +---+---+---+---+---+---+---+---+
  |   |   |   |   |   |   |   |   | 3
  +---+---+---+---+---+---+---+---+
  | P | P | P | P | P | P | P | P | 2
  +---+---+---+---+---+---+---+---+
  | R | N | B | Q | K | B | N | R | 1
  +---+---+---+---+---+---+---+---+
    a   b   c   d   e   f   g   h

  Fen: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
  Key: 8F8F01D4562F59FB
  Checkers:
  ```
</details>

### `eval`

> [!NOTE]
> The `eval` command only provides a very rough evaluation of the position without any search involved and **is not recommended for most use cases**.  
> In order to get an accurate evaluation of the current position, you need to use the [`go`](#go) command.

Display the static evaluation of the current position.

<details>
<summary>Example</summary>

```
info string NNUE evaluation using nn-c38c3d8d3920.nnue


 NNUE derived piece values:
+-------+-------+-------+-------+-------+-------+-------+-------+
|   r   |   n   |   b   |   q   |   k   |   b   |   n   |   r   |
| -5.28 | -4.92 | -5.11 | -8.99 |       | -5.12 | -4.96 | -5.55 |
+-------+-------+-------+-------+-------+-------+-------+-------+
|   p   |   p   |   p   |   p   |   p   |   p   |   p   |   p   |
| -0.70 | -1.17 | -1.15 | -1.14 | -1.27 | -1.69 | -1.41 | -0.72 |
+-------+-------+-------+-------+-------+-------+-------+-------+
|       |       |       |       |       |       |       |       |
|       |       |       |       |       |       |       |       |
+-------+-------+-------+-------+-------+-------+-------+-------+
|       |       |       |       |       |       |       |       |
|       |       |       |       |       |       |       |       |
+-------+-------+-------+-------+-------+-------+-------+-------+
|       |       |       |       |       |       |       |       |
|       |       |       |       |       |       |       |       |
+-------+-------+-------+-------+-------+-------+-------+-------+
|       |       |       |       |       |       |       |       |
|       |       |       |       |       |       |       |       |
+-------+-------+-------+-------+-------+-------+-------+-------+
|   P   |   P   |   P   |   P   |   P   |   P   |   P   |   P   |
| +0.64 | +1.04 | +1.03 | +0.98 | +1.14 | +1.49 | +1.23 | +0.61 |
+-------+-------+-------+-------+-------+-------+-------+-------+
|   R   |   N   |   B   |   Q   |   K   |   B   |   N   |   R   |
| +4.38 | +4.13 | +4.52 | +7.67 |       | +4.37 | +4.11 | +4.65 |
+-------+-------+-------+-------+-------+-------+-------+-------+

 NNUE network contributions (White to move)
+------------+------------+------------+------------+
|   Bucket   |  Material  | Positional |   Total    |
|            |   (PSQT)   |  (Layers)  |            |
+------------+------------+------------+------------+
|  0         |     0.00   |  -  2.93   |  -  2.93   |
|  1         |     0.00   |  -  0.16   |  -  0.16   |
|  2         |     0.00   |  +  0.39   |  +  0.39   |
|  3         |     0.00   |  +  0.43   |  +  0.43   |
|  4         |     0.00   |  +  0.20   |  +  0.20   |
|  5         |     0.00   |  +  0.26   |  +  0.26   |
|  6         |     0.00   |  +  0.27   |  +  0.27   |
|  7         |     0.00   |  +  0.10   |  +  0.10   | <-- this bucket is used
+------------+------------+------------+------------+

NNUE evaluation        +0.10 (white side)
Final evaluation       +0.11 (white side) [with scaled NNUE, ...]
```
</details>

### `compiler`

Give information about the compiler and environment used for building a binary.

Example:
```
> compiler

Compiled by g++ (GNUC) 13.1.0 on MinGW64
Compilation settings include:  64bit AVX2 SSE41 SSSE3 SSE2 POPCNT
__VERSION__ macro expands to: 13.1.0
```

### `export_net [filenameBigNet] [filenameSmallNet]`

Exports the currently loaded network to a file.
If the currently loaded network is the embedded network and the filename is not specified then the network is saved to the file matching the name of the embedded network, as defined in `evaluate.h`.
If the currently loaded network is not the embedded network (some net set through the UCI `setoption`) then the filename parameter is required and the network is saved into that file.

### `flip`

Flips the side to move.

### `help`

Gives version info, describes Stockfish as a chess engine using UCI, and points to the GitHub page for more details.

### `license`

Gives version info, describes Stockfish as a chess engine using UCI, and points to the GitHub page for more details.
