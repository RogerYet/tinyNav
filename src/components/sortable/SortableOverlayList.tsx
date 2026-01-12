import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useReducedMotion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { GripVertical } from "lucide-react";

export function SortableOverlayList<T extends { id: string }>({
  items,
  onReorder,
  renderItem
}: {
  items: T[];
  onReorder: (nextIds: string[]) => void | Promise<void>;
  renderItem: (item: T, handle: ReactNode, state: { isDragging: boolean }) => ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeItem = useMemo(() => (activeId ? items.find((i) => i.id === activeId) ?? null : null), [activeId, items]);

  function onDragEnd(e: DragEndEvent) {
    const from = e.active?.id?.toString();
    const to = e.over?.id?.toString();
    setActiveId(null);
    if (!from || !to || from === to) return;

    const ids = items.map((i) => i.id);
    const oldIndex = ids.indexOf(from);
    const newIndex = ids.indexOf(to);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  }

  const overlayHandle = (
    <div aria-hidden className="touch-none select-none [-webkit-user-select:none] text-muted">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/6 dark:bg-white/4">
        <GripVertical size={16} className="opacity-75 shrink-0" />
      </span>
    </div>
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveId(e.active.id.toString())}
      onDragCancel={() => {
        setActiveId(null);
      }}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((item) => (
            <SortableRow key={item.id} id={item.id}>
              {(handle, state) => renderItem(item, handle, state)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>

      {createPortal(
        <div className="fixed inset-0 z-[9999] pointer-events-none">
          <DragOverlay dropAnimation={reduceMotion ? null : undefined}>
            {activeItem ? renderItem(activeItem, overlayHandle, { isDragging: true }) : null}
          </DragOverlay>
        </div>,
        document.body
      )}
    </DndContext>
  );
}

function SortableRow({
  id,
  children
}: {
  id: string;
  children: (handle: ReactNode, state: { isDragging: boolean }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: CSSProperties = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition
  };

  const handle = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      aria-label="Drag"
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      className="touch-none select-none [-webkit-user-select:none] cursor-grab active:cursor-grabbing text-muted hover:text-fg transition-colors"
      style={{ WebkitTapHighlightColor: "transparent" }}
      {...attributes}
      {...listeners}
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/6 dark:bg-white/4">
        <GripVertical size={16} className="opacity-75 shrink-0" />
      </span>
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-40" : undefined}
    >
      {children(handle, { isDragging })}
    </div>
  );
}
