/**
 * Liveness probe for the host's health check (Render: Health Check Path
 * /api/health). No data fetching, no rendering: answers while the process is up,
 * so a restarting instance is taken out of rotation instead of serving 502s.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("ok", { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
