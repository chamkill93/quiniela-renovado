import { getDeploymentVersion } from "@/lib/deployment-version";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return Response.json(
    { version: await getDeploymentVersion() },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } },
  );
}
