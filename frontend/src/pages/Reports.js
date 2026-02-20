import { useState, useEffect } from "react";
import api from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  CalendarIcon,
  ArrowUpRight,
  ArrowDownRight,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "../lib/utils";
import { motion } from "framer-motion";

const Reports = () => {
  const [financialData, setFinancialData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("financial");
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const [financialRes, transactionsRes] = await Promise.all([
        api.get("/reports/financial"),
        api.get("/reports/transactions")
      ]);
      setFinancialData(financialRes.data);
      setTransactions(transactionsRes.data.transactions);
    } catch (error) {
      toast.error("Failed to fetch reports");
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

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="reports-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">Financial and transaction reports</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="financial" data-testid="financial-tab">
            <DollarSign className="h-4 w-4 mr-2" />
            Financial Report
          </TabsTrigger>
          <TabsTrigger value="transactions" data-testid="transactions-tab">
            <FileText className="h-4 w-4 mr-2" />
            Transactions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="financial" className="space-y-6">
          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Total Revenue</p>
                      <p className="text-2xl font-heading font-bold mt-1 tabular-nums text-green-700">
                        {formatCurrency(financialData?.total_revenue)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {financialData?.paid_invoice_count} paid invoices
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <ArrowUpRight className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="bg-gradient-to-br from-rose-50 to-red-50 border-rose-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Total Expenses</p>
                      <p className="text-2xl font-heading font-bold mt-1 tabular-nums text-rose-700">
                        {formatCurrency(financialData?.total_expenses)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {financialData?.expense_count} expenses recorded
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-rose-100 flex items-center justify-center">
                      <ArrowDownRight className="h-5 w-5 text-rose-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className={cn(
                "border-2",
                financialData?.gross_profit >= 0 
                  ? "bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-300" 
                  : "bg-gradient-to-br from-red-50 to-rose-50 border-red-300"
              )}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Gross Profit</p>
                      <p className={cn(
                        "text-2xl font-heading font-bold mt-1 tabular-nums",
                        financialData?.gross_profit >= 0 ? "text-emerald-700" : "text-red-700"
                      )}>
                        {formatCurrency(financialData?.gross_profit)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {financialData?.profit_margin?.toFixed(1)}% margin
                      </p>
                    </div>
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center",
                      financialData?.gross_profit >= 0 ? "bg-emerald-100" : "bg-red-100"
                    )}>
                      {financialData?.gross_profit >= 0 
                        ? <TrendingUp className="h-5 w-5 text-emerald-600" />
                        : <TrendingDown className="h-5 w-5 text-red-600" />
                      }
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Pending Revenue</p>
                      <p className="text-2xl font-heading font-bold mt-1 tabular-nums text-amber-700">
                        {formatCurrency(financialData?.total_pending)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Unpaid invoices
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-amber-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Expense Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg">Expenses by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {financialData?.expense_by_category && Object.keys(financialData.expense_by_category).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(financialData.expense_by_category).map(([category, amount]) => (
                      <div key={category} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-accent" />
                          <span className="capitalize text-sm">{category.replace('_', ' ')}</span>
                        </div>
                        <span className="font-medium tabular-nums">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">No expenses recorded</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg">Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                {financialData?.payment_methods && Object.keys(financialData.payment_methods).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(financialData.payment_methods).map(([method, amount]) => (
                      <div key={method} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                          <span className="capitalize text-sm">{method.replace('_', ' ')}</span>
                        </div>
                        <span className="font-medium tabular-nums">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">No payments recorded</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">All Transactions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium text-lg mb-1">No transactions found</h3>
                  <p className="text-muted-foreground text-sm">Payments will appear here</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Date</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction, index) => (
                        <motion.tr
                          key={transaction.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.03 }}
                          className="border-b hover:bg-muted/30 transition-colors"
                        >
                          <TableCell className="text-muted-foreground">
                            {formatDate(transaction.date)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {transaction.invoice_number || "-"}
                          </TableCell>
                          <TableCell>{transaction.customer_name || "-"}</TableCell>
                          <TableCell>
                            <span className={cn(
                              "text-xs px-2 py-1 rounded-full",
                              transaction.type === "stripe" 
                                ? "bg-purple-100 text-purple-700" 
                                : "bg-blue-100 text-blue-700"
                            )}>
                              {transaction.type}
                            </span>
                          </TableCell>
                          <TableCell className="capitalize">
                            {transaction.payment_method || "-"}
                          </TableCell>
                          <TableCell>
                            <span className={cn(
                              "text-xs px-2 py-1 rounded-full",
                              transaction.status === "completed" || transaction.status === "paid"
                                ? "bg-green-100 text-green-700"
                                : transaction.status === "pending"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-stone-100 text-stone-700"
                            )}>
                              {transaction.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {formatCurrency(transaction.amount)}
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
