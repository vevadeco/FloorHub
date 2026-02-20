import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  Users, 
  Target, 
  DollarSign, 
  Wrench, 
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  BarChart3,
  PieChart,
  MessageSquare,
  UserPlus,
  Bell
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Package, label: "Inventory", path: "/inventory" },
  { icon: FileText, label: "Invoices", path: "/invoices" },
  { icon: Users, label: "Customers", path: "/customers" },
  { icon: Target, label: "Leads", path: "/leads" },
  { icon: DollarSign, label: "Expenses", path: "/expenses" },
  { icon: Wrench, label: "Contractors", path: "/contractors" },
  { icon: BarChart3, label: "Reports", path: "/reports" },
  { icon: PieChart, label: "Analytics", path: "/analytics" },
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: UserPlus, label: "Employees", path: "/employees", ownerOnly: true },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const Layout = ({ children }) => {
  const { user, logout, isOwner } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const currentPage = navItems.find(item => item.path === location.pathname)?.label || "Dashboard";

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              data-testid="mobile-menu-toggle"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <span className="font-heading font-semibold text-lg">FloorHub</span>
          </div>
          <div className="text-sm text-muted-foreground">{user?.name}</div>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="hidden lg:flex items-center gap-3 px-6 py-5 border-b border-border">
            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
              <Package className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-lg tracking-tight">FloorHub</h1>
              <p className="text-xs text-muted-foreground">Flooring Management</p>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto mt-14 lg:mt-0">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive 
                    ? "bg-accent text-accent-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                <span className="text-sm font-medium">{user?.name?.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={logout}
              data-testid="logout-button"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="min-h-screen pt-16 lg:pt-0">
          {/* Page Header */}
          <header className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">FloorHub</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{currentPage}</span>
            </div>
            <div className="flex items-center gap-4">
              {isOwner && (
                <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded-full font-medium">
                  Owner
                </span>
              )}
              <span className="text-sm text-muted-foreground">{user?.email}</span>
            </div>
          </header>

          {/* Page Content */}
          <div className="p-4 lg:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
