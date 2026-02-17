"use client";

import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
	DndContext,
	useSensor,
	useSensors,
	PointerSensor,
	type DragMoveEvent,
} from "@dnd-kit/core";
import {
	LayoutDashboard,
	CheckSquare,
	Calendar,
	StickyNote,
	Folder,
	Users,
} from "lucide-react";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import UserMenu from "./UserMenu";
import WorkspaceList from "@/components/dashboard/WorkspaceList";

const baseNavItems = [
	{ key: "overview", href: "/dashboard", icon: LayoutDashboard },
	{ key: "tasks", href: "/dashboard/tasks", icon: CheckSquare },
	{ key: "calendar", href: "/dashboard/calendar", icon: Calendar },
	{ key: "memo", href: "/dashboard/memo", icon: StickyNote },
	{ key: "files", href: "/dashboard/files", icon: Folder },
];

// Sidebar width constraints
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 256;

// Section height constraints
const MIN_WORKSPACE_HEIGHT = 150;
const MIN_NAV_HEIGHT = 120;
const DEFAULT_WORKSPACE_HEIGHT = 300;

export default function Sidebar({
	isMobile = false,
	mobileOpen = false,
	onClose,
}: {
	isMobile?: boolean;
	mobileOpen?: boolean;
	onClose?: () => void;
}) {
	const t = useTranslations("dashboard.nav");
	const pathname = usePathname();
	const { data: session } = useSession();
	const { currentWorkspace } = useWorkspace();
	const [isTeamAdmin, setIsTeamAdmin] = useState(false);
	const sidebarRef = useRef<HTMLElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);

	// Sidebar width state
	const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
	const [isResizingWidth, setIsResizingWidth] = useState(false);

	// Section heights state
	const [workspaceHeight, setWorkspaceHeight] = useState(DEFAULT_WORKSPACE_HEIGHT);
	const [isDraggingDivider, setIsDraggingDivider] = useState(false);
	const [dragStartY, setDragStartY] = useState(0);
	const [dragStartHeight, setDragStartHeight] = useState(0);

	// DnD sensors
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 1,
			},
		})
	);

	// Load saved dimensions from localStorage
	useEffect(() => {
		const savedWidth = localStorage.getItem("sidebarWidth");
		if (savedWidth) {
			const width = parseInt(savedWidth, 10);
			if (width >= MIN_WIDTH && width <= MAX_WIDTH) {
				setSidebarWidth(width);
			}
		}

		const savedWorkspaceHeight = localStorage.getItem("sidebarWorkspaceHeight");
		if (savedWorkspaceHeight) {
			const height = parseInt(savedWorkspaceHeight, 10);
			if (height >= MIN_WORKSPACE_HEIGHT) {
				setWorkspaceHeight(height);
			}
		}
	}, []);

	useEffect(() => {
		const checkTeamAdmin = async () => {
			if (!currentWorkspace || currentWorkspace.type !== "team") {
				setIsTeamAdmin(false);
				return;
			}

			try {
				const res = await fetch(`/api/teams/${currentWorkspace.owner_id}`);
				const data = await res.json();
				const memberId = session?.user?.memberId;
				setIsTeamAdmin(Boolean(data?.team?.created_by && data.team.created_by === memberId));
			} catch {
				setIsTeamAdmin(false);
			}
		};

		checkTeamAdmin();
	}, [currentWorkspace, session?.user?.memberId]);

	const navItems = useMemo(() => {
		const items = [...baseNavItems];
		if (isTeamAdmin) {
			items.push({ key: "teamAdmin", href: "/dashboard/teams", icon: Users });
		}
		return items;
	}, [isTeamAdmin]);

	// Save width to localStorage when it changes
	useEffect(() => {
		localStorage.setItem("sidebarWidth", String(sidebarWidth));
		window.dispatchEvent(new CustomEvent("sidebarResize", { detail: { width: sidebarWidth } }));
	}, [sidebarWidth]);

	// Save workspace height to localStorage when it changes
	useEffect(() => {
		localStorage.setItem("sidebarWorkspaceHeight", String(workspaceHeight));
	}, [workspaceHeight]);

	// Width resize handlers
	const startResizingWidth = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		setIsResizingWidth(true);
	}, []);

	const stopResizingWidth = useCallback(() => {
		setIsResizingWidth(false);
	}, []);

	const resizeWidth = useCallback(
		(e: MouseEvent) => {
			if (isResizingWidth && sidebarRef.current) {
				const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
				if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
					setSidebarWidth(newWidth);
				}
			}
		},
		[isResizingWidth]
	);

	useEffect(() => {
		if (isResizingWidth) {
			window.addEventListener("mousemove", resizeWidth);
			window.addEventListener("mouseup", stopResizingWidth);
			document.body.style.userSelect = "none";
			document.body.style.cursor = "col-resize";
		}

		return () => {
			window.removeEventListener("mousemove", resizeWidth);
			window.removeEventListener("mouseup", stopResizingWidth);
			document.body.style.userSelect = "";
			document.body.style.cursor = "";
		};
	}, [isResizingWidth, resizeWidth, stopResizingWidth]);

	// Height divider drag handlers
	const handleDragStart = useCallback((event: { active: { id: string | number } }) => {
		if (event.active.id === "workspace-nav-divider") {
			setIsDraggingDivider(true);
			setDragStartY(0);
			setDragStartHeight(workspaceHeight);
		}
	}, [workspaceHeight]);

	const handleDragMove = useCallback(
		(event: DragMoveEvent) => {
			if (event.active.id === "workspace-nav-divider" && contentRef.current) {
				const deltaY = event.delta.y;
				const contentHeight = contentRef.current.getBoundingClientRect().height;
				const maxWorkspaceHeight = contentHeight - MIN_NAV_HEIGHT;

				let newHeight = dragStartHeight + deltaY;

				// Apply constraints
				if (newHeight < MIN_WORKSPACE_HEIGHT) {
					newHeight = MIN_WORKSPACE_HEIGHT;
				}
				if (newHeight > maxWorkspaceHeight) {
					newHeight = maxWorkspaceHeight;
				}

				setWorkspaceHeight(newHeight);
			}
		},
		[dragStartHeight]
	);

	const handleDragEnd = useCallback(() => {
		setIsDraggingDivider(false);
	}, []);

	return (
		<DndContext
			sensors={sensors}
			onDragStart={handleDragStart}
			onDragMove={handleDragMove}
			onDragEnd={handleDragEnd}
		>
			<aside
				ref={sidebarRef}
				style={{ width: isMobile ? "80vw" : `${sidebarWidth}px` }}
				className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar-background transition-transform overscroll-contain touch-pan-y ${
					isMobile
						? mobileOpen
							? "translate-x-0"
							: "-translate-x-full"
						: "translate-x-0"
				}`}
			>
				{/* Workspace Switcher - Fixed at top */}
				<div className="flex-shrink-0 p-4">
					<div className="flex items-center justify-between">
						<WorkspaceSwitcher />
						{isMobile && (
							<button
								type="button"
								onClick={onClose}
								className="ui-button ml-2 px-2 py-1 text-xs"
							>
								Close
							</button>
						)}
					</div>
				</div>

				{/* Resizable content area */}
				<div ref={contentRef} className="flex flex-1 flex-col overflow-hidden">
					{/* Workspace List - Resizable */}
					<div
						style={{ height: `${workspaceHeight}px` }}
						className="flex-shrink-0 overflow-y-auto px-4 overscroll-contain touch-pan-y"
					>
						<WorkspaceList />
					</div>

					{/* Drag Divider */}
					<div
						data-draggable-id="workspace-nav-divider"
						onMouseDown={(e) => {
							e.preventDefault();
							setIsDraggingDivider(true);
							setDragStartY(e.clientY);
							setDragStartHeight(workspaceHeight);
						}}
						className={`group relative mx-2 h-2 cursor-row-resize select-none rounded ${
							isDraggingDivider ? "bg-primary/20" : "hover:bg-muted"
						}`}
					>
						<div
							className={`absolute left-1/2 top-1/2 h-1 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors ${
								isDraggingDivider
									? "bg-primary"
									: "bg-border group-hover:bg-primary/50"
							}`}
						/>
					</div>

					{/* Navigation - Takes remaining space */}
					<nav className="flex-1 space-y-1 overflow-y-auto p-4 overscroll-contain touch-pan-y">
						{navItems.map((item) => {
							const isActive =
								pathname === item.href ||
								(item.href !== "/dashboard" && pathname.startsWith(item.href));
							const Icon = item.icon;

							return (
								<Link
									key={item.key}
									href={item.href}
									className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
										isActive
											? "bg-active text-foreground"
											: "text-muted-foreground hover:bg-hover hover:text-foreground"
									}`}
								>
									<Icon className="h-4 w-4" />
									{t(item.key)}
								</Link>
							);
						})}
					</nav>
				</div>

				{/* User Menu - Fixed at bottom */}
				<div className="flex-shrink-0 border-t border-sidebar-border p-4">
					<UserMenu />
				</div>

				{/* Width Resize Handle */}
				<div
					onMouseDown={startResizingWidth}
					className={`absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/50 ${
						isResizingWidth ? "bg-primary" : "bg-transparent"
					}`}
				/>
			</aside>

			{/* Global mouse event handler for divider dragging */}
			{isDraggingDivider && (
				<div
					className="fixed inset-0 z-50 cursor-row-resize"
					onMouseMove={(e) => {
						if (contentRef.current) {
							const deltaY = e.clientY - dragStartY;
							const contentHeight = contentRef.current.getBoundingClientRect().height;
							const maxWorkspaceHeight = contentHeight - MIN_NAV_HEIGHT;

							let newHeight = dragStartHeight + deltaY;

							if (newHeight < MIN_WORKSPACE_HEIGHT) {
								newHeight = MIN_WORKSPACE_HEIGHT;
							}
							if (newHeight > maxWorkspaceHeight) {
								newHeight = maxWorkspaceHeight;
							}

							setWorkspaceHeight(newHeight);
						}
					}}
					onMouseUp={() => setIsDraggingDivider(false)}
				/>
			)}
		</DndContext>
	);
}
