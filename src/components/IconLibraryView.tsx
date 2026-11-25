import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Award,
  Bell,
  Bookmark,
  Box,
  Briefcase,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Clipboard,
  Clock,
  Cloud,
  Code,
  Columns2,
  Command,
  Compass,
  Copy,
  CreditCard,
  Crop,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  File,
  FileText,
  Filter,
  Flag,
  Flame,
  Folder,
  FolderOpen,
  Globe,
  Grid3X3,
  Heart,
  HelpCircle,
  Home,
  Image,
  Inbox,
  Info,
  Key,
  Laptop,
  Layers,
  LayoutGrid,
  Link2,
  List,
  Lock,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Maximize2,
  Menu,
  MessageCircle,
  MessageSquare,
  Mic,
  Minimize2,
  Minus,
  Monitor,
  Moon,
  MoreHorizontal,
  Music,
  Package,
  Palette,
  Paperclip,
  Pause,
  PenTool,
  Phone,
  Pin,
  Play,
  Plus,
  Printer,
  RefreshCw,
  Repeat,
  RotateCcw,
  Save,
  Scissors,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sliders,
  Smartphone,
  Sparkles,
  Square,
  Star,
  Sun,
  Tag,
  Terminal,
  ThumbsUp,
  Trash2,
  TrendingUp,
  Type,
  Unlock,
  Upload,
  User,
  Users,
  Video,
  Volume2,
  Wifi,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';

interface IconEntry {
  name: string;
  category: string;
  tags: string[];
  Icon: LucideIcon;
}

