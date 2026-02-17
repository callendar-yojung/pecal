"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import RichTextEditor from "@/components/editor/RichTextEditor";
import {
  Clock, FileText, Palette, PencilLine, PlusCircle,
  Calendar, Tag as TagIcon, Paperclip, X, Check, ChevronDown
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// --- Types (기존과 동일) ---
export interface TaskFormData {
  id?: number; title: string; start_time: string; end_time: string;
  content: string; status?: "TODO" | "IN_PROGRESS" | "DONE";
  color?: string; tag_ids?: number[]; file_ids?: number[];
  created_at?: string; updated_at?: string;
  created_by_name?: string | null; updated_by_name?: string | null;
}

interface PendingFile {
  file_id: number; original_name: string; file_path: string;
  file_size: number; file_size_formatted: string; mime_type: string | null;
}

interface Tag {
  tag_id: number; name: string; color: string;
  owner_type: "team" | "personal"; owner_id: number;
}

interface TaskAttachment {
  attachment_id: number; task_id: number; file_id: number;
  original_name: string; file_path: string; file_size: number;
  file_size_formatted: string; mime_type: string | null; created_at: string;
}

interface TaskFormPanelProps {
  isOpen: boolean; onClose: () => void; onSave: (task: TaskFormData) => void;
  mode?: "create" | "edit"; initialData?: TaskFormData | null;
  workspaceType?: "team" | "personal"; ownerId?: number; variant?: "modal" | "page";
}

export default function TaskFormPanel({
                                        isOpen, onClose, onSave, mode = "create", initialData, workspaceType, ownerId, variant = "modal",
                                      }: TaskFormPanelProps) {
  const t = useTranslations("dashboard.tasks.modal");
  const [currentMode, setCurrentMode] = useState<"create" | "edit">(mode);
  const [formData, setFormData] = useState<TaskFormData>({
    title: "", start_time: "", end_time: "", content: "", color: "#3B82F6", tag_ids: [],
  });
  const [errors, setErrors] = useState<Partial<Record<keyof TaskFormData, string>>>({});
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");
  const [creatingTag, setCreatingTag] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  const colorOptions = [
    { value: "#3B82F6", label: "Blue" }, { value: "#EF4444", label: "Red" },
    { value: "#10B981", label: "Green" }, { value: "#F59E0B", label: "Amber" },
    { value: "#8B5CF6", label: "Purple" }, { value: "#EC4899", label: "Pink" },
    { value: "#6366F1", label: "Indigo" }, { value: "#14B8A6", label: "Teal" },
  ];

  const timeOptions = useMemo(() =>
      Array.from({ length: 48 }, (_, idx) => {
        const hours = String(Math.floor(idx / 2)).padStart(2, "0");
        const minutes = idx % 2 === 0 ? "00" : "30";
        return `${hours}:${minutes}`;
      }), []);

  // --- Helpers ---
  const parseContentJson = (value: string) => {
    if (!value) {
      return { type: "doc", content: [{ type: "paragraph" }] };
    }
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
        };
      }
    }
    return {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
    };
  };

  const editorInitialContent = useMemo(
    () => parseContentJson(formData.content || ""),
    [formData.content]
  );

  const splitDateTime = (value: string) => {
    if (!value) return { date: "", time: "" };
    const [date, time] = value.includes("T") ? value.split("T") : [value, ""];
    return { date, time: time.slice(0, 5) };
  };

  const setDateTime = (field: "start_time" | "end_time", date: string, time: string) => {
    const current = splitDateTime(formData[field]);
    const nextDate = date || current.date || new Date().toISOString().slice(0, 10);
    const nextTime = time || current.time || "09:00";
    handleChange(field, `${nextDate}T${nextTime}`);
  };

  const handleChange = (field: keyof TaskFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof TaskFormData, string>> = {};
    if (!formData.title.trim()) newErrors.title = t("requiredField");
    if (!formData.start_time) newErrors.start_time = t("requiredField");
    if (!formData.end_time) newErrors.end_time = t("requiredField");
    if (formData.start_time && formData.end_time && formData.start_time >= formData.end_time) {
      newErrors.end_time = t("endTimeBeforeStart");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSave({ ...formData, file_ids: pendingFiles.map(f => f.file_id) });
    }
  };

  const formatDateTimeLocal = (dateStr: string) => {
    if (!dateStr) return "";
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (match) {
      const [, year, month, day, hours, minutes] = match;
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const fetchTags = async () => {
    if (!workspaceType || !ownerId) return;
    setLoadingTags(true);
    try {
      const res = await fetch(
        `/api/tags?owner_type=${workspaceType}&owner_id=${ownerId}`
      );
      if (res.ok) {
        const data = await res.json();
        setAvailableTags(data.tags || []);
      } else {
        const data = await res.json().catch(() => ({}));
        setTagError(data.error || "태그를 불러오지 못했습니다.");
      }
    } catch (error) {
      console.error("Failed to fetch tags:", error);
      setTagError("태그를 불러오지 못했습니다.");
    } finally {
      setLoadingTags(false);
    }
  };

  const fetchAttachments = async (taskId: number) => {
    setLoadingAttachments(true);
    try {
      const response = await fetch(`/api/tasks/attachments?task_id=${taskId}`);
      if (response.ok) {
        const data = await response.json();
        setAttachments(data.attachments || []);
      }
    } catch (error) {
      console.error("Failed to fetch attachments:", error);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspaceType || !ownerId) return;

    setUploadingFile(true);
    setUploadError(null);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("owner_type", workspaceType);
      uploadFormData.append("owner_id", String(ownerId));

      if (initialData?.id) {
        uploadFormData.append("task_id", String(initialData.id));
      }

      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: uploadFormData,
      });

      const data = await response.json();
      if (!response.ok) {
        if (data?.code === "LIMIT_EXCEEDED") {
          const used = typeof data.used_bytes === "number" ? formatBytes(data.used_bytes) : null;
          const limit = typeof data.limit_bytes === "number" ? formatBytes(data.limit_bytes) : null;
          const maxFile =
            typeof data.max_file_size_bytes === "number"
              ? formatBytes(data.max_file_size_bytes)
              : null;
          const details = [
            used && limit ? `사용 ${used} / ${limit}` : null,
            maxFile ? `최대 파일 ${maxFile}` : null,
          ]
            .filter(Boolean)
            .join(" · ");
          setUploadError(
            details ? `용량 제한을 초과했습니다. ${details}` : "용량 제한을 초과했습니다."
          );
        } else {
          setUploadError(data.error || "파일 업로드에 실패했습니다.");
        }
        return;
      }

      if (initialData?.id) {
        await fetchAttachments(initialData.id);
      } else {
        setPendingFiles(prev => [
          ...prev,
          {
            file_id: data.file.file_id,
            original_name: data.file.original_name,
            file_path: data.file.file_path,
            file_size: data.file.file_size,
            file_size_formatted: data.file.file_size_formatted,
            mime_type: data.file.mime_type,
          },
        ]);
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("File upload error:", error);
      setUploadError("파일 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploadingFile(false);
    }
  };


  const handleRemovePendingFile = async (fileId: number) => {
    try {
      await fetch(`/api/files?id=${fileId}`, { method: "DELETE" });
      setPendingFiles(prev => prev.filter(f => f.file_id !== fileId));
    } catch (error) {
      console.error("Failed to delete pending file:", error);
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!confirm("첨부파일을 삭제하시겠습니까?")) return;
    try {
      const response = await fetch(
        `/api/tasks/attachments?attachment_id=${attachmentId}&delete_file=true`,
        { method: "DELETE" }
      );
      if (response.ok) {
        setAttachments(prev => prev.filter(a => a.attachment_id !== attachmentId));
      } else {
        const data = await response.json();
        alert(data.error || "첨부파일 삭제에 실패했습니다.");
      }
    } catch (error) {
      console.error("Delete attachment error:", error);
      alert("첨부파일 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      setTagError("태그 이름을 입력해주세요.");
      return;
    }
    if (!workspaceType || !ownerId) {
      setTagError("워크스페이스 정보를 찾을 수 없습니다.");
      return;
    }

    setCreatingTag(true);
    setTagError(null);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTagName.trim(),
          color: newTagColor,
          owner_type: workspaceType,
          owner_id: ownerId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTagError(data.error || "태그 생성에 실패했습니다.");
        return;
      }

      setNewTagName("");
      setNewTagColor("#3B82F6");
      setShowNewTagForm(false);
      await fetchTags();
    } catch (error) {
      console.error("Failed to create tag:", error);
      setTagError("태그 생성 중 오류가 발생했습니다.");
    } finally {
      setCreatingTag(false);
    }
  };

  // --- Effects ---
  useEffect(() => {
    if (isOpen && workspaceType && ownerId) fetchTags();
  }, [isOpen, workspaceType, ownerId]);

  useEffect(() => {
    if (isOpen && initialData?.id) fetchAttachments(initialData.id);
    else setAttachments([]);
  }, [isOpen, initialData?.id]);

  useEffect(() => {
    if (initialData && mode === "edit") {
      setFormData({
        ...initialData,
        start_time: formatDateTimeLocal(initialData.start_time),
        end_time: formatDateTimeLocal(initialData.end_time),
        content: initialData.content || "",
        color: initialData.color || "#3B82F6",
      });
      setCurrentMode("edit");
    } else {
      setFormData({ title: "", start_time: "", end_time: "", content: "", color: "#3B82F6", tag_ids: [] });
      setCurrentMode("create");
    }
    setTagError(null);
    setShowNewTagForm(false);
  }, [isOpen, initialData, mode]);

  if (!isOpen) return null;

  const isPage = variant === "page";

  return (
      <div className={isPage ? "w-full" : "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto"}>
        <div className={`w-full bg-card border border-border shadow-2xl transition-all ${isPage ? "rounded-xl p-8" : "max-w-3xl rounded-2xl p-6 my-auto"}`}>

          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {currentMode === "edit" ? <PencilLine size={22} /> : <PlusCircle size={22} />}
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {currentMode === "edit" ? t("editTitle") : t("title")}
                </h2>
                <p className="text-sm text-muted-foreground">{currentMode === "edit" ? "기존 할 일을 수정합니다." : "새로운 할 일을 계획해 보세요."}</p>
              </div>
            </div>
            {!isPage && (
                <button onClick={onClose} className="rounded-full p-2 hover:bg-muted transition-colors text-muted-foreground">
                  <X size={20} />
                </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 제목 섹션 */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText size={16} className="text-muted-foreground" />
                {t("taskTitle")} <span className="text-destructive">*</span>
              </label>
              <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  placeholder={t("taskTitlePlaceholder")}
                  className={`h-11 w-full rounded-xl border bg-background px-4 text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:outline-none ${
                      errors.title ? "border-destructive" : "border-input hover:border-primary"
                  }`}
              />
              {errors.title && <p className="text-xs font-medium text-destructive">{errors.title}</p>}
            </div>

            {/* 시간 설정 섹션 */}
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { id: "start_time", label: t("startTime"), icon: <Calendar size={16} /> },
                { id: "end_time", label: t("endTime"), icon: <Clock size={16} /> }
              ].map((field) => (
                  <div key={field.id} className="space-y-2">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      {field.icon}
                      {field.label} <span className="text-destructive">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                          type="date"
                          value={splitDateTime(formData[field.id as keyof TaskFormData] as string).date}
                          onChange={(e) => setDateTime(field.id as any, e.target.value, "")}
                          className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                      />
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className="inline-flex h-10 w-28 items-center justify-between rounded-xl border border-input bg-background px-3 text-sm hover:bg-muted transition-colors">
                            <span className="font-medium">{splitDateTime(formData[field.id as keyof TaskFormData] as string).time || "09:00"}</span>
                            <ChevronDown size={14} className="text-muted-foreground" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-32 p-1" align="end">
                          <div className="max-h-60 overflow-y-auto no-scrollbar">
                            {timeOptions.map((time) => (
                                <button
                                    key={time}
                                    type="button"
                                    onClick={() => setDateTime(field.id as any, "", time)}
                                    className="w-full rounded-md px-2 py-2 text-center text-sm hover:bg-primary hover:text-primary-foreground transition-colors"
                                >
                                  {time}
                                </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    {errors[field.id as keyof TaskFormData] && <p className="text-xs font-medium text-destructive">{errors[field.id as keyof TaskFormData]}</p>}
                  </div>
              ))}
            </div>

            {/* 에디터 섹션 */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <PencilLine size={16} className="text-muted-foreground" />
                {t("content")}
              </label>
              <div className="rounded-xl border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <RichTextEditor
                    initialContent={editorInitialContent}
                    contentKey={`task-${formData.id ?? "new"}`}
                    onChange={(json) => handleChange("content", JSON.stringify(json))}
                />
              </div>
            </div>

            {/* 색상 & 태그 하단 영역 */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Palette size={16} className="text-muted-foreground" />
                  태스크 컬러
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {colorOptions.map(color => (
                      <button
                          key={color.value}
                          type="button"
                          onClick={() => handleChange("color", color.value)}
                          className={`h-7 w-7 rounded-full border-2 transition-all ${
                              formData.color === color.value ? "ring-2 ring-primary ring-offset-2 border-transparent scale-110" : "border-transparent hover:scale-110"
                          }`}
                          style={{ backgroundColor: color.value }}
                      >
                        {formData.color === color.value && <Check size={14} className="mx-auto text-white drop-shadow-md" />}
                      </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TagIcon size={16} className="text-muted-foreground" />
                  태그
                </label>
                {loadingTags ? (
                  <p className="text-xs text-muted-foreground">태그 불러오는 중...</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map(tag => (
                        <button
                            key={tag.tag_id}
                            type="button"
                            onClick={() => {
                              const current = formData.tag_ids || [];
                              const next = current.includes(tag.tag_id)
                                ? current.filter(id => id !== tag.tag_id)
                                : [...current, tag.tag_id];
                              handleChange("tag_ids", next);
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all border ${
                                formData.tag_ids?.includes(tag.tag_id)
                                  ? "shadow-md scale-105"
                                  : "opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0"
                            }`}
                            style={{ backgroundColor: `${tag.color}20`, borderColor: tag.color, color: tag.color }}
                        >
                          {tag.name}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => setShowNewTagForm(!showNewTagForm)}
                        className="rounded-full border border-dashed border-input px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                    >
                      + 추가
                    </button>
                  </div>
                )}
                {showNewTagForm && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-2">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="태그 이름"
                      className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                    />
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="h-9 w-10 cursor-pointer rounded-md border border-border bg-background"
                    />
                    <button
                      type="button"
                      onClick={handleCreateTag}
                      disabled={creatingTag}
                      className="h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                    >
                      {creatingTag ? "생성 중..." : "저장"}
                    </button>
                    {tagError && (
                      <p className="w-full text-xs text-destructive">{tagError}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 첨부파일 섹션 */}
            <div className="space-y-3 rounded-xl bg-muted/30 p-4 border border-border/50">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Paperclip size={16} className="text-muted-foreground" />
                첨부파일
              </label>
              <div className="flex flex-col gap-2">
                <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" id="file-upload" />
                <label htmlFor="file-upload" className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-input bg-background p-3 text-sm text-muted-foreground hover:bg-muted transition-colors">
                  {uploadingFile ? "업로드 중..." : "클릭하여 파일 업로드"}
                </label>
                {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}

                <div className="grid gap-2 sm:grid-cols-2">
                  {pendingFiles.map(file => (
                      <div key={`pending-${file.file_id}`} className="group flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-xs">
                        <span className="truncate font-medium">{file.original_name}</span>
                        <button type="button" onClick={() => handleRemovePendingFile(file.file_id)} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={14} />
                        </button>
                      </div>
                  ))}
                  {attachments.map(att => (
                      <div key={att.attachment_id} className="group flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-xs">
                        <span className="truncate font-medium">{att.original_name}</span>
                        <button type="button" onClick={() => handleDeleteAttachment(att.attachment_id)} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={14} />
                        </button>
                      </div>
                  ))}
                  {!uploadingFile && pendingFiles.length === 0 && attachments.length === 0 && !loadingAttachments && (
                    <p className="text-xs text-muted-foreground">첨부된 파일이 없습니다.</p>
                  )}
                  {loadingAttachments && (
                    <p className="text-xs text-muted-foreground">첨부파일 불러오는 중...</p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                  type="button"
                  onClick={onClose}
                  className="h-11 rounded-xl px-6 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                  type="submit"
                  className="h-11 rounded-xl bg-primary px-8 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all"
              >
                {currentMode === "edit" ? t("save") : t("create")}
              </button>
            </div>
          </form>
        </div>
      </div>
  );
}
