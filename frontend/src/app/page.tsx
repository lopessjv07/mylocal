'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  Clock,
  Cloud,
  Download,
  Edit2,
  Eye,
  File,
  FileSpreadsheet,
  FileText,
  Film,
  Folder,
  FolderInput,
  FolderPlus,
  Grid,
  HardDrive,
  Home,
  Image as ImageIcon,
  KeyRound,
  List,
  LogOut,
  Music,
  Search,
  Star,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  apiRequest,
  BreadcrumbItem,
  clearToken,
  DriveResponse,
  FileRecord,
  FolderItem,
  formatBytes,
  formatDate,
  getFileStreamUrl,
  getToken,
  UserProfile,
} from '@/lib/api';
import { LightDismissDialog } from '@/components/LightDismissDialog';

type SectionType = 'drive' | 'favorites' | 'recent' | 'documents' | 'images' | 'media';

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  storageQuota: number;
  storageUsed: number;
  filesCount: number;
  foldersCount: number;
  createdAt: string;
}

export default function CloudDashboardPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [section, setSection] = useState<SectionType>('drive');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [stats, setStats] = useState({
    usedBytes: 0,
    quotaBytes: 10737418240,
    totalFiles: 0,
    totalFolders: 0,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  // Modais
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [renameTarget, setRenameTarget] = useState<{
    type: 'folder' | 'file';
    id: string;
    name: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [moveTarget, setMoveTarget] = useState<{
    type: 'folder' | 'file';
    id: string;
    name: string;
    currentParentId: string | null;
  } | null>(null);
  const [allFolders, setAllFolders] = useState<
    Array<{ id: string; name: string; parentId: string | null }>
  >([]);
  const [selectedMoveFolderId, setSelectedMoveFolderId] = useState<string>('');

  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [textPreviewContent, setTextPreviewContent] = useState<string | null>(null);

  // Admin & Conta Modais
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'USER' | 'ADMIN'>('USER');

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const showMessage = (type: 'error' | 'success', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const loadDrive = useCallback(
    async (
      targetFolderId: string | null = currentFolderId,
      targetSection: SectionType = section,
      targetSearch: string = searchQuery,
    ) => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.set('section', targetSection);
        if (targetSection === 'drive' && targetFolderId) {
          params.set('folderId', targetFolderId);
        }
        if (targetSearch.trim()) {
          params.set('search', targetSearch.trim());
        }

        const data = await apiRequest<DriveResponse>(
          `/api/drive/contents?${params.toString()}`,
        );

        setBreadcrumbs(data.breadcrumbs);
        setFolders(data.folders);
        setFiles(data.files);
        setStats(data.stats);
      } catch (err: any) {
        showMessage('error', err.message || 'Erro ao carregar arquivos.');
      } finally {
        setLoading(false);
      }
    },
    [currentFolderId, section, searchQuery],
  );

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    apiRequest<{ user: UserProfile }>('/api/auth/me')
      .then((res) => {
        setUser(res.user);
        loadDrive(null, 'drive', '');
      })
      .catch(() => {
        clearToken();
        router.replace('/login');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      loadDrive(currentFolderId, section, searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [currentFolderId, section, searchQuery, user, loadDrive]);

  const handleSelectSection = (nextSection: SectionType) => {
    setSection(nextSection);
    if (nextSection !== 'drive') {
      setCurrentFolderId(null);
    }
  };

  const handleOpenFolder = (folderId: string | null) => {
    setSection('drive');
    setSearchQuery('');
    setCurrentFolderId(folderId);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      await apiRequest('/api/drive/folders', {
        method: 'POST',
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentId: section === 'drive' ? currentFolderId : null,
        }),
      });
      setNewFolderName('');
      setNewFolderOpen(false);
      showMessage('success', 'Pasta criada com sucesso!');
      loadDrive();
    } catch (err: any) {
      showMessage('error', err.message);
    }
  };

  const handleUploadFiles = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;

    const formData = new FormData();
    for (const file of arr) {
      formData.append('files', file);
    }
    if (section === 'drive' && currentFolderId) {
      formData.append('folderId', currentFolderId);
    }

    try {
      setUploading(true);
      await apiRequest('/api/drive/files/upload', {
        method: 'POST',
        body: formData,
      });
      showMessage(
        'success',
        arr.length === 1
          ? `Arquivo "${arr[0].name}" enviado!`
          : `${arr.length} arquivos enviados com sucesso!`,
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      loadDrive();
    } catch (err: any) {
      showMessage('error', err.message || 'Falha no upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameValue.trim()) return;

    try {
      const endpoint =
        renameTarget.type === 'folder'
          ? `/api/drive/folders/${renameTarget.id}`
          : `/api/drive/files/${renameTarget.id}`;

      await apiRequest(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({ name: renameValue.trim() }),
      });

      setRenameTarget(null);
      showMessage('success', 'Item renomeado com sucesso!');
      loadDrive();
    } catch (err: any) {
      showMessage('error', err.message);
    }
  };

  const openMoveModal = async (target: {
    type: 'folder' | 'file';
    id: string;
    name: string;
    currentParentId: string | null;
  }) => {
    try {
      const res = await apiRequest<{
        folders: Array<{ id: string; name: string; parentId: string | null }>;
      }>('/api/drive/folders/all');
      setAllFolders(res.folders);
      setSelectedMoveFolderId(target.currentParentId || '');
      setMoveTarget(target);
    } catch (err: any) {
      showMessage('error', err.message);
    }
  };

  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveTarget) return;

    try {
      const targetId = selectedMoveFolderId || null;
      if (moveTarget.type === 'folder') {
        await apiRequest(`/api/drive/folders/${moveTarget.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ parentId: targetId }),
        });
      } else {
        await apiRequest(`/api/drive/files/${moveTarget.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ folderId: targetId }),
        });
      }

      setMoveTarget(null);
      showMessage('success', `"${moveTarget.name}" movido com sucesso!`);
      loadDrive();
    } catch (err: any) {
      showMessage('error', err.message);
    }
  };

  const handleDeleteFolder = async (folder: FolderItem) => {
    if (
      !window.confirm(
        `Tem certeza que deseja excluir a pasta "${folder.name}" e todo o seu conteúdo?`,
      )
    ) {
      return;
    }

    try {
      await apiRequest(`/api/drive/folders/${folder.id}`, {
        method: 'DELETE',
      });
      showMessage('success', `Pasta "${folder.name}" removida.`);
      loadDrive();
    } catch (err: any) {
      showMessage('error', err.message);
    }
  };

  const handleDeleteFile = async (file: FileRecord) => {
    if (!window.confirm(`Deseja excluir permanentemente o arquivo "${file.name}"?`)) {
      return;
    }

    try {
      await apiRequest(`/api/drive/files/${file.id}`, {
        method: 'DELETE',
      });
      showMessage('success', `Arquivo "${file.name}" excluído.`);
      if (previewFile?.id === file.id) {
        setPreviewFile(null);
      }
      loadDrive();
    } catch (err: any) {
      showMessage('error', err.message);
    }
  };

  const handleToggleFavorite = async (file: FileRecord) => {
    try {
      await apiRequest(`/api/drive/files/${file.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isFavorite: !file.isFavorite }),
      });
      loadDrive();
    } catch (err: any) {
      showMessage('error', err.message);
    }
  };

  const handleOpenPreview = async (file: FileRecord) => {
    setPreviewFile(file);
    setTextPreviewContent(null);

    if (
      file.mimeType.startsWith('text/') ||
      file.mimeType.includes('json') ||
      file.name.endsWith('.md') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.csv')
    ) {
      try {
        const res = await fetch(getFileStreamUrl(file.id, false));
        const txt = await res.text();
        setTextPreviewContent(txt.slice(0, 50000));
      } catch {
        setTextPreviewContent('Não foi possível carregar o texto deste arquivo.');
      }
    }
  };

  // Admin: Gerenciar usuários
  const openUsersModal = async () => {
    setUsersModalOpen(true);
    try {
      const list = await apiRequest<ManagedUser[]>('/api/users');
      setManagedUsers(list);
    } catch (err: any) {
      showMessage('error', err.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
        }),
      });
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      showMessage('success', 'Conta de usuário criada com sucesso!');
      const list = await apiRequest<ManagedUser[]>('/api/users');
      setManagedUsers(list);
    } catch (err: any) {
      showMessage('error', err.message);
    }
  };

  const handleDeleteUser = async (target: ManagedUser) => {
    if (!window.confirm(`Remover o usuário "${target.name}" (${target.email}) e seus arquivos?`)) {
      return;
    }
    try {
      await apiRequest(`/api/users/${target.id}`, { method: 'DELETE' });
      const list = await apiRequest<ManagedUser[]>('/api/users');
      setManagedUsers(list);
      showMessage('success', 'Usuário removido.');
    } catch (err: any) {
      showMessage('error', err.message);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordModalOpen(false);
      showMessage('success', 'Senha alterada com sucesso!');
    } catch (err: any) {
      showMessage('error', err.message);
    }
  };

  const renderFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon size={18} color="#38bdf8" />;
    if (mimeType.startsWith('video/')) return <Film size={18} color="#f472b6" />;
    if (mimeType.startsWith('audio/')) return <Music size={18} color="#c084fc" />;
    if (mimeType.includes('pdf')) return <FileText size={18} color="#f87171" />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv'))
      return <FileSpreadsheet size={18} color="#34d399" />;
    if (mimeType.startsWith('text/') || mimeType.includes('document') || mimeType.includes('word'))
      return <FileText size={18} color="#818cf8" />;
    return <File size={18} color="#94a3b8" />;
  };

  const usagePercent = Math.min(
    100,
    Math.round((stats.usedBytes / Math.max(stats.quotaBytes, 1)) * 100),
  );

  const sectionLabels: Record<SectionType, string> = {
    drive: 'Meu Drive',
    favorites: 'Arquivos Favoritos',
    recent: 'Arquivos Recentes',
    documents: 'Documentos & PDFs',
    images: 'Imagens & Fotos',
    media: 'Áudio & Vídeo',
  };

  return (
    <div className="cloud-shell">
      {/* Sidebar */}
      <aside className="cloud-sidebar">
        <div>
          <div className="brand-header" style={{ marginBottom: '1.75rem' }}>
            <div className="brand-icon">
              <Cloud size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>MyLibrary</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Nuvem Pessoal Privada
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: '1.25rem', padding: '0.7rem' }}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={17} />
            {uploading ? 'Enviando...' : 'Enviar Arquivos'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
          />

          <nav aria-label="Navegação da nuvem">
            <ul className="nav-list">
              <li>
                <button
                  type="button"
                  className={`nav-item-btn ${section === 'drive' ? 'active' : ''}`}
                  onClick={() => handleSelectSection('drive')}
                >
                  <HardDrive size={18} />
                  Meu Drive
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`nav-item-btn ${section === 'favorites' ? 'active' : ''}`}
                  onClick={() => handleSelectSection('favorites')}
                >
                  <Star size={18} />
                  Favoritos
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`nav-item-btn ${section === 'recent' ? 'active' : ''}`}
                  onClick={() => handleSelectSection('recent')}
                >
                  <Clock size={18} />
                  Recentes
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`nav-item-btn ${section === 'documents' ? 'active' : ''}`}
                  onClick={() => handleSelectSection('documents')}
                >
                  <FileText size={18} />
                  Documentos
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`nav-item-btn ${section === 'images' ? 'active' : ''}`}
                  onClick={() => handleSelectSection('images')}
                >
                  <ImageIcon size={18} />
                  Imagens
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`nav-item-btn ${section === 'media' ? 'active' : ''}`}
                  onClick={() => handleSelectSection('media')}
                >
                  <Film size={18} />
                  Áudio & Vídeo
                </button>
              </li>

              {user?.role === 'ADMIN' && (
                <li style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    type="button"
                    className="nav-item-btn"
                    onClick={openUsersModal}
                  >
                    <Users size={18} />
                    Contas & Acesso
                  </button>
                </li>
              )}
            </ul>
          </nav>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="storage-box">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              <span>Armazenamento</span>
              <span>{usagePercent}%</span>
            </div>
            <div className="storage-bar-track">
              <div
                className="storage-bar-fill"
                style={{ width: `${Math.max(usagePercent, stats.usedBytes > 0 ? 3 : 0)}%` }}
              />
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              {formatBytes(stats.usedBytes)} de {formatBytes(stats.quotaBytes)} usados
            </div>
            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {stats.totalFolders} pastas • {stats.totalFiles} arquivos
            </div>
          </div>

          {user && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {user.name}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {user.email}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.2rem' }}>
                <button
                  type="button"
                  className="icon-btn"
                  title="Alterar minha senha"
                  aria-label="Alterar minha senha"
                  onClick={() => setPasswordModalOpen(true)}
                >
                  <KeyRound size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Sair da conta"
                  aria-label="Sair da conta"
                  onClick={() => {
                    clearToken();
                    router.push('/login');
                  }}
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Área Principal com suporte a Drag and Drop */}
      <main
        className={`cloud-main ${isDragging ? 'dropzone-active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleUploadFiles(e.dataTransfer.files);
          }
        }}
      >
        {/* Topbar */}
        <header className="topbar">
          <div className="search-box">
            <Search size={17} />
            <input
              type="search"
              placeholder="Pesquisar pastas ou documentos por nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Pesquisar arquivos e pastas"
            />
          </div>

          <div className="toolbar-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setNewFolderName('');
                setNewFolderOpen(true);
              }}
            >
              <FolderPlus size={17} />
              Nova Pasta
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={17} />
              Upload
            </button>

            <div
              style={{
                display: 'inline-flex',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '2px',
              }}
            >
              <button
                type="button"
                className="icon-btn"
                style={{
                  background:
                    viewMode === 'table' ? 'var(--bg-surface-elevated)' : 'transparent',
                  color: viewMode === 'table' ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
                onClick={() => setViewMode('table')}
                aria-label="Visualização em tabela"
                title="Visualização em tabela"
              >
                <List size={17} />
              </button>
              <button
                type="button"
                className="icon-btn"
                style={{
                  background:
                    viewMode === 'grid' ? 'var(--bg-surface-elevated)' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
                onClick={() => setViewMode('grid')}
                aria-label="Visualização em grade"
                title="Visualização em grade"
              >
                <Grid size={17} />
              </button>
            </div>
          </div>
        </header>

        {/* Feedback Banner */}
        {feedback && (
          <div
            className={`alert-banner ${
              feedback.type === 'error' ? 'alert-error' : 'alert-success'
            }`}
            role="status"
          >
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Barra de caminho (Breadcrumbs) */}
        <nav className="breadcrumbs-bar" aria-label="Caminho da pasta atual">
          <button
            type="button"
            className={`breadcrumb-btn ${
              section === 'drive' && !currentFolderId ? 'current' : ''
            }`}
            onClick={() => handleOpenFolder(null)}
          >
            <Home size={16} />
            {sectionLabels[section]}
          </button>

          {section === 'drive' &&
            breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.id}>
                <ChevronRight size={15} color="var(--text-muted)" />
                <button
                  type="button"
                  className={`breadcrumb-btn ${
                    idx === breadcrumbs.length - 1 ? 'current' : ''
                  }`}
                  onClick={() => handleOpenFolder(crumb.id)}
                >
                  <Folder size={15} />
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
        </nav>

        {/* Pastas */}
        {folders.length > 0 && (
          <section aria-labelledby="folders-heading">
            <div className="section-heading">
              <span id="folders-heading">Pastas ({folders.length})</span>
            </div>
            <div className="folders-grid">
              {folders.map((folder) => (
                <div key={folder.id} className="folder-card">
                  <button
                    type="button"
                    className="folder-card-main"
                    onClick={() => handleOpenFolder(folder.id)}
                  >
                    <div className="folder-icon-box">
                      <Folder size={20} />
                    </div>
                    <div className="folder-meta">
                      <div className="folder-name" title={folder.name}>
                        {folder.name}
                      </div>
                      <div className="folder-sub">
                        {folder.itemsCount ?? 0}{' '}
                        {(folder.itemsCount ?? 0) === 1 ? 'item' : 'itens'}
                      </div>
                    </div>
                  </button>

                  <div style={{ display: 'flex', gap: '2px' }}>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Renomear pasta"
                      aria-label={`Renomear pasta ${folder.name}`}
                      onClick={() => {
                        setRenameTarget({
                          type: 'folder',
                          id: folder.id,
                          name: folder.name,
                        });
                        setRenameValue(folder.name);
                      }}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Mover pasta"
                      aria-label={`Mover pasta ${folder.name}`}
                      onClick={() =>
                        openMoveModal({
                          type: 'folder',
                          id: folder.id,
                          name: folder.name,
                          currentParentId: folder.parentId,
                        })
                      }
                    >
                      <FolderInput size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Excluir pasta"
                      aria-label={`Excluir pasta ${folder.name}`}
                      onClick={() => handleDeleteFolder(folder)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Arquivos */}
        <section aria-labelledby="files-heading" style={{ flex: 1 }}>
          <div className="section-heading">
            <span id="files-heading">Arquivos e Documentos ({files.length})</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 400, textTransform: 'none' }}>
              Dica: Arraste arquivos para qualquer lugar da tela para fazer upload
            </span>
          </div>

          {loading ? (
            <div
              style={{
                padding: '3rem',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              Carregando conteúdo da sua nuvem...
            </div>
          ) : files.length === 0 ? (
            <div
              style={{
                padding: '3.5rem 1.5rem',
                textAlign: 'center',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border-strong)',
              }}
            >
              <Cloud
                size={40}
                style={{ color: 'var(--accent)', marginBottom: '0.75rem' }}
              />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Nenhum arquivo nesta visualização
              </h3>
              <p
                style={{
                  fontSize: '0.86rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '1.25rem',
                }}
              >
                Envie documentos, PDFs, fotos ou planilhas ou arraste-os diretamente para cá.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} />
                Selecionar Arquivos do Computador
              </button>
            </div>
          ) : viewMode === 'table' ? (
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="files-table-caption"
              className="table-wrapper"
            >
              <table
                className="files-table"
                style={
                  {
                    '--label-2': '"Tamanho"',
                    '--label-3': '"Tipo"',
                    '--label-4': '"Modificado"',
                    '--label-5': '"Ações"',
                  } as React.CSSProperties
                }
              >
                <caption id="files-table-caption" className="sr-only">
                  Lista de arquivos e documentos armazenados
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Nome do Arquivo</th>
                    <th scope="col">Tamanho</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Modificado</th>
                    <th scope="col" style={{ textAlign: 'right' }}>
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id}>
                      <th scope="row">
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.65rem',
                          }}
                        >
                          {renderFileIcon(file.mimeType)}
                          <button
                            type="button"
                            onClick={() => handleOpenPreview(file)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-primary)',
                              fontWeight: 600,
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontSize: '0.9rem',
                            }}
                            title="Clique para visualizar o arquivo"
                          >
                            {file.name}
                          </button>
                        </div>
                      </th>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {formatBytes(file.size)}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        {file.mimeType}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        {formatDate(file.updatedAt)}
                      </td>
                      <td>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '0.25rem',
                          }}
                        >
                          <button
                            type="button"
                            className={`icon-btn ${file.isFavorite ? 'active-star' : ''}`}
                            onClick={() => handleToggleFavorite(file)}
                            title={
                              file.isFavorite
                                ? 'Remover dos favoritos'
                                : 'Marcar como favorito'
                            }
                            aria-label={`Favoritar ${file.name}`}
                          >
                            <Star
                              size={16}
                              fill={file.isFavorite ? 'currentColor' : 'none'}
                            />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => handleOpenPreview(file)}
                            title="Visualizar arquivo"
                            aria-label={`Visualizar ${file.name}`}
                          >
                            <Eye size={16} />
                          </button>
                          <a
                            href={getFileStreamUrl(file.id, true)}
                            className="icon-btn"
                            title="Baixar arquivo"
                            aria-label={`Baixar ${file.name}`}
                          >
                            <Download size={16} />
                          </a>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => {
                              setRenameTarget({
                                type: 'file',
                                id: file.id,
                                name: file.name,
                              });
                              setRenameValue(file.name);
                            }}
                            title="Renomear arquivo"
                            aria-label={`Renomear ${file.name}`}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() =>
                              openMoveModal({
                                type: 'file',
                                id: file.id,
                                name: file.name,
                                currentParentId: file.folderId,
                              })
                            }
                            title="Mover para outra pasta"
                            aria-label={`Mover ${file.name}`}
                          >
                            <FolderInput size={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => handleDeleteFile(file)}
                            title="Excluir arquivo"
                            aria-label={`Excluir ${file.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="files-grid">
              {files.map((file) => (
                <div key={file.id} className="file-card">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenPreview(file)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        minWidth: 0,
                      }}
                    >
                      {renderFileIcon(file.mimeType)}
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={file.name}
                      >
                        {file.name}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`icon-btn ${file.isFavorite ? 'active-star' : ''}`}
                      onClick={() => handleToggleFavorite(file)}
                      aria-label={`Favoritar ${file.name}`}
                    >
                      <Star size={16} fill={file.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <div>{formatBytes(file.size)}</div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      {formatDate(file.updatedAt)}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      paddingTop: '0.5rem',
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                      onClick={() => handleOpenPreview(file)}
                    >
                      <Eye size={14} /> Abrir
                    </button>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <a
                        href={getFileStreamUrl(file.id, true)}
                        className="icon-btn"
                        title="Baixar"
                      >
                        <Download size={15} />
                      </a>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => handleDeleteFile(file)}
                        title="Excluir"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Modal: Criar Nova Pasta */}
      <LightDismissDialog
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        title="Criar Nova Pasta"
      >
        <form onSubmit={handleCreateFolder}>
          <div className="form-group">
            <label htmlFor="new-folder-name" className="form-label">
              Nome da pasta
            </label>
            <input
              id="new-folder-name"
              type="text"
              className="form-input"
              placeholder="Ex: Contratos 2026"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setNewFolderOpen(false)}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Criar Pasta
            </button>
          </div>
        </form>
      </LightDismissDialog>

      {/* Modal: Renomear Pasta ou Arquivo */}
      <LightDismissDialog
        open={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        title={`Renomear ${renameTarget?.type === 'folder' ? 'Pasta' : 'Arquivo'}`}
      >
        <form onSubmit={handleRenameSubmit}>
          <div className="form-group">
            <label htmlFor="rename-input" className="form-label">
              Novo nome
            </label>
            <input
              id="rename-input"
              type="text"
              className="form-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRenameTarget(null)}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Salvar
            </button>
          </div>
        </form>
      </LightDismissDialog>

      {/* Modal: Mover Pasta ou Arquivo */}
      <LightDismissDialog
        open={Boolean(moveTarget)}
        onClose={() => setMoveTarget(null)}
        title={`Mover "${moveTarget?.name || ''}"`}
      >
        <form onSubmit={handleMoveSubmit}>
          <div className="form-group">
            <label htmlFor="move-destination" className="form-label">
              Selecione a pasta de destino
            </label>
            <select
              id="move-destination"
              className="form-select"
              value={selectedMoveFolderId}
              onChange={(e) => setSelectedMoveFolderId(e.target.value)}
            >
              <option value="">Raiz (Meu Drive)</option>
              {allFolders
                .filter((f) => f.id !== moveTarget?.id)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setMoveTarget(null)}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Mover para cá
            </button>
          </div>
        </form>
      </LightDismissDialog>

      {/* Modal: Visualização (Preview) de Arquivo */}
      <LightDismissDialog
        open={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        title={previewFile?.name || 'Visualizar Arquivo'}
        maxWidthClass="dialog-lg"
      >
        {previewFile && (
          <div>
            <div className="preview-container">
              {previewFile.mimeType.startsWith('image/') ? (
                <img
                  src={getFileStreamUrl(previewFile.id, false)}
                  alt={previewFile.name}
                />
              ) : previewFile.mimeType.includes('pdf') ? (
                <iframe
                  src={getFileStreamUrl(previewFile.id, false)}
                  title={previewFile.name}
                />
              ) : previewFile.mimeType.startsWith('video/') ? (
                <video controls src={getFileStreamUrl(previewFile.id, false)} />
              ) : previewFile.mimeType.startsWith('audio/') ? (
                <audio controls src={getFileStreamUrl(previewFile.id, false)} />
              ) : textPreviewContent !== null ? (
                <pre
                  style={{
                    width: '100%',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    fontFamily: 'monospace',
                  }}
                >
                  {textPreviewContent}
                </pre>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <FileText
                    size={42}
                    style={{ color: 'var(--accent)', marginBottom: '0.75rem' }}
                  />
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    Este formato ({previewFile.mimeType}) pode ser baixado diretamente.
                  </p>
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '1.1rem',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Tamanho: <strong>{formatBytes(previewFile.size)}</strong> • Atualizado em{' '}
                {formatDate(previewFile.updatedAt)}
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <a
                  href={getFileStreamUrl(previewFile.id, true)}
                  className="btn btn-primary"
                >
                  <Download size={16} />
                  Baixar Arquivo
                </a>
              </div>
            </div>
          </div>
        )}
      </LightDismissDialog>

      {/* Modal: Alterar Senha */}
      <LightDismissDialog
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        title="Alterar Minha Senha"
      >
        <form onSubmit={handleChangePassword}>
          <div className="form-group">
            <label htmlFor="curr-pass" className="form-label">
              Senha atual
            </label>
            <input
              id="curr-pass"
              type="password"
              className="form-input"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="new-pass" className="form-label">
              Nova senha (mín. 6 caracteres)
            </label>
            <input
              id="new-pass"
              type="password"
              className="form-input"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPasswordModalOpen(false)}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Atualizar Senha
            </button>
          </div>
        </form>
      </LightDismissDialog>

      {/* Modal Admin: Gerenciar Contas de Usuários */}
      <LightDismissDialog
        open={usersModalOpen}
        onClose={() => setUsersModalOpen(false)}
        title="Gerenciar Contas da Nuvem (Admin)"
        maxWidthClass="dialog-lg"
      >
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <form
            onSubmit={handleCreateUser}
            style={{
              background: 'var(--bg-app)',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <h3
              style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                marginBottom: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <UserPlus size={16} /> Criar Nova Conta de Acesso
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem',
              }}
            >
              <div>
                <label htmlFor="admin-user-name" className="form-label">
                  Nome
                </label>
                <input
                  id="admin-user-name"
                  type="text"
                  className="form-input"
                  placeholder="Nome completo"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="admin-user-email" className="form-label">
                  E-mail
                </label>
                <input
                  id="admin-user-email"
                  type="email"
                  className="form-input"
                  placeholder="usuario@mylibrary.local"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="admin-user-pass" className="form-label">
                  Senha inicial
                </label>
                <input
                  id="admin-user-pass"
                  type="password"
                  className="form-input"
                  placeholder="Mín. 6 caracteres"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="admin-user-role" className="form-label">
                  Perfil
                </label>
                <select
                  id="admin-user-role"
                  className="form-select"
                  value={newUserRole}
                  onChange={(e) =>
                    setNewUserRole(e.target.value as 'USER' | 'ADMIN')
                  }
                >
                  <option value="USER">Usuário Padrão</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary">
                <UserPlus size={16} /> Adicionar Conta
              </button>
            </div>
          </form>

          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.65rem' }}>
              Contas Cadastradas ({managedUsers.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {managedUsers.map((u) => (
                <div
                  key={u.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {u.name}{' '}
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'var(--accent-soft)',
                          color: '#a5b4fc',
                          marginLeft: '0.4rem',
                        }}
                      >
                        {u.role}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {u.email} • {formatBytes(u.storageUsed)} usados ({u.filesCount}{' '}
                      arquivos)
                    </div>
                  </div>
                  {u.id !== user?.id && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: '0.4rem 0.7rem', fontSize: '0.78rem' }}
                      onClick={() => handleDeleteUser(u)}
                    >
                      <Trash2 size={14} /> Remover
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </LightDismissDialog>
    </div>
  );
}