export const ICON_CATALOG: IconEntry[] = [
  // Interface
  { name: 'Search', category: 'Interface', tags: ['find', 'lookup'], Icon: Search },
  { name: 'Home', category: 'Interface', tags: ['house', 'start'], Icon: Home },
  { name: 'Settings', category: 'Interface', tags: ['gear', 'preferences'], Icon: Settings },
  { name: 'Menu', category: 'Interface', tags: ['hamburger', 'nav'], Icon: Menu },
  { name: 'MoreHorizontal', category: 'Interface', tags: ['dots', 'options'], Icon: MoreHorizontal },
  { name: 'Plus', category: 'Interface', tags: ['add', 'new'], Icon: Plus },
  { name: 'Minus', category: 'Interface', tags: ['remove', 'subtract'], Icon: Minus },
  { name: 'X', category: 'Interface', tags: ['close', 'cancel'], Icon: X },
  { name: 'Check', category: 'Interface', tags: ['done', 'ok'], Icon: Check },
  { name: 'Filter', category: 'Interface', tags: ['funnel', 'sort'], Icon: Filter },
  { name: 'Sliders', category: 'Interface', tags: ['controls', 'adjust'], Icon: Sliders },
  { name: 'Eye', category: 'Interface', tags: ['view', 'show'], Icon: Eye },
  { name: 'EyeOff', category: 'Interface', tags: ['hide', 'private'], Icon: EyeOff },
  { name: 'Bell', category: 'Interface', tags: ['alert', 'notification'], Icon: Bell },
  { name: 'Bookmark', category: 'Interface', tags: ['save', 'favorite'], Icon: Bookmark },
  { name: 'Star', category: 'Interface', tags: ['favorite', 'rating'], Icon: Star },
  { name: 'Heart', category: 'Interface', tags: ['like', 'love'], Icon: Heart },
  { name: 'Pin', category: 'Interface', tags: ['stick', 'attach'], Icon: Pin },
  { name: 'Flag', category: 'Interface', tags: ['report', 'mark'], Icon: Flag },
  { name: 'Command', category: 'Interface', tags: ['shortcut', 'mac'], Icon: Command },
  { name: 'RefreshCw', category: 'Interface', tags: ['reload', 'sync'], Icon: RefreshCw },
  { name: 'RotateCcw', category: 'Interface', tags: ['undo', 'reset'], Icon: RotateCcw },
  { name: 'Maximize2', category: 'Interface', tags: ['expand', 'fullscreen'], Icon: Maximize2 },
  { name: 'Minimize2', category: 'Interface', tags: ['collapse', 'shrink'], Icon: Minimize2 },
  { name: 'ZoomIn', category: 'Interface', tags: ['magnify', 'scale'], Icon: ZoomIn },
  { name: 'ZoomOut', category: 'Interface', tags: ['shrink', 'scale'], Icon: ZoomOut },
  // Arrows
  { name: 'ArrowUp', category: 'Arrows', tags: ['north', 'top'], Icon: ArrowUp },
  { name: 'ArrowDown', category: 'Arrows', tags: ['south', 'bottom'], Icon: ArrowDown },
  { name: 'ArrowLeft', category: 'Arrows', tags: ['back', 'prev'], Icon: ArrowLeft },
  { name: 'ArrowRight', category: 'Arrows', tags: ['next', 'forward'], Icon: ArrowRight },
  { name: 'ArrowUpRight', category: 'Arrows', tags: ['external', 'link'], Icon: ArrowUpRight },
  { name: 'ChevronUp', category: 'Arrows', tags: ['collapse'], Icon: ChevronUp },
  { name: 'ChevronDown', category: 'Arrows', tags: ['expand', 'dropdown'], Icon: ChevronDown },
  { name: 'ChevronLeft', category: 'Arrows', tags: ['prev'], Icon: ChevronLeft },
  { name: 'ChevronRight', category: 'Arrows', tags: ['next'], Icon: ChevronRight },
  { name: 'ExternalLink', category: 'Arrows', tags: ['open', 'url'], Icon: ExternalLink },
  { name: 'Repeat', category: 'Arrows', tags: ['loop', 'cycle'], Icon: Repeat },
  // Design
  { name: 'Type', category: 'Design', tags: ['font', 'text', 'typography'], Icon: Type },
  { name: 'Palette', category: 'Design', tags: ['color', 'theme'], Icon: Palette },
  { name: 'PenTool', category: 'Design', tags: ['vector', 'bezier', 'figma'], Icon: PenTool },
  { name: 'Layers', category: 'Design', tags: ['stack', 'depth'], Icon: Layers },
  { name: 'LayoutGrid', category: 'Design', tags: ['grid', 'cards'], Icon: LayoutGrid },
  { name: 'Grid3X3', category: 'Design', tags: ['matrix', 'glyphs'], Icon: Grid3X3 },
  { name: 'Columns2', category: 'Design', tags: ['split', 'compare'], Icon: Columns2 },
  { name: 'List', category: 'Design', tags: ['rows', 'items'], Icon: List },
  { name: 'Crop', category: 'Design', tags: ['trim', 'frame'], Icon: Crop },
  { name: 'Scissors', category: 'Design', tags: ['cut', 'trim'], Icon: Scissors },
  { name: 'Edit3', category: 'Design', tags: ['write', 'pencil'], Icon: Edit3 },
  { name: 'Sparkles', category: 'Design', tags: ['ai', 'magic'], Icon: Sparkles },
  { name: 'AlignLeft', category: 'Design', tags: ['text'], Icon: AlignLeft },
  { name: 'AlignCenter', category: 'Design', tags: ['text'], Icon: AlignCenter },
  { name: 'AlignRight', category: 'Design', tags: ['text'], Icon: AlignRight },
  { name: 'Circle', category: 'Design', tags: ['shape', 'dot'], Icon: Circle },
  { name: 'Square', category: 'Design', tags: ['shape', 'box'], Icon: Square },
  { name: 'Sun', category: 'Design', tags: ['light', 'mode'], Icon: Sun },
  { name: 'Moon', category: 'Design', tags: ['dark', 'mode'], Icon: Moon },
  // Files
  { name: 'Folder', category: 'Files', tags: ['directory', 'group'], Icon: Folder },
  { name: 'FolderOpen', category: 'Files', tags: ['directory', 'browse'], Icon: FolderOpen },
  { name: 'File', category: 'Files', tags: ['document', 'page'], Icon: File },
  { name: 'FileText', category: 'Files', tags: ['doc', 'notes'], Icon: FileText },
  { name: 'Download', category: 'Files', tags: ['export', 'save'], Icon: Download },
  { name: 'Upload', category: 'Files', tags: ['import', 'cloud'], Icon: Upload },
  { name: 'Save', category: 'Files', tags: ['disk', 'store'], Icon: Save },
  { name: 'Copy', category: 'Files', tags: ['duplicate', 'clone'], Icon: Copy },
  { name: 'Clipboard', category: 'Files', tags: ['paste', 'notes'], Icon: Clipboard },
  { name: 'Paperclip', category: 'Files', tags: ['attach', 'file'], Icon: Paperclip },
  { name: 'Archive', category: 'Files', tags: ['zip', 'box'], Icon: Archive },
  { name: 'Trash2', category: 'Files', tags: ['delete', 'remove'], Icon: Trash2 },
  { name: 'Cloud', category: 'Files', tags: ['drive', 'sync'], Icon: Cloud },
  { name: 'Link2', category: 'Files', tags: ['url', 'share'], Icon: Link2 },
  // Media
  { name: 'Image', category: 'Media', tags: ['photo', 'picture'], Icon: Image },
  { name: 'Camera', category: 'Media', tags: ['photo', 'capture'], Icon: Camera },
  { name: 'Video', category: 'Media', tags: ['movie', 'record'], Icon: Video },
  { name: 'Music', category: 'Media', tags: ['audio', 'song'], Icon: Music },
  { name: 'Mic', category: 'Media', tags: ['voice', 'audio'], Icon: Mic },
  { name: 'Volume2', category: 'Media', tags: ['sound', 'speaker'], Icon: Volume2 },
  { name: 'Play', category: 'Media', tags: ['start', 'video'], Icon: Play },
  { name: 'Pause', category: 'Media', tags: ['stop', 'wait'], Icon: Pause },
  // Communication & People
  { name: 'Mail', category: 'Communication', tags: ['email', 'inbox'], Icon: Mail },
  { name: 'Inbox', category: 'Communication', tags: ['messages'], Icon: Inbox },
  { name: 'Send', category: 'Communication', tags: ['share', 'submit'], Icon: Send },
  { name: 'Share2', category: 'Communication', tags: ['network', 'export'], Icon: Share2 },
  { name: 'MessageSquare', category: 'Communication', tags: ['chat', 'comment'], Icon: MessageSquare },
  { name: 'MessageCircle', category: 'Communication', tags: ['chat', 'bubble'], Icon: MessageCircle },
  { name: 'Phone', category: 'Communication', tags: ['call', 'contact'], Icon: Phone },
  { name: 'User', category: 'Communication', tags: ['account', 'profile'], Icon: User },
  { name: 'Users', category: 'Communication', tags: ['team', 'group'], Icon: Users },
  { name: 'Globe', category: 'Communication', tags: ['web', 'world'], Icon: Globe },
  { name: 'MapPin', category: 'Communication', tags: ['location', 'place'], Icon: MapPin },
  { name: 'Compass', category: 'Communication', tags: ['explore', 'discover'], Icon: Compass },
  // Commerce & Work
  { name: 'ShoppingBag', category: 'Commerce', tags: ['store', 'buy'], Icon: ShoppingBag },
  { name: 'ShoppingCart', category: 'Commerce', tags: ['checkout', 'store'], Icon: ShoppingCart },
  { name: 'CreditCard', category: 'Commerce', tags: ['payment', 'billing'], Icon: CreditCard },
  { name: 'Tag', category: 'Commerce', tags: ['label', 'price'], Icon: Tag },
  { name: 'Package', category: 'Commerce', tags: ['box', 'delivery'], Icon: Package },
  { name: 'Box', category: 'Commerce', tags: ['cube', '3d'], Icon: Box },
  { name: 'Briefcase', category: 'Commerce', tags: ['work', 'business'], Icon: Briefcase },
  { name: 'TrendingUp', category: 'Commerce', tags: ['chart', 'growth'], Icon: TrendingUp },
  { name: 'Award', category: 'Commerce', tags: ['badge', 'prize'], Icon: Award },
  { name: 'Calendar', category: 'Commerce', tags: ['date', 'schedule'], Icon: Calendar },
  { name: 'Clock', category: 'Commerce', tags: ['time', 'history'], Icon: Clock },
  // Devices & Dev
  { name: 'Laptop', category: 'Devices', tags: ['mac', 'computer'], Icon: Laptop },
  { name: 'Monitor', category: 'Devices', tags: ['desktop', 'screen'], Icon: Monitor },
  { name: 'Smartphone', category: 'Devices', tags: ['mobile', 'phone'], Icon: Smartphone },
  { name: 'Printer', category: 'Devices', tags: ['print', 'paper'], Icon: Printer },
  { name: 'Wifi', category: 'Devices', tags: ['network', 'online'], Icon: Wifi },
  { name: 'Code', category: 'Devices', tags: ['dev', 'html'], Icon: Code },
  { name: 'Terminal', category: 'Devices', tags: ['cli', 'shell'], Icon: Terminal },
  // Status & Security
  { name: 'CheckCircle2', category: 'Status', tags: ['success', 'active'], Icon: CheckCircle2 },
  { name: 'AlertCircle', category: 'Status', tags: ['error', 'warning'], Icon: AlertCircle },
  { name: 'AlertTriangle', category: 'Status', tags: ['caution', 'warn'], Icon: AlertTriangle },
  { name: 'Info', category: 'Status', tags: ['details', 'about'], Icon: Info },
  { name: 'HelpCircle', category: 'Status', tags: ['question', 'support'], Icon: HelpCircle },
  { name: 'Lock', category: 'Status', tags: ['secure', 'private'], Icon: Lock },
  { name: 'Unlock', category: 'Status', tags: ['open', 'access'], Icon: Unlock },
  { name: 'Key', category: 'Status', tags: ['password', 'auth'], Icon: Key },
  { name: 'Shield', category: 'Status', tags: ['security', 'protect'], Icon: Shield },
  { name: 'ShieldCheck', category: 'Status', tags: ['verified', 'safe'], Icon: ShieldCheck },
  { name: 'LogIn', category: 'Status', tags: ['signin', 'enter'], Icon: LogIn },
  { name: 'LogOut', category: 'Status', tags: ['signout', 'exit'], Icon: LogOut },
  { name: 'Zap', category: 'Status', tags: ['fast', 'lightning'], Icon: Zap },
  { name: 'Flame', category: 'Status', tags: ['hot', 'trending'], Icon: Flame },
  { name: 'ThumbsUp', category: 'Status', tags: ['approve', 'like'], Icon: ThumbsUp },
];

