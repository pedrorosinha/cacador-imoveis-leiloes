export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAIXA_ORIGIN = "https://venda-imoveis.caixa.gov.br";

function unavailable(message: string, status: number) {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function extractPhoto(html: string): string | null {
  for (const [tag] of html.matchAll(/<img\b[^>]*>/gi)) {
    const match = tag.match(/\ssrc\s*=\s*(["'])(.*?)\1/i);
    if (!match) continue;

    try {
      const src = match[2].replace(/&amp;/gi, "&");
      const url = new URL(src, CAIXA_ORIGIN);

      if (
        url.origin === CAIXA_ORIGIN &&
        url.pathname.toLowerCase().startsWith("/fotos/")
      ) {
        return url.toString();
      }
    } catch {
      // Ignora endereços inválidos.
    }
  }

  return null;
}

async function loadPhoto(url: string): Promise<Response | null> {
  const response = await fetch(url, {
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) return null;

  const contentType = (
    response.headers.get("content-type") ?? ""
  )
    .split(";")[0]
    .trim()
    .toLowerCase();

  const allowedTypes = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
  ]);

  // Não devolve páginas HTML de erro como se fossem fotos.
  if (!allowedTypes.has(contentType)) return null;

  const declaredSize = Number(
    response.headers.get("content-length") ?? 0,
  );

  if (declaredSize > 5 * 1024 * 1024) return null;

  const image = await response.arrayBuffer();

  if (
    image.byteLength === 0 ||
    image.byteLength > 5 * 1024 * 1024
  ) {
    return null;
  }

  return new Response(image, {
    headers: {
      "Content-Type":
        contentType === "image/jpg" ? "image/jpeg" : contentType,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  const match = id?.match(/^caixa-(\d{6,16})$/);

  if (!match) {
    return unavailable("Identificador da CAIXA inválido.", 400);
  }

  const propertyNumber = match[1];

  // Padrão observado nos anúncios consultados.
  // A existência e o tipo da imagem são verificados pela requisição.
  const candidateUrl =
    `${CAIXA_ORIGIN}/fotos/F${propertyNumber}21.jpg`;

  try {
    const photo = await loadPhoto(candidateUrl);

    if (photo) {
      return photo;
    }
  } catch (error) {
    console.warn(
      `Foto direta indisponível para ${propertyNumber}; consultando anúncio.`,
      error,
    );
  }

  // Alternativa para anúncios que utilizem outro endereço de foto.
  try {
    const detailUrl = new URL(
      "/sistema/detalhe-imovel.asp",
      CAIXA_ORIGIN,
    );

    detailUrl.searchParams.set("hdnimovel", propertyNumber);

    const response = await fetch(detailUrl, {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return unavailable(
        "Não foi possível consultar o anúncio da CAIXA.",
        502,
      );
    }

    const bytes = await response.arrayBuffer();

    if (bytes.byteLength > 2 * 1024 * 1024) {
      return unavailable("Resposta do anúncio acima do limite.", 502);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const encoding = /charset\s*=\s*["']?utf-8/i.test(contentType)
      ? "utf-8"
      : "windows-1252";

    const html = new TextDecoder(encoding).decode(bytes);
    const photoUrl = extractPhoto(html);

    if (!photoUrl) {
      console.warn("Foto não localizada no HTML recebido:", {
        propertyNumber,
        finalUrl: response.url,
        title: html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
      });

      return unavailable(
        "Não foi possível localizar a foto no HTML retornado pela CAIXA.",
        404,
      );
    }

    const photo = await loadPhoto(photoUrl);

    if (photo) {
      return photo;
    }

    return unavailable(
      "O endereço encontrado não retornou uma imagem válida.",
      502,
    );
  } catch (error) {
    console.error("Falha ao carregar foto da CAIXA:", error);

    return unavailable(
      "Não foi possível carregar a foto neste momento.",
      502,
    );
  }
}