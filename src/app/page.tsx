'use client';

import { useCustomSession } from '@/components/providers';
import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  LayoutDashboard,
  Store,
  Users,
  ClipboardList,
  Image as ImageIcon,
  LogOut,
  Menu,
  X,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Package,
  CheckCircle,
  XCircle,
  TrendingUp,
  Building2,
  UserCheck,
  FileText,
  Bell,
  Edit,
  Trash2,
  Key,
  Camera,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  CameraOff,
  Download,
  Upload,
} from 'lucide-react';

// Types
interface Store {
  id: string;
  storeId: string;
  storeCode: string | null;
  storeName: string;
  channel: string;
  hc: number;
  region: string;
  province: string;
  mcp: string;
  tdl: string | null;
  tds: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { displays: number; surveyResponses: number };
}

interface User {
  id: string;
  userid: string;
  username: string;
  loginid: string;
  role: string;
  leader: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  lastLogin: string | null;
  createdAt: string;
  _count?: { assignedStores: number; surveyResponses: number };
}

interface SurveyResponse {
  id: string;
  leader: string;
  shopName: string;
  storeId: string | null;
  submittedBy: string;
  submittedByRole: string;
  submittedAt: string;
  responses: Array<{
    model: string;
    quantity: number;
    posmSelections: Array<{ posmCode: string; posmName: string; selected: boolean }>;
    allSelected: boolean;
    images: string[];
  }>;
  store?: { storeName: string; region: string; province: string };
  user?: { userid: string; username: string; role: string };
}

interface Display {
  id: string;
  storeId: string;
  model: string;
  isDisplayed: boolean;
  createdAt: string;
  store?: { storeId: string; storeName: string; region: string; province: string };
  user?: { userid: string; username: string };
}

interface ModelPosm {
  model: string;
  posm: string;
  posmName: string;
  category: string | null;
  project: string | null;
}

