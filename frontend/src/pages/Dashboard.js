import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { 
  Package, 
  Users, 
  Target, 
  DollarSign, 
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Plus
} from "lucide-react";
import { motion } from "framer-motion";

const StatCard = ({ title, value, icon: Icon, description, trend, color }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-heading font-bold mt-1 tabular-nums">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-3 text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>{Math.abs(trend)}% from last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  </motion.div>
);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get("/dashboard/stats");
      setStats(response.data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="dashboard">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's your business overview.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/invoices">
              <FileText className="h-4 w-4 mr-2" />
              New Invoice
            </Link>
          </Button>
          <Button className="bg-accent hover:bg-accent/90" asChild>
            <Link to="/leads">
              <Plus className="h-4 w-4 mr-2" />
              Add Lead
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats?.total_revenue)}
          icon={DollarSign}
          description="From paid invoices"
          color="bg-green-100 text-green-600"
        />
        <StatCard
          title="Net Income"
          value={formatCurrency(stats?.net_income)}
          icon={stats?.net_income >= 0 ? TrendingUp : TrendingDown}
          description="Revenue minus expenses"
          color={stats?.net_income >= 0 ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}
        />
        <StatCard
          title="New Leads"
          value={stats?.new_leads_count || 0}
          icon={Target}
          description={`${stats?.leads_count || 0} total leads`}
          color="bg-orange-100 text-orange-600"
        />
        <StatCard
          title="Pending Invoices"
          value={stats?.pending_invoices || 0}
          icon={FileText}
          description="Awaiting payment"
          color="bg-blue-100 text-blue-600"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Products in Stock"
          value={stats?.products_count || 0}
          icon={Package}
          color="bg-purple-100 text-purple-600"
        />
        <StatCard
          title="Total Customers"
          value={stats?.customers_count || 0}
          icon={Users}
          color="bg-indigo-100 text-indigo-600"
        />
        <StatCard
          title="Total Expenses"
          value={formatCurrency(stats?.total_expenses)}
          icon={DollarSign}
          color="bg-rose-100 text-rose-600"
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-heading text-lg">Recent Invoices</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/invoices" className="text-accent hover:text-accent/80">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats?.recent_invoices?.length > 0 ? (
              <div className="space-y-3">
                {stats.recent_invoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    to={`/invoices/${invoice.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                    data-testid={`recent-invoice-${invoice.id}`}
                  >
                    <div>
                      <p className="font-medium text-sm">{invoice.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">{invoice.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm tabular-nums">{formatCurrency(invoice.total)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                        invoice.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                        'bg-stone-100 text-stone-700'
                      }`}>
                        {invoice.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No invoices yet</p>
                <Button variant="link" className="text-accent mt-2" asChild>
                  <Link to="/invoices">Create your first invoice</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Leads */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-heading text-lg">Recent Leads</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/leads" className="text-accent hover:text-accent/80">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats?.recent_leads?.length > 0 ? (
              <div className="space-y-3">
                {stats.recent_leads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                    data-testid={`recent-lead-${lead.id}`}
                  >
                    <div>
                      <p className="font-medium text-sm">{lead.name}</p>
                      <p className="text-xs text-muted-foreground">{lead.project_type || lead.source}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      lead.status === 'new' ? 'bg-orange-100 text-orange-700' :
                      lead.status === 'contacted' ? 'bg-blue-100 text-blue-700' :
                      lead.status === 'qualified' ? 'bg-purple-100 text-purple-700' :
                      lead.status === 'won' ? 'bg-green-100 text-green-700' :
                      'bg-stone-100 text-stone-700'
                    }`}>
                      {lead.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No leads yet</p>
                <Button variant="link" className="text-accent mt-2" asChild>
                  <Link to="/leads">Add your first lead</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
