"use client";

import { useEffect, useId, useRef } from "react";
import {
  easeCubicOut,
  geoNaturalEarth1,
  geoPath,
  pointer,
  scaleSqrt,
  select,
  zoom,
  zoomIdentity,
  type D3ZoomEvent,
  type ZoomBehavior,
  type ZoomTransform,
} from "d3";
import {
  getOriginMapFeatureName,
  getOriginMapPoint,
  originMapCountries,
} from "@/data/origin-map";
import type { OriginMapEntry } from "@/types/stats";

interface OriginMapProps {
  entries: OriginMapEntry[];
  selectedCountry: string | null;
  onSelect: (entry: OriginMapEntry) => void;
  labels: {
    zoomIn: string;
    zoomOut: string;
    reset: string;
    modifierHint: string;
    description: string;
  };
}

interface PlottedOrigin {
  entry: OriginMapEntry;
  featureName: string | null;
  point: [number, number];
  radius: number;
}

interface ZoomApi {
  changeBy: (factor: number) => void;
  reset: () => void;
}

interface TouchGesture {
  anchor: [number, number];
  initialDistance: number;
  initialScale: number;
}

type ZoomableSvg = SVGSVGElement & { __zoom?: ZoomTransform };
type MapExtent = [[number, number], [number, number]];

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.24;
const ZOOM_DURATION_MS = 290;
const WHEEL_ZOOM_DURATION_MS = 160;
const HIT_RADIUS = 22;

function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

function touchDistance(first: Touch, second: Touch): number {
  return Math.hypot(
    second.clientX - first.clientX,
    second.clientY - first.clientY
  );
}

function setMarkerSelection(svg: SVGSVGElement, selectedCountry: string | null) {
  svg
    .querySelectorAll<SVGCircleElement>("[data-origin-country]")
    .forEach((marker) => {
      const selected = marker.dataset.originCountry === selectedCountry;
      marker.setAttribute("fill-opacity", selected ? "1" : "0.88");
      marker.setAttribute(
        "stroke",
        selected ? "var(--color-accent-light)" : "var(--color-surface)"
      );
      marker.setAttribute("stroke-width", selected ? "2.25" : "1.5");
    });
}

