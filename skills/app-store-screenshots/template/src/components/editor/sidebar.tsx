"use client";
import * as React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Device, Orientation, Slide, Theme } from "@/lib/types";
import { newSlide } from "@/lib/defaults";
import { useT } from "@/lib/ui-i18n";
import { SlideThumb } from "./slide-thumb";

type Props = {
  slides: Slide[];
  activeId: string | null;
  device: Device;
  orientation: Orientation;
  theme: Theme;
  locale: string;
  appName?: string;
  appIcon?: string;
  connectedCanvas: boolean;
  disabled?: boolean;
  selectedForDesign?: Set<string>;
  showDesignSelection?: boolean;
  onToggleDesignSelection?: (id: string) => void;
  onReorder: (next: Slide[]) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAdd: (slide: Slide) => void;
};

export function Sidebar({
  slides,
  activeId,
  device,
  orientation,
  theme,
  locale,
  appName,
  appIcon,
  connectedCanvas,
  disabled,
  selectedForDesign,
  showDesignSelection,
  onToggleDesignSelection,
  onReorder,
  onSelect,
  onDelete,
  onDuplicate,
  onAdd,
}: Props) {
  const { t } = useT();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = slides.findIndex((s) => s.id === active.id);
    const newIdx = slides.findIndex((s) => s.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    onReorder(arrayMove(slides, oldIdx, newIdx));
  };

  return (
    <div className={`flex h-full flex-col ${disabled ? "pointer-events-none opacity-60" : ""}`}>
      <div className="border-b border-border/70 px-3 py-3">
        <h2 className="text-subhead font-semibold tracking-tight">{t("sidebar.screens")}</h2>
        <p className="text-caption text-muted-foreground">
          {t("sidebar.screensCount", { count: slides.length })}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {slides.map((slide, i) => (
                <SlideThumb
                  key={slide.id}
                  slide={slide}
                  slides={slides}
                  index={i}
                  active={slide.id === activeId}
                  device={device}
                  orientation={orientation}
                  theme={theme}
                  locale={locale}
                  appName={appName}
                  appIcon={appIcon}
                  connectedCanvas={connectedCanvas}
                  onSelect={() => onSelect(slide.id)}
                  onDelete={() => onDelete(slide.id)}
                  onDuplicate={() => onDuplicate(slide.id)}
                  selectedForDesign={selectedForDesign?.has(slide.id)}
                  showDesignSelection={showDesignSelection}
                  onToggleDesignSelection={
                    onToggleDesignSelection ? () => onToggleDesignSelection(slide.id) : undefined
                  }
                />
              ))}
              {slides.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-xs font-medium text-foreground">
                    {t("sidebar.noScreensYet")}
                  </p>
                  <p className="mt-1 text-caption text-muted-foreground">
                    {t("sidebar.noScreensHintBefore")}
                    <span className="font-semibold">{t("sidebar.addScreen")}</span>
                    {t("sidebar.noScreensHintAfter")}
                  </p>
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div className="border-t border-border/70 bg-background/50 p-3">
        <Button
          type="button"
          className="w-full border-dashed text-muted-foreground hover:border-ring hover:text-foreground"
          variant="outline"
          onClick={() => onAdd(newSlide(device === "feature-graphic" ? "feature-graphic" : "device-bottom"))}
          disabled={disabled}
        >
          <Plus className="h-4 w-4" /> {t("sidebar.addScreen")}
        </Button>
      </div>
    </div>
  );
}
