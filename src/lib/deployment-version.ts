import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** The Next.js build ID changes on every production build. */
export async function getDeploymentVersion() {
  try {
    const buildId = (await readFile(join(process.cwd(), ".next", "BUILD_ID"), "utf8")).trim();
    if (buildId) return buildId;
  } catch {
    // Development may not have a production BUILD_ID yet.
  }

  return process.env.DEPLOYMENT_VERSION?.trim() || "development";
}
