"use client";

import { useState } from "react";
import Image from "next/image";
import { Building2 } from "lucide-react";

type PropertyPhotoProps = {
  id: string;
  source: string;
  description: string;
  position: number;
};

export default function PropertyPhoto({
  id,
  source,
  description,
  position,
}: PropertyPhotoProps) {
  const [failed, setFailed] = useState(false);

  const canLoad = source === "CAIXA" && /^caixa-\d+$/.test(id);

  return (
    <div className="property-visual">
      {canLoad && !failed ? (
        <Image
          src={`/api/property-photo?id=${encodeURIComponent(id)}`}
          alt={`Foto divulgada pela CAIXA: ${description}`}
          width={240}
          height={180}
          loading="lazy"
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="property-photo-empty">
          <Building2 size={28} strokeWidth={1.3} />

          <small>
            {canLoad ? "Foto indisponível" : "Foto não cadastrada"}
          </small>

          {canLoad && failed && (
            <button
              type="button"
              onClick={() => setFailed(false)}
              aria-label={`Tentar carregar foto de ${description}`}
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}

      <span>{String(position).padStart(2, "0")}</span>
    </div>
  );
}