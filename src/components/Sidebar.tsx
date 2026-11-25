import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CheckCircle2,
  Clock,
  Cloud,
  CopyCheck,
  Download,
  Folder,
  FolderOpen,
  FolderPlus,
  Globe,
  HardDrive,
  Layers,
  LogOut,
  MinusCircle,
  MoreHorizontal,
  Plug,
  Plus,
  RefreshCw,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Type,
  Wand2,
} from 'lucide-react';
import type { DesktopUpdateInfo } from '../services/desktopFontActivator';
import type { FontLibrary, FontList, SidebarDestination, SmartList } from '../types/font';
import { GoogleSignInButton } from './CloudConnectionsModal';

interface SidebarProps {
  destination: SidebarDestination;
  onSelect: (dest: SidebarDestination) => void;
  libraries: FontLibrary[];
  fontLists: FontList[];
  smartLists: SmartList[];
  counts: {
    all: number;
    activated: number;
    deactivated: number;
    starred: number;
    recent: number;
    libraryCounts: Record<string, number>;
    listCounts: Record<string, number>;
    smartCounts: Record<string, number>;
  };
  duplicateCount: number;
  onOpenNewList: () => void;
  onOpenNewSmartList: () => void;
  onOpenConnections: () => void;
  onOpenDuplicates: () => void;
  onOpenMissingFonts?: () => void;
  onOpenCompare: () => void;
  compareCount: number;
  onDeleteList: (id: string) => void;
  onActivateAllInList: (id: string, active: boolean) => void;
  onShareList?: (id: string) => void;
  onDeleteSmartList: (id: string) => void;
  onSyncLibrary: (id: string) => void;
  onActivateAllInLibrary?: (id: string, active: boolean) => void;
  onDropFontOnList: (listId: string, fontId: string) => void;
  showInstallAction?: boolean;
  onOpenInstall?: () => void;
  isDesktop?: boolean;
  osPlatform?: string | null;
  osActiveCount?: number;
  osSyncBusy?: boolean;
  sessionOnlyMode?: boolean;
  onToggleSessionOnlyMode?: () => void;
  onOpenOsFontsFolder?: () => void;
  desktopUpdate?: DesktopUpdateInfo | null;
  user: User | null;
  cloudSynced: boolean;
  onSignInGoogle: () => void;
  onSignOut: () => void;
}

function isSameDestination(a: SidebarDestination, b: SidebarDestination): boolean {
  if (a.type !== b.type) return false;
  if ('id' in a && 'id' in b) return a.id === b.id;
  return true;
}