const CATEGORIES = [
  'All',
  'Interface',
  'Design',
  'Arrows',
  'Files',
  'Media',
  'Communication',
  'Commerce',
  'Devices',
  'Status',
];

interface ExtraSvgIconEntry {
  id: string;
  name: string;
  pack: 'Material' | 'Heroicons';
  category: string;
  tags: string[];
  mode: 'fill' | 'stroke';
  paths: string[];
}

export const EXTRA_ICON_PACKS: ExtraSvgIconEntry[] = [
  // Material Symbols (Apache 2.0) — Crisp 24x24 Filled Geometry
  { id: 'mat-home', name: 'Home', pack: 'Material', category: 'Interface', tags: ['house', 'main', 'material'], mode: 'fill', paths: ['M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'] },
  { id: 'mat-search', name: 'Search', pack: 'Material', category: 'Interface', tags: ['find', 'lookup', 'material'], mode: 'fill', paths: ['M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z'] },
  { id: 'mat-bolt', name: 'Bolt', pack: 'Material', category: 'Status', tags: ['fast', 'flash', 'power'], mode: 'fill', paths: ['M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z'] },
  { id: 'mat-star', name: 'Star', pack: 'Material', category: 'Interface', tags: ['favorite', 'rating'], mode: 'fill', paths: ['M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'] },
  { id: 'mat-favorite', name: 'Favorite', pack: 'Material', category: 'Interface', tags: ['heart', 'like'], mode: 'fill', paths: ['M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'] },
  { id: 'mat-check-circle', name: 'CheckCircle', pack: 'Material', category: 'Status', tags: ['done', 'ok', 'verified'], mode: 'fill', paths: ['M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'] },
  { id: 'mat-add-circle', name: 'AddCircle', pack: 'Material', category: 'Interface', tags: ['plus', 'new'], mode: 'fill', paths: ['M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z'] },
  { id: 'mat-arrow-forward', name: 'ArrowForward', pack: 'Material', category: 'Arrows', tags: ['right', 'next'], mode: 'fill', paths: ['M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z'] },
  { id: 'mat-arrow-back', name: 'ArrowBack', pack: 'Material', category: 'Arrows', tags: ['left', 'prev'], mode: 'fill', paths: ['M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z'] },
  { id: 'mat-cloud-done', name: 'CloudDone', pack: 'Material', category: 'Files', tags: ['sync', 'drive'], mode: 'fill', paths: ['M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM10 17l-3.5-3.5 1.41-1.41L10 14.17 15.18 9l1.41 1.41L10 17z'] },
  { id: 'mat-folder', name: 'Folder', pack: 'Material', category: 'Files', tags: ['directory', 'files'], mode: 'fill', paths: ['M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z'] },
  { id: 'mat-download', name: 'Download', pack: 'Material', category: 'Files', tags: ['save', 'export'], mode: 'fill', paths: ['M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z'] },
  { id: 'mat-upload', name: 'Upload', pack: 'Material', category: 'Files', tags: ['import', 'send'], mode: 'fill', paths: ['M5 20h14v-2H5v2zm0-10h4v6h6v-6h4l-7-7-7 7z'] },
  { id: 'mat-palette', name: 'Palette', pack: 'Material', category: 'Design', tags: ['color', 'theme'], mode: 'fill', paths: ['M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z'] },
  { id: 'mat-layers', name: 'Layers', pack: 'Material', category: 'Design', tags: ['stack', 'figma'], mode: 'fill', paths: ['M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z'] },
  { id: 'mat-text-fields', name: 'TextFields', pack: 'Material', category: 'Design', tags: ['font', 'type', 'typography'], mode: 'fill', paths: ['M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z'] },
  { id: 'mat-auto-awesome', name: 'AutoAwesome', pack: 'Material', category: 'Design', tags: ['ai', 'sparkles', 'magic'], mode: 'fill', paths: ['M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z'] },
  { id: 'mat-play', name: 'PlayArrow', pack: 'Material', category: 'Media', tags: ['video', 'start'], mode: 'fill', paths: ['M8 5v14l11-7z'] },
  { id: 'mat-notifications', name: 'Notifications', pack: 'Material', category: 'Communication', tags: ['bell', 'alert'], mode: 'fill', paths: ['M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z'] },
  { id: 'mat-mail', name: 'Mail', pack: 'Material', category: 'Communication', tags: ['email', 'inbox'], mode: 'fill', paths: ['M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z'] },

  // Heroicons (MIT) — Crisp 24x24 Outline Geometry
  { id: 'hero-home', name: 'Home', pack: 'Heroicons', category: 'Interface', tags: ['house', 'heroicons'], mode: 'stroke', paths: ['M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25'] },
  { id: 'hero-search', name: 'MagnifyingGlass', pack: 'Heroicons', category: 'Interface', tags: ['search', 'find'], mode: 'stroke', paths: ['M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z'] },
  { id: 'hero-sparkles', name: 'Sparkles', pack: 'Heroicons', category: 'Design', tags: ['ai', 'magic'], mode: 'stroke', paths: ['M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456z'] },
  { id: 'hero-swatch', name: 'Swatch', pack: 'Heroicons', category: 'Design', tags: ['color', 'palette'], mode: 'stroke', paths: ['M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z'] },
  { id: 'hero-squares', name: 'Squares2x2', pack: 'Heroicons', category: 'Interface', tags: ['grid', 'layout'], mode: 'stroke', paths: ['M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25zM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25z'] },
  { id: 'hero-arrow-up-right', name: 'ArrowUpRight', pack: 'Heroicons', category: 'Arrows', tags: ['external', 'link'], mode: 'stroke', paths: ['M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25'] },
  { id: 'hero-arrow-right', name: 'ArrowRight', pack: 'Heroicons', category: 'Arrows', tags: ['next', 'forward'], mode: 'stroke', paths: ['M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3'] },
  { id: 'hero-arrow-left', name: 'ArrowLeft', pack: 'Heroicons', category: 'Arrows', tags: ['prev', 'back'], mode: 'stroke', paths: ['M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18'] },
  { id: 'hero-cloud-arrow-down', name: 'CloudArrowDown', pack: 'Heroicons', category: 'Files', tags: ['download', 'sync'], mode: 'stroke', paths: ['M12 9.75v6.75m0 0l-3-3m3 3l3-3m-8.25 6a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75z'] },
  { id: 'hero-folder', name: 'Folder', pack: 'Heroicons', category: 'Files', tags: ['directory', 'files'], mode: 'stroke', paths: ['M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44z'] },
  { id: 'hero-bolt', name: 'Bolt', pack: 'Heroicons', category: 'Status', tags: ['fast', 'lightning'], mode: 'stroke', paths: ['M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z'] },
  { id: 'hero-check-badge', name: 'CheckBadge', pack: 'Heroicons', category: 'Status', tags: ['verified', 'approved'], mode: 'stroke', paths: ['M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12z'] },
  { id: 'hero-bell', name: 'Bell', pack: 'Heroicons', category: 'Communication', tags: ['notification', 'alert'], mode: 'stroke', paths: ['M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75v-.7V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0'] },
  { id: 'hero-chat', name: 'ChatBubble', pack: 'Heroicons', category: 'Communication', tags: ['message', 'comment'], mode: 'stroke', paths: ['M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z'] },
  { id: 'hero-code', name: 'CodeBracket', pack: 'Heroicons', category: 'Dev', tags: ['code', 'html', 'dev'], mode: 'stroke', paths: ['M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5'] },
  { id: 'hero-terminal', name: 'CommandLine', pack: 'Heroicons', category: 'Dev', tags: ['cli', 'shell'], mode: 'stroke', paths: ['M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25z'] },
  { id: 'hero-heart', name: 'Heart', pack: 'Heroicons', category: 'Interface', tags: ['like', 'love'], mode: 'stroke', paths: ['M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z'] },
  { id: 'hero-star', name: 'Star', pack: 'Heroicons', category: 'Interface', tags: ['favorite', 'rating'], mode: 'stroke', paths: ['M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.563.563 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.563.563 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5z'] },
  { id: 'hero-paper-airplane', name: 'PaperAirplane', pack: 'Heroicons', category: 'Communication', tags: ['send', 'share'], mode: 'stroke', paths: ['M6 12L3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12zm0 0h7.5'] },
  { id: 'hero-rocket', name: 'RocketLaunch', pack: 'Heroicons', category: 'Status', tags: ['ship', 'deploy', 'launch'], mode: 'stroke', paths: ['M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z'] },
];

