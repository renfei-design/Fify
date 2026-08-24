"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  BadgeDollarSign,
  BookOpen,
  CalendarDays,
  CarFront,
  Check,
  ChartNoAxesCombined,
  ChevronRight,
  CircleAlert,
  CircleUserRound,
  Clock3,
  Code2,
  Compass,
  ExternalLink,
  Info,
  Lightbulb,
  LoaderCircle,
  Map,
  MapPin,
  MessageSquareText,
  PiggyBank,
  Plus,
  RotateCcw,
  Route,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  WalletCards,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  decodeJsonLines,
  reduceA2UIMessage,
  type A2UIComponent,
} from "@fify/a2ui";
import {
  createA2UIRenderer,
  type RegisteredA2UIComponentProps,
} from "@fify/react";
import {
  informationUISurfaceFamilyForType,
  informationUIWebThemeStyle,
  representationPlanSchema,
  uiLanguageCatalogId,
  uiLanguageFixture,
  uiNodeSchema,
  uiScreenSchema,
  type UIExperience,
  type UIItem,
  type UINode,
} from "@fify/core";
import { Badge as ShadcnBadge } from "@/components/ui/badge";
import { Button as ShadcnButton, buttonVariants } from "@/components/ui/button";
import {
  Card as ShadcnCard,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input as ShadcnInput } from "@/components/ui/input";
import { Progress as ShadcnProgress } from "@/components/ui/progress";
import { Separator as ShadcnSeparator } from "@/components/ui/separator";
import { Skeleton as ShadcnSkeleton } from "@/components/ui/skeleton";
import { Textarea as ShadcnTextarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FifyMark } from "@/components/fify-mark";
import {
  parseUniversalGenerationStreamFrame,
  type UniversalGenerationActivity,
  type UniversalGenerationPhase,
  type UniversalGenerationStatus,
} from "../lib/universal-generation-stream";
import {
  emptyDurableConversationState,
  legacyUniversalConversationStorageKey,
  parseDurableConversationState,
  serializeDurableConversationState,
  universalConversationStorageKey,
  universalSessionKeyStorageKey,
  type DurableConversationState,
  type DurableConversationTurn,
  type UniversalRunRequest,
} from "../lib/universal-conversation-persistence";

const examples = [
  "Plan a focused 3-day trip in Shanghai.",
  "Who is Anthony Edwards in NBA today.",
  "Tell me about the weather in Beijing right now",
];

export interface RendererContext {
  checked: ReadonlySet<string>;
  selected: Readonly<Record<string, string>>;
  inputs: Readonly<Record<string, string>>;
  generating: boolean;
  runAction: (node: UINode, value?: string) => void;
  setInput: (id: string, value: string) => void;
  useSuggestion: (prompt: string) => void;
}

type NodeProps = RegisteredA2UIComponentProps<RendererContext>;

function readNode(component: A2UIComponent): UINode {
  const { component: _component, catalogId: _catalogId, ...node } = component;
  return uiNodeSchema.parse(node);
}

function nodeClasses(node: UINode, extra = "") {
  return cn(
    "gxui-node",
    `gxui-${node.type.toLowerCase()}`,
    `surface-family-${informationUISurfaceFamilyForType(node.type)}`,
    `importance-${node.importance}`,
    `relationship-${node.relationship}`,
    `media-${node.mediaRole}`,
    `align-${node.align}`,
    `gap-${node.gap}`,
    extra,
  );
}

const modelIconMap: Readonly<Record<string, LucideIcon>> = {
  alert: CircleAlert,
  book: BookOpen,
  calendar: CalendarDays,
  car: CarFront,
  chart: ChartNoAxesCombined,
  clock: Clock3,
  code: Code2,
  compass: Compass,
  electric: Zap,
  idea: Lightbulb,
  info: Info,
  location: MapPin,
  map: Map,
  money: BadgeDollarSign,
  route: Route,
  savings: PiggyBank,
  shield: ShieldCheck,
  sparkle: Sparkles,
  target: Target,
  time: Clock3,
  wallet: WalletCards,
  warning: CircleAlert,
  zap: Zap,
};

function ModelIcon({
  token,
  fallback: Fallback = Sparkles,
}: {
  token?: string;
  fallback?: LucideIcon;
}) {
  const value = token?.trim() ?? "";
  const key = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const Icon = modelIconMap[key];
  if (Icon) return <Icon aria-hidden="true" />;
  if (!value) return <Fallback aria-hidden="true" />;
  if (/\p{Extended_Pictographic}/u.test(value))
    return <span aria-hidden="true">{value}</span>;
  return (
    <span className="gxui-icon-monogram" aria-hidden="true">
      {value.slice(0, 2).toUpperCase()}
    </span>
  );
}

function badgeVariant(
  tone: UINode["tone"],
): "default" | "secondary" | "destructive" | "outline" {
  if (tone === "critical") return "destructive";
  if (tone === "neutral") return "outline";
  return tone === "accent" ? "default" : "secondary";
}

function buttonVariant(
  importance: UINode["importance"],
): "default" | "outline" | "ghost" {
  if (importance === "primary") return "default";
  if (importance === "quiet") return "ghost";
  return "outline";
}

function Heading({ node }: { node: UINode }) {
  if (!node.label && !node.title && !node.text) return null;
  return (
    <div className="gxui-heading">
      {node.label ? (
        <span className="gxui-heading-label">{node.label}</span>
      ) : null}
      {node.title ? <h2>{node.title}</h2> : null}
      {node.text ? <p>{node.text}</p> : null}
    </div>
  );
}

function ItemTone({ item, index }: { item: UIItem; index: number }) {
  const symbol = String(index + 1).padStart(2, "0");
  return <i className={`gxui-item-tone tone-${item.tone}`}>{symbol}</i>;
}

function Page({ component, surface, children }: NodeProps) {
  const node = readNode(component);
  const parsed = uiScreenSchema.safeParse(surface.dataModel.screen);
  const screen = parsed.success ? parsed.data : uiLanguageFixture.screen;
  const plan = representationPlanSchema.safeParse(
    surface.dataModel.representation,
  );
  return (
    <section
      className={cn(
        nodeClasses(node),
        plan.success && `scale-${plan.data.scale}`,
        plan.success && `topology-${plan.data.topology}`,
        plan.success && `blueprint-${plan.data.blueprintIds[0]}`,
      )}
      aria-label={screen.title}
      style={informationUIWebThemeStyle() as CSSProperties}
    >
      {children}
    </section>
  );
}

