export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getCaixaFeed } from "@/lib/caixa";
import { readAnalyses } from "@/lib/db";
import type { Scenario } from "@/lib/properties";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const force = url.searchParams.get("refresh") === "1";

  try {
    const feed = await getCaixaFeed(force);

    let analyses: Record<string, Scenario> = {};
    let storage = true;
    let warning = feed.warning ?? "";

    try {
      const saved = await readAnalyses();

      // Preserva os outros registros no banco, mas só exibe análises CAIXA.
      analyses = Object.fromEntries(
        Object.entries(saved).filter(([id]) => id.startsWith("caixa-")),
      );
    } catch (error) {
      console.error("Erro ao carregar análises:", error);

      storage = false;
      warning = [warning, "Não foi possível carregar as análises salvas."]
        .filter(Boolean)
        .join(" ");
    }

    return Response.json(
      {
        properties: feed.properties,
        updatedAt: feed.updatedAt,
        stale: feed.stale,
        analyses,
        storage,
        warning,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar os imóveis.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
