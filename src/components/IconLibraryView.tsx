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

const ICON_CATALOG: IconEntry[] = [
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

interface IconLibraryViewProps {
  onNotify: (msg: string) => void;
}

export const IconLibraryView: React.FC<IconLibraryViewProps> = ({ onNotify }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [iconSize, setIconSize] = useState(24);
  const [strokeWidth, setStrokeWidth] = useState(1.75);
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const svgRefs = useRef<Record<string, SVGSVGElement | null>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ICON_CATALOG.filter((item) => {
      if (category !== 'All' && item.category !== category) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.tags.some((t) => t.includes(q))
      );
    });
  }, [query, category]);

  const buildCleanSvgMarkup = (name: string): string | null => {
    const el = svgRefs.current[name];
    if (!el) return null;
    const clone = el.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(iconSize));
    clone.setAttribute('height', String(iconSize));
    clone.removeAttribute('class');
    return clone.outerHTML;
  };

  const handleCopySvg = async (name: string) => {
    const svg = buildCleanSvgMarkup(name);
    if (!svg) return;
    try {
      await navigator.clipboard.writeText(svg);
      setCopiedName(name);
      onNotify(`Copied ${name} SVG — paste directly into Figma, Photoshop, or code`);
      window.setTimeout(() => setCopiedName((cur) => (cur === name ? null : cur)), 1400);
    } catch {
      onNotify('Unable to copy SVG to clipboard');
    }
  };

  const handleCopyJsx = async (name: string) => {
    const snippet = `<${name} size={${iconSize}} strokeWidth={${strokeWidth}} />`;
    try {
      await navigator.clipboard.writeText(snippet);
      onNotify(`Copied ${name} JSX component`);
    } catch {
      onNotify('Unable to copy JSX');
    }
  };

  const handleDownloadSvg = (name: string) => {
    const svg = buildCleanSvgMarkup(name);
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
            Click any icon to copy clean SVG straight into Figma, Illustrator, Photoshop, or code.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11.5px]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons (e.g. arrow, figma, cloud)…"
              aria-label="Search icons"
              className="h-8 w-56 pl-8 pr-3 rounded-lg bg-[#F1F1F1] dark:bg-[#262626] border border-[var(--color-border)] text-[12px] text-[var(--color-text-primary)] outline-none focus:border-[#1b1b1b] dark:focus:border-[#f1f1f1]"
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

      {/* Category Filter Pills */}
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

      {/* Icon Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-2.5">
        {filtered.map(({ name, Icon }) => {
          const isCopied = copiedName === name;
          return (
            <div
              key={name}
              className="group relative flex flex-col items-center justify-between p-3 rounded-xl border border-[var(--color-border)] bg-white dark:bg-[#262626] hover:border-[#1b1b1b] dark:hover:border-[#f1f1f1] transition-colors"
            >
              <button
                type="button"
                onClick={() => void handleCopySvg(name)}
                title={`Copy ${name} SVG`}
                className="w-full flex flex-col items-center gap-2 py-2 cursor-pointer"
              >
                <Icon
                  ref={(el) => {
                    svgRefs.current[name] = el;
                  }}
                  size={iconSize}
                  strokeWidth={strokeWidth}
                  className="text-[var(--color-text-primary)]"
                />
                <span className="text-[10.5px] font-code text-[var(--color-text-secondary)] truncate max-w-full">
                  {isCopied ? 'Copied SVG!' : name}
                </span>
              </button>

              <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 absolute top-1.5 right-1.5 flex items-center gap-0.5 transition-opacity">
                <button
                  type="button"
                  onClick={() => void handleCopyJsx(name)}
                  title="Copy JSX"
                  aria-label={`Copy ${name} JSX`}
                  className="p-1 rounded bg-[#F1F1F1] dark:bg-[#1B1B1B] text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white cursor-pointer"
                >
                  <Code className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadSvg(name)}
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