export const Sidebar: React.FC<SidebarProps> = ({
  destination,
  onSelect,
  libraries,
  fontLists,
  smartLists,
  counts,
  duplicateCount,
  onOpenNewList,
  onOpenNewSmartList,
  onOpenConnections,
  onOpenDuplicates,
  onOpenMissingFonts,
  onOpenCompare,
  compareCount,
  onDeleteList,
  onActivateAllInList,
  onShareList,
  onDeleteSmartList,
  onSyncLibrary,
  onActivateAllInLibrary,
  onDropFontOnList,
  showInstallAction = false,
  onOpenInstall,
  isDesktop = false,
  osPlatform = null,
  osActiveCount = 0,
  osSyncBusy = false,
  sessionOnlyMode = false,
  onToggleSessionOnlyMode,
  onOpenOsFontsFolder,
  desktopUpdate = null,
  user,
  cloudSynced,
  onSignInGoogle,
  onSignOut,
}) => {
  const [dragOverListId, setDragOverListId] = useState<string | null>(null);
  const [openMenuListId, setOpenMenuListId] = useState<string | null>(null);
  const [openMenuLibId, setOpenMenuLibId] = useState<string | null>(null);

  const rowShellClass = (active: boolean) =>
    `group relative w-full flex items-center justify-between gap-1 rounded-lg text-[13px] transition-colors ${
      active
        ? 'bg-[#1b1b1b] text-[#ffffff] dark:bg-[#f1f1f1] dark:text-[#111111] font-medium'
        : 'text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.07]'
    }`;

  const navItemClass = (active: boolean) =>
    `group w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors text-left cursor-pointer ${
      active
        ? 'bg-[#1b1b1b] text-[#ffffff] dark:bg-[#f1f1f1] dark:text-[#111111] font-medium'
        : 'text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.07]'
    }`;

  const countClass = (active: boolean) =>
    `text-[11px] font-code tabular-nums shrink-0 ${
      active
        ? 'text-white/75 dark:text-neutral-900/70'
        : 'text-neutral-500 dark:text-neutral-400'
    }`;

  const coreItems: Array<{
    dest: SidebarDestination;
    label: string;
    count: number;
    icon: React.ReactNode;
  }> = [
    { dest: { type: 'all' }, label: 'All Fonts', count: counts.all, icon: <Layers className="w-3.5 h-3.5 shrink-0" /> },
    { dest: { type: 'activated' }, label: 'Activated', count: counts.activated, icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> },
    { dest: { type: 'deactivated' }, label: 'Deactivated', count: counts.deactivated, icon: <MinusCircle className="w-3.5 h-3.5 shrink-0" /> },
    { dest: { type: 'starred' }, label: 'Starred', count: counts.starred, icon: <Star className="w-3.5 h-3.5 shrink-0" /> },
    { dest: { type: 'recent' }, label: 'Recently Added', count: counts.recent, icon: <Clock className="w-3.5 h-3.5 shrink-0" /> },
    { dest: { type: 'icons' }, label: 'Icon Sets', count: 120, icon: <Sparkles className="w-3.5 h-3.5 shrink-0" /> },
  ];

  const getLibraryIcon = (provider: FontLibrary['provider']) => {
    switch (provider) {
      case 'google':
        return <Globe className="w-3.5 h-3.5 shrink-0" />;
      case 'fontshare':
        return <Sparkles className="w-3.5 h-3.5 shrink-0" />;
      case 'adobe':
        return <Type className="w-3.5 h-3.5 shrink-0" />;
      case 'gdrive':
      case 'icloud':
      case 'box':
        return <Cloud className="w-3.5 h-3.5 shrink-0" />;
      case 'folder':
        return <FolderOpen className="w-3.5 h-3.5 shrink-0" />;
      default:
        return <HardDrive className="w-3.5 h-3.5 shrink-0" />;
    }
  };

  return (
    <aside
      aria-label="Fontainer Sidebar"
      className="w-[244px] shrink-0 h-full flex flex-col bg-[#F1F1F1] dark:bg-[#1B1B1B] border-r border-[var(--color-border)] select-none"
    >
      {/* Window Header / Brand */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            aria-hidden="true"
            className="w-6 h-6 rounded-[7px] bg-[#1b1b1b] dark:bg-[#f1f1f1] text-white dark:text-[#111111] flex items-center justify-center text-[13px] font-bold tracking-tight shrink-0"
          >
            F
          </div>
          <span className="text-[14px] font-semibold tracking-tight text-[var(--color-text-primary)] whitespace-nowrap">
            Fontainer
          </span>
        </div>
        <span className="text-[11px] font-code tabular-nums text-[var(--color-text-secondary)]">
          {counts.activated}/{counts.all}
        </span>
      </div>

      {/* Scrollable Navigation Sections */}
      <nav aria-label="Font Collections" className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
        {/* Core Catalog */}
        <section aria-label="Catalog">
          <div className="px-2.5 mb-1.5 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
            Library
          </div>
          <ul className="space-y-0.5">
            {coreItems.map((item) => {
              const active = isSameDestination(destination, item.dest);
              return (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.dest)}
                    aria-current={active ? 'page' : undefined}
                    className={navItemClass(active)}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={active ? 'text-white dark:text-[#111111]' : 'text-neutral-500 dark:text-neutral-400'}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className={countClass(active)}>{item.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Synced Font Libraries */}
        <section aria-label="Font Libraries">
          <div className="px-2.5 mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
              Font Libraries
            </span>
            <button
              type="button"
              onClick={onOpenConnections}
              aria-label="Connect Font Sources & Cloud Drives"
              title="Connect Adobe Fonts, Google Drive, iCloud Drive…"
              className="p-0.5 rounded text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <ul className="space-y-0.5">
            {libraries.map((lib) => {
              const dest: SidebarDestination = { type: 'library', id: lib.id };
              const active = isSameDestination(destination, dest);
              return (
                <li key={lib.id} className={rowShellClass(active)}>
                  <button
                    type="button"
                    onClick={() => onSelect(dest)}
                    aria-current={active ? 'page' : undefined}
                    className="flex-1 min-w-0 flex items-center gap-2 pl-2.5 py-1.5 text-left cursor-pointer"
                  >
                    <span className={active ? 'text-white dark:text-[#111111]' : 'text-neutral-500 dark:text-neutral-400'}>
                      {getLibraryIcon(lib.provider)}
                    </span>
                    <span className="truncate">{lib.name}</span>
                  </button>
                  <div className="flex items-center gap-1 pr-2.5 shrink-0">
                    {onActivateAllInLibrary && lib.id !== 'lib-google' && (
                      <button
                        type="button"
                        aria-label={`Actions for ${lib.name}`}
                        title={`Activate or Deactivate all in ${lib.name}`}
                        onClick={() => setOpenMenuLibId((cur) => (cur === lib.id ? null : lib.id))}
                        className={`opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded transition-opacity cursor-pointer ${
                          active
                            ? 'text-white/90 dark:text-neutral-900/80 hover:bg-white/20 dark:hover:bg-black/10'
                            : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                        }`}
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={`Sync ${lib.name}`}
                      title={`Sync ${lib.name}`}
                      onClick={() => onSyncLibrary(lib.id)}
                      className={`opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded transition-opacity cursor-pointer ${
                        active
                          ? 'text-white/90 dark:text-neutral-900/80 hover:bg-white/20 dark:hover:bg-black/10'
                          : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                      }`}
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                    <span className={countClass(active)}>{counts.libraryCounts[lib.id] ?? 0}</span>
                  </div>

                  {openMenuLibId === lib.id && onActivateAllInLibrary && (
                    <div
                      role="menu"
                      aria-label={`${lib.name} menu`}
                      className="absolute right-2 top-8 z-30 w-44 py-1 rounded-lg bg-white dark:bg-[#262626] border border-[var(--color-border)] shadow-lg text-[12px]"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onActivateAllInLibrary(lib.id, true);
                          setOpenMenuLibId(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-neutral-700 dark:text-neutral-200 hover:bg-[#1b1b1b] hover:text-white dark:hover:bg-[#f1f1f1] dark:hover:text-[#111111] transition-colors cursor-pointer"
                      >
                        Activate All Fonts
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onActivateAllInLibrary(lib.id, false);
                          setOpenMenuLibId(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-neutral-700 dark:text-neutral-200 hover:bg-[#1b1b1b] hover:text-white dark:hover:bg-[#f1f1f1] dark:hover:text-[#111111] transition-colors cursor-pointer"
                      >
                        Deactivate All Fonts
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Smart Lists */}
        <section aria-label="Smart Lists">
          <div className="px-2.5 mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
              Smart Lists
            </span>
            <button
              type="button"
              onClick={onOpenNewSmartList}
              aria-label="New Smart List"
              title="New Smart List"
              className="p-0.5 rounded text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <ul className="space-y-0.5">
            {smartLists.map((smart) => {
              const dest: SidebarDestination = { type: 'smart', id: smart.id };
              const active = isSameDestination(destination, dest);
              return (
                <li key={smart.id} className={rowShellClass(active)}>
                  <button
                    type="button"
                    onClick={() => onSelect(dest)}
                    aria-current={active ? 'page' : undefined}
                    className="flex-1 min-w-0 flex items-center gap-2 pl-2.5 py-1.5 text-left cursor-pointer"
                  >
                    <SlidersHorizontal
                      className={`w-3.5 h-3.5 shrink-0 ${
                        active
                          ? 'text-white dark:text-[#111111]'
                          : 'text-neutral-600 dark:text-neutral-300'
                      }`}
                    />
                    <span className="truncate">{smart.name}</span>
                  </button>
                  <div className="flex items-center gap-1 pr-2.5 shrink-0">
                    <button
                      type="button"
                      aria-label={`Delete Smart List ${smart.name}`}
                      title={`Delete ${smart.name}`}
                      onClick={() => onDeleteSmartList(smart.id)}
                      className={`opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded transition-opacity cursor-pointer ${
                        active
                          ? 'text-white/80 dark:text-neutral-900/75 hover:bg-white/20 dark:hover:bg-black/10'
                          : 'text-neutral-400 hover:text-red-500'
                      }`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <span className={countClass(active)}>{counts.smartCounts[smart.id] ?? 0}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* User Font Lists */}
        <section aria-label="Font Lists">
          <div className="px-2.5 mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
              Font Lists
            </span>
            <button
              type="button"
              onClick={onOpenNewList}
              aria-label="New Font List"
              title="New Font List"
              className="p-0.5 rounded text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </div>
          <ul className="space-y-0.5">
            {fontLists.map((list) => {
              const dest: SidebarDestination = { type: 'list', id: list.id };
              const active = isSameDestination(destination, dest);
              const isDropTarget = dragOverListId === list.id;

              return (
                <li
                  key={list.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverListId(list.id);
                  }}
                  onDragLeave={() => setDragOverListId(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverListId(null);
                    const fontId = e.dataTransfer.getData('text/fontainer-font-id');
                    if (fontId) onDropFontOnList(list.id, fontId);
                  }}
                  className={`${rowShellClass(active)} ${
                    isDropTarget ? 'ring-2 ring-[#1b1b1b] dark:ring-[#f1f1f1] bg-black/5 dark:bg-white/10' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(dest)}
                    aria-current={active ? 'page' : undefined}
                    className="flex-1 min-w-0 flex items-center gap-2 pl-2.5 py-1.5 text-left cursor-pointer"
                  >
                    <Folder
                      className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-white dark:text-[#111111]' : ''}`}
                      style={active ? undefined : { color: list.color }}
                    />
                    <span className="truncate">{list.name}</span>
                  </button>
                  <div className="flex items-center gap-1 pr-2.5 shrink-0">
                    <button
                      type="button"
                      aria-label={`Actions for ${list.name}`}
                      onClick={() => setOpenMenuListId((cur) => (cur === list.id ? null : list.id))}
                      className={`opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded transition-opacity cursor-pointer ${
                        active
                          ? 'text-white/90 dark:text-neutral-900/80 hover:bg-white/20 dark:hover:bg-black/10'
                          : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                      }`}
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                    <span className={countClass(active)}>{counts.listCounts[list.id] ?? 0}</span>
                  </div>

                  {openMenuListId === list.id && (
                    <div
                      role="menu"
                      aria-label={`${list.name} menu`}
                      className="absolute right-2 top-8 z-30 w-44 py-1 rounded-lg bg-white dark:bg-[#262626] border border-[var(--color-border)] shadow-lg text-[12px]"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onActivateAllInList(list.id, true);
                          setOpenMenuListId(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-neutral-700 dark:text-neutral-200 hover:bg-[#1b1b1b] hover:text-white dark:hover:bg-[#f1f1f1] dark:hover:text-[#111111] transition-colors cursor-pointer"
                      >
                        Activate All Fonts
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onActivateAllInList(list.id, false);
                          setOpenMenuListId(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-neutral-700 dark:text-neutral-200 hover:bg-[#1b1b1b] hover:text-white dark:hover:bg-[#f1f1f1] dark:hover:text-[#111111] transition-colors cursor-pointer"
                      >
                        Deactivate All Fonts
                      </button>
                      {onShareList && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            onShareList(list.id);
                            setOpenMenuListId(null);
                          }}
                          className="w-full px-3 py-1.5 flex items-center gap-1.5 text-left text-neutral-700 dark:text-neutral-200 hover:bg-[#1b1b1b] hover:text-white dark:hover:bg-[#f1f1f1] dark:hover:text-[#111111] transition-colors cursor-pointer"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>Copy Share Link</span>
                        </button>
                      )}
                      <div className="my-1 border-t border-[var(--color-border)]" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onDeleteList(list.id);
                          setOpenMenuListId(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
                      >
                        Delete Font List
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </nav>

      {/* Bottom Connections, Maintenance & Account Sync */}
      <div className="px-2.5 py-2.5 border-t border-[var(--color-border)] space-y-1 shrink-0">
        <button
          type="button"
          onClick={onOpenConnections}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-[var(--color-text-primary)] bg-white/80 dark:bg-white/[0.06] border border-[var(--color-border)] hover:bg-white dark:hover:bg-white/[0.11] transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Plug className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Connect Drives &amp; Adobe</span>
          </span>
          <span className="text-[10px] font-code text-neutral-500 dark:text-neutral-400 shrink-0">
            Live
          </span>
        </button>

        {onOpenMissingFonts && (
          <button
            type="button"
            onClick={onOpenMissingFonts}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] text-neutral-600 dark:text-neutral-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Wand2 className="w-3.5 h-3.5 text-neutral-500" />
              <span>Auto-Activate Missing</span>
            </span>
            <span className="text-[10px] font-code text-neutral-400 dark:text-neutral-500">
              Figma/CC
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={onOpenDuplicates}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] text-neutral-600 dark:text-neutral-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <CopyCheck className="w-3.5 h-3.5 text-neutral-500" />
            <span>Duplicate Finder</span>
          </span>
          <span className="font-code tabular-nums text-[11px] text-amber-600 dark:text-amber-400">
            {duplicateCount > 0 ? `${duplicateCount} found` : 'Clean'}
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenCompare}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] text-neutral-600 dark:text-neutral-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-neutral-500" />
            <span>Compare Tray</span>
          </span>
          <span className="font-code tabular-nums text-[11px] text-neutral-400 dark:text-neutral-500">
            {compareCount} pinned
          </span>
        </button>
        {isDesktop && desktopUpdate && (
          <a
            href={desktopUpdate.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] font-medium bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/20 transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Update v{desktopUpdate.latestVersion}</span>
            </span>
            <span className="text-[10px] font-code shrink-0">Get</span>
          </a>
        )}
        {isDesktop && onOpenOsFontsFolder && (
          <button
            type="button"
            onClick={onOpenOsFontsFolder}
            title={
              osPlatform === 'windows'
                ? 'Open %LOCALAPPDATA%\\Microsoft\\Windows\\Fonts'
                : 'Open ~/Library/Fonts'
            }
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] text-neutral-600 dark:text-neutral-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 min-w-0">
              <HardDrive className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">
                {osPlatform === 'windows' ? 'Windows Fonts' : 'macOS Fonts'}
              </span>
            </span>
            <span className="font-code tabular-nums text-[10.5px] text-emerald-700 dark:text-emerald-400 shrink-0">
              {osSyncBusy ? 'Syncing…' : `${osActiveCount} live`}
            </span>
          </button>
        )}
        {isDesktop && onToggleSessionOnlyMode && (
          <button
            type="button"
            onClick={onToggleSessionOnlyMode}
            title="When ON, newly activated fonts automatically deactivate when you quit Fontainer"
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] text-neutral-600 dark:text-neutral-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Clock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span className="truncate">Session Mode</span>
            </span>
            <span
              className={`font-code text-[10.5px] shrink-0 ${
                sessionOnlyMode
                  ? 'text-amber-600 dark:text-amber-400 font-medium'
                  : 'text-neutral-400 dark:text-neutral-500'
              }`}
            >
              {sessionOnlyMode ? 'Temp' : 'Perm'}
            </span>
          </button>
        )}
        {showInstallAction && onOpenInstall && (
          <button
            type="button"
            onClick={onOpenInstall}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] text-neutral-600 dark:text-neutral-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.07] hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Download className="w-3.5 h-3.5 text-neutral-500" />
              <span>Desktop App</span>
            </span>
            <span className="text-[10px] font-code text-neutral-500 dark:text-neutral-400">
              Mac / Win
            </span>
          </button>
        )}

        {/* User Account / Multi-Device Cloud Sync */}
        <div className="pt-1.5 mt-1 border-t border-[var(--color-border)]">
          {user ? (
            <div className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-white/70 dark:bg-white/[0.04] border border-[var(--color-border)]">
              <div className="flex items-center gap-2 min-w-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName ?? 'User avatar'}
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-full shrink-0 object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[#1b1b1b] dark:bg-[#f1f1f1] text-white dark:text-[#111111] flex items-center justify-center text-[11px] font-semibold shrink-0">
                    {(user.displayName ?? user.email ?? 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[11.5px] font-medium text-[var(--color-text-primary)] truncate">
                    {user.displayName || user.email}
                  </div>
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400 truncate">
                    {cloudSynced ? 'Cloud Synced' : 'Syncing…'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                aria-label="Sign out"
                title="Sign out"
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col">
              <GoogleSignInButton onClick={onSignInGoogle} label="Sign in with Google" />
            </div>
          )}
          <div className="mt-2 flex items-center justify-center gap-2 text-[10.5px] text-[var(--color-text-secondary)]">
            <a
              href="/privacy"
              className="hover:text-[var(--color-text-primary)] hover:underline transition-colors"
            >
              Privacy Policy
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="/terms"
              className="hover:text-[var(--color-text-primary)] hover:underline transition-colors"
            >
              Terms
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
};