interface DashboardData {
  counts: {
    totalStores: number;
    activeStores: number;
    totalUsers: number;
    activeUsers: number;
    totalSurveys: number;
    totalDisplays: number;
    displayedCount: number;
    displayRate: number;
  };
  charts: {
    storesByRegion: Array<{ name: string; value: number }>;
    storesByChannel: Array<{ name: string; value: number }>;
    usersByRole: Array<{ name: string; value: number }>;
  };
  recent: {
    surveys: SurveyResponse[];
    users: User[];
  };
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  TDL: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  TDS: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  PRT: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  user: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

// Role hierarchy for navigation
const ROLE_NAVIGATION: Record<string, string[]> = {
  admin: ['dashboard', 'stores', 'surveys', 'displays', 'users'],
  TDL: ['surveys'],
  TDS: ['surveys'],
  PRT: ['surveys'],
  user: ['surveys'],
};

export default function Home() {
  const session = useCustomSession();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get allowed navigation based on role
  const allowedTabs = session.user ? ROLE_NAVIGATION[session.user.role] || ['surveys'] : [];
  const defaultTab = allowedTabs[0] || 'surveys';
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Data states
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [surveys, setSurveys] = useState<SurveyResponse[]>([]);
  const [displays, setDisplays] = useState<Display[]>([]);
  const [modelPosms, setModelPosms] = useState<ModelPosm[]>([]);
  const [modelGroups, setModelGroups] = useState<Record<string, ModelPosm[]>>({});

  // Pagination
  const [storePage, setStorePage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [surveyPage, setSurveyPage] = useState(1);
  const [storeTotal, setStoreTotal] = useState(0);
  const [userTotal, setUserTotal] = useState(0);
  const [surveyTotal, setSurveyTotal] = useState(0);

  // Filters
  const [storeSearch, setStoreSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [storeRegion, setStoreRegion] = useState('');
  const [userRole, setUserRole] = useState('');

  // Dialog states
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [surveyDialogOpen, setSurveyDialogOpen] = useState(false);
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [storeForm, setStoreForm] = useState({
    storeId: '',
    storeCode: '',
    storeName: '',
    channel: 'GT',
    hc: 0,
    region: '',
    province: '',
    mcp: 'N',
    tdl: '',
    tds: '',
  });

  const [userForm, setUserForm] = useState({
    userid: '',
    username: '',
    loginid: '',
    password: '',
    role: 'user',
    leader: '',
    isActive: true,
  });

  const [editForm, setEditForm] = useState({
    username: '',
    role: '',
    leader: '',
    isActive: true,
    newPassword: '',
  });

  const [surveyForm, setSurveyForm] = useState({
    leader: '',
    shopName: '',
    storeId: '',
    responses: [] as Array<{
      model: string;
      quantity: number;
      posmSelections: Array<{ posmCode: string; posmName: string; selected: boolean }>;
      allSelected: boolean;
      images: string[];
    }>,
  });

  // Camera state for mobile survey
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [currentModelIndex, setCurrentModelIndex] = useState<number | null>(null);

  // Login state
  const [loginForm, setLoginForm] = useState({ loginid: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);

  // Shop autocomplete state
  const [shopSearch, setShopSearch] = useState('');
  const [showShopDropdown, setShowShopDropdown] = useState(false);
  const [allStores, setAllStores] = useState<Store[]>([]);

  // Model autocomplete state
  const [modelSearch, setModelSearch] = useState('');
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  // Import/Export state
  const storeImportRef = useRef<HTMLInputElement>(null);
  const userImportRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // Leader users for dropdown (TDL and TDS roles)
  const leaderUsers = users.filter(u => ['TDL', 'TDS'].includes(u.role) && u.isActive);

  // Fetch functions
  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      setDashboardData(data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
  };

  const fetchStores = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: storePage.toString(),
        limit: '10',
        search: storeSearch,
        region: storeRegion,
      });
      const res = await fetch(`/api/stores?${params}`);
      const data = await res.json();
      setStores(data.stores);
      setStoreTotal(data.pagination.total);
    } catch (error) {
      console.error('Error fetching stores:', error);
    }
    setLoading(false);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: userPage.toString(),
        limit: '10',
        search: userSearch,
        role: userRole,
      });
      const res = await fetch(`/api/users?${params}`);
      const data = await res.json();
      setUsers(data.users);
      setUserTotal(data.pagination.total);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
    setLoading(false);
  };

  const fetchSurveys = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: surveyPage.toString(),
        limit: '10',
      });
      // Pass user ID and admin status for filtering
      if (session.user) {
        params.append('submittedById', session.user.id);
        params.append('isAdmin', session.user.role === 'admin' ? 'true' : 'false');
      }
      const res = await fetch(`/api/surveys?${params}`);
      const data = await res.json();
      setSurveys(data.surveys);
      setSurveyTotal(data.pagination.total);
    } catch (error) {
      console.error('Error fetching surveys:', error);
    }
    setLoading(false);
  };

  const fetchDisplays = async () => {
    try {
      const res = await fetch('/api/displays?limit=50');
      const data = await res.json();
      setDisplays(data.displays);
    } catch (error) {
      console.error('Error fetching displays:', error);
    }
  };

  const fetchModelPosms = async () => {
    try {
      const res = await fetch('/api/model-posm');
      const data = await res.json();
      setModelPosms(data.modelPosms);
      setModelGroups(data.groupedByModel);
    } catch (error) {
      console.error('Error fetching model POSM:', error);
    }
  };

  // Fetch all stores for autocomplete
  const fetchAllStores = async () => {
    try {
      const res = await fetch('/api/stores?limit=1000');
      const data = await res.json();
      setAllStores(data.stores);
    } catch (error) {
      console.error('Error fetching all stores:', error);
    }
  };

  // Export stores to xlsx
  const handleExportStores = async () => {
    try {
      const res = await fetch('/api/stores/export');
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'stores.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
        toast({ title: 'Success', description: 'Stores exported successfully' });
      } else {
        toast({ title: 'Error', description: 'Failed to export stores', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error exporting stores:', error);
      toast({ title: 'Error', description: 'Failed to export stores', variant: 'destructive' });
    }
  };

  // Export users to xlsx
  const handleExportUsers = async () => {
    try {
      const res = await fetch('/api/users/export');
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'users.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
        toast({ title: 'Success', description: 'Users exported successfully' });
      } else {
        toast({ title: 'Error', description: 'Failed to export users', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error exporting users:', error);
      toast({ title: 'Error', description: 'Failed to export users', variant: 'destructive' });
    }
  };

  // Import stores from xlsx file
  const handleImportStores = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/stores/import', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();
      
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({
          title: 'Import Complete',
          description: `Success: ${result.success}, Failed: ${result.failed}${result.errors?.length ? `\nErrors: ${result.errors.slice(0, 3).join(', ')}...` : ''}`,
        });
      }

      fetchStores();
      fetchDashboard();
    } catch (error) {
      console.error('Error importing stores:', error);
      toast({ title: 'Error', description: 'Failed to import stores', variant: 'destructive' });
    }
    setImporting(false);
    if (storeImportRef.current) storeImportRef.current.value = '';
  };

  // Import users from xlsx file
  const handleImportUsers = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/users/import', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();
      
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({
          title: 'Import Complete',
          description: `Success: ${result.success}, Failed: ${result.failed}${result.errors?.length ? `\nErrors: ${result.errors.slice(0, 3).join(', ')}...` : ''}`,
        });
      }

      fetchUsers();
      fetchDashboard();
    } catch (error) {
      console.error('Error importing users:', error);
      toast({ title: 'Error', description: 'Failed to import users', variant: 'destructive' });
    }
    setImporting(false);
    if (userImportRef.current) userImportRef.current.value = '';
  };

  // Effects for data fetching
  useEffect(() => {
    if (session.user) {
      /* eslint-disable react-hooks/set-state-in-effect */
      fetchDashboard().catch(console.error);
      fetchStores().catch(console.error);
      fetchUsers().catch(console.error);
      fetchSurveys().catch(console.error);
      fetchDisplays().catch(console.error);
      fetchModelPosms().catch(console.error);
      fetchAllStores().catch(console.error);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [session]);

  useEffect(() => {
    if (session.user) {
      /* eslint-disable react-hooks/set-state-in-effect */
      fetchStores().catch(console.error);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [storePage, storeSearch, storeRegion]);

  useEffect(() => {
    if (session.user) {
      /* eslint-disable react-hooks/set-state-in-effect */
      fetchUsers().catch(console.error);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [userPage, userSearch, userRole]);

  useEffect(() => {
    if (session.user) {
      /* eslint-disable react-hooks/set-state-in-effect */
      fetchSurveys().catch(console.error);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [surveyPage]);

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(loginForm),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast({
          title: 'Login Successful',
          description: `Welcome, ${data.user?.username || 'User'}!`,
        });
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        toast({
          title: 'Login Failed',
          description: data.error || 'Invalid credentials. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Error',
        description: 'Failed to login. Please try again.',
        variant: 'destructive',
      });
    }
    setLoginLoading(false);
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      document.cookie = 'next-auth.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      window.location.reload();
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: 'Error',
        description: 'Failed to logout. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle store creation
  const handleCreateStore = async () => {
    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeForm),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Store created successfully' });
        setStoreDialogOpen(false);
        fetchStores();
        fetchDashboard();
        setStoreForm({
          storeId: '',
          storeCode: '',
          storeName: '',
          channel: 'GT',
          hc: 0,
          region: '',
          province: '',
          mcp: 'N',
          tdl: '',
          tds: '',
        });
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create store', variant: 'destructive' });
    }
  };

  // Handle user creation
  const handleCreateUser = async () => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'User created successfully' });
        setUserDialogOpen(false);
        fetchUsers();
        fetchDashboard();
        setUserForm({
          userid: '',
          username: '',
          loginid: '',
          password: '',
          role: 'user',
          leader: '',
          isActive: true,
        });
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create user', variant: 'destructive' });
    }
  };

  // Handle edit user
  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'User updated successfully' });
        setEditUserDialogOpen(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update user', variant: 'destructive' });
    }
  };

  // Open edit user dialog
  const openEditUserDialog = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      username: user.username,
      role: user.role,
      leader: user.leader || '',
      isActive: user.isActive,
      newPassword: '',
    });
    setEditUserDialogOpen(true);
  };

  // Handle survey submission
  const handleCreateSurvey = async () => {
    try {
      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...surveyForm,
          submittedById: session.user?.id,
          submittedBy: session.user?.username,
          submittedByRole: session.user?.role,
        }),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Survey submitted successfully' });
        setSurveyDialogOpen(false);
        fetchSurveys();
        fetchDashboard();
        setSurveyForm({
          leader: '',
          shopName: '',
          storeId: '',
          responses: [],
        });
        setCapturedImages([]);
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to submit survey', variant: 'destructive' });
    }
  };

  // Add model to survey form
  const addModelToSurvey = (model: string) => {
    const posmItems = modelGroups[model] || [];
    setSurveyForm((prev) => ({
      ...prev,
      responses: [
        {
          model,
          quantity: 1,
          posmSelections: posmItems.map((p) => ({
            posmCode: p.posm,
            posmName: p.posmName,
            selected: false,
          })),
          allSelected: false,
          images: [],
        },
        ...prev.responses, // New models added at the top
      ],
    }));
  };

  // Toggle POSM selection
  const togglePosmSelection = (responseIndex: number, posmIndex: number) => {
    setSurveyForm((prev) => {
      const responses = [...prev.responses];
      const selection = responses[responseIndex].posmSelections[posmIndex];
      selection.selected = !selection.selected;
      responses[responseIndex].allSelected = responses[responseIndex].posmSelections.every(
        (p) => p.selected
      );
      return { ...prev, responses };
    });
  };

  // Select all POSM for a model
  const selectAllPosm = (responseIndex: number) => {
    setSurveyForm((prev) => {
      const responses = [...prev.responses];
      const allSelected = !responses[responseIndex].allSelected;
      responses[responseIndex].posmSelections.forEach((p) => (p.selected = allSelected));
      responses[responseIndex].allSelected = allSelected;
      return { ...prev, responses };
    });
  };

  // Remove model from survey
  const removeModelFromSurvey = (index: number) => {
    setSurveyForm((prev) => ({
      ...prev,
      responses: prev.responses.filter((_, i) => i !== index),
    }));
  };

  // Handle camera capture
  const handleImageCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newImages: string[] = [];
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          newImages.push(e.target.result as string);
          if (newImages.length === files.length) {
            setCapturedImages((prev) => [...prev, ...newImages]);
            if (currentModelIndex !== null) {
              setSurveyForm((prev) => {
                const responses = [...prev.responses];
                responses[currentModelIndex].images = [
                  ...responses[currentModelIndex].images,
                  ...newImages,
                ];
                return { ...prev, responses };
              });
            }
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Trigger camera
  const triggerCamera = (modelIndex: number) => {
    setCurrentModelIndex(modelIndex);
    fileInputRef.current?.click();
  };

  // Remove image
  const removeImage = (modelIndex: number, imageIndex: number) => {
    setSurveyForm((prev) => {
      const responses = [...prev.responses];
      responses[modelIndex].images = responses[modelIndex].images.filter((_, i) => i !== imageIndex);
      return { ...prev, responses };
    });
  };

  // Show login page if not authenticated
  if (session.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!session.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
              <Package className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardTitle className="text-2xl font-bold">POSM Survey System</CardTitle>
            <CardDescription>Sign in to your account to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="loginid">Login ID</Label>
                <Input
                  id="loginid"
                  type="text"
                  placeholder="Enter your login ID"
                  value={loginForm.loginid}
                  onChange={(e) => setLoginForm({ ...loginForm, loginid: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loginLoading}>
                {loginLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>Demo credentials:</p>
              <p className="mt-1">Admin: <code className="bg-muted px-1 rounded">admin / admin123</code></p>
              <p>TDL: <code className="bg-muted px-1 rounded">tdl1 / tdl123</code></p>
              <p>PRT: <code className="bg-muted px-1 rounded">prt1 / prt123</code></p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user should only see survey page (mobile-first for PRT/TDS/TDL)
  const isMobileSurveyOnly = ['PRT', 'TDS', 'TDL'].includes(session.user?.role);

  // Mobile Survey Only View
  if (isMobileSurveyOnly) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        {/* Hidden file input for camera */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleImageCapture}
        />

        {/* Mobile Header */}
        <header className="sticky top-0 z-50 bg-emerald-600 text-white shadow-lg">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <Package className="h-6 w-6" />
              <span className="font-semibold">POSM Survey</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{session.user?.username}</span>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-emerald-700"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="p-4 pb-20">
          {!surveyDialogOpen ? (
            <div className="space-y-4">
              <Card className="shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Quick Survey</CardTitle>
                  <CardDescription>Collect POSM survey data</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setSurveyDialogOpen(true)}
                  >
                    <Plus className="h-6 w-6 mr-2" />
                    Start New Survey
                  </Button>
                </CardContent>
              </Card>

              <Card className="shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Recent Surveys</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-320px)]">
                    {surveys.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        No surveys yet
                      </div>
                    ) : (
                      <div className="divide-y">
                        {surveys.map((survey) => (
                          <div key={survey.id} className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{survey.shopName}</p>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(survey.submittedAt).toLocaleDateString()}
                                </p>
                              </div>
                              <Badge>{survey.responses?.length || 0} items</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Survey Form - Mobile First */
            <div className="space-y-4 pb-24">{/* Add padding at bottom for sticky submit button */}
              <Card className="shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">New Survey</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSurveyDialogOpen(false);
                        setSurveyForm({ leader: '', shopName: '', storeId: '', responses: [] });
                        setCapturedImages([]);
                        setShopSearch('');
                      }}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 relative">
                    <Label>Shop Name *</Label>
                    <Input
                      value={shopSearch}
                      onChange={(e) => {
                        setShopSearch(e.target.value);
                        setSurveyForm({ ...surveyForm, shopName: e.target.value });
                        setShowShopDropdown(true);
                      }}
                      onFocus={() => setShowShopDropdown(true)}
                      placeholder="Search shop name..."
                    />
                    {showShopDropdown && shopSearch && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {allStores
                          .filter(s => s.storeName.toLowerCase().includes(shopSearch.toLowerCase()))
                          .slice(0, 10)
                          .map((store) => (
                            <button
                              key={store.id}
                              type="button"
                              className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                              onClick={() => {
                                setShopSearch(store.storeName);
                                setSurveyForm({ ...surveyForm, shopName: store.storeName, storeId: store.id });
                                setShowShopDropdown(false);
                              }}
                            >
                              <span className="font-medium">{store.storeName}</span>
                              <span className="text-muted-foreground ml-2">({store.storeId})</span>
                            </button>
                          ))}
                        {allStores.filter(s => s.storeName.toLowerCase().includes(shopSearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">No stores found</div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Add Models */}
              <Card className="shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Select Models</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <Input
                      placeholder="Search models..."
                      value={modelSearch}
                      onChange={(e) => {
                        setModelSearch(e.target.value);
                        setShowModelDropdown(true);
                      }}
                      onFocus={() => setShowModelDropdown(true)}
                    />
                    {showModelDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {Object.keys(modelGroups)
                          .filter(model => model.toLowerCase().includes(modelSearch.toLowerCase()))
                          .map((model) => (
                            <button
                              key={model}
                              type="button"
                              className={`w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between ${
                                surveyForm.responses.some((r) => r.model === model) ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              onClick={() => {
                                if (!surveyForm.responses.some((r) => r.model === model)) {
                                  addModelToSurvey(model);
                                  setModelSearch('');
                                  setShowModelDropdown(false);
                                }
                              }}
                              disabled={surveyForm.responses.some((r) => r.model === model)}
                            >
                              <span className="truncate">{model}</span>
                              {surveyForm.responses.some((r) => r.model === model) && (
                                <Badge variant="secondary" className="ml-2">Added</Badge>
                              )}
                            </button>
                          ))}
                        {Object.keys(modelGroups).filter(model => model.toLowerCase().includes(modelSearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">No models found</div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Selected Models */}
              {surveyForm.responses.map((response, index) => (
                <Card key={index} className="shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{response.model}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeModelFromSurvey(index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Quantity</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const responses = [...surveyForm.responses];
                            responses[index].quantity = Math.max(1, responses[index].quantity - 1);
                            setSurveyForm({ ...surveyForm, responses });
                          }}
                        >
                          -
                        </Button>
                        <span className="w-8 text-center">{response.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const responses = [...surveyForm.responses];
                            responses[index].quantity++;
                            setSurveyForm({ ...surveyForm, responses });
                          }}
                        >
                          +
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm">POSM Items</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => selectAllPosm(index)}
                        >
                          {response.allSelected ? 'Deselect All' : 'Select All'}
                        </Button>
                      </div>
                      <div className="space-y-1">
                        {response.posmSelections.map((posm, pIndex) => (
                          <div
                            key={pIndex}
                            className="flex items-center gap-2 p-2 rounded bg-slate-50 dark:bg-slate-800"
                          >
                            <Checkbox
                              checked={posm.selected}
                              onCheckedChange={() => togglePosmSelection(index, pIndex)}
                            />
                            <span className="text-sm">{posm.posmName}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Camera Section */}
                    <div>
                      <Label className="text-sm mb-2 block">Photos ({response.images.length})</Label>
                      {response.images.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          {response.images.map((img, imgIndex) => (
                            <div key={imgIndex} className="relative">
                              <img
                                src={img}
                                alt={`Photo ${imgIndex + 1}`}
                                className="w-full h-20 object-cover rounded"
                              />
                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute top-1 right-1 h-6 w-6 p-0"
                                onClick={() => removeImage(index, imgIndex)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      <Button
                        variant="outline"
                        className="w-full h-14 border-dashed"
                        onClick={() => triggerCamera(index)}
                      >
                        <Camera className="h-5 w-5 mr-2" />
                        Take Photo
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Submit Button - Sticky at bottom */}
              {surveyForm.responses.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t shadow-lg z-50">
                  <Button
                    className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleCreateSurvey}
                  >
                    <CheckCircle className="h-6 w-6 mr-2" />
                    Submit Survey
                  </Button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  // Main application - Desktop View for Admin
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-800 border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white">
                <Package className="h-5 w-5" />
              </div>
              <span className="font-semibold text-lg hidden sm:block">POSM Survey</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700">
              <div className="h-8 w-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-medium">
                {session.user?.username?.charAt(0) || 'U'}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium">{session.user?.username}</p>
                <p className="text-xs text-muted-foreground">{session.user?.role}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-800 border-r transition-transform duration-200 ease-in-out lg:translate-x-0 pt-16 lg:pt-0`}
        >
          <div className="flex flex-col h-full">
            <nav className="flex-1 p-4 space-y-2">
              {allowedTabs.includes('dashboard') && (
                <Button
                  variant={activeTab === 'dashboard' ? 'secondary' : 'ghost'}
                  className="w-full justify-start gap-3"
                  onClick={() => setActiveTab('dashboard')}
                >
                  <LayoutDashboard className="h-5 w-5" />
                  Dashboard
                </Button>
              )}
              {allowedTabs.includes('stores') && (
                <Button
                  variant={activeTab === 'stores' ? 'secondary' : 'ghost'}
                  className="w-full justify-start gap-3"
                  onClick={() => setActiveTab('stores')}
                >
                  <Store className="h-5 w-5" />
                  Stores
                </Button>
              )}
              {allowedTabs.includes('surveys') && (
                <Button
                  variant={activeTab === 'surveys' ? 'secondary' : 'ghost'}
                  className="w-full justify-start gap-3"
                  onClick={() => setActiveTab('surveys')}
                >
                  <ClipboardList className="h-5 w-5" />
                  Surveys
                </Button>
              )}
              {allowedTabs.includes('displays') && (
                <Button
                  variant={activeTab === 'displays' ? 'secondary' : 'ghost'}
                  className="w-full justify-start gap-3"
                  onClick={() => setActiveTab('displays')}
                >
                  <ImageIcon className="h-5 w-5" />
                  Displays
                </Button>
              )}
              {allowedTabs.includes('users') && session.user?.role === 'admin' && (
                <Button
                  variant={activeTab === 'users' ? 'secondary' : 'ghost'}
                  className="w-full justify-start gap-3"
                  onClick={() => setActiveTab('users')}
                >
                  <Users className="h-5 w-5" />
                  Users
                </Button>
              )}
            </nav>

            <div className="p-4 border-t">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm font-medium">Quick Stats</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {dashboardData?.counts.totalSurveys || 0} surveys collected
                </p>
                <p className="text-xs text-muted-foreground">
                  {dashboardData?.counts.displayRate || 0}% display rate
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-6 lg:ml-0 min-h-[calc(100vh-60px)] overflow-x-hidden">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && dashboardData && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Dashboard</h1>
                  <p className="text-muted-foreground">
                    Welcome back, {session.user?.username}
                  </p>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{dashboardData.counts.activeStores}</p>
                        <p className="text-sm text-muted-foreground">Active Stores</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{dashboardData.counts.activeUsers}</p>
                        <p className="text-sm text-muted-foreground">Active Users</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{dashboardData.counts.totalSurveys}</p>
                        <p className="text-sm text-muted-foreground">Surveys</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{dashboardData.counts.displayRate}%</p>
                        <p className="text-sm text-muted-foreground">Display Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Stores by Region</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={dashboardData.charts.storesByRegion}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Stores by Channel</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={dashboardData.charts.storesByChannel}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {dashboardData.charts.storesByChannel.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Users by Role</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={dashboardData.charts.usersByRole} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={60} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Surveys</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[250px]">
                      <div className="space-y-3">
                        {dashboardData.recent.surveys.map((survey) => (
                          <div
                            key={survey.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
                          >
                            <div>
                              <p className="font-medium">{survey.shopName}</p>
                              <p className="text-sm text-muted-foreground">
                                by {survey.submittedBy} •{' '}
                                {new Date(survey.submittedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant="secondary">
                              {survey.responses?.length || 0} items
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Stores Tab */}
          {activeTab === 'stores' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold">Stores</h1>
                  <p className="text-muted-foreground">Manage retail locations</p>
                </div>
                <div className="flex gap-2">
                  <input
                    ref={storeImportRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleImportStores}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => storeImportRef.current?.click()}
                    disabled={importing}
                  >
                    <Upload className="h-4 w-4" />
                    Import
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleExportStores}
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                  <Dialog open={storeDialogOpen} onOpenChange={setStoreDialogOpen}>
                    <Button className="gap-2" onClick={() => setStoreDialogOpen(true)}>
                      <Plus className="h-4 w-4" />
                      Add Store
                    </Button>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Store</DialogTitle>
                      <DialogDescription>Create a new store location</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Store ID *</Label>
                          <Input
                            value={storeForm.storeId}
                            onChange={(e) =>
                              setStoreForm({ ...storeForm, storeId: e.target.value })
                            }
                            placeholder="STR001"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Store Code</Label>
                          <Input
                            value={storeForm.storeCode}
                            onChange={(e) =>
                              setStoreForm({ ...storeForm, storeCode: e.target.value })
                            }
                            placeholder="HN001"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Store Name *</Label>
                        <Input
                          value={storeForm.storeName}
                          onChange={(e) =>
                            setStoreForm({ ...storeForm, storeName: e.target.value })
                          }
                          placeholder="Store name"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Channel *</Label>
                          <Select
                            value={storeForm.channel}
                            onValueChange={(v) => setStoreForm({ ...storeForm, channel: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="GT">GT</SelectItem>
                              <SelectItem value="MT">MT</SelectItem>
                              <SelectItem value="HORECA">HORECA</SelectItem>
                              <SelectItem value="WHOLESALE">Wholesale</SelectItem>
                              <SelectItem value="OTHER">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>HC</Label>
                          <Input
                            type="number"
                            value={storeForm.hc}
                            onChange={(e) =>
                              setStoreForm({ ...storeForm, hc: parseInt(e.target.value) || 0 })
                            }
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Region *</Label>
                          <Input
                            value={storeForm.region}
                            onChange={(e) =>
                              setStoreForm({ ...storeForm, region: e.target.value })
                            }
                            placeholder="North"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Province *</Label>
                          <Input
                            value={storeForm.province}
                            onChange={(e) =>
                              setStoreForm({ ...storeForm, province: e.target.value })
                            }
                            placeholder="Hanoi"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>TDL</Label>
                          <Input
                            value={storeForm.tdl}
                            onChange={(e) =>
                              setStoreForm({ ...storeForm, tdl: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>TDS</Label>
                          <Input
                            value={storeForm.tds}
                            onChange={(e) =>
                              setStoreForm({ ...storeForm, tds: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>MCP</Label>
                        <Select
                          value={storeForm.mcp}
                          onValueChange={(v) => setStoreForm({ ...storeForm, mcp: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Y">Yes</SelectItem>
                            <SelectItem value="N">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setStoreDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateStore}>Create Store</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search stores..."
                    className="pl-10"
                    value={storeSearch}
                    onChange={(e) => setStoreSearch(e.target.value)}
                  />
                </div>
                <Select value={storeRegion || "all"} onValueChange={(v) => setStoreRegion(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    <SelectItem value="North">North</SelectItem>
                    <SelectItem value="South">South</SelectItem>
                    <SelectItem value="Central">Central</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Stores Table */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Store List</CardTitle>
                  <CardDescription>
                    {storeTotal} stores registered in the system
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Store ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Channel</TableHead>
                          <TableHead>Region</TableHead>
                          <TableHead>Province</TableHead>
                          <TableHead>MCP</TableHead>
                          <TableHead>Surveys</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8">
                              Loading...
                            </TableCell>
                          </TableRow>
                        ) : stores.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8">
                              No stores found
                            </TableCell>
                          </TableRow>
                        ) : (
                          stores.map((store) => (
                            <TableRow key={store.id}>
                              <TableCell className="font-medium">{store.storeId}</TableCell>
                              <TableCell>{store.storeName}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{store.channel}</Badge>
                              </TableCell>
                              <TableCell>{store.region}</TableCell>
                              <TableCell>{store.province}</TableCell>
                              <TableCell>
                                <Badge variant={store.mcp === 'Y' ? 'default' : 'secondary'}>
                                  {store.mcp}
                                </Badge>
                              </TableCell>
                              <TableCell>{store._count?.surveyResponses || 0}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={store.isActive ? 'default' : 'secondary'}
                                  className={
                                    store.isActive
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                                      : ''
                                  }
                                >
                                  {store.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {stores.length} of {storeTotal} stores
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={storePage === 1}
                    onClick={() => setStorePage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={storePage * 10 >= storeTotal}
                    onClick={() => setStorePage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            </div>
          )}

          {/* Surveys Tab */}
          {activeTab === 'surveys' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold">Surveys</h1>
                  <p className="text-muted-foreground">Survey collection and responses</p>
                </div>
                <Dialog open={surveyDialogOpen} onOpenChange={setSurveyDialogOpen}>
                  <Button className="gap-2" onClick={() => setSurveyDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    New Survey
                  </Button>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>New Survey</DialogTitle>
                      <DialogDescription>Collect survey data for a store</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Leader</Label>
                          <Input
                            value={surveyForm.leader}
                            onChange={(e) =>
                              setSurveyForm({ ...surveyForm, leader: e.target.value })
                            }
                            placeholder="Leader name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Shop Name</Label>
                          <Input
                            value={surveyForm.shopName}
                            onChange={(e) =>
                              setSurveyForm({ ...surveyForm, shopName: e.target.value })
                            }
                            placeholder="Shop name"
                          />
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <Label className="mb-2 block">Search Models</Label>
                        <div className="relative">
                          <Input
                            placeholder="Type to search models..."
                            value={modelSearch}
                            onChange={(e) => {
                              setModelSearch(e.target.value);
                              setShowModelDropdown(true);
                            }}
                            onFocus={() => setShowModelDropdown(true)}
                          />
                          {showModelDropdown && (
                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border rounded-md shadow-lg max-h-48 overflow-y-auto">
                              {Object.keys(modelGroups)
                                .filter(model => model.toLowerCase().includes(modelSearch.toLowerCase()))
                                .map((model) => (
                                  <button
                                    key={model}
                                    type="button"
                                    className={`w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between ${
                                      surveyForm.responses.some((r) => r.model === model) ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                    onClick={() => {
                                      if (!surveyForm.responses.some((r) => r.model === model)) {
                                        addModelToSurvey(model);
                                        setModelSearch('');
                                        setShowModelDropdown(false);
                                      }
                                    }}
                                    disabled={surveyForm.responses.some((r) => r.model === model)}
                                  >
                                    <span className="truncate text-sm">{model}</span>
                                    {surveyForm.responses.some((r) => r.model === model) && (
                                      <Badge variant="secondary" className="ml-2 text-xs">Added</Badge>
                                    )}
                                  </button>
                                ))}
                              {Object.keys(modelGroups).filter(model => model.toLowerCase().includes(modelSearch.toLowerCase())).length === 0 && (
                                <div className="px-3 py-2 text-sm text-muted-foreground">No models found</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {surveyForm.responses.length > 0 && (
                        <div className="space-y-4">
                          <Label>Selected Models</Label>
                          {surveyForm.responses.map((response, index) => (
                            <Card key={index}>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{response.model}</span>
                                    <Badge variant="outline">Qty: {response.quantity}</Badge>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeModelFromSurvey(index)}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm text-muted-foreground">POSM Items</span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => selectAllPosm(index)}
                                  >
                                    {response.allSelected ? 'Deselect All' : 'Select All'}
                                  </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {response.posmSelections.map((posm, pIndex) => (
                                    <div
                                      key={pIndex}
                                      className="flex items-center gap-2 p-2 rounded border"
                                    >
                                      <Checkbox
                                        checked={posm.selected}
                                        onCheckedChange={() => togglePosmSelection(index, pIndex)}
                                      />
                                      <span className="text-sm">{posm.posmName}</span>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSurveyDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateSurvey}>Submit Survey</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Surveys Table */}
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Shop Name</TableHead>
                          <TableHead>Leader</TableHead>
                          <TableHead>Submitted By</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8">
                              Loading...
                            </TableCell>
                          </TableRow>
                        ) : surveys.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8">
                              No surveys found
                            </TableCell>
                          </TableRow>
                        ) : (
                          surveys.map((survey) => (
                            <TableRow key={survey.id}>
                              <TableCell className="font-medium">{survey.shopName}</TableCell>
                              <TableCell>{survey.leader}</TableCell>
                              <TableCell>{survey.submittedBy}</TableCell>
                              <TableCell>
                                <Badge className={ROLE_COLORS[survey.submittedByRole]}>
                                  {survey.submittedByRole}
                                </Badge>
                              </TableCell>
                              <TableCell>{survey.responses?.length || 0}</TableCell>
                              <TableCell>
                                {new Date(survey.submittedAt).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {surveys.length} of {surveyTotal} surveys
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={surveyPage === 1}
                    onClick={() => setSurveyPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={surveyPage * 10 >= surveyTotal}
                    onClick={() => setSurveyPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Displays Tab */}
          {activeTab === 'displays' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold">Displays</h1>
                  <p className="text-muted-foreground">Track POSM display status</p>
                </div>
              </div>

              {/* Displays Table */}
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Store</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead>Region</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displays.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8">
                              No displays found
                            </TableCell>
                          </TableRow>
                        ) : (
                          displays.map((display) => (
                            <TableRow key={display.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{display.store?.storeName}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {display.storeId}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>{display.model}</TableCell>
                              <TableCell>{display.store?.region}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={display.isDisplayed ? 'default' : 'secondary'}
                                  className={
                                    display.isDisplayed
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                                      : ''
                                  }
                                >
                                  {display.isDisplayed ? 'Displayed' : 'Not Displayed'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {new Date(display.createdAt).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && session.user?.role === 'admin' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold">Users</h1>
                  <p className="text-muted-foreground">Manage user accounts</p>
                </div>
                <div className="flex gap-2">
                  <input
                    ref={userImportRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleImportUsers}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => userImportRef.current?.click()}
                    disabled={importing}
                  >
                    <Upload className="h-4 w-4" />
                    Import
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleExportUsers}
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                  <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
                    <Button className="gap-2" onClick={() => setUserDialogOpen(true)}>
                      <Plus className="h-4 w-4" />
                      Add User
                    </Button>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                        <DialogDescription>Create a new user account</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>User ID *</Label>
                            <Input
                              value={userForm.userid}
                              onChange={(e) =>
                                setUserForm({ ...userForm, userid: e.target.value })
                              }
                              placeholder="USR001"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Login ID *</Label>
                            <Input
                              value={userForm.loginid}
                              onChange={(e) =>
                                setUserForm({ ...userForm, loginid: e.target.value })
                              }
                              placeholder="login_id"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Username *</Label>
                          <Input
                            value={userForm.username}
                            onChange={(e) =>
                              setUserForm({ ...userForm, username: e.target.value })
                          }
                          placeholder="Full Name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Password *</Label>
                        <Input
                          type="password"
                          value={userForm.password}
                          onChange={(e) =>
                            setUserForm({ ...userForm, password: e.target.value })
                          }
                          placeholder="Password"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Role *</Label>
                          <Select
                            value={userForm.role}
                            onValueChange={(v) => setUserForm({ ...userForm, role: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="TDL">TDL</SelectItem>
                              <SelectItem value="TDS">TDS</SelectItem>
                              <SelectItem value="PRT">PRT</SelectItem>
                              <SelectItem value="user">User</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Leader</Label>
                          <Select
                            value={userForm.leader || "none"}
                            onValueChange={(v) => setUserForm({ ...userForm, leader: v === "none" ? "" : v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select leader" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Leader</SelectItem>
                              {leaderUsers.map((leader) => (
                                <SelectItem key={leader.id} value={leader.username}>
                                  {leader.username} ({leader.role})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setUserDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateUser}>Create User</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    className="pl-10"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                </div>
                <Select value={userRole || "all"} onValueChange={(v) => setUserRole(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="TDL">TDL</SelectItem>
                    <SelectItem value="TDS">TDS</SelectItem>
                    <SelectItem value="PRT">PRT</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Users Table */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">User List</CardTitle>
                  <CardDescription>
                    {userTotal} users registered in the system
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User ID</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>Login ID</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Leader</TableHead>
                          <TableHead>Stores</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8">
                              Loading...
                            </TableCell>
                          </TableRow>
                        ) : users.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8">
                              No users found
                            </TableCell>
                          </TableRow>
                        ) : (
                          users.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell className="font-medium">{user.userid}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="h-8 w-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm">
                                    {user.username.charAt(0)}
                                  </div>
                                  <div>
                                    <p>{user.username}</p>
                                    {user.isSuperAdmin && (
                                      <Badge variant="secondary" className="text-xs">
                                        Super Admin
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{user.loginid}</TableCell>
                              <TableCell>
                                <Badge className={ROLE_COLORS[user.role]}>{user.role}</Badge>
                              </TableCell>
                              <TableCell>{user.leader || '-'}</TableCell>
                              <TableCell>{user._count?.assignedStores || 0}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={user.isActive ? 'default' : 'secondary'}
                                  className={
                                    user.isActive
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                                      : ''
                                  }
                                >
                                  {user.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditUserDialog(user)}
                                  disabled={user.isSuperAdmin && !session.user?.isSuperAdmin}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Edit User Dialog */}
              <Dialog open={editUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit User</DialogTitle>
                    <DialogDescription>Update user information</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input
                        value={editForm.username}
                        onChange={(e) =>
                          setEditForm({ ...editForm, username: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select
                        value={editForm.role}
                        onValueChange={(v) => setEditForm({ ...editForm, role: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="TDL">TDL</SelectItem>
                          <SelectItem value="TDS">TDS</SelectItem>
                          <SelectItem value="PRT">PRT</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Leader</Label>
                      <Select
                        value={editForm.leader || "none"}
                        onValueChange={(v) => setEditForm({ ...editForm, leader: v === "none" ? "" : v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select leader" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Leader</SelectItem>
                          {leaderUsers.map((leader) => (
                            <SelectItem key={leader.id} value={leader.username}>
                              {leader.username} ({leader.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={editForm.isActive}
                        onCheckedChange={(checked) =>
                          setEditForm({ ...editForm, isActive: checked as boolean })
                        }
                      />
                      <Label>Active</Label>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Reset Password
                      </Label>
                      <Input
                        type="password"
                        value={editForm.newPassword}
                        onChange={(e) =>
                          setEditForm({ ...editForm, newPassword: e.target.value })
                        }
                        placeholder="Leave empty to keep current password"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditUserDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleEditUser}>Save Changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {users.length} of {userTotal} users
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={userPage === 1}
                    onClick={() => setUserPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={userPage * 10 >= userTotal}
                    onClick={() => setUserPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
