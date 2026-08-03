import asyncio
import os
import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class EngineConfig:
    name: str
    path: str
    priority: int = 1
    enabled: bool = True
    options: dict = field(default_factory=dict)
    skill_level: Optional[int] = None
    uci_elo: Optional[int] = None
    nodes_limit: Optional[int] = None
    depth_cap: Optional[int] = None


class EngineProcess:
    def __init__(self, config: EngineConfig, broadcast):
        self.config = config
        self.broadcast = broadcast
        self.proc: Optional[asyncio.subprocess.Process] = None
        self.alive = False
        self.busy = False
        self.last_bestmove: Optional[str] = None
        self.last_eval: Optional[float] = None
        self.started_at: Optional[float] = None
        self._reader_task: Optional[asyncio.Task] = None
        self._watchdog_task: Optional[asyncio.Task] = None
        self._write_lock = asyncio.Lock()
        self._stopping = False

    async def start(self):
        if not os.path.isfile(self.config.path):
            await self._emit("error", f"engine binary not found: {self.config.path}")
            return False
        try:
            self.proc = await asyncio.create_subprocess_exec(
                self.config.path,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
        except Exception as e:
            await self._emit("error", f"failed to spawn: {e}")
            return False
        self.alive = True
        self.started_at = time.time()
        self._stopping = False
        self._reader_task = asyncio.create_task(self._read_loop())
        self._watchdog_task = asyncio.create_task(self._watchdog())
        await self.send("uci")
        await asyncio.sleep(0.2)
        await self._apply_options()
        await self.send("isready")
        return True

    async def _apply_options(self):
        opts = dict(self.config.options)
        if self.config.skill_level is not None:
            opts["Skill Level"] = self.config.skill_level
        if self.config.uci_elo is not None:
            opts["UCI_LimitStrength"] = "true"
            opts["UCI_Elo"] = self.config.uci_elo
        for k, v in opts.items():
            await self.send(f"setoption name {k} value {v}")

    async def send(self, cmd: str):
        if not self.proc or self.proc.stdin is None or self.proc.returncode is not None:
            return
        async with self._write_lock:
            try:
                self.proc.stdin.write((cmd + "\n").encode())
                await self.proc.stdin.drain()
                if cmd.startswith("go"):
                    self.busy = True
            except (BrokenPipeError, ConnectionResetError):
                self.alive = False

    async def stop_analysis(self):
        await self.send("stop")

    async def quit(self):
        self._stopping = True
        await self.send("quit")
        try:
            if self.proc:
                await asyncio.wait_for(self.proc.wait(), timeout=2)
        except asyncio.TimeoutError:
            self.proc.kill()
        self.alive = False
        for t in (self._reader_task, self._watchdog_task):
            if t:
                t.cancel()

    async def _read_loop(self):
        try:
            while self.proc and self.proc.stdout:
                line = await self.proc.stdout.readline()
                if not line:
                    break
                text = line.decode(errors="replace").strip()
                if not text:
                    continue
                if text.startswith("bestmove"):
                    self.busy = False
                    parts = text.split()
                    if len(parts) >= 2:
                        self.last_bestmove = parts[1]
                if "score cp" in text:
                    try:
                        idx = text.index("score cp")
                        self.last_eval = int(text[idx:].split()[2]) / 100.0
                    except (ValueError, IndexError):
                        pass
                await self.broadcast(self.config.name, text)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            await self._emit("error", f"reader crashed: {e}")
        finally:
            self.alive = False
            self.busy = False

    async def _watchdog(self):
        try:
            while not self._stopping:
                await asyncio.sleep(3)
                if self.proc and self.proc.returncode is not None:
                    self.alive = False
                    await self._emit("engine_died", "process exited, restarting in 2s")
                    await asyncio.sleep(2)
                    if not self._stopping:
                        await self.start()
                        await self._emit("engine_restarted", "ok")
                        return
        except asyncio.CancelledError:
            pass

    async def _emit(self, kind, message):
        await self.broadcast(self.config.name, None, extra={"type": kind, "message": message})

    def status(self):
        return {
            "name": self.config.name,
            "path": self.config.path,
            "priority": self.config.priority,
            "enabled": self.config.enabled,
            "alive": self.alive,
            "busy": self.busy,
            "last_bestmove": self.last_bestmove,
            "last_eval": self.last_eval,
            "uptime": (time.time() - self.started_at) if self.started_at else 0,
            "options": self.config.options,
            "skill_level": self.config.skill_level,
            "uci_elo": self.config.uci_elo,
        }


class EngineManager:
    def __init__(self, broadcast):
        self.engines: dict[str, EngineProcess] = {}
        self.broadcast = broadcast

    def load_from_config(self, entries: list[dict]):
        for e in entries:
            cfg = EngineConfig(
                name=e["name"],
                path=e["path"],
                priority=e.get("priority", 1),
                enabled=e.get("enabled", True),
                options=e.get("options", {}),
                skill_level=e.get("skill_level"),
                uci_elo=e.get("uci_elo"),
                nodes_limit=e.get("nodes_limit"),
                depth_cap=e.get("depth_cap"),
            )
            self.engines[cfg.name] = EngineProcess(cfg, self.broadcast)

    async def start_all(self):
        await asyncio.gather(*[
            eng.start() for eng in self.engines.values() if eng.config.enabled
        ])

    async def stop_all(self):
        await asyncio.gather(*[eng.quit() for eng in self.engines.values()])

    def get(self, name) -> Optional[EngineProcess]:
        return self.engines.get(name)

    def by_priority(self) -> list[EngineProcess]:
        """Engines that should actually receive analysis commands."""
        return sorted(
            [e for e in self.engines.values() if e.config.enabled],
            key=lambda e: e.config.priority,
        )

    def all_by_priority(self) -> list[EngineProcess]:
        """Every configured engine, including the disabled ones.

        Reporting only the enabled engines hid the rest from the dashboard, so
        there was no way to turn one on, and saving priorities rewrote the
        config from that partial list and dropped them for good.
        """
        return sorted(self.engines.values(), key=lambda e: e.config.priority)

    def status_list(self):
        return [e.status() for e in self.all_by_priority()]