export function OriginMap({
  entries,
  selectedCountry,
  onSelect,
  labels,
}: OriginMapProps) {
  const hintId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomInRef = useRef<HTMLButtonElement>(null);
  const zoomOutRef = useRef<HTMLButtonElement>(null);
  const zoomResetRef = useRef<HTMLButtonElement>(null);
  const zoomApiRef = useRef<ZoomApi | null>(null);
  const onSelectRef = useRef(onSelect);
  const selectedCountryRef = useRef(selectedCountry);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    selectedCountryRef.current = selectedCountry;
    const svg = svgRef.current;
    if (svg) setMarkerSelection(svg, selectedCountry);
  }, [selectedCountry]);

  useEffect(() => {
    const containerNode = containerRef.current;
    const svgNode = svgRef.current;
    if (!containerNode || !svgNode) return;
    const container: HTMLDivElement = containerNode;
    const svg: SVGSVGElement = svgNode;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const svgSelection = select<SVGSVGElement, unknown>(svg);
    let reducedMotion = reduceMotion.matches;
    let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | null = null;
    let currentZoom = zoomIdentity;
    let projection: ReturnType<typeof geoNaturalEarth1> | null = null;
    let plottedOrigins: PlottedOrigin[] = [];
    let mapLayer = svgSelection.append("g");
    let markerSelection = mapLayer
      .selectAll<SVGCircleElement, PlottedOrigin>("circle");
    let width = 320;
    let height = 320;
    let viewport: MapExtent = [[0, 0], [width, height]];
    let translateBounds: MapExtent = [[-24, -24], [width + 24, height + 24]];
    let hasRendered = false;
    let renderFrame: number | null = null;
    let resizeFrame: number | null = null;
    let wheelFrame: number | null = null;
    let wheelStartedAt = 0;
    let wheelFrom = currentZoom;
    let wheelTarget = currentZoom;
    let pendingZoom = currentZoom;
    let touchGesture: TouchGesture | null = null;

    function updateZoomControls() {
      const zoomOutButton = zoomOutRef.current;
      const zoomInButton = zoomInRef.current;
      const resetButton = zoomResetRef.current;
      if (!zoomOutButton || !zoomInButton || !resetButton) return;

      const atMinimum = currentZoom.k <= MIN_ZOOM + 0.01;
      zoomOutButton.disabled = atMinimum;
      zoomInButton.disabled = currentZoom.k >= MAX_ZOOM - 0.01;
      resetButton.hidden = atMinimum;
    }

    function paintZoom(transform: ZoomTransform) {
      mapLayer.attr("transform", transform.toString());
      markerSelection.attr(
        "r",
        (origin) => origin.radius / transform.k
      );
    }

    function scheduleZoomPaint(transform: ZoomTransform) {
      pendingZoom = transform;
      if (renderFrame !== null) return;

      renderFrame = window.requestAnimationFrame(() => {
        renderFrame = null;
        paintZoom(pendingZoom);
      });
    }

    function flushZoomPaint() {
      if (renderFrame !== null) {
        window.cancelAnimationFrame(renderFrame);
        renderFrame = null;
      }
      paintZoom(pendingZoom);
    }

    function stopWheelZoom() {
      if (wheelFrame !== null) {
        window.cancelAnimationFrame(wheelFrame);
        wheelFrame = null;
      }
      wheelFrom = currentZoom;
      wheelTarget = currentZoom;
    }

    function interpolateTransform(
      start: ZoomTransform,
      end: ZoomTransform,
      progress: number
    ): ZoomTransform {
      const eased = easeCubicOut(progress);
      return zoomIdentity
        .translate(
          start.x + (end.x - start.x) * eased,
          start.y + (end.y - start.y) * eased
        )
        .scale(start.k + (end.k - start.k) * eased);
    }

    function runWheelZoom(now: number) {
      const progress = Math.min(
        1,
        (now - wheelStartedAt) / WHEEL_ZOOM_DURATION_MS
      );
      currentZoom = interpolateTransform(wheelFrom, wheelTarget, progress);
      pendingZoom = currentZoom;
      (svg as ZoomableSvg).__zoom = currentZoom;
      paintZoom(currentZoom);

      if (progress < 1) {
        wheelFrame = window.requestAnimationFrame(runWheelZoom);
      } else {
        wheelFrame = null;
        currentZoom = wheelTarget;
        updateZoomControls();
      }
    }

    function handleWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;

      event.preventDefault();
      if (!zoomBehavior) return;

      svgSelection.interrupt();
      flushZoomPaint();
      const [anchorX, anchorY] = pointer(event, svg);
      const pixels = event.deltaY * (
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1
      );
      const exponent = Math.max(-0.12, Math.min(0.12, -pixels * 0.0015));
      const targetScale = clampZoom(wheelTarget.k * 2 ** exponent);
      if (Math.abs(targetScale - wheelTarget.k) < 0.0001) return;

      const mapAnchor = wheelTarget.invert([anchorX, anchorY]);
      const candidate = zoomIdentity
        .translate(anchorX, anchorY)
        .scale(targetScale)
        .translate(-mapAnchor[0], -mapAnchor[1]);
      wheelFrom = currentZoom;
      wheelTarget = zoomBehavior.constrain()(
        candidate,
        viewport,
        translateBounds
      );

      if (reducedMotion) {
        if (wheelFrame !== null) {
          window.cancelAnimationFrame(wheelFrame);
          wheelFrame = null;
        }
        currentZoom = wheelTarget;
        pendingZoom = currentZoom;
        (svg as ZoomableSvg).__zoom = currentZoom;
        paintZoom(currentZoom);
        wheelFrom = currentZoom;
        wheelTarget = currentZoom;
        updateZoomControls();
        return;
      }

      wheelStartedAt = performance.now();
      if (wheelFrame === null) {
        wheelFrame = window.requestAnimationFrame(runWheelZoom);
      }
    }

    function animateScale(targetScale: number) {
      if (!zoomBehavior) return;
      const target = clampZoom(targetScale);
      const center: [number, number] = [width / 2, height / 2];
      stopWheelZoom();
      svgSelection.interrupt();

      if (reducedMotion) {
        svgSelection.call(zoomBehavior.scaleTo, target, center);
        return;
      }

      svgSelection
        .transition()
        .duration(ZOOM_DURATION_MS)
        .ease(easeCubicOut)
        .call(zoomBehavior.scaleTo, target, center);
    }

    function resetZoom() {
      if (!zoomBehavior) return;
      stopWheelZoom();
      svgSelection.interrupt();

      if (reducedMotion) {
        svgSelection.call(zoomBehavior.transform, zoomIdentity);
        return;
      }

      svgSelection
        .transition()
        .duration(ZOOM_DURATION_MS)
        .ease(easeCubicOut)
        .call(zoomBehavior.transform, zoomIdentity);
    }

    function clientPoint(touch: Touch): [number, number] {
      const matrix = svg.getScreenCTM();
      if (matrix) {
        const point = new DOMPoint(touch.clientX, touch.clientY).matrixTransform(
          matrix.inverse()
        );
        return [point.x, point.y];
      }

      const bounds = svg.getBoundingClientRect();
      return [
        ((touch.clientX - bounds.left) / bounds.width) * width,
        ((touch.clientY - bounds.top) / bounds.height) * height,
      ];
    }

    function touchMidpoint(first: Touch, second: Touch): [number, number] {
      const firstPoint = clientPoint(first);
      const secondPoint = clientPoint(second);
      return [
        (firstPoint[0] + secondPoint[0]) / 2,
        (firstPoint[1] + secondPoint[1]) / 2,
      ];
    }

    function handleTouchStart(event: TouchEvent) {
      if (event.touches.length !== 2) return;
      const first = event.touches.item(0);
      const second = event.touches.item(1);
      if (!first || !second) return;

      event.preventDefault();
      stopWheelZoom();
      svgSelection.interrupt();
      flushZoomPaint();
      const midpoint = touchMidpoint(first, second);
      touchGesture = {
        anchor: currentZoom.invert(midpoint) as [number, number],
        initialDistance: Math.max(1, touchDistance(first, second)),
        initialScale: currentZoom.k,
      };
    }

    function handleTouchMove(event: TouchEvent) {
      if (!touchGesture || !zoomBehavior || event.touches.length !== 2) return;
      const first = event.touches.item(0);
      const second = event.touches.item(1);
      if (!first || !second) return;

      event.preventDefault();
      const midpoint = touchMidpoint(first, second);
      const scale = clampZoom(
        touchGesture.initialScale *
          (touchDistance(first, second) / touchGesture.initialDistance)
      );
      const rawTransform = zoomIdentity
        .translate(midpoint[0], midpoint[1])
        .scale(scale)
        .translate(-touchGesture.anchor[0], -touchGesture.anchor[1]);
      const constrained = zoomBehavior.constrain()(
        rawTransform,
        viewport,
        translateBounds
      );

      currentZoom = constrained;
      wheelFrom = currentZoom;
      wheelTarget = currentZoom;
      (svg as ZoomableSvg).__zoom = constrained;
      scheduleZoomPaint(constrained);
    }

    function handleTouchEnd(event: TouchEvent) {
      if (!touchGesture || event.touches.length >= 2) return;
      touchGesture = null;
      updateZoomControls();
    }

    function renderMap() {
      const bounds = container.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const nextWidth = Math.round(bounds.width * 100) / 100;
      const nextHeight = Math.round(bounds.height * 100) / 100;
      if (nextWidth === width && nextHeight === height && hasRendered) {
        return;
      }

      const previousZoom = currentZoom;
      const previousProjection = projection;
      const previousGeographicCenter =
        hasRendered && previousProjection?.invert
        ? previousProjection.invert(
            previousZoom.invert([width / 2, height / 2])
          )
        : null;
      stopWheelZoom();
      flushZoomPaint();
      width = nextWidth;
      height = nextHeight;
      touchGesture = null;

      svgSelection.interrupt();
      svgSelection.on(".zoom", null).on(".origin-map", null);
      svgSelection.selectAll("*").remove();
      svgSelection.attr("viewBox", `0 0 ${width} ${height}`);

      const nextProjection = geoNaturalEarth1().fitExtent(
        [[10, 10], [width - 10, height - 10]],
        { type: "Sphere" }
      );
      projection = nextProjection;
      const path = geoPath(nextProjection);
      const sourceOrigins = entries.flatMap((entry) => {
        if (entry.count <= 0) return [];
        const coordinates = getOriginMapPoint(entry);
        if (!coordinates) return [];
        const projected = nextProjection(coordinates);
        if (!projected || !projected.every(Number.isFinite)) return [];
        return [{ entry, featureName: getOriginMapFeatureName(entry), point: projected }];
      });
      const maximumCount = Math.max(
        1,
        ...sourceOrigins.map(({ entry }) => entry.count)
      );
      const radius = scaleSqrt()
        .domain([0, maximumCount])
        .range([4, width < 640 ? 14 : 18]);

      mapLayer = svgSelection
        .append("g")
        .attr("class", "origin-map-layer");
      mapLayer
        .append("g")
        .attr("aria-hidden", "true")
        .selectAll("path")
        .data(originMapCountries)
        .join("path")
        .attr("d", path)
        .attr("fill", "var(--color-brown-light)")
        .attr("fill-opacity", 0.78)
        .attr("stroke", "var(--color-surface)")
        .attr("stroke-width", 0.8)
        .attr("vector-effect", "non-scaling-stroke");

      plottedOrigins = sourceOrigins
        .map((origin) => ({
          ...origin,
          radius: radius(origin.entry.count),
        }))
        .sort((first, second) => second.entry.count - first.entry.count);

      markerSelection = mapLayer
        .append("g")
        .attr("aria-hidden", "true")
        .selectAll<SVGCircleElement, PlottedOrigin>("circle")
        .data(plottedOrigins, (origin) => origin.entry.nameEn)
        .join("circle")
        .attr("data-origin-country", (origin) => origin.entry.nameEn)
        .attr("data-origin-feature", (origin) => origin.featureName ?? "")
        .attr("cx", (origin) => origin.point[0])
        .attr("cy", (origin) => origin.point[1])
        .attr("r", (origin) => origin.radius)
        .attr("fill", "var(--color-accent)")
        .attr("stroke", "var(--color-surface)")
        .attr("vector-effect", "non-scaling-stroke")
        .style("pointer-events", "none");
      setMarkerSelection(svg, selectedCountryRef.current);

      viewport = [[0, 0], [width, height]];
      translateBounds = [
        [-24, -24],
        [width + 24, height + 24],
      ];

      zoomBehavior = zoom<SVGSVGElement, unknown>()
        .scaleExtent([MIN_ZOOM, MAX_ZOOM])
        .extent(viewport)
        .translateExtent(translateBounds)
        .clickDistance(8)
        .duration(reducedMotion ? 0 : ZOOM_DURATION_MS)
        .touchable(() => false)
        .filter((event) => {
          if (event.type === "wheel") return false;
          return !event.button;
        })
        .on("start", stopWheelZoom)
        .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
          currentZoom = event.transform;
          scheduleZoomPaint(event.transform);
        })
        .on("end", () => {
          wheelFrom = currentZoom;
          wheelTarget = currentZoom;
          updateZoomControls();
        });

      const projectedCenter = previousGeographicCenter
        ? nextProjection(previousGeographicCenter)
        : null;
      const preservedZoom = hasRendered && projectedCenter
        ? zoomIdentity
            .translate(width / 2, height / 2)
            .scale(previousZoom.k)
            .translate(-projectedCenter[0], -projectedCenter[1])
        : zoomIdentity;
      currentZoom = zoomBehavior.constrain()(
        preservedZoom,
        viewport,
        translateBounds
      );
      pendingZoom = currentZoom;
      wheelFrom = currentZoom;
      wheelTarget = currentZoom;
      (svg as ZoomableSvg).__zoom = currentZoom;
      svgSelection.call(zoomBehavior).on("wheel.zoom", null);
      paintZoom(currentZoom);
      updateZoomControls();
      hasRendered = true;

      svgSelection.on("click.origin-map", (event: MouseEvent) => {
        if (event.defaultPrevented || plottedOrigins.length === 0) return;
        const [clickX, clickY] = pointer(event, svg);
        let nearest: PlottedOrigin | null = null;
        let nearestDistance = Number.POSITIVE_INFINITY;

        for (const origin of plottedOrigins) {
          const [x, y] = currentZoom.apply(origin.point);
          const distance = Math.hypot(x - clickX, y - clickY);
          if (distance < nearestDistance) {
            nearest = origin;
            nearestDistance = distance;
          }
        }

        if (
          nearest &&
          nearestDistance <= Math.max(HIT_RADIUS, nearest.radius)
        ) {
          onSelectRef.current(nearest.entry);
        }
      });

      zoomApiRef.current = {
        changeBy: (factor) => animateScale(currentZoom.k * factor),
        reset: resetZoom,
      };
    }

    function handleMotionPreference(event: MediaQueryListEvent) {
      reducedMotion = event.matches;
      zoomBehavior?.duration(reducedMotion ? 0 : ZOOM_DURATION_MS);
      if (reducedMotion) {
        svgSelection.interrupt();
        stopWheelZoom();
        pendingZoom = currentZoom;
        paintZoom(currentZoom);
        updateZoomControls();
      }
    }

    function scheduleResize() {
      if (resizeFrame !== null) return;
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;
        renderMap();
      });
    }

    renderMap();
    const resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(container);
    reduceMotion.addEventListener("change", handleMotionPreference);
    svg.addEventListener("wheel", handleWheel, { passive: false });
    svg.addEventListener("touchstart", handleTouchStart, { passive: false });
    svg.addEventListener("touchmove", handleTouchMove, { passive: false });
    svg.addEventListener("touchend", handleTouchEnd);
    svg.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      resizeObserver.disconnect();
      reduceMotion.removeEventListener("change", handleMotionPreference);
      svg.removeEventListener("wheel", handleWheel);
      svg.removeEventListener("touchstart", handleTouchStart);
      svg.removeEventListener("touchmove", handleTouchMove);
      svg.removeEventListener("touchend", handleTouchEnd);
      svg.removeEventListener("touchcancel", handleTouchEnd);
      svgSelection.interrupt();
      svgSelection.on(".zoom", null).on(".origin-map", null);
      svgSelection.selectAll("*").remove();
      if (renderFrame !== null) window.cancelAnimationFrame(renderFrame);
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      if (wheelFrame !== null) window.cancelAnimationFrame(wheelFrame);
      zoomApiRef.current = null;
    };
  }, [entries]);

  function handleMapKeyDown(event: React.KeyboardEvent<SVGSVGElement>) {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomApiRef.current?.changeBy(ZOOM_STEP);
    } else if (event.key === "-") {
      event.preventDefault();
      zoomApiRef.current?.changeBy(1 / ZOOM_STEP);
    } else if (event.key === "0") {
      event.preventDefault();
      zoomApiRef.current?.reset();
    }
  }

  return (
    <div ref={containerRef} className="group relative h-full overflow-hidden">
      <svg
        ref={svgRef}
        role="img"
        aria-label={labels.description}
        aria-describedby={hintId}
        tabIndex={0}
        onKeyDown={handleMapKeyDown}
        className="block h-full w-full touch-pan-y select-none bg-surface-warm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50"
      />

      <div
        className="absolute right-3 top-3 flex flex-col items-end gap-1.5"
        role="group"
        aria-label={labels.description}
      >
        <div className="flex gap-1.5">
          <button
            ref={zoomOutRef}
            type="button"
            aria-label={labels.zoomOut}
            title={labels.zoomOut}
            onClick={() => zoomApiRef.current?.changeBy(1 / ZOOM_STEP)}
            className="grid size-11 place-items-center rounded-md border border-border-light bg-surface text-xl leading-none text-brown transition-colors hover:bg-cream-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-default disabled:opacity-45"
          >
            −
          </button>
          <button
            ref={zoomInRef}
            type="button"
            aria-label={labels.zoomIn}
            title={labels.zoomIn}
            onClick={() => zoomApiRef.current?.changeBy(ZOOM_STEP)}
            className="grid size-11 place-items-center rounded-md border border-border-light bg-surface text-xl leading-none text-brown transition-colors hover:bg-cream-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-default disabled:opacity-45"
          >
            +
          </button>
        </div>
        <button
          ref={zoomResetRef}
          type="button"
          hidden
          aria-label={labels.reset}
          onClick={() => zoomApiRef.current?.reset()}
          className="min-h-11 rounded-md border border-border-light bg-surface px-3 text-xs font-medium text-brown transition-colors hover:bg-cream-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          {labels.reset}
        </button>
      </div>

      <p
        id={hintId}
        className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 rounded-md bg-surface/95 px-2.5 py-1.5 text-[11px] text-brown-light opacity-0 shadow-[0_0.25rem_0.75rem_color-mix(in_srgb,var(--color-brown)_8%,transparent)] transition-opacity md:block md:group-hover:opacity-100 md:group-focus-within:opacity-100"
      >
        {labels.modifierHint}
      </p>
    </div>
  );
}