export const TOTAL_ICON_COUNT = ICON_CATALOG.length + EXTRA_ICON_PACKS.length;

type IconPackFilter = 'All' | 'Lucide' | 'Material' | 'Heroicons';

interface IconLibraryViewProps {
  onNotify: (msg: string) => void;
}

export const IconLibraryView: React.FC<IconLibraryViewProps> = ({ onNotify }) => {
  const [query, setQuery] = useState('');
  const [pack, setPack] = useState<IconPackFilter>('All');
  const [category, setCategory] = useState('All');
  const [iconSize, setIconSize] = useState(24);
  const [strokeWidth, setStrokeWidth] = useState(1.75);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const svgRefs = useRef<Record<string, SVGSVGElement | null>>({});

  const allItems = useMemo(() => {
    const lucideItems = ICON_CATALOG.map((item) => ({
      id: `lucide-${item.name}`,
      name: item.name,
      pack: 'Lucide' as const,
      category: item.category,
      tags: item.tags,
      Icon: item.Icon,
      extra: null as ExtraSvgIconEntry | null,
    }));
    const extraItems = EXTRA_ICON_PACKS.map((item) => ({
      id: item.id,
      name: item.name,
      pack: item.pack,
      category: item.category,
      tags: item.tags,
      Icon: null as LucideIcon | null,
      extra: item,
    }));
    return [...lucideItems, ...extraItems];
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allItems.filter((item) => {
      if (pack !== 'All' && item.pack !== pack) return false;
      if (category !== 'All' && item.category !== category) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.pack.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.tags.some((t) => t.includes(q))
      );
    });
  }, [allItems, pack, query, category]);

  const buildCleanSvgMarkup = (id: string): string | null => {
    const el = svgRefs.current[id];
    if (!el) return null;
    const clone = el.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(iconSize));
    clone.setAttribute('height', String(iconSize));
    clone.removeAttribute('class');
    return clone.outerHTML;
  };

  const handleCopySvg = async (id: string, name: string, itemPack: string) => {
    const svg = buildCleanSvgMarkup(id);
    if (!svg) return;
    try {
      await navigator.clipboard.writeText(svg);
      setCopiedId(id);
      onNotify(`Copied ${name} (${itemPack}) SVG — paste directly into Figma, Photoshop, or code`);
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1400);
    } catch {
      onNotify('Unable to copy SVG to clipboard');
    }
  };

  const handleCopyJsx = async (id: string, name: string, itemPack: string) => {
    const snippet =
      itemPack === 'Lucide'
        ? `<${name} size={${iconSize}} strokeWidth={${strokeWidth}} />`
        : buildCleanSvgMarkup(id) ?? `<${name} />`;
    try {
      await navigator.clipboard.writeText(snippet);
      onNotify(`Copied ${name} (${itemPack}) snippet`);
    } catch {
      onNotify('Unable to copy snippet');
    }
  };

  const handleDownloadSvg = (id: string, name: string) => {
    const svg = buildCleanSvgMarkup(id);
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.toLowerCase()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify(`Downloaded ${name.toLowerCase()}.svg`);
  };

  return (
    <div className="p-5 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--color-border)]">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            Vector Icon Library ({filtered.length} icons)
          </h2>
          <p className="text-[12px] text-[var(--color-text-secondary)]">
            Lucide, Material Symbols, and Heroicons — click any icon to copy clean SVG into Figma or code.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11.5px]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons…"
              aria-label="Search icons"
              className="h-8 w-52 pl-8 pr-3 rounded-lg bg-[#F1F1F1] dark:bg-[#262626] border border-[var(--color-border)] text-[12px] text-[var(--color-text-primary)] outline-none focus:border-[#1b1b1b] dark:focus:border-[#f1f1f1]"
            />
          </div>

          <label className="flex items-center gap-2 text-[var(--color-text-secondary)]">
            <span className="font-code tabular-nums w-12">{iconSize}px</span>
            <input
              type="range"
              min={16}
              max={48}
              step={2}
              value={iconSize}
              onChange={(e) => setIconSize(Number(e.target.value))}
              className="mac-slider w-20"
            />
          </label>

          <label className="flex items-center gap-2 text-[var(--color-text-secondary)]">
            <span className="font-code tabular-nums w-12">{strokeWidth.toFixed(2)}</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.25}
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="mac-slider w-20"
            />
          </label>
        </div>
      </div>

      {/* Pack Switcher + Category Filter Pills */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#F1F1F1] dark:bg-[#262626] border border-[var(--color-border)]">
          {(['All', 'Lucide', 'Material', 'Heroicons'] as IconPackFilter[]).map((p) => {
            const active = pack === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPack(p)}
                className={`h-6 px-2.5 rounded-md text-[11.5px] font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1b1b1b] text-white dark:bg-[#f1f1f1] dark:text-[#111111]'
                    : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                {p === 'All' ? 'All Packs' : p}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`h-7 px-2.5 rounded-lg text-[11.5px] font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1b1b1b] text-white dark:bg-[#f1f1f1] dark:text-[#111111]'
                    : 'bg-[#F1F1F1] dark:bg-[#262626] text-neutral-600 dark:text-neutral-300 hover:bg-black/10 dark:hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Icon Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-2.5">
        {filtered.map(({ id, name, pack: itemPack, Icon, extra }) => {
          const isCopied = copiedId === id;
          return (
            <div
              key={id}
              className="group relative flex flex-col items-center justify-between p-3 rounded-xl border border-[var(--color-border)] bg-white dark:bg-[#262626] hover:border-[#1b1b1b] dark:hover:border-[#f1f1f1] transition-colors"
            >
              <button
                type="button"
                onClick={() => void handleCopySvg(id, name, itemPack)}
                title={`Copy ${name} (${itemPack}) SVG`}
                className="w-full flex flex-col items-center gap-2 py-2 cursor-pointer"
              >
                {Icon ? (
                  <Icon
                    ref={(el) => {
                      svgRefs.current[id] = el;
                    }}
                    size={iconSize}
                    strokeWidth={strokeWidth}
                    className="text-[var(--color-text-primary)]"
                  />
                ) : extra ? (
                  <svg
                    ref={(el) => {
                      svgRefs.current[id] = el;
                    }}
                    viewBox="0 0 24 24"
                    width={iconSize}
                    height={iconSize}
                    fill={extra.mode === 'fill' ? 'currentColor' : 'none'}
                    stroke={extra.mode === 'stroke' ? 'currentColor' : 'none'}
                    strokeWidth={extra.mode === 'stroke' ? strokeWidth : undefined}
                    strokeLinecap={extra.mode === 'stroke' ? 'round' : undefined}
                    strokeLinejoin={extra.mode === 'stroke' ? 'round' : undefined}
                    className="text-[var(--color-text-primary)]"
                  >
                    {extra.paths.map((d, idx) => (
                      <path key={idx} d={d} />
                    ))}
                  </svg>
                ) : null}
                <span className="text-[10.5px] font-code text-[var(--color-text-secondary)] truncate max-w-full">
                  {isCopied ? 'Copied SVG!' : name}
                </span>
              </button>

              <span className="text-[9px] font-code uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                {itemPack}
              </span>

              <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 absolute top-1.5 right-1.5 flex items-center gap-0.5 transition-opacity">
                <button
                  type="button"
                  onClick={() => void handleCopyJsx(id, name, itemPack)}
                  title="Copy JSX / SVG"
                  aria-label={`Copy ${name} snippet`}
                  className="p-1 rounded bg-[#F1F1F1] dark:bg-[#1B1B1B] text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white cursor-pointer"
                >
                  <Code className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadSvg(id, name)}
                  title="Download .svg"
                  aria-label={`Download ${name} SVG`}
                  className="p-1 rounded bg-[#F1F1F1] dark:bg-[#1B1B1B] text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
