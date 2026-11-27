import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, readdir, mkdir, cp, writeFile } from "fs/promises";
import { execSync } from "child_process";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildInstalledApp() {
  const publicDir = "dist/public";
  const installedDir = publicDir + "/pinned";
  const entries = await readdir(publicDir);
  const workerFiles = /^(?:sw\.js|phlogiston-sw\.js|workbox-.*\.js)$/;
  await mkdir(installedDir);
  for (const entry of entries) {
    if (entry !== "phlogiston.zip" && entry !== "images" && !workerFiles.test(entry)) {
      await cp(publicDir + "/" + entry, installedDir + "/" + entry, { recursive: true });
    }
  }
  const files = (await readdir(installedDir, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => (entry.parentPath + "/" + entry.name).slice(installedDir.length + 1));
  await writeFile(installedDir + "/shell.json", JSON.stringify(files));
  await cp("script/installed-worker.js", installedDir + "/phlogiston-sw.js");

  // Existing home-screen shortcuts may still point to the old install URL.
  const legacyDir = publicDir + "/installed";
  await mkdir(legacyDir);
  await cp("script/legacy-installed-worker.js", legacyDir + "/phlogiston-sw.js");
  await cp("script/installed-launcher.html", legacyDir + "/index.html");
}

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  // Relative base: the same build works on GitHub Pages and from the offline ZIP
  await viteBuild({ base: "./" });

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  console.log("creating offline zip archive...");
  try {
    execSync("rm -f dist/public/phlogiston.zip", { stdio: "inherit" });
    execSync("cd dist/public && zip -r phlogiston.zip ./*", { stdio: "inherit" });
    console.log("Offline archive created at dist/public/phlogiston.zip");
  } catch (e) {
    console.error("Failed to create zip archive", e);
  }

  await buildInstalledApp();
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