function Stack({ component, children }: NodeProps) {
  const node = readNode(component);
  return (
    <section className={nodeClasses(node)}>
      <Heading node={node} />
      {children}
    </section>
  );
}
function Row({ component, children }: NodeProps) {
  const node = readNode(component);
  return (
    <section
      className={nodeClasses(node)}
      style={{ "--gxui-align": node.align } as CSSProperties}
    >
      {children}
    </section>
  );
}
function Grid({ component, children }: NodeProps) {
  const node = readNode(component);
  return (
    <section
      className={nodeClasses(node)}
      style={{ "--gxui-columns": node.columns } as CSSProperties}
    >
      {children}
    </section>
  );
}
function Rail({ component, children }: NodeProps) {
  const node = readNode(component);
  return <section className={nodeClasses(node)}>{children}</section>;
}

function Card({ component, surface, children }: NodeProps) {
  const node = readNode(component);
  const plan = representationPlanSchema.safeParse(
    surface.dataModel.representation,
  );
  const pendingSlot = plan.success
    ? plan.data.slots.find((slot) => node.id === `pending-${slot.id}`)
    : null;
  if (
    pendingSlot &&
    !node.title &&
    !node.text &&
    !node.label &&
    node.children.length === 0
  )
    return null;
  return (
    <ShadcnCard className={nodeClasses(node)}>
      <CardHeader>
        <Heading node={node} />
        {node.value ? (
          <strong className="gxui-card-value">{node.value}</strong>
        ) : null}
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </ShadcnCard>
  );
}

function Hero({ component, children }: NodeProps) {
  const node = readNode(component);
  return (
    <header className={nodeClasses(node)}>
      <div className="gxui-hero-copy">
        {node.label ? <span>{node.label}</span> : null}
        <h2>{node.title}</h2>
        {node.text ? <p>{node.text}</p> : null}
      </div>
      {node.value ? (
        <div className="gxui-hero-mark">
          <span>{node.value}</span>
        </div>
      ) : null}
      {children ? <div className="gxui-hero-children">{children}</div> : null}
    </header>
  );
}

