import esbuild from "esbuild";
import fs from "node:fs";

const watch = process.argv.includes("--watch");

const shared = {
  bundle: true,
  minify: true,
  target: "chrome110",
  logLevel: "info",
  legalComments: "none",
};

const builds = [
  {
    ...shared,
    entryPoints: ["js/app/index.js"],
    outfile: "dist/inject.js",
    format: "iife",
  },
  {
    ...shared,
    entryPoints: ["js/options/index.js"],
    outfile: "dist/options.js",
    format: "iife",
  },
];

async function run() {
  fs.mkdirSync("dist", { recursive: true });
  if (watch) {
    for (const cfg of builds) {
      const ctx = await esbuild.context(cfg);
      await ctx.watch();
    }
    console.log("watching…");
  } else {
    for (const cfg of builds) await esbuild.build(cfg);
    console.log("built dist/inject.js + dist/options.js");
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
