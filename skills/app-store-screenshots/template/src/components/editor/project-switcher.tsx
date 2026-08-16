"use client";
import * as React from "react";
import {
  Check,
  ChevronDown,
  Copy,
  FolderKanban,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { ProjectMeta } from "@/lib/types";
import { useT } from "@/lib/ui-i18n";

type Props = {
  projects: ProjectMeta[];
  activeId: string | null;
  disabled?: boolean;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
};

export function ProjectSwitcher({
  projects,
  activeId,
  disabled,
  onSwitch,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
}: Props) {
  const { t } = useT();
  const [manageOpen, setManageOpen] = React.useState(false);
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  // Clear per-row modes if their project disappears (deleted elsewhere).
  React.useEffect(() => {
    const ids = new Set(projects.map((project) => project.id));
    if (renamingId && !ids.has(renamingId)) setRenamingId(null);
    if (confirmDeleteId && !ids.has(confirmDeleteId)) setConfirmDeleteId(null);
  }, [projects, renamingId, confirmDeleteId]);

  const active = projects.find((project) => project.id === activeId) || projects[0] || null;

  const commitRename = (id: string) => {
    const value = renameValue.trim();
    if (value) onRename(id, value);
    setRenamingId(null);
    setRenameValue("");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 max-w-44 gap-1.5 px-2 text-xs"
            disabled={disabled}
            title={active ? t("projectSwitcher.projectTitle", { name: active.name }) : t("projectSwitcher.projects")}
          >
            <FolderKanban className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{active ? active.name : t("projectSwitcher.projects")}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>{t("projectSwitcher.projects")}</DropdownMenuLabel>
          {projects.map((project) => (
            <DropdownMenuCheckboxItem
              key={project.id}
              checked={project.id === activeId}
              onSelect={(event) => {
                event.preventDefault(); // keep the menu open so the check moves
                if (project.id !== activeId && !disabled) onSwitch(project.id);
              }}
            >
              <span className="truncate">{project.name}</span>
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onCreate()} disabled={disabled}>
            <Plus className="h-3.5 w-3.5" /> {t("projectSwitcher.newProject")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setManageOpen(true)} disabled={disabled}>
            <Settings2 className="h-3.5 w-3.5" /> {t("projectSwitcher.manageProjects")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("projectSwitcher.projects")}</DialogTitle>
            <DialogDescription>
              {t("projectSwitcher.manageDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-0.5">
            {projects.map((project) => {
              const isActive = project.id === activeId;
              if (renamingId === project.id) {
                return (
                  <div key={project.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitRename(project.id);
                        if (event.key === "Escape") setRenamingId(null);
                      }}
                      className="h-8 flex-1 text-sm"
                      aria-label={t("projectSwitcher.renameA11y", { name: project.name })}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-8"
                      disabled={!renameValue.trim() || disabled}
                      onClick={() => commitRename(project.id)}
                    >
                      {t("projectSwitcher.save")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setRenamingId(null)}
                      aria-label={t("projectSwitcher.cancelRename")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              }
              if (confirmDeleteId === project.id) {
                return (
                  <div
                    key={project.id}
                    className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                      {t("projectSwitcher.deleteConfirm", { name: project.name })}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      {t("projectSwitcher.cancel")}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={disabled}
                      onClick={() => {
                        onDelete(project.id);
                        setConfirmDeleteId(null);
                      }}
                    >
                      {t("projectSwitcher.delete")}
                    </Button>
                  </div>
                );
              }
              return (
                <div key={project.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline disabled:hover:no-underline"
                    onClick={() => {
                      if (!isActive && !disabled) onSwitch(project.id);
                    }}
                    disabled={isActive || disabled}
                    title={
                      isActive
                        ? t("projectSwitcher.activeProject")
                        : t("projectSwitcher.switchTo", { name: project.name })
                    }
                  >
                    {project.name}
                  </button>
                  {isActive && (
                    <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Check className="h-3 w-3" /> {t("projectSwitcher.active")}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={disabled}
                    onClick={() => {
                      setRenamingId(project.id);
                      setRenameValue(project.name);
                    }}
                    title={t("projectSwitcher.rename")}
                    aria-label={t("projectSwitcher.renameA11y", { name: project.name })}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={disabled}
                    onClick={() => onDuplicate(project.id)}
                    title={t("projectSwitcher.duplicate")}
                    aria-label={t("projectSwitcher.duplicateA11y", { name: project.name })}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    disabled={disabled}
                    onClick={() => setConfirmDeleteId(project.id)}
                    title={t("projectSwitcher.delete")}
                    aria-label={t("projectSwitcher.deleteA11y", { name: project.name })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={disabled}
              onClick={() => {
                setManageOpen(false);
                onCreate();
              }}
            >
              <Plus className="h-3.5 w-3.5" /> {t("projectSwitcher.newProject")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
