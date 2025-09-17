#!/usr/bin/env node
const fs = require("node:fs");
const fsp = fs.promises;
const path = require("node:path");
const os = require("node:os");
const https = require("node:https");
const { spawnSync } = require("node:child_process");

async function main() {
  if (process.platform !== "linux" || process.arch !== "x64") {
    return;
  }

  const isMusl = (() => {
    if (!process.report || typeof process.report.getReport !== "function") {
      return false;
    }

    try {
      const report = process.report.getReport();
      return !report?.header?.glibcVersionRuntime;
    } catch (_error) {
      return false;
    }
  })();

  const variant = isMusl ? "linux-x64-musl" : "linux-x64-gnu";
  const moduleDir = path.join(process.cwd(), "node_modules", "@rollup", `rollup-${variant}`);

  if (fs.existsSync(moduleDir)) {
    return;
  }

  const rollupPackageJsonPath = path.join(process.cwd(), "node_modules", "rollup", "package.json");

  let rollupPackage;
  try {
    const packageContents = await fsp.readFile(rollupPackageJsonPath, "utf8");
    rollupPackage = JSON.parse(packageContents);
  } catch (error) {
    console.warn(
      `[rollup-binary] Skipping native binary installation because rollup is not available: ${error.message}`,
    );
    return;
  }

  const dependencyKey = `@rollup/rollup-${variant}`;
  const version = rollupPackage.optionalDependencies?.[dependencyKey] ?? rollupPackage.version;

  if (!version) {
    console.warn(`[rollup-binary] Could not determine a version for ${dependencyKey}.`);
    return;
  }

  console.log(`[rollup-binary] Installing ${dependencyKey}@${version}...`);

  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "rollup-binary-"));
  const tarballName = `rollup-${variant}-${version}.tgz`;
  const tarballPath = path.join(tmpDir, tarballName);
  const tarballUrl = `https://registry.npmjs.org/${encodeURIComponent(dependencyKey)}/-/${tarballName}`;

  await downloadToFile(tarballUrl, tarballPath);

  const extractResult = spawnSync("tar", ["-xzf", tarballPath, "-C", tmpDir], { stdio: "inherit" });

  if (extractResult.status !== 0) {
    throw new Error(`Failed to extract ${tarballPath}`);
  }

  const packageDir = path.join(tmpDir, "package");

  await fsp.mkdir(path.dirname(moduleDir), { recursive: true });
  await fsp.rm(moduleDir, { recursive: true, force: true });
  await fsp.cp(packageDir, moduleDir, { recursive: true });

  console.log(`[rollup-binary] Installed native binary to ${moduleDir}`);
}

async function downloadToFile(url, destination) {
  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);

    const handleResponse = (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        downloadToFile(response.headers.location, destination).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode ?? "unknown status"}`));
        return;
      }

      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
    };

    const request = https.get(url, handleResponse);

    request.on("error", (error) => {
      fs.unlink(destination, () => reject(error));
    });
  });
}

main().catch((error) => {
  console.error("[rollup-binary] Failed to install Rollup native binary:", error);
  process.exit(1);
});
