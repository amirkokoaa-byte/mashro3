import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Calculator,
  Clock,
  Calendar,
  Users,
  RefreshCw,
  Phone,
  Download,
  Upload,
  WifiOff,
  Smartphone,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { registerSW } from 'virtual:pwa-register';
import { db } from './firebase';
import {
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';

// Register PWA Service Worker for full offline browsing on mobile & desktop
if (typeof window !== 'undefined') {
  registerSW({ immediate: true });
}

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

export interface SiteConfig {
  siteName: string;
  facebookUrl: string;
  instagramUrl: string;
  phoneNumber: string;
}

interface OfflineOperation {
  id: string;
  type: 'upsert_project' | 'delete_project' | 'update_settings';
  project?: Project;
  projectId?: string;
  siteConfig?: SiteConfig;
  timestamp: number;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DEFAULT_SITE_CONFIG: SiteConfig = {
  siteName: 'منصه مشروعات المطور Amir Lamay',
  facebookUrl: 'https://www.facebook.com/',
  instagramUrl: 'https://www.instagram.com/',
  phoneNumber: '201000000000',
};

const SITE_CONFIG_STORAGE_KEY = 'glassfolio_site_config_v1';
const PROJECTS_CACHE_KEY = 'glassfolio_projects_cache_v1';
const OFFLINE_QUEUE_KEY = 'glassfolio_offline_queue_v1';
const BIRTH_DATE_STORAGE_KEY = 'glassfolio_birthdate_v1';
const CAPMAS_ANCHOR_KEY = 'glassfolio_capmas_anchor_v1';

// Official CAPMAS verified baseline anchor:
// 109,701,538 at 2026-10-26T15:50:26.658Z (1793039426658 ms), official CAPMAS growth rate: 0.04907159 persons/sec
const DEFAULT_CAPMAS_ANCHOR = {
  population: 109701538,
  timestampMs: 1793039426658,
};
const OFFICIAL_CAPMAS_GROWTH_PER_SEC = 0.04907159;

export default function App() {
  // 1. تعريف حالة المشاريع مع التحميل الفوري من الكاش المحلي في المتصفح (0ms)
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const cached = localStorage.getItem(PROJECTS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Never block UI if cached projects exist
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PROJECTS_CACHE_KEY) === null;
    } catch {
      return false;
    }
  });

  // Online / Offline Connectivity State
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState<boolean>(false);

  // Navigation View State ('projects' | 'age')
  const [activeView, setActiveView] = useState<'projects' | 'age'>('projects');

  // Site Config State (Website Name + Contact Links) — updates in real-time
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(() => {
    try {
      const saved = localStorage.getItem(SITE_CONFIG_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_SITE_CONFIG, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SITE_CONFIG;
  });

  // Save projects cache whenever `projects` changes
  useEffect(() => {
    try {
      localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(projects));
    } catch {
      // ignore
    }
  }, [projects]);

  // Sync Site Title with Browser Tab in real-time
  useEffect(() => {
    document.title = siteConfig.siteName || 'منصه مشروعات المطور Amir Lamay';
    try {
      localStorage.setItem(SITE_CONFIG_STORAGE_KEY, JSON.stringify(siteConfig));
    } catch {
      // ignore
    }
  }, [siteConfig]);

  // Helper to read/write Offline Sync Queue
  const getOfflineQueue = (): OfflineOperation[] => {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const enqueueOfflineOperation = (op: OfflineOperation) => {
    try {
      const queue = getOfflineQueue();
      queue.push(op);
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch {
      // ignore
    }
  };

  // Trigger Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 2600);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Flush Offline Sync Queue when internet returns
  const syncPendingOfflineOperations = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    const remaining: OfflineOperation[] = [];
    let syncedCount = 0;

    for (const op of queue) {
      try {
        if (op.type === 'upsert_project' && op.project) {
          const { id, ...data } = op.project;
          await setDoc(doc(db, 'projects', id), data, { merge: true });
          syncedCount++;
        } else if (op.type === 'delete_project' && op.projectId) {
          await deleteDoc(doc(db, 'projects', op.projectId));
          syncedCount++;
        } else if (op.type === 'update_settings' && op.siteConfig) {
          await setDoc(doc(db, 'settings', 'siteConfig'), op.siteConfig, { merge: true });
          syncedCount++;
        }
      } catch {
        remaining.push(op);
      }
    }

    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    } catch {
      // ignore
    }

    if (syncedCount > 0) {
      showToast('تم استعادة الإنترنت ورفع التحديثات على السيستم تلقائياً');
    }
  }, [showToast]);

  // Monitor Online/Offline events and PWA install prompt
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingOfflineOperations();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sync any pending operations on startup if online
    if (navigator.onLine) {
      syncPendingOfflineOperations();
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsPWAInstalled(isStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsPWAInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [syncPendingOfflineOperations]);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsPWAInstalled(true);
      setDeferredPrompt(null);
      showToast('تم تثبيت التطبيق على جهازك للعمل بدون إنترنت');
    }
  };

  // Real-time Firestore listener for Site Config
  useEffect(() => {
    const configDocRef = doc(db, 'settings', 'siteConfig');
    const unsubscribe = onSnapshot(
      configDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Partial<SiteConfig>;
          setSiteConfig((prev) => ({
            siteName: data.siteName ?? prev.siteName,
            facebookUrl: data.facebookUrl ?? prev.facebookUrl,
            instagramUrl: data.instagramUrl ?? prev.instagramUrl,
            phoneNumber: data.phoneNumber ?? prev.phoneNumber,
          }));
        }
      },
      () => {
        // Offline fallback handled by localStorage
      }
    );
    return () => unsubscribe();
  }, []);

  // Real-time Firestore listener for Projects (with Persistent IndexedDB + LocalStorage Cache)
  useEffect(() => {
    const projectsColRef = collection(db, 'projects');
    const unsubscribe = onSnapshot(
      projectsColRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        const projectsData: Project[] = snapshot.docs.map((docItem) => {
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
        setIsLoading(false);
        try {
          localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(projectsData));
        } catch {
          // ignore
        }
      },
      () => {
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Update Site Config helper (updates state immediately + queues for Firestore if offline)
  const handleUpdateSiteConfig = (field: keyof SiteConfig, value: string) => {
    setSiteConfig((prev) => {
      const updated = { ...prev, [field]: value };
      if (navigator.onLine) {
        setDoc(doc(db, 'settings', 'siteConfig'), updated, { merge: true }).catch(() => {
          enqueueOfflineOperation({
            id: `op-${Date.now()}`,
            type: 'update_settings',
            siteConfig: updated,
            timestamp: Date.now(),
          });
        });
      } else {
        enqueueOfflineOperation({
          id: `op-${Date.now()}`,
          type: 'update_settings',
          siteConfig: updated,
          timestamp: Date.now(),
        });
      }
      return updated;
    });
  };

  // Live Clock State (Top-Left: Day, Date, 12-hour Clock)
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Mobile Sidebar Drawer State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Authentication / Settings State (Default: false)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Modals & UI States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isEditingInModal, setIsEditingInModal] = useState(false);

  // Live Search State
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

  // Clipboard State
  const [copiedFieldKey, setCopiedFieldKey] = useState<string | null>(null);

  // File Input Ref for Import Data
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // =====================================================================
  // AGE CALCULATOR & OFFICIAL LIVE EGYPT POPULATION STATES
  // =====================================================================
  const [birthInputMode, setBirthInputMode] = useState<'calendar' | 'manual'>('calendar');
  const [birthDateString, setBirthDateString] = useState<string>(() => {
    try {
      return localStorage.getItem(BIRTH_DATE_STORAGE_KEY) || '2000-01-01';
    } catch {
      return '2000-01-01';
    }
  });

  const [manualDay, setManualDay] = useState<string>(() => {
    const parts = birthDateString.split('-');
    return parts.length === 3 ? String(parseInt(parts[2], 10)) : '1';
  });
  const [manualMonth, setManualMonth] = useState<string>(() => {
    const parts = birthDateString.split('-');
    return parts.length === 3 ? String(parseInt(parts[1], 10)) : '1';
  });
  const [manualYear, setManualYear] = useState<string>(() => {
    const parts = birthDateString.split('-');
    return parts.length === 3 ? parts[0] : '2000';
  });

  useEffect(() => {
    try {
      localStorage.setItem(BIRTH_DATE_STORAGE_KEY, birthDateString);
    } catch {
      // ignore
    }
  }, [birthDateString]);

  // Official CAPMAS Egypt Population Anchor (Instant 0ms display, zero loading delay, works online & offline)
  const [capmasAnchor, setCapmasAnchor] = useState<{
    population: number;
    timestampMs: number;
  }>(() => {
    try {
      const saved = localStorage.getItem(CAPMAS_ANCHOR_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.population === 'number' && parsed.population > 100000000) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_CAPMAS_ANCHOR;
  });
  const [isFetchingPop, setIsFetchingPop] = useState<boolean>(false);

  // Live Egypt Population calculated in real-time every second from the official CAPMAS anchor
  const liveEgyptPopulation = useMemo(() => {
    const elapsedSec = Math.max(0, (currentTime.getTime() - capmasAnchor.timestampMs) / 1000);
    return Math.round(capmasAnchor.population + elapsedSec * OFFICIAL_CAPMAS_GROWTH_PER_SEC);
  }, [capmasAnchor, currentTime]);

  const fetchOfficialEgyptPopulation = useCallback(async (showSpinner = false) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    try {
      if (showSpinner) setIsFetchingPop(true);
      const res = await fetch('/api/egypt-population', { cache: 'no-store' });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (typeof data.population === 'number' && data.population > 100000000) {
            const newAnchor = {
              population: data.population,
              timestampMs: data.anchorTimestampMs || Date.now(),
            };
            setCapmasAnchor(newAnchor);
            try {
              localStorage.setItem(CAPMAS_ANCHOR_KEY, JSON.stringify(newAnchor));
            } catch {
              // ignore
            }
            return;
          }
        }
      }
      // Fallback for static deployments (e.g. Vercel without Express backend)
      const proxyRes = await fetch(
        'https://api.allorigins.win/raw?url=' +
          encodeURIComponent('https://www.capmas.gov.eg:8080/population-proxy/total'),
        { signal: AbortSignal.timeout(4000) }
      );
      if (proxyRes.ok) {
        const text = (await proxyRes.text()).trim();
        const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
        if (num && !isNaN(num) && num > 100000000) {
          const newAnchor = { population: num, timestampMs: Date.now() };
          setCapmasAnchor(newAnchor);
          try {
            localStorage.setItem(CAPMAS_ANCHOR_KEY, JSON.stringify(newAnchor));
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // Silently continue using the verified CAPMAS anchor without displaying any error text
    } finally {
      if (showSpinner) setIsFetchingPop(false);
    }
  }, []);

  // Poll official CAPMAS endpoint in background when online
  useEffect(() => {
    fetchOfficialEgyptPopulation(false);
    const interval = setInterval(() => {
      fetchOfficialEgyptPopulation(false);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchOfficialEgyptPopulation]);

  // Synchronize calendar picker and manual inputs
  const handleCalendarDateChange = (val: string) => {
    setBirthDateString(val);
    if (val) {
      const parts = val.split('-');
      if (parts.length === 3) {
        setManualYear(parts[0]);
        setManualMonth(String(parseInt(parts[1], 10)));
        setManualDay(String(parseInt(parts[2], 10)));
      }
    }
  };

  const handleManualDateChange = (dayStr: string, monthStr: string, yearStr: string) => {
    setManualDay(dayStr);
    setManualMonth(monthStr);
    setManualYear(yearStr);

    const y = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    const d = parseInt(dayStr, 10);

    if (
      !isNaN(y) &&
      y >= 1900 &&
      y <= 2100 &&
      !isNaN(m) &&
      m >= 1 &&
      m <= 12 &&
      !isNaN(d) &&
      d >= 1 &&
      d <= 31
    ) {
      const paddedM = String(m).padStart(2, '0');
      const paddedD = String(d).padStart(2, '0');
      setBirthDateString(`${y}-${paddedM}-${paddedD}`);
    }
  };

  // Real-time Age Calculation (updates every second via `currentTime`)
  const ageCalculation = useMemo(() => {
    if (!birthDateString) return null;
    const parts = birthDateString.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;

    const [bYear, bMonth, bDay] = parts;
    const birthDate = new Date(bYear, bMonth - 1, bDay, 0, 0, 0);
    if (isNaN(birthDate.getTime()) || birthDate.getTime() > currentTime.getTime()) {
      return null;
    }

    let years = currentTime.getFullYear() - birthDate.getFullYear();
    let months = currentTime.getMonth() - birthDate.getMonth();
    let days = currentTime.getDate() - birthDate.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonth = new Date(currentTime.getFullYear(), currentTime.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const seconds = currentTime.getSeconds();

    const diffMs = currentTime.getTime() - birthDate.getTime();
    const totalSeconds = Math.floor(diffMs / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalDays = Math.floor(totalHours / 24);

    return {
      years,
      months,
      days,
      hours,
      minutes,
      seconds,
      totalDays,
      totalHours,
      totalMinutes,
      totalSeconds,
    };
  }, [birthDateString, currentTime]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

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

  // 3. دالة لحفظ مشروع جديد (فورية 0ms وتعمل بالإنترنت وبدون إنترنت وترفع التحديث تلقائياً)
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

    const customId = `proj-${Date.now()}`;
    const newProject: Project = {
      id: customId,
      description: description.trim() || 'مشروع بدون وصف',
      liveUrl: liveUrl.trim(),
      githubUrl: githubUrl.trim(),
      vercelUrl: vercelUrl.trim(),
      firebaseUrl: firebaseUrl.trim(),
      googleStudioUrl: googleStudioUrl.trim() || 'https://aistudio.google.com/',
      createdAt: new Date().toISOString().split('T')[0],
    };

    // Optimistic instant update in browser state & localStorage
    setProjects((prev) => [newProject, ...prev]);
    resetAddForm();
    setIsAddModalOpen(false);

    const { id: docId, ...firestoreData } = newProject;
    if (navigator.onLine) {
      showToast('تم حفظ المشروع بنجاح!');
      setDoc(doc(db, 'projects', docId), firestoreData).catch(() => {
        enqueueOfflineOperation({
          id: `op-${Date.now()}`,
          type: 'upsert_project',
          project: newProject,
          timestamp: Date.now(),
        });
      });
    } else {
      enqueueOfflineOperation({
        id: `op-${Date.now()}`,
        type: 'upsert_project',
        project: newProject,
        timestamp: Date.now(),
      });
      showToast('تم حفظ المشروع محلياً وسيتم رفعه تلقائياً عند عودة الإنترنت');
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

  // Save Edited Project (Optimistic instant update + online/offline sync)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    const updatedProject: Project = {
      ...selectedProject,
      description: editDescription.trim() || 'مشروع بدون وصف',
      liveUrl: editLiveUrl.trim(),
      githubUrl: editGithubUrl.trim(),
      vercelUrl: editVercelUrl.trim(),
      firebaseUrl: editFirebaseUrl.trim(),
      googleStudioUrl: editGoogleStudioUrl.trim() || 'https://aistudio.google.com/',
    };

    setProjects((prev) =>
      prev.map((item) => (item.id === selectedProject.id ? updatedProject : item))
    );
    setIsEditingInModal(false);

    const { id: docId, ...firestoreData } = updatedProject;
    if (navigator.onLine) {
      showToast('تم تحديث بيانات المشروع بنجاح');
      updateDoc(doc(db, 'projects', docId), firestoreData).catch(() => {
        setDoc(doc(db, 'projects', docId), firestoreData, { merge: true }).catch(() => {
          enqueueOfflineOperation({
            id: `op-${Date.now()}`,
            type: 'upsert_project',
            project: updatedProject,
            timestamp: Date.now(),
          });
        });
      });
    } else {
      enqueueOfflineOperation({
        id: `op-${Date.now()}`,
        type: 'upsert_project',
        project: updatedProject,
        timestamp: Date.now(),
      });
      showToast('تم حفظ التعديلات محلياً وسيتم رفعها عند عودة الإنترنت');
    }
  };

  // 4. دالة لحذف مشروع (فورية وتدعم العمل بدون إنترنت)
  const handleDeleteProject = async (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setSelectedProjectId(null);
    setIsEditingInModal(false);

    if (navigator.onLine) {
      showToast('تم حذف المشروع بنجاح');
      deleteDoc(doc(db, 'projects', projectId)).catch(() => {
        enqueueOfflineOperation({
          id: `op-${Date.now()}`,
          type: 'delete_project',
          projectId,
          timestamp: Date.now(),
        });
      });
    } else {
      enqueueOfflineOperation({
        id: `op-${Date.now()}`,
        type: 'delete_project',
        projectId,
        timestamp: Date.now(),
      });
      showToast('تم حذف المشروع محلياً وسيتم التحديث على السيستم فور عودة الإنترنت');
    }
  };

  // =====================================================================
  // EXPORT & IMPORT ALL SITE DATA (تصدير واستيراد كل البيانات المدخلة في الموقع)
  // =====================================================================
  const handleExportAllData = () => {
    try {
      const exportPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        siteConfig,
        birthDateString,
        projects,
      };
      const jsonString = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `amir-lamay-site-backup-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('تم تصدير جميع البيانات المدخلة في الموقع بنجاح');
    } catch {
      showToast('حدث خطأ أثناء تصدير البيانات');
    }
  };

  const handleImportAllData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        // Restore SiteConfig if present
        if (parsed.siteConfig && typeof parsed.siteConfig === 'object') {
          const newConfig: SiteConfig = {
            siteName: parsed.siteConfig.siteName || DEFAULT_SITE_CONFIG.siteName,
            facebookUrl: parsed.siteConfig.facebookUrl || DEFAULT_SITE_CONFIG.facebookUrl,
            instagramUrl: parsed.siteConfig.instagramUrl || DEFAULT_SITE_CONFIG.instagramUrl,
            phoneNumber: parsed.siteConfig.phoneNumber || DEFAULT_SITE_CONFIG.phoneNumber,
          };
          setSiteConfig(newConfig);
          localStorage.setItem(SITE_CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
          if (navigator.onLine) {
            setDoc(doc(db, 'settings', 'siteConfig'), newConfig, { merge: true }).catch(() => {
              enqueueOfflineOperation({
                id: `op-${Date.now()}-cfg`,
                type: 'update_settings',
                siteConfig: newConfig,
                timestamp: Date.now(),
              });
            });
          } else {
            enqueueOfflineOperation({
              id: `op-${Date.now()}-cfg`,
              type: 'update_settings',
              siteConfig: newConfig,
              timestamp: Date.now(),
            });
          }
        }

        // Restore Birthdate if present
        if (typeof parsed.birthDateString === 'string' && parsed.birthDateString) {
          handleCalendarDateChange(parsed.birthDateString);
        }

        // Restore Projects if present (supports both { projects: [...] } or direct array [...])
        const importedProjects: Project[] = Array.isArray(parsed.projects)
          ? parsed.projects
          : Array.isArray(parsed)
          ? parsed
          : [];

        if (importedProjects.length > 0) {
          const normalizedProjects: Project[] = importedProjects.map((p, idx) => ({
            id: p.id || `proj-${Date.now()}-${idx}`,
            description: p.description || 'مشروع بدون وصف',
            liveUrl: p.liveUrl || '',
            githubUrl: p.githubUrl || '',
            vercelUrl: p.vercelUrl || '',
            firebaseUrl: p.firebaseUrl || '',
            googleStudioUrl: p.googleStudioUrl || 'https://aistudio.google.com/',
            createdAt: p.createdAt || new Date().toISOString().split('T')[0],
          }));

          setProjects(normalizedProjects);
          localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(normalizedProjects));

          for (const proj of normalizedProjects) {
            const { id: docId, ...firestoreData } = proj;
            if (navigator.onLine) {
              setDoc(doc(db, 'projects', docId), firestoreData, { merge: true }).catch(() => {
                enqueueOfflineOperation({
                  id: `op-${Date.now()}-${docId}`,
                  type: 'upsert_project',
                  project: proj,
                  timestamp: Date.now(),
                });
              });
            } else {
              enqueueOfflineOperation({
                id: `op-${Date.now()}-${docId}`,
                type: 'upsert_project',
                project: proj,
                timestamp: Date.now(),
              });
            }
          }
        }

        showToast('تم استيراد جميع البيانات وتحديث الموقع بنجاح');
      } catch {
        showToast('ملف الاستيراد غير صالح، يرجى اختيار ملف JSON صحيح');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  // Handle Settings Password Submit
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === '0000') {
      setIsAuthenticated(true);
      setPasswordInput('');
      setPasswordError(false);
      showToast('تم تسجيل الدخول وتفعيل الإعدادات');
    } else {
      setPasswordError(true);
      setPasswordInput('');
    }
  };

  // Real-time Filtered Projects by any typed characters
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

  const ensureProtocol = (url: string) => {
    if (!url) return '#';
    return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
  };

  const getWhatsAppUrl = (phone: string) => {
    const cleaned = (phone || '').replace(/[^0-9]/g, '');
    if (!cleaned) return 'https://wa.me/';
    return `https://wa.me/${cleaned}`;
  };

  // Formatted Live Day, Date, and 12-Hour Clock
  const formattedDayName = useMemo(() => {
    return currentTime.toLocaleDateString('ar-EG', { weekday: 'long' });
  }, [currentTime]);

  const formattedDate = useMemo(() => {
    return currentTime.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [currentTime]);

  const formatted12HourTime = useMemo(() => {
    return currentTime.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }, [currentTime]);

  // Reusable Sidebar Content
  const renderSidebarContent = () => (
    <div className="glow-sidebar rounded-2xl p-6 flex flex-col justify-between h-full gap-8">
      {/* Top Brand & Control Panel */}
      <div className="space-y-7">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.25)]">
              <Layers className="w-5 h-5 text-sky-300" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight text-white truncate">
                {siteConfig.siteName}
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
            className="lg:hidden h-9 w-9 shrink-0 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
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

        {/* Navigation Items: جميع المشاريع + احسب عمرك (تظهر للجميع) */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400 px-2 pb-1">
            القائمة الرئيسية
          </p>
          <nav className="space-y-2">
            {/* جميع المشاريع */}
            <button
              type="button"
              onClick={() => {
                setActiveView('projects');
                setSearchQuery('');
                setIsMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
                activeView === 'projects'
                  ? 'bg-sky-500/18 text-sky-200 border border-sky-400/50 shadow-[0_0_18px_rgba(56,189,248,0.22)]'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.04] border border-transparent hover:border-sky-400/30'
              }`}
            >
              <span className="flex items-center gap-3 whitespace-nowrap">
                <FolderKanban
                  className={`w-4 h-4 ${
                    activeView === 'projects' ? 'text-sky-300' : 'text-slate-400'
                  }`}
                />
                <span>جميع المشاريع</span>
              </span>
              <span className="font-mono text-xs tabular-nums text-sky-200">
                {projects.length}
              </span>
            </button>

            {/* احسب عمرك (تظهر للجميع) */}
            <button
              type="button"
              onClick={() => {
                setActiveView('age');
                setIsMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
                activeView === 'age'
                  ? 'bg-sky-500/18 text-sky-200 border border-sky-400/50 shadow-[0_0_18px_rgba(56,189,248,0.22)]'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.04] border border-transparent hover:border-sky-400/30'
              }`}
            >
              <span className="flex items-center gap-3 whitespace-nowrap">
                <Calculator
                  className={`w-4 h-4 ${
                    activeView === 'age' ? 'text-sky-300' : 'text-slate-400'
                  }`}
                />
                <span>احسب عمرك</span>
              </span>
              <Clock className="w-3.5 h-3.5 text-sky-400/80" />
            </button>
          </nav>
        </div>
      </div>

      {/* Sidebar Bottom Platform Links (مخفية عن المستخدمين وتظهر فقط عند تسجيل الدخول من الإعدادات) & Settings */}
      <div className="space-y-2.5 pt-6 border-t border-white/10">
        {isAuthenticated && (
          <>
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
          </>
        )}

        {/* PWA Install Button if available */}
        {!isPWAInstalled && deferredPrompt && (
          <button
            type="button"
            onClick={handleInstallPWA}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-sky-200 bg-sky-500/12 hover:bg-sky-500/20 border border-sky-400/35 transition-all flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5 text-sky-400" />
              <span>تثبيت التطبيق للتصفح بدون نت</span>
            </span>
            <Download className="w-3.5 h-3.5 text-sky-300" />
          </button>
        )}

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
    <div className="relative min-h-screen w-full max-w-full bg-[#060B19] text-slate-100 flex flex-col lg:flex-row overflow-x-hidden">
      {/* Hidden File Input for Import Data */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImportAllData}
        className="hidden"
      />

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

      {/* MOBILE DRAWER SIDEBAR */}
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
        className="relative z-10 flex-1 min-w-0 p-3 sm:p-6 lg:p-8 flex flex-col justify-between gap-5 max-w-[1440px] overflow-x-hidden"
      >
        <div className="flex flex-col gap-5 flex-1 min-w-0">
          {/* Top Workspace Header */}
          <header className="glass-panel rounded-2xl px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Right side of header: Mobile Menu + Site Name + Mobile Settings */}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Mobile 3-Bars Hamburger Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMobileSidebarOpen(true);
                  }}
                  aria-label="فتح القائمة الجانبية"
                  className="lg:hidden h-9 w-9 shrink-0 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 flex items-center justify-center text-sky-300 shadow-[0_0_16px_rgba(56,189,248,0.25)] cursor-pointer"
                >
                  <Menu className="w-5 h-5" />
                </button>

                <div className="min-w-0 flex items-center gap-2">
                  <h2 className="text-base sm:text-xl font-bold text-white tracking-tight truncate">
                    {siteConfig.siteName}
                  </h2>
                  {!isOnline && (
                    <span
                      title="وضع التصفح بدون إنترنت — سيتم رفع أي تحديثات تلقائياً فور عودة الاتصال"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-400/40 text-[10px] font-medium text-amber-300 shrink-0"
                    >
                      <WifiOff className="w-3 h-3" />
                      <span>بدون نت</span>
                    </span>
                  )}
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
                className="md:hidden h-9 w-9 shrink-0 rounded-xl bg-white/[0.04] hover:bg-sky-500/15 border border-white/10 hover:border-sky-400/40 flex items-center justify-center text-slate-300 hover:text-sky-300 transition-all cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            {/* Left side of header (على اليسار بالأعلى مكان خانة البحث): اليوم والتاريخ والساعة في سطر واحد */}
            <div className="flex items-center justify-between md:justify-end gap-2.5 w-full md:w-auto">
              <div className="glass-card-interactive flex-1 md:flex-initial px-3 sm:px-4 py-2 rounded-xl flex items-center justify-between md:justify-center gap-2 sm:gap-3 text-[11px] sm:text-xs border border-sky-400/25 whitespace-nowrap overflow-hidden">
                <div className="flex items-center gap-1 text-sky-300 font-semibold shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0 hidden sm:inline" />
                  <span>{formattedDayName}</span>
                </div>
                <span className="text-white/20 shrink-0" aria-hidden="true">
                  ·
                </span>
                <span className="text-slate-200 font-medium shrink-0">{formattedDate}</span>
                <span className="text-white/20 shrink-0" aria-hidden="true">
                  ·
                </span>
                <div className="flex items-center gap-1 font-mono tabular-nums text-cyan-300 font-semibold bg-sky-500/10 px-2 py-0.5 rounded-lg border border-sky-400/25 shrink-0">
                  <Clock className="w-3 h-3 text-sky-400 shrink-0 hidden sm:inline" />
                  <span>{formatted12HourTime}</span>
                </div>
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

          {/* =====================================================================
              CONDITIONAL VIEW: EITHER PROJECTS OR AGE CALCULATOR ("احسب عمرك")
          ====================================================================== */}
          {activeView === 'age' ? (
            <section
              aria-label="احسب عمرك والساعة السكانية"
              className="flex-1 flex flex-col gap-4 w-full max-w-full overflow-x-hidden"
            >
              {/* 1. التاريخ يظهر في سطر واحد: اليوم والتاريخ والساعة */}
              <div className="glass-panel rounded-2xl px-3 sm:px-6 py-3.5 border border-sky-400/30 flex items-center justify-between gap-2 whitespace-nowrap overflow-hidden">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-sky-300 shrink-0">
                  <Calendar className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>{formattedDayName}</span>
                </div>

                <span className="text-xs sm:text-sm font-semibold text-slate-100 shrink-0">
                  {formattedDate}
                </span>

                <div className="flex items-center gap-1.5 font-mono tabular-nums text-xs sm:text-sm text-cyan-300 font-bold bg-sky-500/12 px-2.5 py-1 rounded-xl border border-sky-400/30 shrink-0">
                  <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>{formatted12HourTime}</span>
                </div>
              </div>

              {/* 2. أسفلها: الساعة السكانية الرسمية (تظهر فوراً دون أي تأخير أو رسائل انتظار) */}
              <div className="glass-modal w-full rounded-2xl p-4 sm:p-6 space-y-4 border border-sky-400/40 shadow-[0_0_30px_rgba(56,189,248,0.18)]">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-xl bg-sky-500/20 border border-sky-400/50 flex items-center justify-center shadow-[0_0_16px_rgba(56,189,248,0.3)]">
                      <Users className="w-4 h-4 sm:w-5 sm:h-5 text-sky-300" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-bold text-white truncate">
                        الساعة السكانية الرسمية
                      </h3>
                      <p className="text-[11px] sm:text-xs text-slate-300 truncate">
                        عدد سكان جمهورية مصر العربية محدث لحظياً من الموقع الرسمي
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => fetchOfficialEgyptPopulation(true)}
                    title="تحديث الآن من المصدر الرسمي"
                    className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-xl bg-white/[0.05] hover:bg-sky-500/20 border border-white/10 hover:border-sky-400/50 text-sky-300 flex items-center justify-center transition-all cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${isFetchingPop ? 'animate-spin' : ''}`}
                    />
                  </button>
                </div>

                {/* Official Population Number Display (Always displays immediately) */}
                <div className="glass-panel rounded-xl p-4 text-center space-y-2 border border-sky-400/30 bg-[#040814]/80">
                  <p className="text-[11px] sm:text-xs font-medium text-sky-300">
                    إجمالي عدد سكان جمهورية مصر العربية الآن (نسمة)
                  </p>

                  <div
                    dir="ltr"
                    className="text-2xl sm:text-4xl font-extrabold font-mono tabular-nums tracking-wider text-white drop-shadow-[0_0_18px_rgba(56,189,248,0.45)]"
                  >
                    {liveEgyptPopulation.toLocaleString('en-US')}
                  </div>

                  <p className="text-[10px] sm:text-[11px] text-slate-400">
                    المصدر الرسمي: الجهاز المركزي للتعبئة العامة والإحصاء (CAPMAS) ·{' '}
                    <span className="font-mono text-sky-300">{formatted12HourTime}</span>
                  </p>
                </div>
              </div>

              {/* 3. أسفلها: سجل تاريخ ميلادك */}
              <div className="glass-panel rounded-2xl p-4 sm:p-6 space-y-4 border border-sky-400/20">
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-center">
                      <Calculator className="w-4 h-4 text-sky-300" />
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-white truncate">
                      سجل تاريخ ميلادك
                    </h3>
                  </div>

                  {/* Toggle Input Method */}
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-[#050914]/70 border border-white/10 shrink-0">
                    <button
                      type="button"
                      onClick={() => setBirthInputMode('calendar')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                        birthInputMode === 'calendar'
                          ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      من النتيجة
                    </button>
                    <button
                      type="button"
                      onClick={() => setBirthInputMode('manual')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                        birthInputMode === 'manual'
                          ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      يدوياً
                    </button>
                  </div>
                </div>

                {birthInputMode === 'calendar' ? (
                  <div>
                    <input
                      id="birth-calendar-input"
                      type="date"
                      value={birthDateString}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => handleCalendarDateChange(e.target.value)}
                      className="glass-input w-full px-3.5 py-2.5 rounded-xl text-sm sm:text-base font-mono text-white cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-sky-300 text-center">
                        اليوم
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={manualDay}
                        onChange={(e) =>
                          handleManualDateChange(e.target.value, manualMonth, manualYear)
                        }
                        placeholder="اليوم"
                        className="glass-input w-full px-2 py-2.5 rounded-xl text-xs sm:text-sm font-mono text-white text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-sky-300 text-center">
                        الشهر
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={manualMonth}
                        onChange={(e) =>
                          handleManualDateChange(manualDay, e.target.value, manualYear)
                        }
                        placeholder="الشهر"
                        className="glass-input w-full px-2 py-2.5 rounded-xl text-xs sm:text-sm font-mono text-white text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-sky-300 text-center">
                        السنة
                      </label>
                      <input
                        type="number"
                        min={1900}
                        max={new Date().getFullYear()}
                        value={manualYear}
                        onChange={(e) =>
                          handleManualDateChange(manualDay, manualMonth, e.target.value)
                        }
                        placeholder="السنة"
                        className="glass-input w-full px-2 py-2.5 rounded-xl text-xs sm:text-sm font-mono text-white text-center"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 4. عمرك الحالي بالتفصيل (محدث لحظياً) بالتاريخ في سطر واحد
                  5. السن والشهر واليوم في سطر واحد بجانب بعض، أسفلهم الساعة والدقائق والثواني */}
              {ageCalculation ? (
                <>
                  <div className="glass-panel rounded-2xl p-4 sm:p-6 space-y-4 border border-sky-400/25 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 whitespace-nowrap border-b border-white/10 pb-3">
                      <h4 className="text-xs sm:text-base font-bold text-white flex items-center gap-1.5 truncate">
                        <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 shrink-0" />
                        <span className="truncate">عمرك الحالي بالتفصيل (محدث لحظياً)</span>
                      </h4>
                      <span
                        dir="ltr"
                        className="text-xs sm:text-sm font-mono font-semibold text-sky-300 tabular-nums bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-400/25 shrink-0"
                      >
                        {birthDateString}
                      </span>
                    </div>

                    {/* السطر الأول: السن والشهر واليوم في سطر واحد بجانب بعض */}
                    <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                      <div className="glass-card-interactive rounded-xl p-3 sm:p-4 text-center space-y-1">
                        <div className="text-xl sm:text-3xl font-bold font-mono tabular-nums text-sky-300">
                          {ageCalculation.years}
                        </div>
                        <div className="text-[11px] sm:text-xs text-slate-300 font-medium">
                          السن
                        </div>
                      </div>

                      <div className="glass-card-interactive rounded-xl p-3 sm:p-4 text-center space-y-1">
                        <div className="text-xl sm:text-3xl font-bold font-mono tabular-nums text-sky-200">
                          {ageCalculation.months}
                        </div>
                        <div className="text-[11px] sm:text-xs text-slate-300 font-medium">
                          الشهر
                        </div>
                      </div>

                      <div className="glass-card-interactive rounded-xl p-3 sm:p-4 text-center space-y-1">
                        <div className="text-xl sm:text-3xl font-bold font-mono tabular-nums text-cyan-300">
                          {ageCalculation.days}
                        </div>
                        <div className="text-[11px] sm:text-xs text-slate-300 font-medium">
                          اليوم
                        </div>
                      </div>
                    </div>

                    {/* السطر الثاني أسفلهم: الساعة والدقائق والثواني في سطر واحد بجانب بعض */}
                    <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                      <div className="glass-card-interactive rounded-xl p-3 sm:p-4 text-center space-y-1">
                        <div className="text-xl sm:text-3xl font-bold font-mono tabular-nums text-white">
                          {String(ageCalculation.hours).padStart(2, '0')}
                        </div>
                        <div className="text-[11px] sm:text-xs text-slate-300 font-medium">
                          الساعة
                        </div>
                      </div>

                      <div className="glass-card-interactive rounded-xl p-3 sm:p-4 text-center space-y-1">
                        <div className="text-xl sm:text-3xl font-bold font-mono tabular-nums text-white">
                          {String(ageCalculation.minutes).padStart(2, '0')}
                        </div>
                        <div className="text-[11px] sm:text-xs text-slate-300 font-medium">
                          الدقائق
                        </div>
                      </div>

                      <div className="glass-card-interactive rounded-xl p-3 sm:p-4 text-center space-y-1 border-sky-400/50 shadow-[0_0_20px_rgba(56,189,248,0.2)]">
                        <div className="text-xl sm:text-3xl font-bold font-mono tabular-nums text-sky-400">
                          {String(ageCalculation.seconds).padStart(2, '0')}
                        </div>
                        <div className="text-[11px] sm:text-xs text-sky-200 font-medium">
                          الثواني
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* أسفلها: عدد الأيام والساعات والدقائق والثواني التي عاشها صاحب المستعلم */}
                  <div className="glass-panel rounded-2xl p-4 sm:p-6 space-y-3.5 border border-sky-400/25 overflow-hidden">
                    <h4 className="text-xs sm:text-base font-bold text-white flex items-center gap-2 truncate">
                      <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="truncate">
                        عدد الأيام والساعات والدقائق والثواني التي عاشها المستعلم
                      </span>
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                      <div className="glass-card-interactive rounded-xl p-3 text-center space-y-1">
                        <div
                          dir="ltr"
                          className="text-sm sm:text-lg font-bold font-mono tabular-nums text-sky-300 truncate"
                        >
                          {ageCalculation.totalDays.toLocaleString('en-US')}
                        </div>
                        <div className="text-[11px] text-slate-300">عدد الأيام</div>
                      </div>

                      <div className="glass-card-interactive rounded-xl p-3 text-center space-y-1">
                        <div
                          dir="ltr"
                          className="text-sm sm:text-lg font-bold font-mono tabular-nums text-cyan-300 truncate"
                        >
                          {ageCalculation.totalHours.toLocaleString('en-US')}
                        </div>
                        <div className="text-[11px] text-slate-300">عدد الساعات</div>
                      </div>

                      <div className="glass-card-interactive rounded-xl p-3 text-center space-y-1">
                        <div
                          dir="ltr"
                          className="text-sm sm:text-lg font-bold font-mono tabular-nums text-slate-100 truncate"
                        >
                          {ageCalculation.totalMinutes.toLocaleString('en-US')}
                        </div>
                        <div className="text-[11px] text-slate-300">عدد الدقائق</div>
                      </div>

                      <div className="glass-card-interactive rounded-xl p-3 text-center space-y-1 border-sky-400/45 shadow-[0_0_15px_rgba(56,189,248,0.18)]">
                        <div
                          dir="ltr"
                          className="text-sm sm:text-lg font-bold font-mono tabular-nums text-sky-400 truncate"
                        >
                          {ageCalculation.totalSeconds.toLocaleString('en-US')}
                        </div>
                        <div className="text-[11px] text-sky-200">عدد الثواني</div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="glass-panel rounded-2xl p-6 text-center text-xs sm:text-sm text-rose-300">
                  يرجى إدخال تاريخ ميلاد صحيح (في الماضي) لعرض الحساب اللحظي.
                </div>
              )}
            </section>
          ) : (
            /* =================================================================
               PROJECTS DISPLAY AREA:
               - شريط البحث اللحظي مكان شريط الإحصائيات المحذوف
               - عرض المشروعات في سطر واحد وفي اليسار زر "فتح المنصة"
            ================================================================== */
            <section aria-label="قائمة المشاريع" className="flex-1 flex flex-col gap-4 min-w-0">
              {/* Live Search Bar */}
              <div className="glass-panel rounded-2xl p-3 sm:p-4 border border-sky-400/25">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-sky-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث هنا... اكتب أي حرف لفلترة المشروعات المسجلة لحظياً"
                    className="glass-input w-full pr-10 pl-9 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="مسح البحث"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {isLoading && projects.length === 0 ? (
                <div className="glass-panel rounded-2xl p-12 text-center my-auto flex flex-col items-center justify-center gap-4">
                  <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
                  <p className="text-sm text-slate-300">جاري تحميل المشاريع...</p>
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="glass-panel rounded-2xl p-10 text-center my-auto flex flex-col items-center justify-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-center shadow-[0_0_24px_rgba(56,189,248,0.18)]">
                    <Code2 className="w-6 h-6 text-sky-300" />
                  </div>
                  <div className="space-y-1 max-w-md">
                    <h3 className="text-base sm:text-lg font-semibold text-white">
                      {searchQuery
                        ? 'لا توجد مشاريع مطابقة للحروف المكتوبة'
                        : 'لا توجد مشاريع مضافة حتى الآن'}
                    </h3>
                  </div>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="glow-button-primary py-2 px-5 rounded-xl text-xs sm:text-sm font-medium text-white cursor-pointer"
                    >
                      عرض جميع المشاريع
                    </button>
                  )}
                </div>
              ) : (
                /* Project Cards: سطر واحد على الهاتف والكمبيوتر، الوصف على اليمين وفي اليسار زر "فتح المنصة" */
                <div className="flex flex-col gap-3.5">
                  <AnimatePresence mode="popLayout">
                    {filteredProjects.map((project, index) => (
                      <motion.article
                        layout
                        key={project.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.16 }}
                        onClick={() => handleOpenDetails(project)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleOpenDetails(project);
                          }
                        }}
                        className="glass-card-interactive group w-full rounded-2xl px-3.5 py-3.5 sm:px-6 sm:py-4 cursor-pointer flex flex-row items-center justify-between gap-3 text-right focus:outline-none"
                      >
                        {/* Right Side: Number + Single-Line Project Description */}
                        <div className="flex items-center gap-2.5 sm:gap-4 flex-1 min-w-0">
                          <div className="h-9 w-9 sm:h-11 sm:w-11 shrink-0 rounded-xl bg-sky-500/12 border border-sky-400/30 group-hover:border-sky-300/70 group-hover:bg-sky-500/20 flex items-center justify-center font-mono text-xs sm:text-sm font-semibold text-sky-300 tabular-nums transition-all">
                            {String(index + 1).padStart(2, '0')}
                          </div>

                          <p className="text-xs sm:text-base font-medium text-slate-100 group-hover:text-white truncate flex-1 min-w-0">
                            {project.description}
                          </p>
                        </div>

                        {/* Left Side (في اليسار): زر "فتح المنصة" بنفس تصميم زر فتح منصة جوجل استوديو */}
                        <div
                          className="shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a
                            href={ensureProtocol(project.liveUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-2 px-3 sm:py-2.5 sm:px-4 rounded-xl text-[11px] sm:text-xs font-medium text-slate-300 hover:text-sky-200 bg-white/[0.03] hover:bg-sky-500/10 border border-white/10 hover:border-sky-400/40 transition-all flex items-center justify-between gap-2 sm:gap-3 group/btn whitespace-nowrap"
                          >
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              <span>فتح المنصة</span>
                            </span>
                            <ArrowUpLeft className="w-3.5 h-3.5 text-slate-400 group-hover/btn:text-sky-300 transition-transform group-hover/btn:-translate-x-0.5 group-hover/btn:-translate-y-0.5 shrink-0" />
                          </a>
                        </div>
                      </motion.article>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </section>
          )}
        </div>

        {/* =====================================================================
            BOTTOM AREA:
            - على اليسار في الأسفل: قائمة باسم "للتواصل" (فيس بوك، انستجرام، الهاتف -> واتساب)
            - توقيع المطور باللغة الإنجليزية
        ====================================================================== */}
        <footer className="pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
          <p
            className="text-xs sm:text-sm font-medium text-slate-400 tracking-wide order-2 md:order-1"
            dir="ltr"
          >
            With best regards, Developer{' '}
            <span className="text-sky-300 font-semibold">Amir Lamay</span>
          </p>

          {/* Bottom-Left Contact List */}
          <div className="glass-panel rounded-2xl p-4 w-full md:w-72 space-y-2.5 border border-sky-400/25 order-1 md:order-2 mr-auto md:mr-0">
            <h3 className="text-xs font-bold text-sky-300 px-1 pb-1 border-b border-white/10">
              للتواصل
            </h3>

            <div className="flex flex-col gap-2">
              {/* 1. فيس بوك */}
              <a
                href={ensureProtocol(siteConfig.facebookUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-sky-500/12 border border-white/10 hover:border-sky-400/40 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-[#1877F2] flex items-center justify-center text-white shadow-sm shrink-0">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-slate-200 group-hover:text-white">
                    فيس بوك
                  </span>
                </div>
                <ArrowUpLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-300" />
              </a>

              {/* 2. انستجرام */}
              <a
                href={ensureProtocol(siteConfig.instagramUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-sky-500/12 border border-white/10 hover:border-sky-400/40 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white shadow-sm shrink-0">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-slate-200 group-hover:text-white">
                    انستجرام
                  </span>
                </div>
                <ArrowUpLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-300" />
              </a>

              {/* 3. الهاتف (يفتح الواتساب في محادثة شخصية) */}
              <a
                href={getWhatsAppUrl(siteConfig.phoneNumber)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-sky-500/12 border border-white/10 hover:border-sky-400/40 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-[#25D366] flex items-center justify-center text-white shadow-sm shrink-0">
                    <Phone className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <span className="text-xs font-medium text-slate-200 group-hover:text-white">
                    الهاتف
                  </span>
                </div>
                <ArrowUpLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-300" />
              </a>
            </div>
          </div>
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
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-center shadow-[0_0_16px_rgba(56,189,248,0.25)]">
                    <Plus className="w-5 h-5 text-sky-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">إضافة مشروع جديد</h3>
                    <p className="text-xs text-slate-300">
                      أدخل بيانات وروابط المشروع لحفظها فوراً
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

                {/* 5. لينك فاير بيز السحابي */}
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

                {/* Action Button: زر "حفظ" */}
                <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      resetAddForm();
                      setIsAddModalOpen(false);
                    }}
                    className="px-5 py-3 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="glow-button-primary flex-1 sm:flex-initial sm:min-w-[160px] py-3 px-6 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>حفظ</span>
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
              className="glass-modal relative w-full max-w-2xl rounded-2xl p-5 sm:p-8 text-right max-h-[90vh] overflow-y-auto"
            >
              {/* Top Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4 mb-5">
                {isAuthenticated ? (
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
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

                    <button
                      type="button"
                      onClick={() => handleDeleteProject(selectedProject.id)}
                      className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 bg-rose-500/12 hover:bg-rose-500/25 border border-rose-400/35 hover:border-rose-400/70 text-rose-200 hover:shadow-[0_0_16px_rgba(244,63,94,0.3)] transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>حذف</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <FileText className="w-4 h-4 text-sky-400" />
                    <span>تفاصيل المشروع</span>
                  </div>
                )}

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
                <div className="space-y-5">
                  <div className="glass-panel rounded-xl p-4 sm:p-5 space-y-2.5 border border-white/10">
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
                      onClick={() => setIsEditingInModal(false)}
                      className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-300 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="glow-button-primary px-6 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center gap-2 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>حفظ التعديلات</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Authenticated View inside Details Modal */
                <div className="space-y-3.5">
                  {/* Field 1: وصف الموقع */}
                  <div className="glass-panel rounded-xl p-4 space-y-2 border border-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-sky-300 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>وصف الموقع</span>
                      </span>

                      <a
                        href={ensureProtocol(selectedProject.liveUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sm:hidden px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-sky-500/20 border border-white/10 hover:border-sky-400/50 text-slate-200 hover:text-sky-200 flex items-center gap-1.5 transition-all"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                        <span>فتح المنصة</span>
                      </a>

                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(selectedProject.description, 'وصف الموقع', 'desc')
                        }
                        className="hidden sm:flex px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-sky-500/20 border border-white/10 hover:border-sky-400/50 text-slate-200 hover:text-sky-200 items-center gap-1.5 transition-all cursor-pointer"
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

                  {/* Field 2: لينك الموقع */}
                  <div className="glass-panel rounded-xl p-4 flex items-center justify-between gap-3 border border-white/10">
                    <span className="text-xs font-medium text-sky-300 flex items-center gap-2">
                      <Globe className="w-4 h-4 shrink-0" />
                      <span>لينك الموقع (Live URL)</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!selectedProject.liveUrl}
                        onClick={() =>
                          handleCopy(selectedProject.liveUrl, 'لينك الموقع', 'live')
                        }
                        className="hidden sm:flex px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-sky-500/20 disabled:opacity-40 border border-white/10 hover:border-sky-400/50 text-slate-200 hover:text-sky-200 items-center gap-1.5 transition-all cursor-pointer"
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

                      <a
                        href={ensureProtocol(selectedProject.liveUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3.5 rounded-xl text-xs font-medium text-slate-200 hover:text-sky-200 bg-white/[0.04] hover:bg-sky-500/15 border border-white/10 hover:border-sky-400/40 transition-all flex items-center gap-2 whitespace-nowrap"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                        <span>فتح المنصة</span>
                        <ArrowUpLeft className="w-3.5 h-3.5 text-slate-400" />
                      </a>
                    </div>
                  </div>

                  {/* Field 3: لينك GitHub */}
                  <div className="glass-panel rounded-xl p-4 flex items-center justify-between gap-3 border border-white/10">
                    <span className="text-xs font-medium text-sky-300 flex items-center gap-2">
                      <Github className="w-4 h-4 shrink-0" />
                      <span>لينك GitHub</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!selectedProject.githubUrl}
                        onClick={() =>
                          handleCopy(selectedProject.githubUrl, 'لينك GitHub', 'github')
                        }
                        className="hidden sm:flex px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-sky-500/20 disabled:opacity-40 border border-white/10 hover:border-sky-400/50 text-slate-200 hover:text-sky-200 items-center gap-1.5 transition-all cursor-pointer"
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

                      <a
                        href={ensureProtocol(selectedProject.githubUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3.5 rounded-xl text-xs font-medium text-slate-200 hover:text-sky-200 bg-white/[0.04] hover:bg-sky-500/15 border border-white/10 hover:border-sky-400/40 transition-all flex items-center gap-2 whitespace-nowrap"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                        <span>فتح المنصة</span>
                        <ArrowUpLeft className="w-3.5 h-3.5 text-slate-400" />
                      </a>
                    </div>
                  </div>

                  {/* Field 4: لينك Vercel */}
                  <div className="glass-panel rounded-xl p-4 flex items-center justify-between gap-3 border border-white/10">
                    <span className="text-xs font-medium text-sky-300 flex items-center gap-2">
                      <Triangle className="w-4 h-4 shrink-0" />
                      <span>لينك Vercel</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!selectedProject.vercelUrl}
                        onClick={() =>
                          handleCopy(selectedProject.vercelUrl, 'لينك Vercel', 'vercel')
                        }
                        className="hidden sm:flex px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-sky-500/20 disabled:opacity-40 border border-white/10 hover:border-sky-400/50 text-slate-200 hover:text-sky-200 items-center gap-1.5 transition-all cursor-pointer"
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

                      <a
                        href={ensureProtocol(selectedProject.vercelUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3.5 rounded-xl text-xs font-medium text-slate-200 hover:text-sky-200 bg-white/[0.04] hover:bg-sky-500/15 border border-white/10 hover:border-sky-400/40 transition-all flex items-center gap-2 whitespace-nowrap"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                        <span>فتح المنصة</span>
                        <ArrowUpLeft className="w-3.5 h-3.5 text-slate-400" />
                      </a>
                    </div>
                  </div>

                  {/* Field 5: لينك فاير بيز السحابي */}
                  <div className="glass-panel rounded-xl p-4 flex items-center justify-between gap-3 border border-white/10">
                    <span className="text-xs font-medium text-sky-300 flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>لينك فاير بيز السحابي</span>
                    </span>

                    <div className="flex items-center gap-2">
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
                        className="hidden sm:flex px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-sky-500/20 disabled:opacity-40 border border-white/10 hover:border-sky-400/50 text-slate-200 hover:text-sky-200 items-center gap-1.5 transition-all cursor-pointer"
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

                      <a
                        href={ensureProtocol(selectedProject.firebaseUrl || '')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3.5 rounded-xl text-xs font-medium text-slate-200 hover:text-sky-200 bg-white/[0.04] hover:bg-sky-500/15 border border-white/10 hover:border-sky-400/40 transition-all flex items-center gap-2 whitespace-nowrap"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                        <span>فتح المنصة</span>
                        <ArrowUpLeft className="w-3.5 h-3.5 text-slate-400" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Additional Link: رابط "Google Studio" */}
              {isAuthenticated && !isEditingInModal && (
                <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Link2 className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>Google Studio</span>
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
                      className="hidden sm:flex px-3 py-2 rounded-xl text-xs font-medium bg-white/[0.05] hover:bg-sky-500/20 border border-white/10 hover:border-sky-400/50 text-slate-200 hover:text-sky-200 items-center gap-1.5 transition-all cursor-pointer"
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
                      className="glow-button-primary px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>فتح المنصة</span>
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
          SETTINGS MODAL (نافذة الإعدادات السرية + تعديل اسم الموقع وقائمة التواصل + تصدير واستيراد البيانات)
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
              className="glass-modal relative w-full max-w-lg rounded-2xl p-6 sm:p-7 text-right max-h-[90vh] overflow-y-auto"
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
                  <div className="glass-panel rounded-xl p-3.5 flex items-center gap-3 border border-emerald-400/30">
                    <Unlock className="w-5 h-5 text-emerald-400 shrink-0" />
                    <p className="text-xs text-slate-200">
                      وضع المطور مفعل — أي تعديل أدناه يظهر ويتحدث لحظياً في الموقع.
                    </p>
                  </div>

                  {/* 1. خانة تعديل اسم الموقع */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="setting-site-name"
                      className="block text-xs font-semibold text-sky-300"
                    >
                      تعديل اسم الموقع
                    </label>
                    <input
                      id="setting-site-name"
                      type="text"
                      value={siteConfig.siteName}
                      onChange={(e) => handleUpdateSiteConfig('siteName', e.target.value)}
                      placeholder="منصه مشروعات المطور Amir Lamay"
                      className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-white"
                    />
                  </div>

                  {/* 2. قائمة التواصل (فيس بوك، انستجرام، رقم الهاتف) */}
                  <div className="space-y-3 pt-3 border-t border-white/10">
                    <h4 className="text-xs font-bold text-sky-300">قائمة التواصل</h4>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="setting-fb"
                        className="block text-xs font-medium text-slate-300"
                      >
                        لينك الفيس بوك
                      </label>
                      <input
                        id="setting-fb"
                        type="text"
                        dir="ltr"
                        value={siteConfig.facebookUrl}
                        onChange={(e) => handleUpdateSiteConfig('facebookUrl', e.target.value)}
                        placeholder="https://www.facebook.com/username"
                        className="glass-input w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-mono text-white text-left"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="setting-ig"
                        className="block text-xs font-medium text-slate-300"
                      >
                        لينك الانستجرام
                      </label>
                      <input
                        id="setting-ig"
                        type="text"
                        dir="ltr"
                        value={siteConfig.instagramUrl}
                        onChange={(e) => handleUpdateSiteConfig('instagramUrl', e.target.value)}
                        placeholder="https://www.instagram.com/username"
                        className="glass-input w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-mono text-white text-left"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="setting-phone"
                        className="block text-xs font-medium text-slate-300"
                      >
                        رقم الهاتف (واتساب)
                      </label>
                      <input
                        id="setting-phone"
                        type="text"
                        dir="ltr"
                        value={siteConfig.phoneNumber}
                        onChange={(e) => handleUpdateSiteConfig('phoneNumber', e.target.value)}
                        placeholder="201000000000"
                        className="glass-input w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-mono text-white text-left"
                      />
                    </div>
                  </div>

                  {/* 3. تصدير البيانات واستيراد البيانات (كل البيانات المدخلة في الموقع) */}
                  <div className="space-y-3 pt-3 border-t border-white/10">
                    <h4 className="text-xs font-bold text-sky-300">
                      نسخ احتياطي للبيانات (تصدير واستيراد كل البيانات المدخلة)
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* زر تصدير البيانات */}
                      <button
                        type="button"
                        onClick={handleExportAllData}
                        className="py-2.5 px-4 rounded-xl text-xs sm:text-sm font-medium text-sky-200 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 hover:border-sky-400/70 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-sky-300" />
                        <span>تصدير البيانات</span>
                      </button>

                      {/* زر استيراد البيانات */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="py-2.5 px-4 rounded-xl text-xs sm:text-sm font-medium text-cyan-200 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 hover:border-cyan-400/70 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-cyan-300" />
                        <span>استيراد البيانات</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSettingsModalOpen(false);
                        showToast('تم حفظ الإعدادات وتحديث الموقع لحظياً');
                      }}
                      className="glow-button-primary w-full py-2.5 px-5 rounded-xl text-xs sm:text-sm font-semibold text-white cursor-pointer"
                    >
                      تم
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAuthenticated(false);
                        setIsSettingsModalOpen(false);
                        showToast('تم قفل الروابط والعودة لوضع الزائر');
                      }}
                      className="w-full py-2.5 px-5 rounded-xl text-xs sm:text-sm font-medium text-rose-200 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/40 transition-all cursor-pointer"
                    >
                      تسجيل الخروج وإخفاء الروابط
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handlePasswordSubmit} className="space-y-4" autoComplete="off">
                  {passwordError && (
                    <div className="rounded-xl bg-rose-500/15 border border-rose-400/40 px-4 py-2.5 text-xs text-rose-200">
                      الرمز غير صحيح
                    </div>
                  )}

                  <div className="space-y-2">
                    <label
                      htmlFor="secret-pass-input"
                      className="block text-xs font-medium text-slate-300"
                    >
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
