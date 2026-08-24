"use client";

import {
  Fragment,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  parseA2UISurfaceState,
  type A2UIComponent,
  type A2UISurfaceState,
} from "@fify/a2ui";

export interface A2UIInteractionEvent {
  type: string;
  source: string;
  payload?: unknown;
}

export interface RegisteredA2UIComponentProps<TContext> {
  component: A2UIComponent;
  surface: A2UISurfaceState;
  context: TContext;
  children: ReactNode;
  emit: (event: Omit<A2UIInteractionEvent, "source">) => void;
}

export type A2UIReactComponentRegistry<TContext> = Readonly<
  Record<string, ComponentType<RegisteredA2UIComponentProps<TContext>>>
>;

export interface A2UIRendererConfiguration<TContext> {
  catalogId: string;
  components: A2UIReactComponentRegistry<TContext>;
  validateComponent?: (component: A2UIComponent) => void;
  /** Rendered while a progressively streamed component reference has not arrived yet. */
  renderPendingComponent?: (componentId: string) => ReactNode;
}

export interface RegisteredA2UIRendererProps<TContext> {
  surface: A2UISurfaceState;
  context: TContext;
  onEvent?: (event: A2UIInteractionEvent) => void;
}

/**
 * Build a trusted React renderer for one application-owned A2UI catalog.
 * Protocol messages may choose registered component names and properties, but
 * only local React implementations can render or handle interactions.
 */
export function createA2UIRenderer<TContext>(
  configuration: A2UIRendererConfiguration<TContext>,
) {
  return function RegisteredA2UIRenderer({
    surface,
    context,
    onEvent,
  }: RegisteredA2UIRendererProps<TContext>): ReactElement {
    const parsed = parseA2UISurfaceState(surface);
    if (parsed.catalogId !== configuration.catalogId) {
      throw new Error(
        `A2UI surface catalog '${parsed.catalogId ?? "none"}' is not supported by this renderer.`,
      );
    }

    function pendingComponent(componentId: string): ReactElement {
      return (
        <Fragment key={componentId}>
          {configuration.renderPendingComponent?.(componentId) ?? null}
        </Fragment>
      );
    }

    function renderComponent(
      componentId: string,
      ancestors: ReadonlySet<string>,
    ): ReactElement {
      if (ancestors.has(componentId)) {
        throw new Error(
          `A2UI component tree contains a cycle at '${componentId}'.`,
        );
      }
      const component = parsed.components[componentId];
      if (!component) return pendingComponent(componentId);
      const Implementation = configuration.components[component.component];
      if (!Implementation) {
        throw new Error(
          `No trusted component is registered for A2UI type '${component.component}'.`,
        );
      }
      configuration.validateComponent?.(component);

      const childIds = Array.isArray(component.children)
        ? component.children.map((child) => {
            if (typeof child !== "string") {
              throw new Error(
                `A2UI component '${componentId}' contains a non-string child reference.`,
              );
            }
            return child;
          })
        : [];
      const nextAncestors = new Set(ancestors).add(componentId);
      const children = childIds.map((childId) =>
        renderComponent(childId, nextAncestors),
      );

      return (
        <Implementation
          key={componentId}
          component={component}
          surface={parsed}
          context={context}
          emit={(event) => onEvent?.({ ...event, source: componentId })}
        >
          {children}
        </Implementation>
      );
    }

    return parsed.components.root
      ? renderComponent("root", new Set())
      : pendingComponent("root");
  };
}
