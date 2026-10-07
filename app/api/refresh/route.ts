export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { parseCaixa } from "@/lib/properties";
import { readRecord, saveRecord } from "@/lib/db";
export async function POST(request: Request) {
  if (
    request.headers.get("origin") &&
    new URL(request.url).origin !== request.headers.get("origin")
  )
    return Response.json({ error: "Origem inválida" }, { status: 403 });
  try {
    const cached = await readRecord("caixa-feed");
    if (cached && Date.now() - new Date(cached.updatedAt).getTime() < 3600000)
      return Response.json({
        count: cached.value.properties.length,
        message: "Lista já consultada na última hora.",
      });
    const response = await fetch(
      "https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_RS.csv",
      { signal: AbortSignal.timeout(25000) },
    );
    if (!response.ok) throw Error("Fonte indisponível");
    const body = await response.arrayBuffer();
    if (body.byteLength > 8000000) throw Error("Lista excede o limite");
    const properties = parseCaixa(new TextDecoder("windows-1252").decode(body));
    if (properties.length === 0)
      throw Error("Nenhum imóvel de Porto Alegre na resposta.");
    await saveRecord("caixa-feed", { properties });
    return Response.json({
      count: properties.length,
      message: `${properties.length} imóveis da CAIXA atualizados.`,
    });
  } catch (e) {
    console.error(e);
    return Response.json(
      {
        error:
          "Não foi possível atualizar a CAIXA agora. A última lista continua disponível. Tente novamente mais tarde.",
      },
      { status: 502 },
    );
  }
}
