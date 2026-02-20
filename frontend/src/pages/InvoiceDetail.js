import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Download, 
  Mail, 
  CreditCard, 
  RefreshCw,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  Banknote,
  CalendarIcon,
  Trash2
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { cn } from "../lib/utils";

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Credit/Debit Card" },
  { value: "other", label: "Other" }
];

const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isOwner } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [manualPayments, setManualPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [convertingToInvoice, setConvertingToInvoice] = useState(false);
  const [pollingPayment, setPollingPayment] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_method: "cash",
    reference_number: "",
    notes: "",
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchInvoice();
    fetchManualPayments();
    
    const sessionId = searchParams.get('session_id');
    const paymentStatus = searchParams.get('payment');
    
    if (sessionId && paymentStatus === 'success') {
      pollPaymentStatus(sessionId);
    }
  }, [id, searchParams]);

  const fetchInvoice = async () => {
    try {
      const response = await api.get(`/invoices/${id}`);
      setInvoice(response.data);
    } catch (error) {
      toast.error("Failed to fetch invoice");
      navigate("/invoices");
    } finally {
      setLoading(false);
    }
  };

  const fetchManualPayments = async () => {
    try {
      const response = await api.get(`/payments/manual/invoice/${id}`);
      setManualPayments(response.data);
    } catch (error) {
      console.error("Failed to fetch payments");
    }
  };

  const pollPaymentStatus = async (sessionId, attempts = 0) => {
    const maxAttempts = 10;
    const pollInterval = 2000;

    if (attempts >= maxAttempts) {
      setPollingPayment(false);
      toast.info("Payment status check timed out. Please refresh to check status.");
      return;
    }

    setPollingPayment(true);

    try {
      const response = await api.get(`/payments/status/${sessionId}`);
      
      if (response.data.payment_status === 'paid') {
        setPollingPayment(false);
        toast.success("Payment successful!");
        fetchInvoice();
        return;
      } else if (response.data.status === 'expired') {
        setPollingPayment(false);
        toast.error("Payment session expired");
        return;
      }

      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), pollInterval);
    } catch (error) {
      setPollingPayment(false);
      console.error("Error checking payment:", error);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await api.get(`/invoices/${id}/pdf`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoice_number}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      toast.success("PDF downloaded successfully");
    } catch (error) {
      toast.error("Failed to download PDF");
    }
  };

  const handleSendEmail = async () => {
    if (!invoice.customer_email) {
      toast.error("Customer email is required to send invoice");
      return;
    }

    setSendingEmail(true);
    try {
      await api.post(`/invoices/${id}/send-email`);
      toast.success("Email sent successfully");
      fetchInvoice();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  const handlePayNow = async () => {
    setProcessingPayment(true);
    try {
      const response = await api.post(`/payments/checkout?invoice_id=${id}`);
      window.location.href = response.data.url;
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to initiate payment");
      setProcessingPayment(false);
    }
  };

  const handleConvertToInvoice = async () => {
    setConvertingToInvoice(true);
    try {
      const response = await api.post(`/invoices/${id}/convert-to-invoice`);
      toast.success("Estimate converted to invoice");
      navigate(`/invoices/${response.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to convert estimate");
    } finally {
      setConvertingToInvoice(false);
    }
  };

  const handleAddManualPayment = async (e) => {
    e.preventDefault();
    
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      await api.post("/payments/manual", {
        invoice_id: id,
        amount: parseFloat(paymentForm.amount),
        payment_method: paymentForm.payment_method,
        reference_number: paymentForm.reference_number,
        notes: paymentForm.notes,
        date: paymentForm.date
      });
      toast.success("Payment recorded successfully");
      setPaymentDialogOpen(false);
      setPaymentForm({
        amount: "",
        payment_method: "cash",
        reference_number: "",
        notes: "",
        date: new Date().toISOString().split('T')[0]
      });
      fetchInvoice();
      fetchManualPayments();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to record payment");
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm("Are you sure you want to delete this payment?")) return;
    
    try {
      await api.delete(`/payments/manual/${paymentId}`);
      toast.success("Payment deleted");
      fetchInvoice();
      fetchManualPayments();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete payment");
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      paid: "bg-green-100 text-green-700 border-green-200",
      partial: "bg-amber-100 text-amber-700 border-amber-200",
      sent: "bg-blue-100 text-blue-700 border-blue-200",
      cancelled: "bg-red-100 text-red-700 border-red-200",
      draft: "bg-stone-100 text-stone-700 border-stone-200"
    };
    return styles[status] || styles.draft;
  };

  const totalPaid = manualPayments.reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = invoice ? invoice.total - totalPaid : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-lg">Invoice not found</h3>
        <Button variant="link" onClick={() => navigate("/invoices")}>
          Back to invoices
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="invoice-detail-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/invoices")} data-testid="back-button">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">
                {invoice.invoice_number}
              </h1>
              <Badge variant="outline" className={getStatusBadge(invoice.status)}>
                {invoice.status}
              </Badge>
              {invoice.is_estimate && (
                <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200">
                  Estimate
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">Created {formatDate(invoice.created_at)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleDownloadPDF} data-testid="download-pdf-button">
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          {invoice.customer_email && invoice.status !== 'paid' && (
            <Button 
              variant="outline" 
              onClick={handleSendEmail}
              disabled={sendingEmail}
              data-testid="send-email-button"
            >
              {sendingEmail ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Email
            </Button>
          )}
          {invoice.is_estimate && (
            <Button 
              variant="outline"
              onClick={handleConvertToInvoice}
              disabled={convertingToInvoice}
              data-testid="convert-to-invoice-button"
            >
              {convertingToInvoice ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Convert
            </Button>
          )}
          {!invoice.is_estimate && invoice.status !== 'paid' && (
            <>
              <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="record-payment-button">
                    <Banknote className="h-4 w-4 mr-2" />
                    Record Payment
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-heading">Record Manual Payment</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddManualPayment} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                        placeholder={balanceDue.toFixed(2)}
                        required
                        data-testid="payment-amount-input"
                      />
                      <p className="text-xs text-muted-foreground">
                        Balance due: {formatCurrency(balanceDue)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Method</Label>
                      <Select 
                        value={paymentForm.payment_method} 
                        onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_method: v })}
                      >
                        <SelectTrigger data-testid="payment-method-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentMethods.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                            data-testid="payment-date-button"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {paymentForm.date ? format(new Date(paymentForm.date), "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={paymentForm.date ? new Date(paymentForm.date) : undefined}
                            onSelect={(date) => {
                              setPaymentForm({ ...paymentForm, date: date ? format(date, "yyyy-MM-dd") : "" });
                              setCalendarOpen(false);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reference">Reference # (optional)</Label>
                      <Input
                        id="reference"
                        value={paymentForm.reference_number}
                        onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                        placeholder="Check #, transaction ID, etc."
                        data-testid="payment-reference-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (optional)</Label>
                      <Textarea
                        id="notes"
                        value={paymentForm.notes}
                        onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                        rows={2}
                        data-testid="payment-notes-input"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-accent hover:bg-accent/90" data-testid="save-payment-button">
                        Record Payment
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              <Button 
                className="bg-accent hover:bg-accent/90"
                onClick={handlePayNow}
                disabled={processingPayment || pollingPayment}
                data-testid="pay-now-button"
              >
                {processingPayment || pollingPayment ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                {pollingPayment ? "Checking..." : "Pay Online"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Payment Status Messages */}
      {searchParams.get('payment') === 'success' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3"
        >
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div>
            <p className="font-medium text-green-800">Payment processing</p>
            <p className="text-sm text-green-600">Your payment is being verified...</p>
          </div>
        </motion.div>
      )}
      {searchParams.get('payment') === 'cancelled' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3"
        >
          <XCircle className="h-5 w-5 text-red-600" />
          <div>
            <p className="font-medium text-red-800">Payment cancelled</p>
            <p className="text-sm text-red-600">You can try again when you're ready</p>
          </div>
        </motion.div>
      )}

      {/* Invoice Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Sq Ft</TableHead>
                      <TableHead className="text-right">Boxes</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">{item.sqft_per_box} sq ft/box</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{item.sqft_needed.toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.boxes_needed}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatCurrency(item.total_price)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Payment History */}
          {!invoice.is_estimate && manualPayments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg">Payment History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        {isOwner && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {manualPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="text-muted-foreground">
                            {new Date(payment.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="capitalize">{payment.payment_method.replace('_', ' ')}</TableCell>
                          <TableCell className="text-muted-foreground">{payment.reference_number || "-"}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium text-green-600">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          {isOwner && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeletePayment(payment.id)}
                                data-testid={`delete-payment-${payment.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{invoice.customer_name}</p>
              {invoice.customer_email && (
                <p className="text-sm text-muted-foreground">{invoice.customer_email}</p>
              )}
              {invoice.customer_phone && (
                <p className="text-sm text-muted-foreground">{invoice.customer_phone}</p>
              )}
              {invoice.customer_address && (
                <p className="text-sm text-muted-foreground">{invoice.customer_address}</p>
              )}
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({invoice.tax_rate}%)</span>
                <span className="tabular-nums">{formatCurrency(invoice.tax_amount)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="tabular-nums text-green-600">-{formatCurrency(invoice.discount)}</span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between font-medium text-lg">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(invoice.total)}</span>
              </div>
              
              {!invoice.is_estimate && (
                <>
                  <div className="border-t pt-3 flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount Paid</span>
                    <span className="tabular-nums text-green-600">{formatCurrency(totalPaid)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Balance Due</span>
                    <span className={cn(
                      "tabular-nums",
                      balanceDue > 0 ? "text-amber-600" : "text-green-600"
                    )}>
                      {formatCurrency(balanceDue)}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetail;
