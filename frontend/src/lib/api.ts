export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || '';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  storageQuota: number;
}

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  itemsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface FileRecord {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  isFavorite: boolean;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
}

export interface DriveResponse {
  currentFolder: { id: string; name: string; parentId: string | null } | null;
  breadcrumbs: BreadcrumbItem[];
  folders: FolderItem[];
  files: FileRecord[];
  stats: {
    usedBytes: number;
    quotaBytes: number;
    totalFiles: number;
    totalFolders: number;
  };
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('mylibrary_token');
}

export function setToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('mylibrary_token', token);
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('mylibrary_token');
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `Erro ${response.status}`;
    try {
      const errData = await response.json();
      errorMessage = Array.isArray(errData.message)
        ? errData.message.join(', ')
        : errData.message || errorMessage;
    } catch {
      // Ignora erro de parse JSON
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export function getFileStreamUrl(fileId: string, download = false): string {
  const token = getToken() || '';
  const dl = download ? '1' : '0';
  return `${API_BASE_URL}/api/drive/files/${fileId}/content?download=${dl}&token=${encodeURIComponent(token)}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

