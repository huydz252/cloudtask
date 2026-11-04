import { useEffect, useRef, useState, type ChangeEvent } from "react";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  ImagePlus,
  LoaderCircle,
  Paperclip,
  RotateCw,
  Upload,
} from "lucide-react";
import { api, errorMessage } from "../api";
import type { Attachment } from "../types";
import { ErrorBox } from "./ui";

const MAX_BYTES = 10 * 1024 * 1024;
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const mimeTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
type UploadItem = {
  id: string;
  file: File;
  mimeType: string;
  localUrl?: string;
  progress: number;
  stage: "waiting" | "uploading" | "confirming" | "error" | "done";
  uploadedId?: string;
  error?: string;
};

export default function TaskAttachments({
  taskId,
  projectId,
  attachments,
  onBusyChange,
}: {
  taskId: string;
  projectId: string;
  attachments: Attachment[];
  onBusyChange: (busy: boolean) => void;
}) {
  const client = useQueryClient();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const locked = useRef(false);
  const localUrls = useRef(new Set<string>());
  useEffect(
    () => () => {
      localUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  function update(id: string, values: Partial<UploadItem>) {
    setItems((previous) =>
      previous.map((item) => (item.id === id ? { ...item, ...values } : item)),
    );
  }
  async function process(batch: UploadItem[]) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    onBusyChange(true);
    setMessage("");
    let completed = 0;
    try {
      for (const item of batch) {
        let uploadedId = item.uploadedId;
        try {
          update(item.id, {
            error: undefined,
            stage: uploadedId ? "confirming" : "uploading",
            progress: uploadedId ? 99 : 0,
          });
          if (!uploadedId) {
            const { data } = await api.post(
              `/tasks/${taskId}/attachments/presigned-url`,
              {
                fileName: item.file.name,
                mimeType: item.mimeType,
                fileSize: item.file.size,
              },
            );
            try {
              await axios.put(data.uploadUrl, item.file, {
                headers: data.headers,
                withCredentials: false,
                timeout: 240000,
                onUploadProgress: (event) =>
                  update(item.id, {
                    progress: Math.min(
                      98,
                      Math.round(
                        (event.loaded / (event.total || item.file.size)) * 100,
                      ),
                    ),
                  }),
              });
            } catch (cause) {
              if (axios.isAxiosError(cause) && !cause.response)
                throw new Error(
                  "Không gửi được tệp đến S3. Kiểm tra kết nối hoặc CORS của bucket.",
                );
              if (axios.isAxiosError(cause) && cause.response?.status === 403)
                throw new Error(
                  "S3 từ chối upload. URL có thể đã hết hạn hoặc quyền/headers chưa đúng. Hãy thử lại.",
                );
              throw cause;
            }
            uploadedId = data.attachmentId;
            update(item.id, { uploadedId, stage: "confirming", progress: 99 });
          }
          await api.post(
            `/tasks/${taskId}/attachments/${uploadedId}/confirm`,
            {},
          );
          completed++;
          update(item.id, { stage: "done", progress: 100 });
        } catch (cause) {
          const expired =
            axios.isAxiosError(cause) && cause.response?.status === 410;
          update(item.id, {
            stage: "error",
            uploadedId: expired ? undefined : uploadedId,
            error: `${uploadedId && !expired ? "Đã gửi tệp; chưa xác nhận được: " : ""}${errorMessage(cause)}`,
          });
        }
      }
      if (completed) {
        await Promise.all([
          client.invalidateQueries({ queryKey: ["task", taskId] }),
          client.invalidateQueries({ queryKey: ["tasks", projectId] }),
        ]);
        setMessage(`Đã tải lên và xác nhận ${completed} tệp.`);
      }
    } finally {
      locked.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }
  function select(files: File[]) {
    if (locked.current || !files.length) return;
    setError("");
    if (files.length > 10) {
      setError("Mỗi lần chọn tối đa 10 tệp.");
      return;
    }
    const batch: UploadItem[] = [];
    const invalid: string[] = [];
    for (const file of files) {
      const extension = file.name.toLowerCase().split(".").pop() || "";
      const mimeType = mimeTypes[extension];
      if (!mimeType || file.size === 0 || file.size > MAX_BYTES) {
        invalid.push(
          `${file.name}: định dạng không hỗ trợ hoặc dung lượng ngoài 1 byte–10 MB.`,
        );
        continue;
      }
      const localUrl = imageTypes.has(mimeType)
        ? URL.createObjectURL(file)
        : undefined;
      if (localUrl) localUrls.current.add(localUrl);
      batch.push({
        id: crypto.randomUUID(),
        file,
        mimeType,
        localUrl,
        stage: "waiting",
        progress: 0,
      });
    }
    if (invalid.length) setError(invalid.join(" "));
    if (batch.length) {
      setItems((previous) => [...previous, ...batch]);
      void process(batch);
    }
  }
  function fileChange(event: ChangeEvent<HTMLInputElement>) {
    select(Array.from(event.target.files || []));
    event.target.value = "";
  }
  return (
    <section className="mt-8 border-t border-slate-200 pt-6">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <Paperclip size={17} />
        Ảnh và tệp đính kèm{" "}
        <span className="text-slate-400">{attachments.length}</span>
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {attachments.map((attachment) => (
          <AttachmentCard
            key={attachment.id}
            taskId={taskId}
            attachment={attachment}
          />
        ))}
      </div>
      <label
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          select(Array.from(event.dataTransfer.files));
        }}
        className={`relative mt-4 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center ${busy ? "cursor-wait opacity-60" : "cursor-pointer hover:border-brand"} ${dragging ? "border-brand bg-indigo-50" : "border-slate-200"}`}
      >
        <ImagePlus size={25} className="text-brand" />
        <span className="text-sm font-medium text-slate-600">
          {busy ? "Đang xử lý tệp…" : "Chọn hoặc kéo thả ảnh vào đây"}
        </span>
        <span className="text-xs text-slate-400">
          JPG, PNG, WebP · tối đa 10 MB/tệp · chọn nhiều ảnh
        </span>
        <span className="text-xs text-slate-400">
          Cũng hỗ trợ PDF, TXT, CSV, ZIP, DOCX, XLSX
        </span>
        <input
          aria-label="Chọn ảnh hoặc tệp đính kèm"
          className="sr-only"
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.csv,.zip,.docx,.xlsx"
          disabled={busy}
          onChange={fileChange}
        />
      </label>
      <div className="mt-3 space-y-3" aria-live="polite">
        {items
          .filter((item) => item.stage !== "done")
          .map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 p-3"
            >
              <div className="flex items-center gap-3">
                {item.localUrl ? (
                  <img
                    src={item.localUrl}
                    alt={`Ảnh đang tải: ${item.file.name}`}
                    className="h-12 w-12 rounded-md object-cover"
                  />
                ) : (
                  <Upload size={20} className="text-slate-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {item.file.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.stage === "confirming"
                      ? "Đang xác nhận với S3…"
                      : item.stage === "uploading"
                        ? `Đang tải ${item.progress}%`
                        : item.stage === "error"
                          ? "Upload chưa hoàn tất"
                          : "Đang chờ…"}
                  </p>
                </div>
                {item.stage === "error" && (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn-secondary !px-2 !text-xs"
                    onClick={() => void process([item])}
                  >
                    <RotateCw size={13} />
                    Thử lại
                  </button>
                )}
              </div>
              {item.stage !== "error" && (
                <div
                  role="progressbar"
                  aria-label={`Tiến độ ${item.file.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={item.progress}
                  className="mt-3 h-1.5 rounded-full bg-slate-100"
                >
                  <div
                    className="h-full rounded-full bg-brand transition-all"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
              {item.error && (
                <p className="mt-2 break-words text-xs leading-5 text-red-600">
                  {item.error}
                </p>
              )}
            </div>
          ))}
      </div>
      {error && (
        <div className="mt-3">
          <ErrorBox message={error} />
        </div>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-emerald-600">
          {message}
        </p>
      )}
    </section>
  );
}

function AttachmentCard({
  taskId,
  attachment,
}: {
  taskId: string;
  attachment: Attachment;
}) {
  const isImage = imageTypes.has(attachment.mimeType);
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState("");
  const preview = useQuery({
    queryKey: ["attachment-preview", taskId, attachment.id],
    queryFn: async () =>
      (
        await api.get<{ url: string }>(
          `/tasks/${taskId}/attachments/${attachment.id}/preview`,
        )
      ).data,
    enabled: isImage,
    staleTime: 240000,
    gcTime: 0,
    retry: 1,
  });
  async function download() {
    setError("");
    try {
      const { data } = await api.get(
        `/tasks/${taskId}/attachments/${attachment.id}/download`,
      );
      const link = document.createElement("a");
      link.href = data.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }
  return (
    <article
      className={`overflow-hidden rounded-xl border border-slate-200 ${expanded ? "sm:col-span-2" : ""}`}
    >
      {isImage && (
        <div className="bg-slate-50">
          {preview.isPending ? (
            <div className="grid h-40 place-items-center text-slate-400">
              <LoaderCircle
                size={20}
                className="animate-spin"
                aria-label="Đang tải ảnh"
              />
            </div>
          ) : preview.isError || failed ? (
            <div className="grid h-40 place-items-center p-4 text-center">
              <div>
                <p className="text-xs text-slate-500">
                  {preview.isError
                    ? errorMessage(preview.error)
                    : "Không tải được ảnh. URL có thể đã hết hạn."}
                </p>
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-brand"
                  onClick={async () => {
                    setFailed(false);
                    await preview.refetch();
                  }}
                >
                  Tải lại ảnh
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              aria-label={`${expanded ? "Thu nhỏ" : "Phóng to"} ảnh ${attachment.fileName}`}
              className="block w-full"
              onClick={() => setExpanded(!expanded)}
            >
              <img
                src={preview.data?.url}
                alt={attachment.fileName}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setFailed(true)}
                className={`w-full object-contain ${expanded ? "max-h-96" : "h-40"}`}
              />
            </button>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 p-3">
        <Paperclip size={15} className="shrink-0 text-slate-400" />
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-xs font-medium"
            title={attachment.fileName}
          >
            {attachment.fileName}
          </p>
          <p className="mt-1 text-[10px] text-slate-400">
            {(attachment.fileSize / 1024).toFixed(1)} KB
          </p>
        </div>
        <button
          type="button"
          aria-label={`Tải xuống ${attachment.fileName}`}
          className="icon-button text-brand"
          onClick={download}
        >
          <Download size={16} />
        </button>
      </div>
      {error && (
        <p role="alert" className="px-3 pb-3 text-xs text-red-600">
          {error}
        </p>
      )}
    </article>
  );
}
