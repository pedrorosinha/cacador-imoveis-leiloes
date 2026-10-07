"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Radar,
  MapPin,
  SlidersHorizontal,
  RefreshCw,
  Building2,
  Search,
  Calculator,
  Database,
  LayoutGrid,
  FileCheck2,
  X,
  Info,
  Check,
  House,
  ExternalLink,
  Wallet,
  TrendingUp,
  ShieldQuestion,
} from "lucide-react";
import {
  type Property,
  type Scenario,
  type NumericField,
  calculate,
  prepareScenario,
  money,
  norm,
} from "@/lib/properties";
import PropertyPhoto from "@/components/PropertyPhoto";
const initial = [] as Property[];
const pct = (v: number) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
type PropertiesResponse = {
  properties: Property[];
  analyses: Record<string, Scenario>;
  storage: boolean;
  updatedAt: string | null;
  stale: boolean;
  warning?: string;
  error?: string;
};
export default function Home() {
  const [properties, setProperties] = useState<Property[]>(initial),
    [analyses, setAnalyses] = useState<Record<string, Scenario>>({}),
    [view, setView] = useState("radar"),
    [query, setQuery] = useState(""),
    [max, setMax] = useState(""),
    [bairro, setBairro] = useState(""),
    [source, setSource] = useState(""),
    [kind, setKind] = useState("Apartamento"),
    [roi, setRoi] = useState(""),
    [sort, setSort] = useState("price"),
    [busy, setBusy] = useState(true),
    [notice, setNotice] = useState(""),
    [storage, setStorage] = useState(false),
    [updated, setUpdated] = useState<string | null>(null),
    [selected, setSelected] = useState<Property | null>(null),
    [scenario, setScenario] = useState<Scenario | null>(null),
    [saving, setSaving] = useState(false),
    [pagination, setPagination] = useState({ key: "", limit: 18 });
  const [city, setCity] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();

    const endpoint =
      reloadKey === 0 ? "/api/properties" : "/api/properties?refresh=1";

    fetch(endpoint, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as PropertiesResponse;

        if (!response.ok) {
          throw new Error(
            data.error ?? "Não foi possível consultar os imóveis.",
          );
        }

        return data;
      })
      .then((data) => {
        if (controller.signal.aborted) return;

        setProperties(data.properties);
        setAnalyses(data.analyses);
        setStorage(data.storage);
        setUpdated(data.updatedAt);
        setNotice(data.warning ?? "");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        setNotice(
          error instanceof Error
            ? error.message
            : "Não foi possível consultar a CAIXA.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setBusy(false);
        }
      });

    return () => controller.abort();
  }, [reloadKey]);
  const filterKey = JSON.stringify([
    city,
    query,
    max,
    bairro,
    source,
    kind,
    roi,
    view,
  ]);
  const limit = pagination.key === filterKey ? pagination.limit : 18;
  useEffect(() => {
    if (!selected) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", close);
    };
  }, [selected]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: { registerTool: (t: unknown, o: unknown) => void };
      }
    ).modelContext;
    if (!context) return;
    const c = new AbortController();
    try {
      context.registerTool(
        {
          name: "filter_properties",
          title: "Filtrar imóveis",
          description: "Atualiza a busca visível por bairro ou endereço.",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"],
            additionalProperties: false,
          },
          execute: async (input: unknown) => {
            if (
              !input ||
              typeof input !== "object" ||
              !("query" in input) ||
              typeof input.query !== "string" ||
              input.query.length > 200
            )
              throw Error("Busca inválida");
            setQuery(input.query);
            setView("radar");
            await new Promise((r) => setTimeout(r, 0));
            return { query: input.query };
          },
        },
        { signal: c.signal },
      );
    } catch {}
    return () => c.abort();
  }, []);
  function refresh() {
    setBusy(true);
    setNotice("Consultando a lista oficial da CAIXA…");
    setReloadKey((value) => value + 1);
  }
  function open(p: Property) {
    setSelected(p);
    setScenario(prepareScenario(analyses[p.id], p));
  }
  async function save() {
    if (!selected || !scenario) return;
    const validation = calculate(scenario);
    if (!validation.valid) {
      setNotice("Preencha ou revise: " + validation.missing.join(", ") + ".");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, scenario }),
      });
      const d = (await r.json()) as { error?: string; message: string };
      if (!r.ok) throw Error(d.error);
      setAnalyses((a) => ({ ...a, [selected.id]: scenario }));
      setNotice("Análise salva. Ela já participa do ranking por retorno.");
      setSelected(null);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }
  const roiFor = (id: string): number | null => {
    const saved = analyses[id];
    if (!saved) return null;
    const result = calculate(saved);
    return result.valid ? result.roi : null;
  };
  const cities = [...new Set(properties.map((property) => property.city))].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );

  const cityProperties = properties.filter(
    (property) => !city || property.city === city,
  );

  const neighborhoods = [
    ...new Set(cityProperties.map((property) => property.neighborhood)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const results = properties
    .filter((p) => {
      const savedRoi = roiFor(p.id);
      return (
        (view !== "analyses" || Boolean(analyses[p.id])) &&
        (!kind || p.type === kind) &&
        (!source || p.source === source) &&
        (!bairro || p.neighborhood === bairro) &&
        (!max || p.price <= Number(max)) &&
        (!query ||
          norm(p.address + " " + p.neighborhood).includes(norm(query))) &&
        (!city || p.city === city) &&
        (!roi || (savedRoi !== null && savedRoi >= Number(roi)))
      );
    })
    .sort((a, b) => {
      if (sort === "roi") {
        const aRoi = roiFor(a.id),
          bRoi = roiFor(b.id);
        if (aRoi === null && bRoi === null) return a.price - b.price;
        if (aRoi === null) return 1;
        if (bRoi === null) return -1;
        return bRoi - aRoi;
      }
      if (sort === "discount")
        return (
          (b.appraisal ? 1 - b.price / b.appraisal : -1) -
          (a.appraisal ? 1 - a.price / a.appraisal : -1)
        );
      return a.price - b.price;
    });
  const ca = properties.filter((p) => p.source === "CAIXA");
  const sims = Object.values(analyses);
  const financial = scenario ? calculate(scenario) : null;
  function reset() {
    setQuery("");
    setMax("");
    setBairro("");
    setSource("");
    setKind("Apartamento");
    setRoi("");
  }
  const numeric = (key: NumericField, label: string, suffix = "R$") => {
    const value = scenario?.[key];
    const informed = typeof value === "number" && Number.isFinite(value);
    const isCost = !["buy", "sale", "months"].includes(key);
    return (
      <label className="field" key={key}>
        <span>{label}</span>
        <div className="number">
          <small>{suffix}</small>
          <input
            type="number"
            min={key === "buy" || key === "sale" ? "0.01" : "0"}
            max={
              suffix === "%" ? "100" : key === "months" ? "600" : "10000000000"
            }
            step={key === "months" ? "1" : "any"}
            placeholder="Não informado"
            value={informed ? value : ""}
            onChange={(event) => {
              const text = event.target.value;
              const parsed = text === "" ? null : Number(text);
              const next =
                parsed !== null && !Number.isFinite(parsed) ? null : parsed;
              setScenario((current) =>
                current ? { ...current, [key]: next } : current,
              );
            }}
          />
        </div>
        {isCost && (
          <small>
            {value === 0
              ? "Sem custo, conforme informado por você."
              : "Informe 0 somente se confirmou que não há esse custo."}
          </small>
        )}
      </label>
    );
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Garimpo início">
          <span className="brand-icon">
            <Radar size={26} />
          </span>
          <span>
            garimpo<span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="workspace">
          <span className="mini-label">SEU RADAR IMOBILIÁRIO</span>
          <div>
            <MapPin size={17} /> {city || "Todas as cidades do RS"} <span className="rs">RS</span>
          </div>
        </div>
        <nav aria-label="Navegação principal">
          <button
            className={view === "radar" ? "active" : ""}
            onClick={() => setView("radar")}
          >
            <LayoutGrid size={19} />
            Oportunidades
          </button>
          <button
            className={view === "analyses" ? "active" : ""}
            onClick={() => setView("analyses")}
          >
            <FileCheck2 size={19} />
            Minhas análises<span className="nav-count">{sims.length}</span>
          </button>
          <button
            className={view === "sources" ? "active" : ""}
            onClick={() => setView("sources")}
          >
            <Database size={19} />
            Fontes de dados
          </button>
        </nav>
        <div className="sidebar-tip">
          <ShieldQuestion size={24} />
          <h3>Preço baixo é só o começo.</h3>
          <p>
            Confira ocupação, edital, débitos e custos antes de fazer uma
            proposta.
          </p>
        </div>
        <div className="sidebar-bottom">
          <span className="avatar">PR</span>
          <div>
            Radar particular<small>{city || "Todas as cidades do RS"} · versão inicial</small>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">
            Seu radar <span>/</span> {city}
          </div>
          <span className="version">
            MVP <span>01</span>
          </span>
        </header>
        <main>
          <div className="heading">
            <div>
              <div className="eyebrow">{city}, RS</div>
              <h1>
                {view === "sources"
                  ? "De onde vêm os imóveis"
                  : view === "analyses"
                    ? "Minhas análises"
                    : "Oportunidades no radar"}
              </h1>
              <p>
                {view === "analyses"
                  ? "Seus cenários de compra e revenda, em um só lugar."
                  : "Encontre, compare e faça as contas antes de comprar."}
              </p>
            </div>
            <button className="primary" disabled={busy} onClick={refresh}>
              <RefreshCw size={17} className={busy ? "spin" : ""} />
              {busy ? "Consultando…" : "Atualizar CAIXA"}
            </button>
          </div>
          {notice && (
            <div className="notice" role="status">
              <Info size={18} />
              <span>{notice}</span>
              <button aria-label="Fechar aviso" onClick={() => setNotice("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {view === "sources" ? (
            <section className="sources">
              <article>
                <Database />

                <h2>CAIXA — Rio Grande do Sul</h2>

                <span className="pill green">Consulta dinâmica</span>

                <p>
                  {properties.length} imóveis disponíveis na última lista
                  carregada. A consulta automática utiliza um cache de uma hora.
                  O botão “Atualizar CAIXA” solicita uma nova consulta.
                </p>

                <p>
                  Lista gerada em:{" "}
                  {properties[0]?.sourceDate ?? "não informado"}.
                </p>

                <p>
                  Última consulta salva:{" "}
                  {updated
                    ? new Date(updated).toLocaleString("pt-BR")
                    : "nenhuma consulta concluída"}
                  .
                </p>

                <a
                  href="https://venda-imoveis.caixa.gov.br/sistema/download-lista.asp"
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir fonte oficial <ExternalLink size={15} />
                </a>
              </article>

              <article>
                <h2>Como os dados são carregados</h2>

                <p>
                  Os imóveis são consultados na lista oficial da CAIXA e
                  armazenados no SQLite local. Não existe uma lista fixa
                  incorporada à aplicação.
                </p>

                <p>
                  Quando a fonte está indisponível, o sistema utiliza a última
                  consulta salva e mostra um aviso. Na primeira consulta, é
                  necessário ter conexão com a fonte.
                </p>

                <p>
                  Preços, disponibilidade e condições devem ser conferidos no
                  anúncio. A avaliação divulgada não representa uma garantia de
                  revenda.
                </p>
              </article>
            </section>
          ) : (
            <>
              <section className="stats">
                <article>
                  <div>
                    <span>Imóveis na base</span>
                    <Building2 size={19} />
                  </div>
                  <strong>{properties.length}</strong>
                  <small>{ca.length} imóveis CAIXA no RS</small>
                </article>
                <article>
                  <div>
                    <span>Apartamentos</span>
                    <House size={19} />
                  </div>
                  <strong>
                    {properties.filter((p) => p.type === "Apartamento").length}
                  </strong>
                  <small>em {city || "Todas as cidades do RS"}</small>
                </article>
                <article>
                  <div>
                    <span>Menor preço filtrado</span>
                    <Wallet size={19} />
                  </div>
                  <strong>
                    {results.length
                      ? money(Math.min(...results.map((p) => p.price)))
                      : "—"}
                  </strong>
                  <small>Antes de taxas e outros custos</small>
                </article>
                <article className="stat-dark">
                  <div>
                    <span>Análises salvas</span>
                    <TrendingUp size={19} />
                  </div>
                  <strong>{sims.length.toString().padStart(2, "0")}</strong>
                  <small>Revenda e custos informados por você</small>
                </article>
              </section>
              <section className="filters" aria-label="Filtros">
                <div className="filter-title">
                  <SlidersHorizontal size={18} />
                  <b>Refine seu garimpo</b>
                  <button onClick={reset}>Limpar filtros</button>
                </div>
                <div className="filter-grid">
                  <label>
                    <span>CIDADE</span>

                    <select
                      value={city}
                      onChange={(event) => {
                        setCity(event.target.value);
                        setBairro("");
                      }}
                    >
                      <option value="">Todas as cidades do RS</option>

                      {cities.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>BUSCAR</span>
                    <div className="search-input">
                      <Search size={17} />
                      <input
                        placeholder="Bairro ou endereço"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                  </label>
                  <label>
                    <span>BAIRRO</span>

                    <select
                      value={bairro}
                      onChange={(event) => setBairro(event.target.value)}
                    >
                      <option value="">Todos os bairros</option>

                      {neighborhoods.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>PREÇO MÁXIMO</span>
                    <input
                      aria-label="Preço máximo"
                      type="number"
                      min="0"
                      placeholder="Sem limite (R$)"
                      value={max}
                      onChange={(e) => setMax(e.target.value)}
                    />
                  </label>
                  <label>
                    <span>TIPO</span>
                    <select
                      value={kind}
                      onChange={(e) => setKind(e.target.value)}
                    >
                      <option value="">Todos</option>
                      {[...new Set(properties.map((p) => p.type))]
                        .sort()
                        .map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                    </select>
                  </label>
                  <label>
                    <span>FONTE</span>
                    <select
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                    >
                      <option value="">Todas as fontes</option>
                      <option>CAIXA</option>
                    </select>
                  </label>
                </div>
              </section>
              <div className="list-toolbar">
                <div>
                  <h2>
                    {results.length}{" "}
                    {results.length === 1
                      ? "imóvel encontrado"
                      : "imóveis encontrados"}
                  </h2>
                  <span>
                    CAIXA · Lista gerada em{" "}
                    {ca[0]?.sourceDate ?? "não informado"}
                    {updated &&
                      ` · Consultada em ${new Date(updated).toLocaleString("pt-BR")}`}
                  </span>
                </div>
                <div className="sorting">
                  <label>
                    ROI mín. (%)
                    <input
                      type="number"
                      placeholder="Todos"
                      value={roi}
                      onChange={(e) => setRoi(e.target.value)}
                    />
                  </label>
                  <label className="sort">
                    Ordenar por
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="price">Menor preço</option>
                      <option value="discount">Desconto sobre avaliação</option>
                      <option value="roi">Maior ROI simulado</option>
                    </select>
                  </label>
                </div>
              </div>
              {busy && properties.length === 0 ? (
                <div className="empty" role="status">
                  <RefreshCw className="spin" size={28} />
                  <h2>Consultando a CAIXA…</h2>
                  <p>A primeira consulta pode levar alguns segundos.</p>
                </div>
              ) : results.length === 0 ? (
                <div className="empty">
                  <Search size={32} />
                  <h2>
                    {view === "analyses" && sims.length === 0
                      ? "Sua primeira análise começa no radar."
                      : "Nenhum imóvel com esses filtros."}
                  </h2>
                  <p>
                    {view === "analyses" && sims.length === 0
                      ? "Abra um imóvel, informe a revenda e os custos e salve sua simulação."
                      : "Tente ampliar o orçamento ou remover um filtro. ROI mínimo considera só análises salvas."}
                  </p>
                  <button
                    className="secondary"
                    onClick={() => {
                      reset();
                      setView("radar");
                    }}
                  >
                    Ver oportunidades
                  </button>
                </div>
              ) : (
                <div className="property-list">
                  {results.slice(0, limit).map((p, i) => {
                    const s = analyses[p.id];
                    const calculated = s ? calculate(s) : null;
                    const calc = calculated?.valid ? calculated : null;
                    const discount = p.appraisal
                      ? (1 - p.price / p.appraisal) * 100
                      : null;
                    return (
                      <article className="property" key={p.id}>
                        <PropertyPhoto
                          id={p.id}
                          source={p.source}
                          description={`${p.type} em ${p.neighborhood}, ${p.address}`}
                          position={i + 1}
                        />
                        <div className="property-info">
                          <div className="badges">
                            <span
                              className={
                                "source " + (p.source === "Zuk" ? "zuk" : "")
                              }
                            >
                              {p.source}
                            </span>
                            <span className="mode">{p.mode}</span>
                          </div>
                          <h3>
                            {p.type} em {p.neighborhood}
                          </h3>
                          <p>{p.address}</p>
                          <div className="specs">
                            <span>
                              {p.area
                                ? `${p.area.toLocaleString("pt-BR")} m² privativos`
                                : "Área não informada"}
                            </span>
                            {p.bedrooms && <span>{p.bedrooms} quartos</span>}
                            {p.parking && <span>{p.parking} vaga(s)</span>}
                          </div>
                          <span className="risk">
                            <ShieldQuestion size={13} />
                            {s?.occupied ?? "Ocupação não verificada"}
                            {p.date
                              ? ` · ${new Date(p.date + "T12:00:00").toLocaleDateString("pt-BR")}`
                              : ""}
                          </span>
                        </div>
                        <div className="property-price">
                          <small>Preço anunciado</small>
                          <strong>{money(p.price)}</strong>
                          {discount !== null ? (
                            <span className="discount">
                              {pct(discount)} sobre avaliação
                            </span>
                          ) : (
                            <span className="muted">
                              Avaliação não informada
                            </span>
                          )}
                          <small>
                            Avaliação: {p.appraisal ? money(p.appraisal) : "—"}
                          </small>
                        </div>
                        <div className="property-action">
                          {calc ? (
                            <div
                              className={
                                calc.profit >= 0
                                  ? "return positive"
                                  : "return negative"
                              }
                            >
                              <b>{pct(calc.roi)}</b>
                              <span>ROI simulado</span>
                            </div>
                          ) : (
                            <div className="no-analysis">
                              <span>
                                {s
                                  ? "Análise incompleta"
                                  : "Retorno a calcular"}
                              </span>
                              <small>Preencha revenda e despesas</small>
                            </div>
                          )}
                          <button className="analyze" onClick={() => open(p)}>
                            <Calculator size={16} />
                            {s ? "Ver análise" : "Analisar imóvel"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              {results.length > limit && (
                <button
                  className="load-more secondary"
                  onClick={() =>
                    setPagination({ key: filterKey, limit: limit + 18 })
                  }
                >
                  Mostrar mais {Math.min(18, results.length - limit)} imóveis
                </button>
              )}
              <div className="bottom-note">
                <Info size={16} />
                <p>
                  Preço de anúncio não inclui despesas. Desconto sobre avaliação
                  não equivale a lucro. Confirme a disponibilidade e as
                  condições na fonte.
                </p>
              </div>
            </>
          )}
        </main>
        <footer>
          <span>garimpo.</span> Uma decisão melhor começa com os números certos.
          <small>Porto Alegre / RS</small>
        </footer>
      </div>
      {selected && scenario && financial && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="analysis-title"
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                const nodes = Array.from(
                  e.currentTarget.querySelectorAll<HTMLElement>(
                    "button,a,input,select,textarea",
                  ),
                ).filter((n) => !n.hasAttribute("disabled"));
                const first = nodes[0],
                  last = nodes[nodes.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last?.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <header>
              <div>
                <div className="eyebrow">SIMULADOR DE COMPRA E REVENDA</div>
                <h2 id="analysis-title">
                  {selected.type} · {selected.neighborhood}
                </h2>
                <p>{selected.address}</p>
              </div>
              <button
                autoFocus
                aria-label="Fechar análise"
                onClick={() => setSelected(null)}
              >
                <X />
              </button>
            </header>
            <div className="modal-body">
              <div className="analysis-form">
                <div className="source-note">
                  <Info size={19} />
                  <p>
                    Preencha compra, revenda, prazo e cada despesa. Campo vazio
                    significa “não informado”. Informe zero somente quando
                    confirmar que não existe aquele custo. A avaliação da fonte
                    não é o valor de revenda.
                  </p>
                </div>
                <a
                  className="source-link"
                  href={selected.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {selected.source === "Zuk"
                    ? "Conferir na listagem da Zuk"
                    : "Abrir anúncio e documentos na CAIXA"}
                  <ExternalLink size={16} />
                </a>
                <h3>
                  01 <span>Compra e revenda</span>
                </h3>
                <div className="form-grid">
                  {numeric("buy", "Valor da compra")}
                  {numeric("sale", "Revenda estimada por você")}
                  {numeric("commission", "Comissão de compra", "%")}
                  {numeric("transfer", "ITBI / transferência", "%")}
                  {numeric("registry", "Registro e documentação")}
                  {numeric("broker", "Corretagem na revenda", "%")}
                </div>
                <h3>
                  02 <span>Custos do investimento</span>
                </h3>
                <div className="form-grid">
                  {numeric("renovation", "Reforma")}
                  {numeric("debts", "Débitos a assumir")}
                  {numeric("legal", "Desocupação / jurídico")}
                  {numeric("reserve", "Reserva para imprevistos")}
                  {numeric("monthly", "Custo mensal de manutenção")}
                  {numeric("months", "Prazo até revender", "meses")}
                  {numeric("tax", "Tributos na revenda (estimativa)")}
                </div>
                <h3>
                  03 <span>Conferências e observações</span>
                </h3>
                <label className="field">
                  Ocupação
                  <select
                    value={scenario.occupied}
                    onChange={(e) =>
                      setScenario({ ...scenario, occupied: e.target.value })
                    }
                  >
                    <option>Não verificada</option>
                    <option>Ocupado</option>
                    <option>Desocupado</option>
                  </select>
                </label>
                <label className="field">
                  Anotações e links de comparáveis
                  <textarea
                    rows={3}
                    maxLength={2000}
                    placeholder="Registre imóveis comparáveis e pendências do edital…"
                    value={scenario.notes}
                    onChange={(e) =>
                      setScenario({ ...scenario, notes: e.target.value })
                    }
                  />
                </label>
                <details>
                  <summary>Dados e limites desta análise</summary>
                  <p>{selected.description}</p>
                  <p>
                    Financiamento na fonte: {selected.financing}. Fonte de{" "}
                    {selected.sourceDate}. Área é privativa quando informada.
                    Datas de leilão da CAIXA devem ser consultadas no anúncio.
                  </p>
                  <p>
                    Lucro = revenda − despesas de venda − capital investido. ROI
                    = lucro ÷ capital investido. Não inclui custo de
                    financiamento ou oportunidade automaticamente; inclua-os nos
                    custos. Tributos são uma estimativa informada por você.
                  </p>
                </details>
              </div>
              <aside className="analysis-result">
                <Calculator size={25} />
                <h3>Seu cenário</h3>
                <p>Valores informados por você</p>
                <dl>
                  <div>
                    <dt>Compra</dt>
                    <dd>{money(scenario.buy)}</dd>
                  </div>
                  <div>
                    <dt>Custos de aquisição e manutenção</dt>
                    <dd>
                      {money(
                        financial.valid && scenario.buy !== null
                          ? financial.purchase - scenario.buy
                          : null,
                      )}
                    </dd>
                  </div>
                  <div className="total">
                    <dt>Capital investido</dt>
                    <dd>{money(financial.purchase)}</dd>
                  </div>
                  <div>
                    <dt>Revenda estimada</dt>
                    <dd>
                      {scenario.sale ? money(scenario.sale) : "A informar"}
                    </dd>
                  </div>
                  <div>
                    <dt>Despesas de venda</dt>
                    <dd>{money(financial.selling)}</dd>
                  </div>
                </dl>
                <div
                  className={
                    "profit " +
                    (financial.valid && financial.profit < 0 ? "loss" : "")
                  }
                >
                  <span>
                    {financial.valid ? "Lucro simulado" : "Análise incompleta"}
                  </span>
                  <strong>
                    {financial.valid ? money(financial.profit) : "—"}
                  </strong>
                  <span>
                    {financial.valid
                      ? `${pct(financial.roi)} de retorno sobre o capital`
                      : "Preencha todos os valores para calcular lucro e ROI"}
                  </span>
                  {!financial.valid && (
                    <p className="missing-fields">
                      Preencha ou revise: {financial.missing.join(", ")}.
                    </p>
                  )}
                  {financial.valid && (
                    <small>
                      Campos preenchidos não significam valores verificados. O
                      resultado depende das suas premissas.
                    </small>
                  )}
                </div>
                <div className="scenario-warning">
                  <ShieldQuestion size={17} />
                  <p>
                    Revise edital, ocupação, débitos e todas as despesas. O
                    resultado depende dessas premissas.
                  </p>
                </div>
                <button
                  className="primary"
                  disabled={saving || !financial.valid || !storage}
                  onClick={save}
                >
                  <Check size={17} />
                  {saving ? "Salvando…" : "Salvar análise"}
                </button>
                {!storage && (
                  <p>
                    Armazenamento indisponível. Aguarde a conexão para salvar.
                  </p>
                )}
                <small>
                  Somente análises completas entram no ranking por ROI.
                  Preenchimento não é validação dos valores.
                </small>
                {notice && <p role="status">{notice}</p>}
              </aside>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
