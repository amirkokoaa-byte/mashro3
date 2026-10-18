import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  X,
  Copy,
  Check,
  Edit3,
  Trash2,
  Globe,
  Github,
  Triangle,
  ExternalLink,
  Search,
  FolderKanban,
  Layers,
  Code2,
  Sparkles,
  Link2,
  FileText,
  ArrowUpLeft,
  Save,
  Flame,
  Menu,
  Settings,
  Lock,
  Unlock,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './firebase';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
} from 'firebase/firestore';

export interface Project {
  id: string;
  description: string;
  liveUrl: string;
  githubUrl: string;
  vercelUrl: string;
  firebaseUrl?: string;
  googleStudioUrl?: string;
  createdAt?: string;
}

export default function App() {
  // 1. تعريف حالة المشاريع
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Mobile Sidebar Drawer State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Authentication / Settings State (Default: false so visitors only see description + open button)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Modals & UI States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isEditingInModal, setIsEditingInModal] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Add Project Form State
  const [description, setDescription] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [vercelUrl, setVercelUrl] = useState('');
  const [firebaseUrl, setFirebaseUrl] = useState('');
  const [googleStudioUrl, setGoogleStudioUrl] = useState('https://aistudio.google.com/');
  const [formError, setFormError] = useState('');

  // Edit Project Form State (inside Details Modal)
  const [editDescription, setEditDescription] = useState('');
  const [editLiveUrl, setEditLiveUrl] = useState('');
  const [editGithubUrl, setEditGithubUrl] = useState('');
  const [editVercelUrl, setEditVercelUrl] = useState('');
  const [editFirebaseUrl, setEditFirebaseUrl] = useState('');
  const [editGoogleStudioUrl, setEditGoogleStudioUrl] = useState('');

  // Clipboard & Toast Notification State
  const [copiedFieldKey, setCopiedFieldKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  // Trigger Toast Notification
  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 2600);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // 2. دالة لجلب المشاريع من السحابة عند فتح الموقع
  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      const querySnapshot = await getDocs(collection(db, 'projects'));
      const projectsData: Project[] = querySnapshot.docs.map((docItem) => {
        const data = docItem.data();
        return {
          id: docItem.id,
          description: data.description || '',
          liveUrl: data.liveUrl || '',
          githubUrl: data.githubUrl || '',
          vercelUrl: data.vercelUrl || '',
          firebaseUrl: data.firebaseUrl || '',
          googleStudioUrl: data.googleStudioUrl || 'https://aistudio.google.com/',
          createdAt: data.createdAt || new Date().toISOString().split('T')[0],
        };
      });
      setProjects(projectsData);
    } catch (error) {
      console.error('حدث خطأ أثناء جلب المشاريع من فايربيز: ', error);
      showToast('تعذر جلب البيانات من السحابة، تأكد من صلاحيات Firestore');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // تشغيل دالة الجلب مرة واحدة عند تحميل الصفحة
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Copy to Clipboard Handler
  const handleCopy = async (text: string, fieldLabel: string, fieldKey: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFieldKey(fieldKey);
      showToast(`تم نسخ ${fieldLabel} إلى الحافظة بنجاح`);
      setTimeout(() => {
        setCopiedFieldKey((prev) => (prev === fieldKey ? null : prev));
      }, 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedFieldKey(fieldKey);
      showToast(`تم نسخ ${fieldLabel} إلى الحافظة بنجاح`);
      setTimeout(() => {
        setCopiedFieldKey((prev) => (prev === fieldKey ? null : prev));
      }, 2000);
    }
  };

  // Reset Add Form
  const resetAddForm = () => {
    setDescription('');
    setLiveUrl('');
    setGithubUrl('');
    setVercelUrl('');
    setFirebaseUrl('');
    setGoogleStudioUrl('https://aistudio.google.com/');
    setFormError('');
  };

  // 3. دالة لحفظ مشروع جديد في فايربيز (مربوطة بزر "حفظ" في الشاشة المنبثقة)
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !description.trim() &&
      !liveUrl.trim() &&
      !githubUrl.trim() &&
      !vercelUrl.trim() &&
      !firebaseUrl.trim()
    ) {
      setFormError('يرجى إدخال وصف الموقع أو أحد الروابط على الأقل لحفظ المشروع.');
      return;
    }

    const newProjectData = {
      description: description.trim() || 'مشروع بدون وصف',
      liveUrl: liveUrl.trim(),
      githubUrl: githubUrl.trim(),
      vercelUrl: vercelUrl.trim(),
      firebaseUrl: firebaseUrl.trim(),
      googleStudioUrl: googleStudioUrl.trim() || 'https://aistudio.google.com/',
      createdAt: new Date().toISOString().split('T')[0],
    };

    try {
      setIsSubmitting(true);
      await addDoc(collection(db, 'projects'), newProjectData);
      console.log('تم حفظ المشروع في فايربيز بنجاح!');
      resetAddForm();
      setIsAddModalOpen(false);
      showToast('تم حفظ المشروع في فايربيز بنجاح!');
      await fetchProjects();
    } catch (error) {
      console.error('حدث خطأ أثناء الحفظ: ', error);
      setFormError('حدث خطأ أثناء الحفظ في فايربيز. تأكد من إعدادات القواعد (Rules).');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Details Modal
  const handleOpenDetails = (project: Project) => {
    setSelectedProjectId(project.id);
    setIsEditingInModal(false);
    setEditDescription(project.description);
    setEditLiveUrl(project.liveUrl);
    setEditGithubUrl(project.githubUrl);
    setEditVercelUrl(project.vercelUrl);
    setEditFirebaseUrl(project.firebaseUrl || '');
    setEditGoogleStudioUrl(project.googleStudioUrl || 'https://aistudio.google.com/');
  };

  // Close Details Modal
  const handleCloseDetails = () => {
    setSelectedProjectId(null);
    setIsEditingInModal(false);
  };

  // Start Editing inside Details Modal
  const handleStartEdit = () => {
    if (!selectedProject) return;
    setEditDescription(selectedProject.description);
    setEditLiveUrl(selectedProject.liveUrl);
    setEditGithubUrl(selectedProject.githubUrl);
    setEditVercelUrl(selectedProject.vercelUrl);
    setEditFirebaseUrl(selectedProject.firebaseUrl || '');
    setEditGoogleStudioUrl(selectedProject.googleStudioUrl || 'https://aistudio.google.com/');
    setIsEditingInModal(true);
  };

  // Save Edited Project inside Details Modal to Firestore
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    const updatedData = {
      description: editDescription.trim() || 'مشروع بدون وصف',
      liveUrl: editLiveUrl.trim(),
      githubUrl: editGithubUrl.trim(),
      vercelUrl: editVercelUrl.trim(),
      firebaseUrl: editFirebaseUrl.trim(),
      googleStudioUrl: editGoogleStudioUrl.trim() || 'https://aistudio.google.com/',
    };

    try {
      setIsSubmitting(true);
      await updateDoc(doc(db, 'projects', selectedProject.id), updatedData);
      setIsEditingInModal(false);
      showToast('تم تحديث بيانات المشروع في السحابة بنجاح');
      await fetchProjects();
    } catch (error) {
      console.error('حدث خطأ أثناء التحديث: ', error);
      showToast('حدث خطأ أثناء تحديث المشروع');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. دالة لحذف مشروع من فايربيز (مربوطة بزر "حذف" في شاشة التفاصيل)
  const handleDeleteProject = async (projectId: string) => {
    try {
      setIsSubmitting(true);
      await deleteDoc(doc(db, 'projects', projectId));
      console.log('تم الحذف بنجاح');
      setSelectedProjectId(null);
      setIsEditingInModal(false);
      showToast('تم حذف المشروع من السحابة بنجاح');
      await fetchProjects();
    } catch (error) {
      console.error('خطأ في الحذف: ', error);
      showToast('حدث خطأ أثناء حذف المشروع');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Settings Password Submit
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === '0000') {
      setIsAuthenticated(true);
      setPasswordInput('');
      setPasswordError(false);
      setIsSettingsModalOpen(false);
      showToast('تم تسجيل الدخول وإظهار جميع الروابط');
    } else {
      setPasswordError(true);
      setPasswordInput('');
    }
  };

  // Filtered Projects
  const filteredProjects = useMemo(() => {
    return projects.filter((proj) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (proj.description || '').toLowerCase().includes(q) ||
        (isAuthenticated &&
          ((proj.liveUrl || '').toLowerCase().includes(q) ||
            (proj.githubUrl || '').toLowerCase().includes(q) ||
            (proj.vercelUrl || '').toLowerCase().includes(q) ||
            (proj.firebaseUrl || '').toLowerCase().includes(q)))
      );
    });
  }, [projects, searchQuery, isAuthenticated]);

  // Total Registered Links Counter
  const totalRegisteredLinks = useMemo(() => {
    return projects.reduce(
      (acc, p) =>
        acc +
        (p.liveUrl ? 1 : 0) +
        (p.githubUrl ? 1 : 0) +
        (p.vercelUrl ? 1 : 0) +
        (p.firebaseUrl ? 1 : 0),
      0
    );
  }, [projects]);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddModalOpen) setIsAddModalOpen(false);
        if (selectedProjectId) handleCloseDetails();
        if (isSettingsModalOpen) {
          setIsSettingsModalOpen(false);
          setPasswordInput('');
          setPasswordError(false);
        }
        if (isMobileSidebarOpen) setIsMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddModalOpen, selectedProjectId, isSettingsModalOpen, isMobileSidebarOpen]);

  const formatUrlLabel = (url: string, fallback: string) => {
    if (!url) return fallback;
    try {
      const normalized = url.startsWith('http') ? url : `https://${url}`;
      const parsed = new URL(normalized);
      return `${parsed.hostname}${parsed.pathname !== '/' ? parsed.pathname : ''}`;
    } catch {
      return url;
    }
  };

  const ensureProtocol = (url: string) => {
    if (!url) return '#';
    return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
  };

  // Reusable Sidebar Content (used in both Desktop static sidebar and Mobile drawer)
  const renderSidebarContent = () => (
    <div className="glow-sidebar rounded-2xl p-6 flex flex-col justify-between h-full gap-8">
      {/* Top Brand & Control Panel */}
      <div className="space-y-7">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.25)]">
              <Layers className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                لوحة المشاريع
              </h1>
              <p className="text-xs text-slate-400">
                المعرض الشخصي وإدارة الروابط
              </p>
            </div>
          </div>

          {/* Close Button on Mobile Sidebar */}
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label="إغلاق القائمة الجانبية"
            className="lg:hidden h-9 w-9 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary CTA Button: "أضف مشروع" */}
        <div>
          <button
            type="button"
            onClick={() => {
              resetAddForm();
              setIsMobileSidebarOpen(false);
              setIsAddModalOpen(true);
            }}
            className="glow-button-primary w-full py-3.5 px-5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span className="whitespace-nowrap">أضف مشروع</span>
          </button>
        </div>

        {/* Navigation Item: جميع المشاريع */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400 px-2 pb-1">
            القائمة الرئيسية
          </p>
          <nav className="space-y-1.5">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setIsMobileSidebarOpen(false);
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer bg-sky-500/18 text-sky-200 border border-sky-400/50 shadow-[0_0_18px_rgba(56,189,248,0.22)]"
            >
              <span className="flex items-center gap-3 whitespace-nowrap">
                <FolderKanban className="w-4 h-4 text-sky-300" />
                <span>جميع المشاريع</span>
              </span>
              <span className="font-mono text-xs tabular-nums text-sky-200">
                {projects.length}
              </span>
            </button>
          </nav>
        </div>
      </div>

      {/* Sidebar Bottom Platform Links & Settings */}
      <div className="space-y-2.5 pt-6 border-t border-white/10">
        {/* 1. فتح منصة Google Studio */}
        <a
          href="https://aistudio.google.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-slate-300 hover:text-sky-200 bg-white/[0.03] hover:bg-sky-500/10 border border-white/10 hover:border-sky-400/40 transition-all flex items-center justify-between group"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>فتح منصة Google Studio</span>
          </span>
          <ArrowUpLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-300 transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>

        {/* 2. فتح منصة Vercel */}
        <a
          href="https://vercel.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-slate-300 hover:text-sky-200 bg-white/[0.03] hover:bg-sky-500/10 border border-white/10 hover:border-sky-400/40 transition-all flex items-center justify-between group"
        >
          <span className="flex items-center gap-2">
            <Triangle className="w-3.5 h-3.5 text-cyan-300" />
            <span>فتح منصة Vercel</span>
          </span>
          <ArrowUpLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-300 transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>

        {/* 3. فتح منصة GitHub */}
        <a
          href="https://github.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-slate-300 hover:text-sky-200 bg-white/[0.03] hover:bg-sky-500/10 border border-white/10 hover:border-sky-400/40 transition-all flex items-center justify-between group"
        >
          <span className="flex items-center gap-2">
            <Github className="w-3.5 h-3.5 text-slate-200" />
            <span>فتح منصة GitHub</span>
          </span>
          <ArrowUpLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-300 transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>

        {/* 4. فتح منصة فاير بيز السحابي */}
        <a
          href="https://console.firebase.google.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-slate-300 hover:text-sky-200 bg-white/[0.03] hover:bg-sky-500/10 border border-white/10 hover:border-sky-400/40 transition-all flex items-center justify-between group"
        >
          <span className="flex items-center gap-2">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>فتح منصة فاير بيز السحابي</span>
          </span>
          <ArrowUpLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-300 transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>

        {/* Settings Button (زر الإعدادات) */}
        <button
          type="button"
          onClick={() => {
            setIsMobileSidebarOpen(false);
            setPasswordInput('');
            setPasswordError(false);
            setIsSettingsModalOpen(true);
          }}
          className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-slate-300 hover:text-sky-200 bg-white/[0.03] hover:bg-sky-500/10 border border-white/10 hover:border-sky-400/40 transition-all flex items-center justify-between group cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Settings className="w-3.5 h-3.5 text-sky-400" />
            <span>الإعدادات</span>
          </span>
          {isAuthenticated ? (
            <Unlock className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-300" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen w-full bg-[#060B19] text-slate-100 flex flex-col lg:flex-row overflow-x-hidden">
      {/* Deep Navy Ambient Lighting */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-sky-500/12 blur-[130px]" />
        <div className="absolute top-1/3 -left-32 h-[460px] w-[460px] rounded-full bg-blue-600/12 blur-[140px]" />
        <div className="absolute -bottom-48 right-1/3 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[150px]" />
      </div>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex relative z-20 w-80 xl:w-88 shrink-0 p-6 min-h-screen flex-col">
        {renderSidebarContent()}
      </aside>

      {/* MOBILE DRAWER SIDEBAR (3 شرط جانبية وتغلق عند الضغط على أي مكان في الشاشة) */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 z-50 lg:hidden bg-[#030712]/75 backdrop-blur-sm flex justify-start"
          >
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-80 max-w-[85vw] h-full p-4 overflow-y-auto"
            >
              {renderSidebarContent()}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT AREA */}
      <main
        onClick={() => {
          if (isMobileSidebarOpen) setIsMobileSidebarOpen(false);
        }}
        className="relative z-10 flex-1 p-4 sm:p-6 lg:p-8 flex flex-col justify-between gap-6 max-w-[1440px]"
      >
        <div className="flex flex-col gap-6 flex-1">
          {/* Top Workspace Header */}
          <header className="glass-panel rounded-2xl px-5 sm:px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Mobile 3-Bars Hamburger Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMobileSidebarOpen(true);
                  }}
                  aria-label="فتح القائمة الجانبية"
                  className="lg:hidden h-10 w-10 shrink-0 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 flex items-center justify-center text-sky-300 shadow-[0_0_16px_rgba(56,189,248,0.25)] cursor-pointer"
                >
                  <Menu className="w-5 h-5" />
                </button>

                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    معرض المشاريع البرمجية
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300">
                    اضغط على أي قالب مشروع لعرض التفاصيل
                  </p>
                </div>
              </div>

              {/* Quick Settings Icon in Header (Mobile) */}
              <button
                type="button"
                onClick={() => {
                  setPasswordInput('');
                  setPasswordError(false);
                  setIsSettingsModalOpen(true);
                }}
                aria-label="الإعدادات"
                title="الإعدادات"
                className="md:hidden h-10 w-10 shrink-0 rounded-xl bg-white/[0.04] hover:bg-sky-500/15 border border-white/10 hover:border-sky-400/40 flex items-center justify-center text-slate-300 hover:text-sky-300 transition-all cursor-pointer"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input + Settings Button */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث في وصف المشاريع..."
                  className="glass-input w-full pr-10 pl-8 py-2.5 rounded-xl text-sm text-white placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="مسح البحث"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setPasswordInput('');
                  setPasswordError(false);
                  setIsSettingsModalOpen(true);
                }}
                aria-label="الإعدادات"
                title="الإعدادات"
                className="hidden md:flex h-10 px-3.5 rounded-xl bg-white/[0.04] hover:bg-sky-500/15 border border-white/10 hover:border-sky-400/40 items-center gap-2 text-xs font-medium text-slate-300 hover:text-sky-200 transition-all cursor-pointer shrink-0"
              >
                <Settings className="w-4 h-4 text-sky-400" />
                <span>الإعدادات</span>
              </button>
            </div>
          </header>

          {/* PROJECTS DISPLAY AREA */}
          <section aria-label="قائمة المشاريع" className="flex-1 flex flex-col gap-4">
            {/* Top Stats Bar: المشاريع المعروضة + إجمالي المشاريع المحفوظة + إجمالي الروابط المسجلة */}
            <div className="glass-panel rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                {/* المشاريع المعروضة */}
                <div className="flex items-center gap-2 text-slate-300">
                  <span>المشاريع المعروضة</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-sky-300 font-semibold">
                    {filteredProjects.length}
                  </span>
                  <span>من أصل</span>
                  <span className="font-mono tabular-nums text-slate-200 font-semibold">
                    {projects.length}
                  </span>
                </div>

                <span className="hidden sm:inline text-white/15" aria-hidden="true">
                  |
                </span>

                {/* إجمالي المشاريع المحفوظة */}
                <div className="flex items-center gap-2 text-slate-300">
                  <span>إجمالي المشاريع المحفوظة</span>
                  <span className="font-mono font-semibold text-sky-300 tabular-nums">
                    {projects.length}
                  </span>
                </div>

                <span className="hidden sm:inline text-white/15" aria-hidden="true">
                  |
                </span>

                {/* إجمالي الروابط المسجلة */}
                <div className="flex items-center gap-2 text-slate-300">
                  <span>إجمالي الروابط المسجلة</span>
                  <span className="font-mono font-semibold text-sky-300 tabular-nums">
                    {totalRegisteredLinks}
                  </span>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="glass-panel rounded-2xl p-12 text-center my-auto flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
                <p className="text-sm text-slate-300">جاري تحميل المشاريع من قاعدة البيانات...</p>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="glass-panel rounded-2xl p-12 text-center my-auto flex flex-col items-center justify-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-center shadow-[0_0_24px_rgba(56,189,248,0.18)]">
                  <Code2 className="w-7 h-7 text-sky-300" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-lg font-semibold text-white">
                    {searchQuery
                      ? 'لا توجد مشاريع مطابقة لبحثك'
                      : 'لا توجد مشاريع مضافة حتى الآن'}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {searchQuery
                      ? 'جرب تغيير كلمات البحث لعرض جميع القوالب.'
                      : 'ابدأ بإضافة مشروعك الأول من خلال الزر المضيء في القائمة الجانبية ليتم حفظه في فايربيز.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (searchQuery) {
                      setSearchQuery('');
                    } else {
                      resetAddForm();
                      setIsAddModalOpen(true);
                    }
                  }}
                  className="glow-button-primary mt-2 py-2.5 px-5 rounded-xl text-sm font-medium text-white flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{searchQuery ? 'عرض جميع المشاريع' : 'أضف مشروع الآن'}</span>
                </button>
              </div>
            ) : (
              /* Horizontal Flex-row Layout for Project Cards */
              <div className="flex flex-row flex-wrap gap-5 items-stretch">
                <AnimatePresence mode="popLayout">
                  {filteredProjects.map((project, index) => (
                    <motion.article
                      layout
                      key={project.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.18 }}
                      onClick={() => handleOpenDetails(project)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleOpenDetails(project);
                        }
                      }}
                      className="glass-card-interactive group w-full rounded-2xl p-5 sm:p-6 cursor-pointer flex flex-col xl:flex-row xl:items-center justify-between gap-5 text-right focus:outline-none"
                    >
                      {/* Right Section: Number + Project Description */}
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="h-12 w-12 shrink-0 rounded-xl bg-sky-500/12 border border-sky-400/30 group-hover:border-sky-300/70 group-hover:bg-sky-500/20 flex items-center justify-center font-mono text-sm font-semibold text-sky-300 tabular-nums transition-all shadow-[0_0_15px_rgba(56,189,248,0.12)] group-hover:shadow-[0_0_22px_rgba(56,189,248,0.35)]">
                          {String(index + 1).padStart(2, '0')}
                        </div>

                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="text-sky-300 font-medium">وصف الموقع</span>
                            {project.createdAt && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">{project.createdAt}</span>
                              </>
                            )}
                          </div>
                          <p className="text-base sm:text-lg font-medium text-slate-100 group-hover:text-white leading-relaxed">
                            {project.description}
                          </p>
                        </div>
                      </div>

                      {/* Left Section: Conditional based on Authentication */}
                      {isAuthenticated ? (
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 xl:shrink-0 pt-3 xl:pt-0 border-t xl:border-t-0 border-white/10">
                          {/* Live URL Quick Indicator */}
                          <div
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono border transition-colors ${
                              project.liveUrl
                                ? 'bg-white/[0.04] border-white/10 text-slate-200 group-hover:border-sky-400/35'
                                : 'bg-white/[0.01] border-white/5 text-slate-500'
                            }`}
                          >
                            <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            <span className="truncate max-w-[130px]" dir="ltr">
                              {formatUrlLabel(project.liveUrl, 'بدون رابط موقع')}
                            </span>
                          </div>

                          {/* GitHub Quick Indicator */}
                          <div
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono border transition-colors ${
                              project.githubUrl
                                ? 'bg-white/[0.04] border-white/10 text-slate-200 group-hover:border-sky-400/35'
                                : 'bg-white/[0.01] border-white/5 text-slate-500'
                            }`}
                          >
                            <Github className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                            <span className="truncate max-w-[110px]" dir="ltr">
                              {project.githubUrl ? 'GitHub' : 'بدون GitHub'}
                            </span>
                          </div>

                          {/* Vercel Quick Indicator */}
                          <div
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono border transition-colors ${
                              project.vercelUrl
                                ? 'bg-white/[0.04] border-white/10 text-slate-200 group-hover:border-sky-400/35'
                                : 'bg-white/[0.01] border-white/5 text-slate-500'
                            }`}
                          >
                            <Triangle className="w-3.5 h-3.5 text-cyan-300 shrink-0 fill-cyan-300/20" />
                            <span className="truncate max-w-[110px]" dir="ltr">
                              {project.vercelUrl ? 'Vercel' : 'بدون Vercel'}
                            </span>
                          </div>

                          {/* Firebase Quick Indicator */}
                          <div
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono border transition-colors ${
                              project.firebaseUrl
                                ? 'bg-white/[0.04] border-white/10 text-slate-200 group-hover:border-sky-400/35'
                                : 'bg-white/[0.01] border-white/5 text-slate-500'
                            }`}
                          >
                            <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate max-w-[110px]" dir="ltr">
                              {project.firebaseUrl ? 'Firebase' : 'بدون Firebase'}
                            </span>
                          </div>

                          {/* Open Details Prompt */}
                          <div className="mr-auto xl:mr-1 flex items-center gap-1.5 text-xs font-medium text-sky-300 group-hover:text-sky-200 px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-400/25 group-hover:border-sky-400/60 group-hover:shadow-[0_0_15px_rgba(56,189,248,0.25)] transition-all whitespace-nowrap">
                            <span>التفاصيل</span>
                            <ArrowUpLeft className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      ) : (
                        /* Visitor Mode (بدون تسجيل الباسورد): يظهر فقط وصف الموقع ونفس شكل زر فتح المنصة مثل زر فتح منصة جوجل استوديو في القائمة الجانبية */
                        <div
                          className="xl:shrink-0 pt-3 xl:pt-0 border-t xl:border-t-0 border-white/10 flex items-center justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a
                            href={ensureProtocol(project.liveUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full sm:w-auto min-w-[200px] py-2.5 px-4 rounded-xl text-xs font-medium text-slate-300 hover:text-sky-200 bg-white/[0.03] hover:bg-sky-500/10 border border-white/10 hover:border-sky-400/40 transition-all flex items-center justify-between gap-4 group/btn"
                          >
                            <span className="flex items-center gap-2">
                              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                              <span>فتح المنصة</span>
                            </span>
                            <ArrowUpLeft className="w-3.5 h-3.5 text-slate-400 group-hover/btn:text-sky-300 transition-transform group-hover/btn:-translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                          </a>
                        </div>
                      )}
                    </motion.article>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>
        </div>

        {/* FOOTER (أسفل الموقع باللغة الإنجليزية) */}
        <footer className="pt-6 border-t border-white/10 text-center">
          <p className="text-xs sm:text-sm font-medium text-slate-400 tracking-wide" dir="ltr">
            With best regards, Developer <span className="text-sky-300 font-semibold">Amir Lamay</span>
          </p>
        </footer>
      </main>

      {/* =====================================================================
          ADD PROJECT MODAL (الشاشة المنبثقة لإضافة مشروع جديد)
      ====================================================================== */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setIsAddModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#030712]/75 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-modal relative w-full max-w-xl rounded-2xl p-6 sm:p-8 text-right max-h-[92vh] overflow-y-auto"
            >
              {/* Top Header with Close Button (X) in Top-Left */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-center shadow-[0_0_16px_rgba(56,189,248,0.25)]">
                    <Plus className="w-5 h-5 text-sky-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">إضافة مشروع جديد</h3>
                    <p className="text-xs text-slate-300">
                      أدخل بيانات وروابط المشروع لحفظها في سحابة فايربيز
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  aria-label="إغلاق النافذة"
                  className="h-9 w-9 rounded-xl bg-white/[0.05] hover:bg-rose-500/20 border border-white/10 hover:border-rose-400/50 text-slate-300 hover:text-rose-200 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Add Project Form */}
              <form onSubmit={handleSaveProject} className="space-y-4">
                {formError && (
                  <div className="rounded-xl bg-rose-500/15 border border-rose-400/40 px-4 py-3 text-xs text-rose-200">
                    {formError}
                  </div>
                )}

                {/* 1. وصف الموقع */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="field-description"
                    className="block text-xs font-medium text-slate-200"
                  >
                    1. وصف الموقع (Project Description)
                  </label>
                  <textarea
                    id="field-description"
                    rows={3}
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      if (formError) setFormError('');
                    }}
                    placeholder="اكتب نبذة مختصرة أو وصفاً تفصيلياً عن فكرة الموقع ومميزاته..."
                    className="glass-input w-full rounded-xl p-3.5 text-sm text-white placeholder:text-slate-400 resize-none"
                  />
                </div>

                {/* 2. لينك الموقع */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="field-live-url"
                    className="block text-xs font-medium text-slate-200"
                  >
                    2. لينك الموقع (Live URL)
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-sky-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="field-live-url"
                      type="text"
                      dir="ltr"
                      value={liveUrl}
                      onChange={(e) => {
                        setLiveUrl(e.target.value);
                        if (formError) setFormError('');
                      }}
                      placeholder="https://your-project-domain.com"
                      className="glass-input w-full pr-10 pl-4 py-3 rounded-xl text-sm font-mono text-white placeholder:text-slate-500 text-left"
                    />
                  </div>
                </div>

                {/* 3. لينك GitHub */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="field-github-url"
                    className="block text-xs font-medium text-slate-200"
                  >
                    3. لينك GitHub
                  </label>
                  <div className="relative">
                    <Github className="w-4 h-4 text-slate-300 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="field-github-url"
                      type="text"
                      dir="ltr"
                      value={githubUrl}
                      onChange={(e) => {
                        setGithubUrl(e.target.value);
                        if (formError) setFormError('');
                      }}
                      placeholder="https://github.com/username/repository"
                      className="glass-input w-full pr-10 pl-4 py-3 rounded-xl text-sm font-mono text-white placeholder:text-slate-500 text-left"
                    />
                  </div>
                </div>

                {/* 4. لينك Vercel */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="field-vercel-url"
                    className="block text-xs font-medium text-slate-200"
                  >
                    4. لينك Vercel
                  </label>
                  <div className="relative">
                    <Triangle className="w-4 h-4 text-cyan-300 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="field-vercel-url"
                      type="text"
                      dir="ltr"
                      value={vercelUrl}
                      onChange={(e) => {
                        setVercelUrl(e.target.value);
                        if (formError) setFormError('');
                      }}
                      placeholder="https://vercel.com/username/project"
                      className="glass-input w-full pr-10 pl-4 py-3 rounded-xl text-sm font-mono text-white placeholder:text-slate-500 text-left"
                    />
                  </div>
                </div>

                {/* 5. لينك فاير بيز السحابي (تحت فيركال) */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="field-firebase-url"
                    className="block text-xs font-medium text-slate-200"
                  >
                    5. لينك فاير بيز السحابي
                  </label>
                  <div className="relative">
                    <Flame className="w-4 h-4 text-amber-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="field-firebase-url"
                      type="text"
                      dir="ltr"
                      value={firebaseUrl}
                      onChange={(e) => {
                        setFirebaseUrl(e.target.value);
                        if (formError) setFormError('');
                      }}
                      placeholder="https://console.firebase.google.com/project/your-app"
                      className="glass-input w-full pr-10 pl-4 py-3 rounded-xl text-sm font-mono text-white placeholder:text-slate-500 text-left"
                    />
                  </div>
                </div>

                {/* Action Button: زر "حفظ" (Save) في الأسفل */}
                <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      resetAddForm();
                      setIsAddModalOpen(false);
                    }}
                    className="px-5 py-3 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="glow-button-primary flex-1 sm:flex-initial sm:min-w-[160px] py-3 px-6 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          PROJECT DETAILS MODAL (الشاشة المنبثقة لتفاصيل المشروع)
      ====================================================================== */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={handleCloseDetails}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#030712]/78 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-modal relative w-full max-w-2xl rounded-2xl p-6 sm:p-8 text-right max-h-[90vh] overflow-y-auto"
            >
              {/* Top Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5 mb-6">
                {isAuthenticated ? (
                  <div className="flex items-center gap-2.5">
                    {/* Edit Button */}
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        if (isEditingInModal) {
                          setIsEditingInModal(false);
                        } else {
                          handleStartEdit();
                        }
                      }}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 border transition-all cursor-pointer ${
                        isEditingInModal
                          ? 'bg-sky-500/25 border-sky-400 text-sky-200 shadow-[0_0_16px_rgba(56,189,248,0.3)]'
                          : 'bg-sky-500/12 hover:bg-sky-500/22 border-sky-400/35 hover:border-sky-400/70 text-sky-200 hover:shadow-[0_0_16px_rgba(56,189,248,0.25)]'
                      }`}
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>{isEditingInModal ? 'إلغاء التعديل' : 'تعديل'}</span>
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleDeleteProject(selectedProject.id)}
                      className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 bg-rose-500/12 hover:bg-rose-500/25 border border-rose-400/35 hover:border-rose-400/70 text-rose-200 hover:shadow-[0_0_16px_rgba(244,63,94,0.3)] transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      <span>حذف</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <FileText className="w-4 h-4 text-sky-400" />
                    <span>تفاصيل المشروع</span>
                  </div>
                )}

                {/* Close Button (X) */}
                <button
                  type="button"
                  onClick={handleCloseDetails}
                  aria-label="إغلاق التفاصيل"
                  className="h-9 w-9 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 hover:border-sky-400/40 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              {!isAuthenticated ? (
                /* Visitor View (دون تسجيل الباسورد): يظهر فقط وصف الموقع ونفس شكل زر فتح المنصة مثل زر فتح منصة جوجل استوديو */
                <div className="space-y-6">
                  <div className="glass-panel rounded-xl p-5 space-y-2.5 border border-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-sky-300 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>وصف الموقع</span>
                      </span>
                    </div>
                    <p className="text-sm sm:text-base text-slate-100 leading-relaxed pt-1">
                      {selectedProject.description}
                    </p>
                  </div>

                  <a
                    href={ensureProtocol(selectedProject.liveUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-slate-300 hover:text-sky-200 bg-white/[0.03] hover:bg-sky-500/10 border border-white/10 hover:border-sky-400/40 transition-all flex items-center justify-between group"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                      <span>فتح المنصة</span>
                    </span>
                    <ArrowUpLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-300 transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" />
                  </a>
                </div>
              ) : isEditingInModal ? (
                <form onSubmit={handleSaveEdit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-sky-300">
                      تعديل وصف الموقع
                    </label>
                    <textarea
                      rows={3}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="glass-input w-full rounded-xl p-3.5 text-sm text-white resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-sky-300">
                      تعديل لينك الموقع (Live URL)
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={editLiveUrl}
                      onChange={(e) => setEditLiveUrl(e.target.value)}
                      className="glass-input w-full px-4 py-2.5 rounded-xl text-sm font-mono text-white text-left"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-sky-300">
                      تعديل لينك GitHub
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={editGithubUrl}
                      onChange={(e) => setEditGithubUrl(e.target.value)}
                      className="glass-input w-full px-4 py-2.5 rounded-xl text-sm font-mono text-white text-left"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-sky-300">
                      تعديل لينك Vercel
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={editVercelUrl}
                      onChange={(e) => setEditVercelUrl(e.target.value)}
                      className="glass-input w-full px-4 py-2.5 rounded-xl text-sm font-mono text-white text-left"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-sky-300">
                      تعديل لينك فاير بيز السحابي
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={editFirebaseUrl}
                      onChange={(e) => setEditFirebaseUrl(e.target.value)}
                      className="glass-input w-full px-4 py-2.5 rounded-xl text-sm font-mono text-white text-left"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-sky-300">
                      تعديل لينك Google Studio
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={editGoogleStudioUrl}
                      onChange={(e) => setEditGoogleStudioUrl(e.target.value)}
                      className="glass-input w-full px-4 py-2.5 rounded-xl text-sm font-mono text-white text-left"
                    />
                  </div>

                  <div className="pt-3 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setIsEditingInModal(false)}
                      className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-300 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="glow-button-primary px-6 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      <span>حفظ التعديلات</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Authenticated View: تظهر جميع اللنكات مع ميزة النسخ */
                <div className="space-y-4">
                  {/* Field 1: وصف الموقع */}
                  <div className="glass-panel rounded-xl p-4 space-y-2 border border-white/10 hover:border-sky-400/35 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-sky-300 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>وصف الموقع</span>
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(selectedProject.description, 'وصف الموقع', 'desc')
                        }
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-sky-500/20 border border-white/10 hover:border-sky-400/50 text-slate-200 hover:text-sky-200 flex items-center gap-1.5 transition-all cursor-pointer"
                        title="نسخ الوصف"
                      >
                        {copiedFieldKey === 'desc' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-300">تم النسخ</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>نسخ</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-sm sm:text-base text-slate-100 leading-relaxed pt-1">
                      {selectedProject.description}
                    </p>
                  </div>

                  {/* Field 2: لينك الموقع (Live URL) */}
                  <div className="glass-panel rounded-xl p-4 space-y-2 border border-white/10 hover:border-sky-400/35 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-sky-300 flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        <span>لينك الموقع (Live URL)</span>
                      </span>

                      <div className="flex items-center gap-2">
                        {selectedProject.liveUrl && (
                          <a
                            href={ensureProtocol(selectedProject.liveUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-sky-500/20 border border-white/10 hover:border-sky-400/40 text-slate-300 hover:text-sky-200 transition-colors"
                            title="فتح الرابط في نافذة جديدة"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={!selectedProject.liveUrl}
                          onClick={() =>
                            handleCopy(selectedProject.liveUrl, 'لينك الموقع', 'live')
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-sky-500/20 disabled:opacity-40 disabled:pointer-events-none border border-white/10 hover:border-sky-400/50 text-slate-200 hover:text-sky-200 flex items-center gap-1.5 transition-all cursor-pointer"
                          title="نسخ لينك الموقع"
                        >
                          {copiedFieldKey === 'live' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-300">تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>نسخ</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <p
                      dir="ltr"
                      className="text-xs sm:text-sm font-mono text-slate-200 break-all text-left bg-[#050914]/60 px-3.5 py-2.5 rounded-lg border border-white/5"
                    >
                      {selectedProject.liveUrl || 'لم يتم إدخال رابط الموقع'}
                    </p>
                  </div>

                  {/* Field 3: لينك GitHub */}
                  <div className="glass-panel rounded-xl p-4 space-y-2 border border-white/10 hover:border-sky-400/35 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-sky-300 flex items-center gap-2">
                        <Github className="w-4 h-4" />
                        <span>لينك GitHub</span>
                      </span>

                      <div className="flex items-center gap-2">
                        {selectedProject.githubUrl && (
                          <a
                            href={ensureProtocol(selectedProject.githubUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-sky-500/20 border border-white/10 hover:border-sky-400/40 text-slate-300 hover:text-sky-200 transition-colors"
                            title="فتح مستودع GitHub"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={!selectedProject.githubUrl}
                          onClick={() =>
                            handleCopy(selectedProject.githubUrl, 'لينك GitHub', 'github')
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-sky-500/20 disabled:opacity-40 disabled:pointer-events-none border border-white/10 hover:border-sky-400/50 text-slate-200 hover:text-sky-200 flex items-center gap-1.5 transition-all cursor-pointer"
                          title="نسخ لينك GitHub"
                        >
                          {copiedFieldKey === 'github' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-300">تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>نسخ</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <p
                      dir="ltr"
                      className="text-xs sm:text-sm font-mono text-slate-200 break-all text-left bg-[#050914]/60 px-3.5 py-2.5 rounded-lg border border-white/5"
                    >
                      {selectedProject.githubUrl || 'لم يتم إدخال رابط GitHub'}
                    </p>
                  </div>

                  {/* Field 4: لينك Vercel */}
                  <div className="glass-panel rounded-xl p-4 space-y-2 border border-white/10 hover:border-sky-400/35 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-sky-300 flex items-center gap-2">
                        <Triangle className="w-4 h-4" />
                        <span>لينك Vercel</span>
                      </span>

                      <div className="flex items-center gap-2">
                        {selectedProject.vercelUrl && (
                          <a
                            href={ensureProtocol(selectedProject.vercelUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-sky-500/20 border border-white/10 hover:border-sky-400/40 text-slate-300 hover:text-sky-200 transition-colors"
                            title="فتح رابط Vercel"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={!selectedProject.vercelUrl}
                          onClick={() =>
                            handleCopy(selectedProject.vercelUrl, 'لينك Vercel', 'vercel')
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-sky-500/20 disabled:opacity-40 disabled:pointer-events-none border border-white/10 hover:border-sky-400/50 text-slate-200 hover:text-sky-200 flex items-center gap-1.5 transition-all cursor-pointer"
                          title="نسخ لينك Vercel"
                        >
                          {copiedFieldKey === 'vercel' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-300">تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>نسخ</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <p
                      dir="ltr"
                      className="text-xs sm:text-sm font-mono text-slate-200 break-all text-left bg-[#050914]/60 px-3.5 py-2.5 rounded-lg border border-white/5"
                    >
                      {selectedProject.vercelUrl || 'لم يتم إدخال رابط Vercel'}
                    </p>
                  </div>

                  {/* Field 5: لينك فاير بيز السحابي */}
                  <div className="glass-panel rounded-xl p-4 space-y-2 border border-white/10 hover:border-sky-400/35 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-sky-300 flex items-center gap-2">
                        <Flame className="w-4 h-4 text-amber-400" />
                        <span>لينك فاير بيز السحابي</span>
                      </span>

                      <div className="flex items-center gap-2">
                        {selectedProject.firebaseUrl && (
                          <a
                            href={ensureProtocol(selectedProject.firebaseUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-sky-500/20 border border-white/10 hover:border-sky-400/40 text-slate-300 hover:text-sky-200 transition-colors"
                            title="فتح رابط فاير بيز السحابي"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={!selectedProject.firebaseUrl}
                          onClick={() =>
                            handleCopy(
                              selectedProject.firebaseUrl || '',
                              'لينك فاير بيز السحابي',
                              'firebase'
                            )
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-sky-500/20 disabled:opacity-40 disabled:pointer-events-none border border-white/10 hover:border-sky-400/50 text-slate-200 hover:text-sky-200 flex items-center gap-1.5 transition-all cursor-pointer"
                          title="نسخ لينك فاير بيز السحابي"
                        >
                          {copiedFieldKey === 'firebase' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-300">تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>نسخ</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <p
                      dir="ltr"
                      className="text-xs sm:text-sm font-mono text-slate-200 break-all text-left bg-[#050914]/60 px-3.5 py-2.5 rounded-lg border border-white/5"
                    >
                      {selectedProject.firebaseUrl || 'لم يتم إدخال رابط فاير بيز السحابي'}
                    </p>
                  </div>
                </div>
              )}

              {/* Bottom Additional Link: رابط "Google Studio" (يظهر فقط عند تسجيل الدخول) */}
              {isAuthenticated && (
                <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Link2 className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>الرابط الإضافي للمشروع على منصة التطوير:</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          selectedProject.googleStudioUrl || 'https://aistudio.google.com/',
                          'لينك Google Studio',
                          'studio'
                        )
                      }
                      className="px-3 py-2.5 rounded-xl text-xs font-medium bg-white/[0.05] hover:bg-sky-500/20 border border-white/10 hover:border-sky-400/50 text-slate-200 hover:text-sky-200 flex items-center gap-1.5 transition-all cursor-pointer"
                      title="نسخ لينك Google Studio"
                    >
                      {copiedFieldKey === 'studio' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>نسخ</span>
                        </>
                      )}
                    </button>

                    <a
                      href={ensureProtocol(
                        selectedProject.googleStudioUrl || 'https://aistudio.google.com/'
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="glow-button-primary px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Google Studio</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          SETTINGS MODAL (نافذة الإعدادات السرية بدون أي تلميح للباسورد)
      ====================================================================== */}
      <AnimatePresence>
        {isSettingsModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => {
              setIsSettingsModalOpen(false);
              setPasswordInput('');
              setPasswordError(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#030712]/78 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-modal relative w-full max-w-md rounded-2xl p-6 sm:p-7 text-right"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-sky-300" />
                  </div>
                  <h3 className="text-base font-bold text-white">الإعدادات</h3>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsModalOpen(false);
                    setPasswordInput('');
                    setPasswordError(false);
                  }}
                  aria-label="إغلاق الإعدادات"
                  className="h-9 w-9 rounded-xl bg-white/[0.05] hover:bg-rose-500/20 border border-white/10 hover:border-rose-400/50 text-slate-300 hover:text-rose-200 flex items-center justify-center transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isAuthenticated ? (
                <div className="space-y-5">
                  <div className="glass-panel rounded-xl p-4 flex items-center gap-3 border border-emerald-400/30">
                    <Unlock className="w-5 h-5 text-emerald-400 shrink-0" />
                    <p className="text-xs sm:text-sm text-slate-200">
                      تم تفعيل وضع المطور وعرض كافة الروابط.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAuthenticated(false);
                      setIsSettingsModalOpen(false);
                      showToast('تم قفل الروابط والعودة لوضع الزائر');
                    }}
                    className="w-full py-3 px-5 rounded-xl text-sm font-medium text-rose-200 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/40 transition-all cursor-pointer"
                  >
                    تسجيل الخروج وإخفاء الروابط
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePasswordSubmit} className="space-y-4" autoComplete="off">
                  {passwordError && (
                    <div className="rounded-xl bg-rose-500/15 border border-rose-400/40 px-4 py-2.5 text-xs text-rose-200">
                      الرمز غير صحيح
                    </div>
                  )}

                  <div className="space-y-2">
                    <label htmlFor="secret-pass-input" className="block text-xs font-medium text-slate-300">
                      الرمز السري
                    </label>
                    <input
                      id="secret-pass-input"
                      type="password"
                      dir="ltr"
                      autoFocus
                      autoComplete="new-password"
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        if (passwordError) setPasswordError(false);
                      }}
                      className="glass-input w-full px-4 py-3 rounded-xl text-sm font-mono text-white text-center tracking-widest"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSettingsModalOpen(false);
                        setPasswordInput('');
                        setPasswordError(false);
                      }}
                      className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="glow-button-primary px-6 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                    >
                      دخول
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING TOAST NOTIFICATION */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            role="status"
            aria-live="polite"
            className="fixed bottom-6 left-6 z-[60] glass-modal px-4 py-3 rounded-xl border border-sky-400/50 shadow-[0_0_25px_rgba(56,189,248,0.35)] flex items-center gap-2.5 text-xs sm:text-sm font-medium text-sky-100"
          >
            <div className="h-6 w-6 rounded-lg bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 text-emerald-300" />
            </div>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
