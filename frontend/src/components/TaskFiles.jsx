import { useEffect, useRef, useState } from "react";
import api from "../lib/api";
import { Button } from "./kit";

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Drop this into your task detail page: <TaskFiles taskId={task.id} currentUserId={user.id} />
const TaskFiles = ({ taskId, currentUserId }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/tasks/${taskId}/files`);
      setFiles(data);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load files.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const onFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      await api.post(`/tasks/${taskId}/files`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadFiles();
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onDownload = async (file) => {
    try {
      const response = await api.get(`/tasks/${taskId}/files/${file.id}/download`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", file.original_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("Couldn't download file.");
    }
  };

  const onDelete = async (file) => {
    if (!window.confirm(`Delete "${file.original_name}"?`)) return;
    try {
      await api.delete(`/tasks/${taskId}/files/${file.id}`);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't delete file.");
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Attachments</h3>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={onFileSelected}
            disabled={uploading}
          />
          <Button
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Uploading…" : "Upload file"}
          </Button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-flow-deep">{error}</p>}

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-ink-soft">No files attached yet.</p>
      ) : (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onDownload(file)}
                  className="truncate font-medium text-flow-deep hover:underline"
                  title={file.original_name}
                >
                  {file.original_name}
                </button>
                <p className="text-xs text-ink-soft">
                  {formatSize(file.size_bytes)} · {file.first_name} {file.last_name} ·{" "}
                  {new Date(file.uploaded_at).toLocaleDateString()}
                </p>
              </div>
              {file.uploaded_by === currentUserId && (
                <Button variant="ghost" onClick={() => onDelete(file)}>
                  Delete
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TaskFiles;