function trustedImageSrc(value: string) {
  if (value.startsWith("/api/media/image?")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "upload.wikimedia.org" ||
        url.hostname === "api.openverse.org")
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function safeExternalHref(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function ImageMedia({ component }: NodeProps) {
  const node = readNode(component);
  const src = trustedImageSrc(node.value);
  const credit = node.items[0];
  const sourceHref = safeExternalHref(credit?.detail ?? "");
  const [loadedSrc, setLoadedSrc] = useState("");
  const [failedSrc, setFailedSrc] = useState("");
  const ready = Boolean(src && loadedSrc === src && failedSrc !== src);
  const unavailable =
    node.meta === "Unavailable" || Boolean(src && failedSrc === src);

  if (unavailable) return null;

  return (
    <figure className={nodeClasses(node)}>
      <div className="gxui-image-frame">
        {src ? (
          <img
            src={src}
            alt={node.title}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoadedSrc(src)}
            onError={() => setFailedSrc(src)}
          />
        ) : null}
        {!ready ? (
          <div className="gxui-image-placeholder">
            <ShadcnSkeleton className="gxui-image-skeleton" />
            <span>
              <LoaderCircle aria-hidden="true" />
              Finding an openly licensed visual…
            </span>
          </div>
        ) : null}
        {ready ? (
          <div className="gxui-image-copy">
            <strong>{node.title}</strong>
            {node.text ? <p>{node.text}</p> : null}
          </div>
        ) : null}
      </div>
      {ready && credit ? (
        <figcaption>
          <span>
            Photo: {credit.label}
            {credit.value ? ` · ${credit.value}` : ""}
          </span>
          {sourceHref ? (
            <a href={sourceHref} target="_blank" rel="noreferrer">
              Source <ExternalLink aria-hidden="true" />
            </a>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

function Sources({ component }: NodeProps) {
  const node = readNode(component);
  const sourceTimestamp = node.meta.replace(/^As of\s+/i, "");
  const sourceDate = Date.parse(sourceTimestamp);
  const checkedLabel = Number.isFinite(sourceDate)
    ? `Checked ${new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(sourceDate))}`
    : node.meta;
  return (
    <aside className={nodeClasses(node)} aria-label={node.title || "Sources"}>
      <details>
        <summary className="gxui-sources-meta">
          <span>Sources</span>
          {checkedLabel ? <time>{checkedLabel}</time> : null}
          <ChevronRight aria-hidden="true" />
        </summary>
        <ol className="gxui-sources-list">
          {node.items.map((item, index) => {
            const href = safeExternalHref(item.detail);
            return (
              <li key={item.id}>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    title={`${item.label} — ${item.value}`}
                  >
                    <sup>{index + 1}</sup>
                    <span>{item.label}</span>
                  </a>
                ) : (
                  <span title={`${item.label} — ${item.value}`}>
                    <sup>{index + 1}</sup>
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </details>
    </aside>
  );
}

function SectionHeader({ component, children }: NodeProps) {
  const node = readNode(component);
  return (
    <section className={cn(nodeClasses(node), "gxui-section-group")}>
      <Heading node={node} />
      {children}
    </section>
  );
}
function Text({ component }: NodeProps) {
  const node = readNode(component);
  const Title = node.importance === "primary" ? "h2" : "h3";
  return (
    <div className={nodeClasses(node)}>
      {node.label ? <span>{node.label}</span> : null}
      {node.title ? <Title>{node.title}</Title> : null}
      <p>{node.text}</p>
      {node.meta ? <small>{node.meta}</small> : null}
    </div>
  );
}
function FactList({ component }: NodeProps) {
  const node = readNode(component);
  return (
    <section className={nodeClasses(node)}>
      <Heading node={node} />
      <dl className="gxui-factlist-flow">
        {node.items.map((item) => (
          <div className="gxui-fact-item" key={item.id}>
            <dt>{item.label}</dt>
            <dd>
              {item.detail}
              {item.value ? <small>{item.value}</small> : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
function safeSwatchColor(value: string) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim())
    ? value.trim()
    : "transparent";
}
function ColorPalette({ component }: NodeProps) {
  const node = readNode(component);
  return (
    <section className={nodeClasses(node)}>
      <Heading node={node} />
      <ul className="gxui-colorpalette-flow">
        {node.items.map((item) => (
          <li key={item.id}>
            <span
              className="gxui-color-swatch"
              style={{ backgroundColor: safeSwatchColor(item.value) }}
              aria-label={`${item.label}: ${item.value}`}
            />
            <div>
              <strong>{item.label}</strong>
              <code>{item.value.toUpperCase()}</code>
              {item.detail ? <p>{item.detail}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
function Badge({ component }: NodeProps) {
  const node = readNode(component);
  return (
    <ShadcnBadge
      className={nodeClasses(node)}
      variant={badgeVariant(node.tone)}
    >
      {node.icon ? <ModelIcon token={node.icon} /> : null}
      {node.label || node.value}
    </ShadcnBadge>
  );
}
function Metric({ component }: NodeProps) {
  const node = readNode(component);
  return (
    <article className={nodeClasses(node)}>
      <span className="gxui-metric-label">{node.label}</span>
      <strong className="gxui-metric-value">{node.value}</strong>
      {node.text ? <p>{node.text}</p> : null}
      {node.meta ? <small>{node.meta}</small> : null}
    </article>
  );
}

function Chart({ component }: NodeProps) {
  const node = readNode(component);
  const max = Math.max(...node.items.map((item) => item.progress ?? 0), 1);
  return (
    <figure className={nodeClasses(node)}>
      <Heading node={node} />
      <div className="gxui-chart-plot">
        {node.items.map((item) => (
          <article key={item.id}>
            <div className="gxui-chart-bar" aria-hidden="true">
              <i
                style={{
                  height: `${Math.max(8, ((item.progress ?? 0) / max) * 100)}%`,
                }}
              />
            </div>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </article>
        ))}
      </div>
    </figure>
  );
}

function Donut({ component }: NodeProps) {
  const node = readNode(component);
  return (
    <ShadcnCard className={nodeClasses(node)}>
      <CardContent className="gxui-donut-layout">
        <div
          className="gxui-donut-ring"
          role="progressbar"
          aria-label={node.label || node.title}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={node.progress ?? 0}
          style={
            { "--gxui-progress": `${node.progress ?? 0}%` } as CSSProperties
          }
        >
          <span>{node.value || `${node.progress ?? 0}%`}</span>
        </div>
        <div>
          <CardTitle>{node.title || node.label}</CardTitle>
          <CardDescription>{node.text}</CardDescription>
        </div>
      </CardContent>
    </ShadcnCard>
  );
}
function Timeline({ component }: NodeProps) {
  const node = readNode(component);
  return (
    <section className={nodeClasses(node)}>
      <Heading node={node} />
      <div className="gxui-timeline-flow">
        {node.items.map((item, index) => (
          <article key={item.id}>
            <time>{item.value || String(index + 1).padStart(2, "0")}</time>
            <i />
            <div>
              <strong>{item.label}</strong>
              <p>{item.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
function Comparison({ component, context }: NodeProps) {
  const node = readNode(component);
  const selectable = node.action.type === "select";
  return (
    <section className={nodeClasses(node)}>
      <Heading node={node} />
      <div
        className="gxui-comparison-flow"
        tabIndex={0}
        aria-label={
          node.title ? `${node.title} comparison options` : "Comparison options"
        }
      >
        {node.items.map((item) => {
          const selected = context.selected[node.id] === item.id;
          const content = (
            <>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.detail}</p>
              {selectable ? (
                <small>{selected ? "Selected" : "Select"}</small>
              ) : null}
            </>
          );
          return selectable ? (
            <ShadcnButton
              aria-pressed={selected}
              variant="outline"
              className={cn(
                "gxui-comparison-option",
                selected && "is-selected",
              )}
              onClick={() => context.runAction(node, item.id)}
              key={item.id}
            >
              {content}
            </ShadcnButton>
          ) : (
            <article className="gxui-comparison-option" key={item.id}>
              {content}
            </article>
          );
        })}
      </div>
    </section>
  );
}
function Checklist({ component, context }: NodeProps) {
  const node = readNode(component);
  return (
    <section className={nodeClasses(node)}>
      <Heading node={node} />
      <div className="gxui-checklist-flow">
        {node.items.map((item) => {
          const checked = context.checked.has(item.id);
          return (
            <ShadcnButton
              role="checkbox"
              aria-checked={checked}
              variant="outline"
              className={cn("gxui-check-item", checked && "is-checked")}
              key={item.id}
              onClick={() => context.runAction(node, item.id)}
            >
              <i className="gxui-check-icon">{checked ? <Check /> : null}</i>
              <span className="gxui-check-copy">
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
              {item.value ? (
                <ShadcnBadge variant="secondary">{item.value}</ShadcnBadge>
              ) : null}
            </ShadcnButton>
          );
        })}
      </div>
    </section>
  );
}
function Steps({ component }: NodeProps) {
  const node = readNode(component);
  return (
    <section className={nodeClasses(node)}>
      <Heading node={node} />
      <div className="gxui-steps-flow">
        {node.items.map((item, index) => (
          <article className="gxui-step" key={item.id}>
            <ItemTone item={item} index={index} />
            <div>
              <span>{item.value}</span>
              <strong>{item.label}</strong>
              <p>{item.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
function Table({ component }: NodeProps) {
  const node = readNode(component);
  return (
    <section className={nodeClasses(node)}>
      <Heading node={node} />
      <dl className="gxui-table-flow">
        {node.items.map((item) => (
          <div className="gxui-table-row" key={item.id}>
            <dt>
              {item.label}
              <small>{item.detail}</small>
            </dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Progress({ component }: NodeProps) {
  const node = readNode(component);
  const progress = node.progress ?? 0;
  return (
    <section className={nodeClasses(node)}>
      <div className="gxui-progress-head">
        <span>{node.label}</span>
        <strong>{node.value || `${progress}%`}</strong>
      </div>
      <ShadcnProgress
        className="mt-2"
        value={progress}
        aria-label={node.label || node.title || "Progress"}
      />
      {node.title ? <h3>{node.title}</h3> : null}
      {node.text ? <p>{node.text}</p> : null}
    </section>
  );
}
function Callout({ component }: NodeProps) {
  const node = readNode(component);
  return (
    <aside className={nodeClasses(node)}>
      <div>
        <h3>{node.title || node.label}</h3>
        <p>{node.text}</p>
        {node.value ? <b>{node.value}</b> : null}
      </div>
    </aside>
  );
}
function Quote({ component }: NodeProps) {
  const node = readNode(component);
  return (
    <figure className={nodeClasses(node)}>
      <blockquote>“{node.text || node.title}”</blockquote>
      <figcaption>
        {node.label}
        {node.meta ? ` · ${node.meta}` : ""}
      </figcaption>
    </figure>
  );
}
function Button({ component, context }: NodeProps) {
  const node = readNode(component);
  return (
    <ShadcnButton
      className={cn(nodeClasses(node), "gxui-action")}
      variant={buttonVariant(node.importance)}
      disabled={context.generating}
      onClick={() => context.runAction(node)}
    >
      <span>{node.label || node.title}</span>
      <ChevronRight />
    </ShadcnButton>
  );
}

function Input({ component, context }: NodeProps) {
  const node = readNode(component);
  return (
    <label className={cn(nodeClasses(node), "gxui-field")}>
      <span>{node.label || node.title}</span>
      <div className="gxui-input-wrap">
        {node.icon ? (
          <i>
            <ModelIcon token={node.icon} />
          </i>
        ) : null}
        <ShadcnInput
          inputMode={node.meta === "number" ? "decimal" : "text"}
          value={context.inputs[node.id] ?? ""}
          onChange={(event) => context.setInput(node.id, event.target.value)}
          placeholder={node.text || node.value}
        />
        {node.value ? <b>{node.value}</b> : null}
      </div>
      {node.meta && node.meta !== "number" ? <small>{node.meta}</small> : null}
    </label>
  );
}

function ChoiceGroup({ component, context }: NodeProps) {
  const node = readNode(component);
  return (
    <fieldset className={nodeClasses(node)}>
      <legend>{node.title || node.label}</legend>
      {node.text ? <p>{node.text}</p> : null}
      <div className="gxui-choice-options">
        {node.items.map((item) => {
          const selected = context.selected[node.id] === item.id;
          return (
            <ShadcnButton
              aria-pressed={selected}
              variant="outline"
              className={cn("gxui-choice-option", selected && "is-selected")}
              onClick={() => context.runAction(node, item.id)}
              key={item.id}
            >
              <span>{item.label}</span>
              {item.detail ? <small>{item.detail}</small> : null}
            </ShadcnButton>
          );
        })}
      </div>
    </fieldset>
  );
}
function Tabs({ component, context }: NodeProps) {
  const node = readNode(component);
  const selectedId = context.selected[node.id] ?? node.items[0]?.id;
  return (
    <div
      className={nodeClasses(node)}
      aria-label={node.label || node.title}
      role="group"
    >
      {node.items.map((item) => (
        <ShadcnButton
          aria-pressed={selectedId === item.id}
          variant="ghost"
          size="sm"
          className={selectedId === item.id ? "is-selected" : ""}
          onClick={() => context.runAction(node, item.id)}
          key={item.id}
        >
          {item.label}
          {item.value ? <small>{item.value}</small> : null}
        </ShadcnButton>
      ))}
    </div>
  );
}

function MapPanel({ component }: NodeProps) {
  const node = readNode(component);
  return (
    <section className={cn(nodeClasses(node), "gxui-map")}>
      <div className="gxui-map-grid" />
      <svg aria-hidden="true" viewBox="0 0 320 170">
        <path d="M-10 142 C55 115, 70 55, 128 76 S220 148, 342 24" />
      </svg>
      {node.items.map((item, index) => (
        <div
          className="gxui-map-pin"
          key={item.id}
          style={{
            left: `${12 + ((item.progress ?? index * 27) % 74)}%`,
            top: `${20 + ((index * 31) % 55)}%`,
          }}
        >
          <i>{index + 1}</i>
          <span>{item.label}</span>
        </div>
      ))}
      <Heading node={node} />
    </section>
  );
}
function Calendar({ component }: NodeProps) {
  const node = readNode(component);
  return (
    <section className={nodeClasses(node)}>
      <Heading node={node} />
      <div className="gxui-calendar-flow">
        {node.items.map((item, index) => (
          <article className={`tone-${item.tone}`} key={item.id}>
            <span>{item.value || `D${index + 1}`}</span>
            <strong>{item.label}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
function CodeBlock({ component }: NodeProps) {
  const node = readNode(component);
  return (
    <section className={cn(nodeClasses(node), "gxui-code")}>
      <header>
        <i />
        <i />
        <i />
        <span>{node.label || node.meta}</span>
      </header>
      <pre>
        <code>{node.text}</code>
      </pre>
    </section>
  );
}
function Visual({ component }: NodeProps) {
  const node = readNode(component);
  return (
    <figure className={nodeClasses(node)}>
      <div className="gxui-visual-canvas">
        <i />
        <i />
        <i />
        <strong>
          {node.icon ? <ModelIcon token={node.icon} /> : node.value || "∞"}
        </strong>
      </div>
      <figcaption>
        <span>{node.label}</span>
        <strong>{node.title}</strong>
        <p>{node.text}</p>
      </figcaption>
    </figure>
  );
}
function Divider({ component }: NodeProps) {
  const node = readNode(component);
  return (
    <div className={nodeClasses(node)}>
      <ShadcnSeparator />
      {node.label ? <span>{node.label}</span> : null}
      <ShadcnSeparator />
    </div>
  );
}
function Spacer({ component }: NodeProps) {
  return (
    <div className={nodeClasses(readNode(component))} aria-hidden="true" />
  );
}

export const UILanguageRenderer = createA2UIRenderer<RendererContext>({
  catalogId: uiLanguageCatalogId,
  components: {
    Page,
    Stack,
    Row,
    Grid,
    Rail,
    Card,
    Hero,
    Image: ImageMedia,
    SectionHeader,
    Text,
    FactList,
    Sources,
    ColorPalette,
    Badge,
    Metric,
    Chart,
    Donut,
    Timeline,
    Comparison,
    Checklist,
    Steps,
    Table,
    Progress,
    Callout,
    Quote,
    Button,
    Input,
    ChoiceGroup,
    Tabs,
    MapPanel,
    Calendar,
    CodeBlock,
    Visual,
    Divider,
    Spacer,
  },
  validateComponent: (component) => {
    readNode(component);
  },
  renderPendingComponent: (id) => (
    <span className="gxui-pending-inline" data-pending-id={id} aria-hidden>
      <ShadcnSkeleton />
    </span>
  ),
});

function duration(ms: number) {
  return ms < 1_000 ? `${Math.round(ms)}ms` : `${(ms / 1_000).toFixed(1)}s`;
}

function generationPhaseLabel(phase: UniversalGenerationPhase) {
  if (phase === "grounding") return "Checking current sources";
  if (phase === "routing") return "Choosing the answer structure";
  if (phase === "composing") return "Building the interface";
  if (phase === "validating") return "Checking the UI graph";
  if (phase === "repairing") return "Rechecking one section";
  if (phase === "media") return "Resolving visual sources";
  if (phase === "rendering") return "Committing the interface";
  return "Opening the response surface";
}

function generationProgressDetail(status: UniversalGenerationStatus | null) {
  if (
    status?.totalUnits &&
    status.completedUnits !== undefined &&
    status.unit === "regions"
  )
    return `${status.completedUnits} of ${status.totalUnits} regions visible`;
  return undefined;
}

function activityFromStatus(
  status: UniversalGenerationStatus,
): UniversalGenerationActivity {
  const detail = generationProgressDetail(status);
  return {
    type: "activity",
    id: `pipeline-${status.phase}`,
    phase: status.phase,
    label: generationPhaseLabel(status.phase),
    ...(detail ? { detail } : {}),
    state: status.state === "completed" ? "complete" : "active",
    source: "pipeline",
    elapsedMs: status.elapsedMs,
  };
}

function mergeGenerationActivity(
  current: readonly UniversalGenerationActivity[],
  incoming: UniversalGenerationActivity,
  fromStatus = false,
) {
  const next = current.map((activity) =>
    activity.state === "active" &&
    activity.id !== incoming.id &&
    fromStatus &&
    (activity.source === "pipeline" || activity.phase !== incoming.phase)
      ? { ...activity, state: "complete" as const }
      : activity,
  );
  const index = next.findIndex((activity) => activity.id === incoming.id);
  if (index >= 0) next[index] = incoming;
  else next.push(incoming);
  return next.slice(-12);
}

function completeGenerationActivities(
  activities: readonly UniversalGenerationActivity[],
) {
  return activities.map((activity) =>
    activity.state === "active"
      ? { ...activity, state: "complete" as const }
      : activity,
  );
}

export function GenerationActivity({
  id,
  activities,
  status,
  active,
  error,
  elapsedMs,
  silentMs = 0,
}: {
  id: string;
  activities: readonly UniversalGenerationActivity[];
  status: UniversalGenerationStatus | null;
  active: boolean;
  error?: string | null;
  elapsedMs: number;
  silentMs?: number;
}) {
  const [expanded, setExpanded] = useState(active || Boolean(error));
  useEffect(() => setExpanded(active || Boolean(error)), [active, error]);
  const visibleActivities =
    activities.length > 0
      ? activities.slice(-4)
      : status
        ? [activityFromStatus(status)]
        : [];
  const latest = [...visibleActivities]
    .reverse()
    .find((activity) => activity.state === "active");
  const headline = error
    ? "Generation stopped"
    : active
      ? (latest?.label ?? "Building the interface")
      : "Interface ready";
  const statusId = `${id}-generation-status`;
  const panelId = `${id}-generation-activity`;
  return (
    <section
      className={cn(
        "gxchat-activity",
        active && "is-active",
        expanded && "is-expanded",
      )}
    >
      <button
        type="button"
        className="gxchat-activity-toggle"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="gxchat-mark" aria-hidden>
          <FifyMark />
        </span>
        <span className="gxchat-activity-summary">
          <strong>Fify</strong>
          <span className="gxchat-activity-subline">
            {active ? (
              <LoaderCircle className="gxchat-activity-spinner" aria-hidden />
            ) : error ? (
              <CircleAlert className="gxchat-activity-error" aria-hidden />
            ) : null}
            <span className="gxchat-activity-headline">{headline}</span>
            {active && silentMs >= 4_000 ? (
              <small>
                Still working · {duration(silentMs)} since the last update
              </small>
            ) : null}
            <ChevronRight className="gxchat-activity-chevron" aria-hidden />
          </span>
        </span>
      </button>
      <span className="sr-only" id={statusId} role="status" aria-live="polite">
        {headline}
      </span>
      {expanded ? (
        <div className="gxchat-activity-trace" id={panelId}>
          <ol>
            {visibleActivities.map((activity) => (
              <li
                className={cn(
                  activity.state === "complete" ? "is-complete" : "is-active",
                  activity.source === "provider" && "is-provider",
                )}
                key={activity.id}
              >
                <i aria-hidden>
                  {activity.state === "complete" ? <Check /> : <span />}
                </i>
                <div>
                  <strong>{activity.label}</strong>
                  {activity.detail ? <p>{activity.detail}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

type ConversationTurn = DurableConversationTurn;

export function UniversalDemo() {
  const [conversationState, setConversationState] =
    useState<DurableConversationState>(emptyDurableConversationState);
  const activeConversation = conversationState.conversations.find(
    (conversation) =>
      conversation.id === conversationState.activeConversationId,
  );
  const turns = activeConversation?.turns ?? [];
  const [prompt, setPrompt] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const settingsDialogRef = useRef<HTMLDialogElement>(null);
  const settingsInputRef = useRef<HTMLInputElement>(null);
  const settingsOpenerRef = useRef<HTMLButtonElement | null>(null);
  const activeRuns = useRef(new Set<string>());

  useEffect(() => {
    void fetch("/api/ui", { cache: "no-store" })
      .then((response) => response.json())
      .then((value: { configured?: boolean }) =>
        setConfigured(Boolean(value.configured)),
      )
      .catch(() => setConfigured(false));
  }, []);
  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(universalConversationStorageKey) ??
        localStorage.getItem(legacyUniversalConversationStorageKey);
      if (saved)
        setConversationState(parseDurableConversationState(JSON.parse(saved)));
      setApiKey(sessionStorage.getItem(universalSessionKeyStorageKey) ?? "");
    } catch {
      localStorage.removeItem(universalConversationStorageKey);
      localStorage.removeItem(legacyUniversalConversationStorageKey);
    } finally {
      setHydrated(true);
    }
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const timeout = window.setTimeout(() => {
      localStorage.setItem(
        universalConversationStorageKey,
        serializeDurableConversationState(conversationState),
      );
      localStorage.removeItem(legacyUniversalConversationStorageKey);
    }, 80);
    return () => window.clearTimeout(timeout);
  }, [conversationState, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    if (apiKey) sessionStorage.setItem(universalSessionKeyStorageKey, apiKey);
    else sessionStorage.removeItem(universalSessionKeyStorageKey);
  }, [apiKey, hydrated]);
  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: generating ? "smooth" : "auto",
      block: "end",
    });
  }, [conversationState.activeConversationId, turns.length, generating]);
  useEffect(() => {
    if (!generating) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [generating]);

  function updateTurn(
    id: string,
    update: (turn: ConversationTurn) => ConversationTurn,
  ) {
    setConversationState((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) => {
        if (!conversation.turns.some((turn) => turn.id === id))
          return conversation;
        return {
          ...conversation,
          updatedAt: Date.now(),
          turns: conversation.turns.map((turn) =>
            turn.id === id ? update(turn) : turn,
          ),
        };
      }),
    }));
  }

  function focusComposer() {
    const composer =
      composerRef.current ??
      (document.getElementById("fify-composer") as HTMLTextAreaElement | null);
    composer?.focus();
    composer?.scrollIntoView({ block: "center" });
  }

  async function consumeRun(
    turnId: string,
    request: UniversalRunRequest,
    initialRunId: string,
    initialSequence = 0,
  ) {
    if (activeRuns.current.has(turnId)) return;
    activeRuns.current.add(turnId);
    setGenerating(true);
    let runId = initialRunId;
    let afterSequence = initialSequence;
    try {
      for (
        let reconnectAttempt = 0;
        reconnectAttempt < 3;
        reconnectAttempt += 1
      ) {
        try {
          const response = await fetch("/api/ui", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(apiKey.trim() ? { "x-openai-api-key": apiKey.trim() } : {}),
            },
            body: JSON.stringify({
              ...request,
              runId,
              afterSequence,
            }),
          });
          if (!response.ok || !response.body) {
            const failure = (await response.json().catch(() => ({}))) as {
              error?: string;
              code?: string;
            };
            if (response.status === 410 && failure.code === "RUN_EXPIRED") {
              const restartedAt = Date.now();
              const restartedProgress: UniversalGenerationStatus = {
                type: "status",
                phase: "accepted",
                elapsedMs: 0,
                state: "started",
              };
              runId = `run-${crypto.randomUUID()}`;
              afterSequence = 0;
              updateTurn(turnId, (turn) => ({
                ...turn,
                runId,
                lastSequence: 0,
                surface: null,
                experience: null,
                error: null,
                phase: "Restarting expired run",
                progress: restartedProgress,
                activities: [activityFromStatus(restartedProgress)],
                startedAt: restartedAt,
                lastActivityAt: restartedAt,
              }));
              continue;
            }
            throw new Error(
              failure.error ?? "The response surface could not be started.",
            );
          }
          let terminal = false;
          for await (const frame of decodeJsonLines(
            response.body,
            parseUniversalGenerationStreamFrame,
          )) {
            if (frame.runId !== runId || frame.sequence <= afterSequence)
              continue;
            afterSequence = frame.sequence;
            if (frame.type === "status") {
              const { runId: _runId, sequence: _sequence, ...progress } = frame;
              updateTurn(turnId, (turn) => ({
                ...turn,
                runId,
                lastSequence: frame.sequence,
                error: null,
                phase: generationPhaseLabel(frame.phase),
                progress,
                activities: mergeGenerationActivity(
                  turn.activities,
                  activityFromStatus(progress),
                  true,
                ),
                lastActivityAt: Date.now(),
              }));
            }
            if (frame.type === "activity") {
              const { runId: _runId, sequence: _sequence, ...activity } = frame;
              updateTurn(turnId, (turn) => ({
                ...turn,
                runId,
                lastSequence: frame.sequence,
                activities: mergeGenerationActivity(turn.activities, activity),
                lastActivityAt: Date.now(),
              }));
            }
            if (frame.type === "a2ui")
              updateTurn(turnId, (turn) => ({
                ...turn,
                runId,
                lastSequence: frame.sequence,
                surface:
                  reduceA2UIMessage(turn.surface, frame.message) ??
                  turn.surface,
                lastActivityAt: Date.now(),
              }));
            if (frame.type === "complete") {
              terminal = true;
              updateTurn(turnId, (turn) => ({
                ...turn,
                runId,
                lastSequence: frame.sequence,
                experience: frame.experience,
                meta: frame.meta,
                error: null,
                phase: "Interface ready",
                activities: completeGenerationActivities(turn.activities),
                lastActivityAt: Date.now(),
              }));
            }
            if (frame.type === "error") {
              terminal = true;
              updateTurn(turnId, (turn) => ({
                ...turn,
                runId,
                lastSequence: frame.sequence,
                error: frame.error,
                phase: "Generation stopped",
                activities: completeGenerationActivities(turn.activities),
                lastActivityAt: Date.now(),
              }));
            }
          }
          if (terminal) return;
          throw new Error(
            "The interface stream disconnected before completion.",
          );
        } catch (error) {
          if (reconnectAttempt >= 2) throw error;
          updateTurn(turnId, (turn) => ({
            ...turn,
            error: null,
            phase: `Reconnecting · attempt ${reconnectAttempt + 2}`,
            activities: [
              ...completeGenerationActivities(turn.activities),
              {
                type: "activity" as const,
                id: `reconnect-${reconnectAttempt + 2}`,
                phase: turn.progress?.phase ?? "accepted",
                label: `Reconnecting to generation`,
                detail: `Attempt ${reconnectAttempt + 2} of 3. Generated UI stays in place.`,
                state: "active" as const,
                source: "pipeline" as const,
                elapsedMs: turn.progress?.elapsedMs ?? 0,
              },
            ].slice(-12),
            lastActivityAt: Date.now(),
          }));
          await new Promise((resolve) =>
            setTimeout(resolve, 250 * 2 ** reconnectAttempt),
          );
        }
      }
    } catch (caught) {
      updateTurn(turnId, (turn) => ({
        ...turn,
        error:
          caught instanceof Error
            ? caught.message
            : "Something interrupted generation.",
        phase: "Generation stopped",
        activities: completeGenerationActivities(turn.activities),
        lastActivityAt: Date.now(),
      }));
    } finally {
      activeRuns.current.delete(turnId);
      setGenerating(activeRuns.current.size > 0);
    }
  }

  useEffect(() => {
    if (!hydrated) return;
    const resumable = conversationState.conversations.flatMap((conversation) =>
      conversation.turns.filter(
        (turn) => turn.request && !turn.experience && !turn.error,
      ),
    );
    for (const turn of resumable)
      if (turn.request)
        void consumeRun(turn.id, turn.request, turn.runId, turn.lastSequence);
  }, [conversationState.conversations, hydrated]);

  async function generate(
    nextPrompt = prompt,
    sourceExperience?: UIExperience | null,
    interfaceState?: {
      inputs: Readonly<Record<string, string>>;
      selections: Readonly<Record<string, string>>;
      toggles: string[];
    },
  ) {
    const clean = nextPrompt.trim();
    if (clean.length < 3 || generating) return;
    const id = `turn-${crypto.randomUUID()}`;
    const contextExperience =
      sourceExperience === undefined
        ? ([...turns].reverse().find((turn) => turn.prompt && turn.experience)
            ?.experience ?? null)
        : sourceExperience;
    const modelPrompt = interfaceState
      ? `${clean}\nCurrent interface state: ${JSON.stringify(interfaceState)}`
      : clean;
    const conversation = turns
      .flatMap((turn) => (turn.prompt ? [turn.prompt] : []))
      .slice(-4);
    const request: UniversalRunRequest = {
      prompt: modelPrompt,
      ...(contextExperience ? { currentExperience: contextExperience } : {}),
      conversation,
    };
    const runId = `run-${crypto.randomUUID()}`;
    const startedAt = Date.now();
    const initialProgress: UniversalGenerationStatus = {
      type: "status",
      phase: "accepted",
      elapsedMs: 0,
      state: "started",
    };
    const pending: ConversationTurn = {
      id,
      runId,
      lastSequence: 0,
      prompt: clean,
      request,
      surface: null,
      experience: null,
      phase: "Opening response surface",
      progress: initialProgress,
      activities: [activityFromStatus(initialProgress)],
      startedAt,
      lastActivityAt: startedAt,
      meta: null,
      error: null,
      checked: [],
      selected: {},
      inputs: {},
    };
    const conversationId =
      conversationState.activeConversationId ??
      `conversation-${crypto.randomUUID()}`;
    setConversationState((current) => {
      const existing = current.conversations.find(
        (conversation) => conversation.id === conversationId,
      );
      const updatedAt = Date.now();
      if (!existing)
        return {
          activeConversationId: conversationId,
          conversations: [
            ...current.conversations,
            {
              id: conversationId,
              title: clean,
              createdAt: updatedAt,
              updatedAt,
              turns: [pending],
            },
          ],
        };
      return {
        ...current,
        activeConversationId: conversationId,
        conversations: current.conversations.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                title:
                  conversation.turns.length === 0 ? clean : conversation.title,
                updatedAt,
                turns: [...conversation.turns, pending],
              }
            : conversation,
        ),
      };
    });
    setGenerating(true);
    setPrompt("");
    requestAnimationFrame(focusComposer);
    await consumeRun(id, request, runId);
  }

  function contextFor(turn: ConversationTurn): RendererContext {
    return {
      checked: new Set(turn.checked),
      selected: turn.selected,
      inputs: turn.inputs,
      generating: turn.phase !== "Interface ready" && !turn.error,
      setInput: (id, value) =>
        updateTurn(turn.id, (current) => ({
          ...current,
          inputs: { ...current.inputs, [id]: value },
        })),
      runAction: (node, value) => {
        const target = node.action.targetId || node.id;
        if (node.action.type === "prompt")
          void generate(node.action.prompt, turn.experience, {
            inputs: turn.inputs,
            selections: turn.selected,
            toggles: [...turn.checked],
          });
        else if (node.action.type === "toggle" || node.type === "Checklist")
          updateTurn(turn.id, (current) => {
            const key = value || target;
            const checked = new Set(current.checked);
            if (checked.has(key)) checked.delete(key);
            else checked.add(key);
            return { ...current, checked: [...checked] };
          });
        else if (
          node.action.type === "select" ||
          node.type === "ChoiceGroup" ||
          node.type === "Tabs" ||
          node.type === "Comparison"
        )
          updateTurn(turn.id, (current) => ({
            ...current,
            selected: {
              ...current.selected,
              [target]: value || node.action.value,
            },
          }));
      },
      useSuggestion: (suggestion) => {
        void generate(suggestion, turn.experience);
      },
    };
  }

  function startNewConversation() {
    if (!generating) {
      const id = `conversation-${crypto.randomUUID()}`;
      const createdAt = Date.now();
      setConversationState((current) => ({
        activeConversationId: id,
        conversations: [
          ...current.conversations,
          {
            id,
            title: "New conversation",
            createdAt,
            updatedAt: createdAt,
            turns: [],
          },
        ].slice(-12),
      }));
      setPrompt("");
      requestAnimationFrame(focusComposer);
    }
  }

  function openConversation(id: string) {
    setConversationState((current) => ({
      ...current,
      activeConversationId: id,
    }));
    setPrompt("");
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      focusComposer();
    });
  }

  function openSettings(opener: HTMLButtonElement) {
    settingsOpenerRef.current = opener;
    setApiKeyDraft(apiKey);
    settingsDialogRef.current?.showModal();
    requestAnimationFrame(() => settingsInputRef.current?.focus());
  }

  function closeSettings() {
    settingsDialogRef.current?.close();
  }

  function saveApiKey() {
    const nextApiKey = apiKeyDraft.trim();
    if (!nextApiKey) return;
    setApiKey(nextApiKey);
    closeSettings();
  }

  function removeApiKey() {
    setApiKey("");
    setApiKeyDraft("");
    closeSettings();
  }

  const connectionLabel = apiKey
    ? "Personal key saved"
    : configured === true
      ? "Using server key"
      : configured === null
        ? "Checking connection"
        : "API key required";

  return (
    <div className="shadcn-theme gxchat-shell">
      <a
        className="gxchat-skip-link"
        href="#fify-composer"
        onClick={(event) => {
          event.preventDefault();
          focusComposer();
        }}
      >
        Skip to message composer
      </a>
      <aside className="gxchat-sidebar">
        <button
          type="button"
          className="gxchat-brand"
          onClick={startNewConversation}
          disabled={generating}
          aria-label="Fify home"
        >
          <span className="gxchat-mark">
            <FifyMark />
          </span>
          <span>Fify</span>
        </button>
        <ShadcnButton
          className="gxchat-new"
          onClick={startNewConversation}
          disabled={generating}
        >
          <Plus />
          New conversation
        </ShadcnButton>
        <span className="gxchat-nav-label">Today</span>
        <nav className="gxchat-history" aria-label="Conversation history">
          {[...conversationState.conversations]
            .sort((left, right) => right.updatedAt - left.updatedAt)
            .map((conversation) => {
              const latestPrompt = conversation.turns.at(-1)?.prompt;
              const preview =
                latestPrompt && latestPrompt !== conversation.title
                  ? latestPrompt
                  : conversation.turns.length > 0
                    ? `${conversation.turns.length} interface${conversation.turns.length === 1 ? "" : "s"}`
                    : "Ready for a prompt";
              return (
                <ShadcnButton
                  className="gxchat-history-button"
                  variant={
                    conversation.id === conversationState.activeConversationId
                      ? "secondary"
                      : "ghost"
                  }
                  aria-current={
                    conversation.id === conversationState.activeConversationId
                      ? "page"
                      : undefined
                  }
                  onClick={() => openConversation(conversation.id)}
                  key={conversation.id}
                >
                  <MessageSquareText />
                  <span className="gxchat-history-copy">
                    <strong>{conversation.title}</strong>
                    <small>{preview}</small>
                  </span>
                </ShadcnButton>
              );
            })}
        </nav>
        <div className="gxchat-spacer" />
        <button
          type="button"
          className="gxchat-settings"
          onClick={(event) => openSettings(event.currentTarget)}
        >
          <span className="gxchat-settings-icon">
            <Settings2 />
          </span>
          <span className="gxchat-settings-copy">
            <strong>Settings</strong>
            <small>{connectionLabel}</small>
          </span>
          <i
            className={cn(
              "gxchat-settings-status",
              (apiKey || configured === true) && "is-connected",
            )}
            aria-hidden="true"
          />
        </button>
        <div className="gxchat-profile">
          <span className="gxchat-avatar">
            <CircleUserRound />
          </span>
          <span>
            <strong>Local workspace</strong>
            <small>UX created with shadcn/ui</small>
          </span>
        </div>
      </aside>

      <main className="gxchat-main">
        <h1 className="sr-only">Fify browser chat</h1>
        <header className="gxchat-topbar">
          <div className="gxchat-topbar-title">Fify browser chat</div>
          <div className="gxchat-topbar-actions">
            <ShadcnBadge className="gxchat-trust" variant="outline">
              <ShieldCheck />
              <span>Catalog-constrained interface</span>
            </ShadcnBadge>
            <ShadcnButton
              className="gxchat-mobile-settings"
              size="icon-sm"
              variant="ghost"
              aria-label="Open settings"
              onClick={(event) => openSettings(event.currentTarget)}
            >
              <Settings2 />
            </ShadcnButton>
          </div>
        </header>
        <section className="gxchat-thread" aria-label="Conversation">
          {turns.length === 0 ? (
            <div className="gxchat-intro">
              <span className="gxchat-mark">
                <FifyMark />
              </span>
              <h2>
                Ask in words.
                <br />
                <span>Get an interface.</span>
              </h2>
              <p>
                The assistant answers with composed, interactive UI—streamed
                into the conversation as it thinks.
              </p>
              <div className="gxchat-entry-paths" aria-label="Ways to use Fify">
                <article>
                  <strong>Browser chat</strong>
                  <span>
                    Manage your API key in Settings, then ask your first
                    question.
                  </span>
                </article>
                <article>
                  <strong>Codex integration</strong>
                  <span>
                    Install Fify once, then ask normally or tag @Fify.
                  </span>
                </article>
              </div>
              <div className="gxchat-examples">
                {examples.slice(0, 3).map((example) => (
                  <ShadcnButton
                    size="sm"
                    variant="outline"
                    disabled={
                      generating || (configured === false && !apiKey.trim())
                    }
                    onClick={() => void generate(example)}
                    key={example}
                  >
                    {example}
                    <ArrowUpRight />
                  </ShadcnButton>
                ))}
              </div>
            </div>
          ) : null}
          {turns.map((turn) => {
            const active = turn.phase !== "Interface ready" && !turn.error;
            const elapsedMs = turn.meta
              ? turn.meta.latencyMs
              : Math.max(
                  turn.progress?.elapsedMs ?? 0,
                  active ? now - turn.startedAt : 0,
                );
            return (
              <article className="gxchat-turn" key={turn.id} aria-busy={active}>
                {turn.prompt ? (
                  <div className="gxchat-user">
                    <span>You</span>
                    <p>{turn.prompt}</p>
                  </div>
                ) : null}
                <div>
                  <header className="gxchat-assistant-head">
                    {turn.activities.length > 0 ||
                    turn.progress ||
                    turn.meta ? (
                      <GenerationActivity
                        id={turn.id}
                        activities={turn.activities}
                        status={turn.progress}
                        active={active}
                        error={turn.error}
                        elapsedMs={elapsedMs}
                        silentMs={Math.max(0, now - turn.lastActivityAt)}
                      />
                    ) : (
                      <div className="gxchat-agent">
                        <span className="gxchat-mark">
                          <FifyMark />
                        </span>
                        <span>
                          <strong>Fify</strong>
                          <small>{turn.phase}</small>
                        </span>
                      </div>
                    )}
                    <div className="gxchat-stream-meta">
                      {active
                        ? "Building"
                        : turn.experience
                          ? "Ready"
                          : "UI response"}
                      <i
                        aria-hidden="true"
                        className={cn("gxchat-live-dot", active && "is-live")}
                      />
                    </div>
                  </header>
                  <div
                    className={cn("gxchat-ui-frame", active && "is-generating")}
                    aria-busy={active}
                  >
                    {turn.surface ? (
                      <UILanguageRenderer
                        surface={turn.surface}
                        context={contextFor(turn)}
                      />
                    ) : null}
                  </div>
                  {turn.error ? (
                    <div className="gxchat-error" role="alert">
                      <span>{turn.error}</span>
                      <ShadcnButton
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void generate(turn.prompt ?? "Try again")
                        }
                      >
                        <RotateCcw />
                        Try again
                      </ShadcnButton>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
          <div ref={endRef} />
        </section>

        <footer className="gxchat-composer-wrap">
          <div className="gxchat-composer">
            <ShadcnTextarea
              id="fify-composer"
              ref={composerRef}
              aria-label="Message Fify"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void generate();
                }
              }}
              placeholder={
                configured === false && !apiKey.trim()
                  ? "Add an API key in Settings to start…"
                  : "Ask Fify to design an answer…"
              }
              rows={1}
            />
            <ShadcnButton
              size="icon"
              aria-label="Send message"
              disabled={
                generating ||
                prompt.trim().length < 3 ||
                (configured === false && !apiKey.trim())
              }
              onClick={() => void generate()}
            >
              {generating ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <ArrowUp />
              )}
            </ShadcnButton>
          </div>
          <small>
            Fify speaks through trusted UI components. Verify important
            information.
          </small>
        </footer>
      </main>

      <dialog
        ref={settingsDialogRef}
        className="gxchat-settings-dialog"
        aria-labelledby="api-settings-title"
        onClose={() => settingsOpenerRef.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeSettings();
        }}
      >
        <div className="gxchat-settings-panel">
          <header>
            <span className="gxchat-settings-dialog-icon">
              <Settings2 />
            </span>
            <div>
              <h2 id="api-settings-title">API key settings</h2>
              <p>Connect a model provider for browser chat.</p>
            </div>
            <ShadcnButton
              size="icon-sm"
              variant="ghost"
              aria-label="Close settings"
              onClick={closeSettings}
            >
              <span aria-hidden="true">×</span>
            </ShadcnButton>
          </header>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveApiKey();
            }}
          >
            <div className="gxchat-settings-field">
              <label htmlFor="universal-key">OpenAI API key</label>
              <small id="universal-key-description">
                Used only for browser chat generation.
              </small>
            </div>
            <ShadcnInput
              id="universal-key"
              ref={settingsInputRef}
              type="password"
              aria-describedby="universal-key-description"
              value={apiKeyDraft}
              onChange={(event) => setApiKeyDraft(event.target.value)}
              placeholder="sk-…"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="gxchat-settings-privacy">
              <ShieldCheck />
              <p>
                Your key is stored in this browser tab only and is cleared when
                the tab closes.
              </p>
            </div>
            <footer>
              {apiKey ? (
                <ShadcnButton
                  type="button"
                  variant="ghost"
                  onClick={removeApiKey}
                >
                  Remove key
                </ShadcnButton>
              ) : (
                <span />
              )}
              <div>
                <ShadcnButton
                  type="button"
                  variant="outline"
                  onClick={closeSettings}
                >
                  Cancel
                </ShadcnButton>
                <ShadcnButton type="submit" disabled={!apiKeyDraft.trim()}>
                  Save key
                </ShadcnButton>
              </div>
            </footer>
          </form>
        </div>
      </dialog>
    </div>
  );
}
