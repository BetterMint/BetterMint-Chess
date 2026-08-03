# How to compile Stockfish from source code

- [General](#general)
- [Linux](#linux)
- [Windows](#windows)
- [macOS](#macos)
- [Android](#android)
- [Cross compilation](#cross-compilation)
- [Lower compilation time](#lower-compilation-time)
- [Optimize for your CPU](#optimize-for-your-cpu)

## General

`make target [ARCH=arch] [COMP=compiler] [COMPCXX=cxx]`

### Targets

```
help                    > Display architecture details
profile-build           > standard build with profile-guided optimization
build                   > skip profile-guided optimization
net                     > Download the default nnue nets
strip                   > Strip executable
install                 > Install executable
clean                   > Clean up
```

### Archs

```
native                  > select the best architecture for the host processor (default)
x86-64-avx512icl        > x86 64-bit with minimum avx512 support of Intel Ice Lake or AMD Zen 4
x86-64-vnni512          > x86 64-bit with vnni 512bit support
x86-64-avx512           > x86 64-bit with avx512 support
x86-64-avxvnni          > x86 64-bit with vnni 256bit support
x86-64-bmi2             > x86 64-bit with bmi2 support
x86-64-avx2             > x86 64-bit with avx2 support
x86-64-sse41-popcnt     > x86 64-bit with sse41 and popcnt support
x86-64-modern           > deprecated, currently x86-64-sse41-popcnt
x86-64-ssse3            > x86 64-bit with ssse3 support
x86-64-sse3-popcnt      > x86 64-bit with sse3 compile and popcnt support
x86-64                  > x86 64-bit generic (with sse2 support)
x86-32-sse41-popcnt     > x86 32-bit with sse41 and popcnt support
x86-32-sse2             > x86 32-bit with sse2 support
x86-32                  > x86 32-bit generic (with mmx compile support)
ppc-64                  > PPC 64-bit
ppc-64-altivec          > PPC 64-bit with altivec support
ppc-64-vsx              > PPC 64-bit with vsx support
ppc-32                  > PPC 32-bit
armv7                   > ARMv7 32-bit
armv7-neon              > ARMv7 32-bit with popcnt and neon
armv8                   > ARMv8 64-bit with popcnt and neon
armv8-dotprod           > ARMv8 64-bit with popcnt, neon and dot product support
e2k                     > Elbrus 2000
apple-silicon           > Apple silicon ARM64
general-64              > unspecified 64-bit
general-32              > unspecified 32-bit
riscv64                 > RISC-V 64-bit
loongarch64             > LoongArch 64-bit
loongarch64-lsx         > LoongArch 64-bit with SIMD eXtension
loongarch64-lasx        > LoongArch 64-bit with Advanced SIMD eXtension
```

### Compilers

```
gcc                     > GNU compiler (default)
mingw                   > GNU compiler with MinGW under Windows
clang                   > LLVM Clang compiler
icx                     > Intel oneAPI DPC++/C++ Compiler
ndk                     > Google NDK to cross-compile for Android
```

### Examples

```bash
# Basic usage
make build

# Build using multiple jobs to speed up the process
make -j build

# Build with profile-guided optimizations for better performance
make -j profile-build

# Build for a specific architecture (e.g., x86-64 with BMI2 support)
make -j build ARCH=x86-64-bmi2

# Build with a specific compiler (e.g., GCC and G++ version 14.0)
make -j build COMP=gcc COMPCXX=g++-14.0

# Build with NNUE embedding disabled
# You will have to load them at runtime.
# Stockfish will try to load the default NNUE files from the current working directory.
make -j build CXXFLAGS="-DNNUE_EMBEDDING_OFF"
```

_See also: [How to lower compilation time](#lower-compilation-time) and [How to optimize for your CPU](#optimize-for-your-cpu)._

---

## Linux

On Unix-like systems, it should be easy to compile Stockfish directly from the source code with the included Makefile in the folder `src`.

In general it is recommended to run `make help` to see a list of make targets with corresponding descriptions.

```bash
cd src
make help
make -j profile-build
```

---

## Windows

<details><summary>About MSYS2 & MinGW-w64</summary>

MSYS2 is a software distribution and building platform for Windows. It provides a Unix-like environment, a command line interface, and a software repository, making it easy to install software on Windows or build software on Windows with either the GCC compiler or the Clang/LLVM compiler and using the Microsoft Visual C++ Runtime (mvscrt, shipped with all Windows versions) or the newer Microsoft Universal C Runtime (ucrt, shipped by default starting with Windows 10).

MSYS2 consists of several subsystems, `msys2`, `mingw32`, and `mingw64`:
* The `mingw32` and `mingw64` subsystems are native Windows applications that use either the mvscrt or the ucrt.
* The `msys2` subsystem provides an emulated mostly-POSIX-compliant environment based on Cygwin.

Each subsystem has an associated "terminal/shell", which is essentially a set of environment variables that allows the subsystems to co-operate properly:
* `MSYS2 UCRT64`, to build Windows-native 64-bit applications with GCC compiler using ucrt.
* `MSYS2 ClangARM64`, to build Windows-ARM-native 64-bit applications with Clang/LLVM compiler using ucrt.
* `MSYS2 MSYS`, to build POSIX applications using the Cygwin compatibility layer.
* `MSYS2 MinGW64`, to build Windows-native 64-bit applications with GCC compiler using mvscrt.
* `MSYS2 Clang64`, to build Windows-native 64-bit applications with Clang/LLVM compiler using ucrt.
* `MSYS2 MinGW32`, to build Windows-native 32-bit applications using GCC compiler using mvscrt.

Refer to the [MSYS2 homepage](https://www.msys2.org/) for more detailed information on the MSYS2 subsystems and terminals/shells.

</details>

### Installing MSYS2

#### Install MSYS2 with WinGet
[WinGet](https://learn.microsoft.com/en-us/windows/package-manager/winget/) is Microsoft's command-line tool for discovering, installing, upgrading, removing, and configuring apps on Windows 10, Windows 11, and Windows Server 2025. It’s the client for the Windows Package Manager.

Open Powershell and run:
```ps
winget install MSYS2.MSYS2
```

<details><summary>Alternative: Install MSYS2 with the <strong>official installer</strong></summary>

1. Download and start the [one-click installer for MSYS2](https://www.msys2.org/). MSYS2 no longer support an installer for Windows 32-bit, the [latest provided](https://github.com/msys2/msys2-installer/releases/tag/2020-05-17) is not able to install packages.
2. The installer runs a `MSYS2 MSYS` shell as a last step. Update the core packages by typing and executing `pacman -Syuu`. When finished, close the `MSYS2 MSYS` shell.
</details>

With MSYS2 installed to `C:\msys64` your home directory will be `C:\msys64\home\<your_username>`. Note that within the MSYS2 shell, paths are written in Unix-like way:

* Windows path: `C:\msys64`
* Unix-like path: `/c/msys64`
* Windows path: `C:\msys64\home`
* Unix-like path: `/home` or `/c/msys64/home`

> [!TIP]
> You can also use `ls` to list the files and folders in a directory, similar to how you would use `dir` in Windows.

### GCC
This works with all the Windows versions.

1. Using your favorite text editor, copy and paste the following bash script, calling it `makefish.sh`:

<details><summary>64-bit Windows</summary>

```bash
#!/bin/bash
# makefish.sh
set -euo pipefail

# install missing packages
pacman -S --noconfirm --needed unzip make mingw-w64-x86_64-gcc

branch='master'
github_user='official-stockfish'

# download the Stockfish source code
wget -O ${branch}.zip https://github.com/${github_user}/Stockfish/archive/refs/heads/${branch}.zip
unzip -o ${branch}.zip
pushd Stockfish-${branch}/src

# remove old nets
file_nnue=$(grep 'define.*EvalFileDefaultName' evaluate.h | grep -Ewo 'nn-[a-z0-9]{12}.nnue')
shopt -s nullglob
for f in *.nnue; do
    [[ "$f" != "$file_nnue" ]] && rm -f -- "$f"
done
shopt -u nullglob

# build the fastest Stockfish executable for the CPU
read -r arch_cpu _ < <(../scripts/get_native_properties.sh)
make -j profile-build COMP=mingw
make strip COMP=mingw
mv stockfish.exe ../../stockfish_${arch_cpu}.exe
make clean COMP=mingw
popd
```
</details>

<details><summary>32-bit Windows</summary>

```bash
#!/bin/bash
# makefish.sh
set -euo pipefail

# install missing packages
pacman -S --noconfirm --needed unzip make mingw-w64-i686-gcc

branch='master'
github_user='official-stockfish'

# download the Stockfish source code
wget -O ${branch}.zip https://github.com/${github_user}/Stockfish/archive/refs/heads/${branch}.zip
unzip -o ${branch}.zip
pushd Stockfish-${branch}/src

# remove old nets
file_nnue=$(grep 'define.*EvalFileDefaultName' evaluate.h | grep -Ewo 'nn-[a-z0-9]{12}.nnue')
shopt -s nullglob
for f in *.nnue; do
    [[ "$f" != "$file_nnue" ]] && rm -f -- "$f"
done
shopt -u nullglob

# build the fastest Stockfish executable for the CPU
read -r arch_cpu _ < <(../scripts/get_native_properties.sh)
make -j profile-build COMP=mingw
make strip COMP=mingw
mv stockfish.exe ../../stockfish_${arch_cpu}.exe
make clean COMP=mingw
popd
```
</details>

2. Start a `MSYS2 MinGW64` shell (not a `MSYS2 MSYS` one), `C:\msys64\mingw64.exe`, or start a `MSYS2 MinGW x86` shell, `C:\msys64\mingw32.exe`, to build a 32 bit application.
3. Navigate to wherever you saved the script (e.g. type and execute `cd '/d/Program Files/Stockfish'` to navigate to `D:\Program Files\Stockfish`).
4. Run the script by typing and executing `bash makefish.sh`.

### Clang/LLVM
With Windows version older than Windows 10 you could need to install the Microsoft Windows Universal C Runtime.

1. Using your favorite text editor, copy and paste the following bash script, calling it `makefish.sh`:

<details><summary>64-bit Windows</summary>

```bash
#!/bin/bash
# makefish.sh
set -euo pipefail

# install missing packages
pacman -S --noconfirm --needed unzip make mingw-w64-clang-x86_64-clang

branch='master'
github_user='official-stockfish'

# download the Stockfish source code
wget -O ${branch}.zip https://github.com/${github_user}/Stockfish/archive/refs/heads/${branch}.zip
unzip -o ${branch}.zip
pushd Stockfish-${branch}/src

# remove old nets
file_nnue=$(grep 'define.*EvalFileDefaultName' evaluate.h | grep -Ewo 'nn-[a-z0-9]{12}.nnue')
shopt -s nullglob
for f in *.nnue; do
    [[ "$f" != "$file_nnue" ]] && rm -f -- "$f"
done
shopt -u nullglob

# build the fastest Stockfish executable for the CPU
read -r arch_cpu _ < <(../scripts/get_native_properties.sh)
make -j profile-build COMP=clang
make strip COMP=clang
mv stockfish.exe ../../stockfish_${arch_cpu}.exe
make clean COMP=clang
popd
```
</details>

2. Start a `MSYS2 MinGW Clang x64` shell, `C:\msys64\clang64.exe`.
3. Navigate to wherever you saved the script (e.g. type and execute `cd '/d/Program Files/Stockfish'` to navigate to `D:\Program Files\Stockfish`).
4. Run the script by typing and executing `bash makefish.sh`.

### Microsoft Visual Studio

> [!CAUTION]
> **Building Stockfish with Visual Studio is not officially supported.**

To create an optimized MSVC build, configure the following settings in the IDE.

#### General Build Settings

1. **Preprocessor Definitions:** Add `NDEBUG;USE_POPCNT;USE_PEXT`.
    - **Optional:** Based on your processor's support, add *one* of the following: `USE_AVX512`, `USE_AVX2`, `USE_SSSE3`, `USE_SSE2`, or `USE_MMX`.
    - **Optional:** If your processor supports VNNI, also add `USE_AVXVNNI`.
2. **Architecture (64-bit):** For CPUs supporting AVX or later, set the compiler flag `/arch:AVX`, `/arch:AVX2`, or `/arch:AVX512`.
3. **Optimization Flags:** Set `/O2`, `/Oi`, `/Ot`, `/Oy`, `/GL`.
4. **Runtime Library:** Set to static link (`/MT`).
5. **Stack Cookies:** Disable (`/GS-`).
6. **Debug Info:** Disable debugging information in both the compiler and linker.
7. **Stack Reserve (Critical):** Set the stack reserve to `8388608`. This is **required to avoid crashes**.
    - Find this setting under `Linker -> System` or use the linker option `/STACK:reserve=8388608`.

#### Profile-Guided Optimization (PGO) (VS 2017 Only)

1. **Make PGO Instrument Build:** Set this option under the project's `General` settings. The build will likely depend on `pgort140.dll` and probably won't start.
2. **Copy PGO DLL:** Find `pgort140.dll` in your Visual Studio installation path (e.g., `C:\Program Files (x86)\Microsoft Visual Studio\2017\Community\VC\Tools\MSVC\14.16.27023\bin\Hostx64\x64`) and copy it to your build's output folder.
3. **Generate Profile Data:** Run `bench` with the instrumented build. This will be very slow. After you quit, it should generate `Stockfish.pgd` and `Stockfish!1.pgc` files.
4. **Make PGO Optimized Build:** Change the setting under `General` to "PGO Optimized". The build log will show that it is using the profile data.

Local tests show builds with these settings have comparable speed to GCC builds.

### Troubleshooting

If this tutorial will not work on your pc, you may try to change the `Windows Security` settings in via `Windows Security` >> `App & Browser Control` >> `Exploit Protection Settings`:
 1. Try to turn off _"Force randomization for images (Mandatory ASLR)"_, if this not solve the problem then,
 2. Try to turn off also _"Randomize memory allocations (Bottom-up ASLR)"_ .

### Using other MinGW-w64 with MSYS2

To use with MSYS2 a MinGW-w64 built by other projects, simply follow these instructions (Windows 64 bit):
1. Download another version of MinGW-w64, e.g. [MinGW-w64 (64-bit) GCC 8.1.0](https://www.msys2.org/), extract the *mingw64* folder renaming it to *mingw64-810*, copy the folder into *C:\msys64*, check to have the directory *C:\msys64\mingw64-810\bin*

2. Build Stockfish writing and executing this bash script
<details><summary>Click to view</summary>

```bash
#!/bin/bash
# makefish.sh

# set PATH to use GCC 8.1.0
if [ -d "/mingw64-810/bin" ] ; then
  PATH="/mingw64-810/bin:${PATH}"
else
  echo "folder error"
  exit 1
fi

branch='master'
github_user='official-stockfish'

# download the Stockfish source code
wget -O ${branch}.zip https://github.com/${github_user}/Stockfish/archive/refs/heads/${branch}.zip
unzip ${branch}.zip
cd Stockfish-${branch}/src

# find the CPU architecture
# CPU without popcnt and bmi2 instructions (e.g. older than Intel Sandy Bridge)
arch_cpu=x86-64
# CPU with bmi2 instruction (e.g. Intel Haswell or newer)
if [ "$(g++ -Q -march=native --help=target | grep mbmi2 | grep enabled)" ] ; then
  # CPU AMD zen
  if [ "$(g++ -Q -march=native --help=target | grep march | grep 'znver[12]')" ] ; then
    arch_cpu=x86-64-avx2
  else
    arch_cpu=x86-64-bmi2
  fi
# CPU with popcnt instruction (e.g. Intel Sandy Bridge)
elif [ "$(g++ -Q -march=native --help=target | grep mpopcnt | grep enabled)" ] ; then
  arch_cpu=x86-64-sse41-popcnt
fi

# build the Stockfish executable
make profile-build ARCH=${arch_cpu} COMP=mingw
make strip
mv stockfish.exe ../../stockfish_${arch_cpu}.exe
make clean 
cd
```
</details>

To use the compiler in the CLI write and run the script `use_gcc810.sh` in the user home folder
```bash
# set PATH to use GCC 8.1.0
# use this command: source use_gcc810.sh
if [ -d "/mingw64-810/bin" ] ; then
  PATH="/mingw64-810/bin:${PATH}"
else
  echo "folder error"
fi
```

---

## macOS

On macOS 10.14 or higher, it is possible to use the Clang compiler provided by Apple
to compile Stockfish out of the box, and this is the method used by default
in our Makefile (the Makefile sets the macosx-version-min=10.14 flag to select
the right libc++ library for the Clang compiler with recent c++17 support).

But it is quite possible to compile and run Stockfish on older versions of macOS! Below
we describe a method to install a recent GNU compiler on these Macs, to get
the c++17 support. We have tested the following procedure to install gcc10 on
machines running macOS 10.7, macOS 10.9 and macOS 10.13.

1) Install Xcode for your machine.

2) Install Apple command-line developer tools for Xcode, by typing the following
   command in a Terminal:

    ```bash
    sudo xcode-select --install
    ```

3) Go to the Stockfish "src" directory, then try a default build and run Stockfish:

    ```bash
    make clean
    make build
    make net
    ./stockfish
    ```

4) If step 3 worked, congrats! You have a compiler recent enough on your Mac
to compile Stockfish. If not, continue with step 5 to install GNU gcc10 :-)

5) Install the MacPorts package manager (https://www.macports.org/install.php),
for instance using the fast method in the "macOS Package (.pkg) Installer"
section of the page.

6) Use the "port" command to install the gcc10 package of MacPorts by typing the
following command:

    ```bash
    sudo port install gcc10
    ```

With this step, MacPorts will install the gcc10 compiler under the name "g++-mp-10"
in the /opt/local/bin directory:

```
which g++-mp-10

/opt/local/bin/g++-mp-10       <--- answer
```

7) You can now go back to the "src" directory of Stockfish, and try to build
Stockfish by pointing at the right compiler:

    ```bash
    make clean
    make build COMP=gcc COMPCXX=/opt/local/bin/g++-mp-10
    make net
    ./stockfish
    ```

8) Enjoy Stockfish on macOS!

See [this pull request](https://github.com/official-stockfish/Stockfish/pull/3049) for further discussion.

---

## Android

> [!WARNING]
> Running Stockfish, especially with multiple threads, is computationally intensive and can drain your device's battery quickly.

### Compile on Android with Termux

You can build Stockfish directly on your Android device using the [Termux](https://termux.dev/en/) app. This avoids the need for a separate computer or the Android NDK.

Open Termux and run the following commands:

```bash
# Update packages and install required tools
pkg update
pkg install git build-essential clang make wget

# Download the Stockfish source code
git clone https://github.com/official-stockfish/Stockfish.git

# Navigate into the source directory and compile
cd Stockfish/src
make -j profile-build COMP=clang
```

After the compilation finishes, the binary will be located at `Stockfish/src/stockfish`.

### Cross-Compile on a PC

This method requires a computer to build the Android binary.

#### Supported Architectures

You must choose the correct architecture for your device.  
Most modern devices use `armv8`.

- `armv8-dotprod`: For the latest ARM CPUs with dot product support (best performance).
- `armv8`: For modern 64-bit ARM CPUs (most common).
- `armv7-neon`: For older 32-bit ARM CPUs with NEON support.
- `armv7`: For very old 32-bit ARM CPUs without NEON.

#### Step 1: Environment Setup

The setup process differs for Windows and Linux.

<details>
    <summary>For Windows (using MSYS2)</summary>

1. **Install MSYS2.** Please see [how to compile on Windows](#windows) for detailed instructions on installing and updating MSYS2.

    > **Note:** You only need to install the basic MSYS environment. You do not need any of the MINGW64, MINGW32 nor the CLANG64 compiler toolchain for an Android build. We will use the Android NDK compiler toolchain instead.

2. **Install Build Tools.** Once MSYS2 is installed, open the MSYS2 MINGW64 terminal and run the following command to install the necessary tools.
    ```bash
    pacman -S --needed base-devel git wget curl expect
    ```
    > **Note:** The `expect` package is optional and only needed if you want to run the test suite. 

3. **Download the Android NDK.** You have two options:
    - **Option A: Direct Download (Recommended).** Go to the [official NDK downloads page](https://developer.android.com/ndk/downloads) and download the latest version for Windows. Unzip it to a simple, memorable location, for example: `C:\Android\Sdk\ndk`.
    - **Option B: Using Android Studio.** If you have Android Studio installed, you can use its SDK manager to install the NDK. It will typically be installed under your Android SDK location (e.g., `C:\Android\Sdk\ndk`).

    > **Note:** The minimum version required is r21e (21.4.7075529).

4. **Link the NDK to MSYS2.** To make the NDK easily accessible, we will create a symbolic link.
    - First, open the Windows **Command Prompt (CMD) as an Administrator**.
    - Run the command below. **You must replace `<ndk_version>`** with the actual folder name of the NDK you downloaded (e.g., `23.1.7779620`).
    ```cmd
    mklink /D "C:\msys64\android-ndk" "C:\Android\Sdk\ndk\<ndk_version>\toolchains\llvm\prebuilt\windows-x86_64"
    ```

5. **Set the NDK Path and Verify.** Now, go back to your MSYS2 terminal. Add the NDK to your session's `PATH` and verify that the compiler is found.
    ```bash
    export PATH=/android-ndk/bin:$PATH
    ```
    > **Note:** This `export` command is only for the current terminal session.

    Now, check that you can access the compiler. The output should be similar to below.
    ```bash
    $ aarch64-linux-android21-clang++ --version
    Android (7019983 based on r365631c3) clang version 9.0.9 (...)
    Target: aarch64-unknown-linux-android21
    Thread model: posix
    InstalledDir: C:\msys64\android-ndk\bin
    ```
    If you get a "command not found" error, please check your paths.

</details>

<details>
    <summary>For Linux</summary>

1. **Install Build Tools.** Use your system's package manager to install the necessary tools. On Debian/Ubuntu-based systems, run:
    ```bash
    sudo apt update && sudo apt install build-essential git wget curl expect
    ```
    > **Note:** The `expect` package is optional and only needed if you want to run the test suite.

2. **Download the Android NDK.** Go to the [official NDK downloads page](https://developer.android.com/ndk/downloads) and download the latest version for Linux. Unzip it to a location you can easily access (e.g., `/home/user/Android/Sdk/ndk/`).

    > **Note:** The minimum version required is r21e (21.4.7075529).

3. **Set the NDK Path and Verify.** Add the NDK compiler to your terminal's `PATH`. Replace `<path_to_your_ndk_folder>` with the actual path where you unzipped the NDK.
    ```bash
    # Example for Linux: export PATH="/home/user/Android/Sdk/ndk/23.1.7779620/toolchains/llvm/prebuilt/linux-x86_64/bin:$PATH"
    export PATH="<path_to_your_ndk_folder>/toolchains/llvm/prebuilt/linux-x86_64/bin:$PATH"
    ```
    > **Note:** This `export` command is only for the current terminal session.

    Now, check that you can access the compiler:
    ```bash
    $ aarch64-linux-android21-clang++ --version
    ```

</details>

#### Step 2: Build Stockfish

These steps are the same for all PC operating systems.

1. **Download Stockfish Source Code.**
    ```bash
    git clone https://github.com/official-stockfish/Stockfish.git
    cd Stockfish/src
    ```

2. **Download the Neural Network.** This command prepares the network to be embedded in the binary.
    ```bash
    make net
    ```

3. **Compile the Engine.** Run the `make` command, specifying your target architecture. We will use `armv8` as the example.
    ```bash
    make -j build ARCH=armv8 COMP=ndk
    ```
    When finished, you will have a `stockfish` file in the `src` directory. A successful compilation will end with messages like this:
    ```
    aarch64-linux-android21-clang++ -o stockfish ...
    make[1]: Leaving directory '.../Stockfish/src'
    ```

#### Step 3: Prepare and Use the Binary

1. **Optimize the Binary.** Make the binary smaller and slightly faster by stripping debugging symbols.
    First, check the file type of the unstripped binary:
    ```bash
    $ file stockfish
    stockfish: ELF 64-bit LSB shared object, ARM aarch64, ... with debug_info, not stripped
    ```
    Now, run the strip command:
    ```bash
    make strip ARCH=armv8 COMP=ndk
    ```
    Checking the file again shows it has been stripped:
    ```bash
    $ file stockfish
    stockfish: ELF 64-bit LSB shared object, ARM aarch64, ... stripped
    ```

2. **Rename the Binary.** It is good practice to rename the file so you can easily identify your self-compiled development version in the GUI.
    ```bash
    mv stockfish stockfish_DEV_armv8
    ```

3. **Transfer and Install.**
    - Copy the final binary (e.g., `stockfish_DEV_armv8`) to your Android device. An easy way to do this is to place it in a shared network folder and access it from your phone.
    - Using a file manager on your phone, move the binary into your chess GUI's engine directory. For Droidfish, this is often a folder named `uci`. You can find more details in the [Droidfish documentation](https://github.com/peterosterlund2/droidfish/tree/master/doc).
    - Select your new engine from within the app's settings. For better performance, consider increasing the **Hash** memory (e.g., to 512 MB) and **Threads** in the engine configuration.

---

## Cross compilation

### For Windows in Ubuntu

The script works with Ubuntu 18.04, Ubuntu 21.10 and Ubuntu 22.04, other versions could still have a packaging bug.

<details><summary>Click to view</summary>

```bash
#!/bin/bash
# functions to build Stockfish
_build_sf () {
make build ARCH=x86-64$1 COMP=mingw -j
make strip COMP=mingw
mv stockfish.exe ../../stockfish-x64${1}.exe
make clean COMP=mingw
}

_build_sf_pgo () {
make profile-build ARCH=x86-64$1 COMP=mingw PGOBENCH="wine ./stockfish.exe bench" -j
make strip COMP=mingw
mv stockfish.exe ../../stockfish-x64${1}-pgo.exe
make clean COMP=mingw
}

# full-upgrade and install required packages
sudo apt update && sudo apt full-upgrade -y && sudo apt autoremove -y && sudo apt clean
sudo apt install -y \
  make \
  mingw-w64 \
  git \
  wine64 \
  binutils

# clone Stockfish source code
git clone --single-branch --branch master https://github.com/official-stockfish/Stockfish.git
cd Stockfish/src

# build Stockfish executables
# to speedup the building process you can keep only the section fitting your CPU architecture

# build the binary for CPUs without popcnt and bmi2 instructions (e.g. older than Intel Sandy Bridge)
_build_sf_pgo
  
# build the binary for CPU with popcnt instruction (e.g. Intel Sandy Bridge)
if [ "$(x86_64-w64-mingw32-c++-posix -Q -march=native --help=target | grep mpopcnt | grep enabled)" ] ; then
  _build_sf_pgo -sse41-popcnt
else
  _build_sf -sse41-popcnt
fi
  
# build the binary for CPU with bmi2 instruction (e.g. Intel Haswell or newer)
if [ "$(x86_64-w64-mingw32-c++-posix -Q -march=native --help=target | grep mbmi2 | grep enabled)" ] ; then
  _build_sf_pgo -bmi2
else
  _build_sf -bmi2
fi
```
</details>

### For all platforms (host/target) using Zig

[Zig](https://ziglang.org/) is a programming language in early development stage that is binary compatible with C.
The Zig toolchain, based on LLVM, ships the source code of all the required libraries to easily cross compile Zig/C/C++ code for several CPU Architecture and OS combinations. All the work required is to set as target the proper supported [triple \<arch-os-abi\>](https://github.com/ziglang/zig-bootstrap#supported-triples) (eg `x86_64-windows-gnu`, `aarch64-linux-musl`).

You can use Zig:
* installing Zig with a [package manager](https://github.com/ziglang/zig/wiki/Install-Zig-from-a-Package-Manager) for your OS, or
* unzipping the [Zig archive](https://ziglang.org/download/) (~70 Mbi) and setting the PATH for the shell with `export PATH=/home/username/zig:$PATH`

Here is a script to cross compile from a clean Ubuntu a static build of Stockfish targeting an armv8 or armv7 CPU running on Linux or Android:

<details><summary>Click to view</summary>

```bash
# Use a clean Ubuntu to cross compile
# a static build for armv8 and armv7 on Linux/Android

# one time configuration
sudo apt update && sudo apt install -y make git
sudo snap install zig --classic --edge
sudo apt install -y qemu-user

# armv8 static build with musl libc
git clone https://github.com/official-stockfish/Stockfish.git
cd Stockfish/src
make -j build ARCH=armv8 COMP=clang CXX="zig c++ -target aarch64-linux-musl"

# test: qemu's magic at work
qemu-aarch64 stockfish compiler
qemu-aarch64 stockfish bench

# armv7 static build with musl libc
make clean
make -j build ARCH=armv7 COMP=clang CXX="zig c++ -target arm-linux-musleabihf"

# test: qemu's magic at work
qemu-arm stockfish compiler
qemu-arm stockfish bench

```
</details>

Here is a script to cross compile from a msys2 msys/mingw-w64 shell a static build of Stockfish targeting an armv8 or armv7 CPU running on Linux or Android:

<details><summary>Click to view</summary>

```bash
# Use msys2 to cross compile
# a static build for armv8 and armv7 on Linux/Android

# one time configuration
pacman -S --noconfirm --needed git make unzip
wget https://ziglang.org/builds/zig-windows-x86_64-0.14.0-dev.2546+0ff0bdb4a.zip

unzip zig-windows-x86_64-0.14.0-dev.2546+0ff0bdb4a.zip
export PATH="$(pwd)/zig-windows-x86_64-0.14.0-dev.2546+0ff0bdb4a:$PATH"

# armv8 static build with musl libc
git clone https://github.com/official-stockfish/Stockfish.git
cd Stockfish/src
make -j build ARCH=armv8 COMP=clang CXX="zig c++ -target aarch64-linux-musl"
mv stockfish.exe stockfish_armv8
```
</details>

---

## Lower compilation time

It is possible to lower the compile time on cpu multi core using make with the flag *-j \<n_jobs\>*, where \<n_jobs\> is the number of jobs (commands) to run simultaneously. The flag *-j* enables one job for each logical CPU core. 

```bash
make -j <n_jobs> profile-build ARCH=x86-64-avx2 COMP=mingw
```

---

## Optimize for your CPU

To get the max speedup for your CPU (1.5% on Ivy Bridge) simply prepend the shell variable `CXXFLAGS='-march=native'` to the `make` command. At example, for a CPU Sandy/Ivy Bridge use this command:

```bash
CXXFLAGS='-march=native' make -j profile-build ARCH=x86-64-avx2 COMP=gcc
```

To view the compiler flags for your CPU: 

```
# for gcc
gcc -Q -march=native --help=target | grep -v "\[disabled\]"

# for clang
clang -E - -march=native -###
```

*-march=native* implies *-mtune=native*, below a high level explanation of the compiler flags *-march* and *-mtune*, view the [gcc manual](https://gcc.gnu.org/onlinedocs/gcc-5.3.0/gcc/x86-Options.html#x86-Options) for more technically sound details:

  * *-march*: determines what instruction sets are used in the binary. An instruction set is the list of commands implemented by the cpu. **The generated code may not run at all on processors other than the one indicated.**

  * *-mtune*: determines the cost model that is used when generating code. The cost model describes how long it takes the cpu to do operations. This information is used by the scheduler to decide what operations to use and in what order.
