import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
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
  Loader2
} from "lucide-react";
import { motion } from "framer-motion";

const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isOwner } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [convertingToInvoice, setConvertingToInvoice] = useState(false);
  const [pollingPayment, setPollingPayment] = useState(false);

  useEffect(() => {
    fetchInvoice();
    
    // Check for payment return
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

      // Continue polling
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
      sent: "bg-blue-100 text-blue-700 border-blue-200",
      cancelled: "bg-red-100 text-red-700 border-red-200",
      draft: "bg-stone-100 text-stone-700 border-stone-200"
    };
    return styles[status] || styles.draft;
  };

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
            Download PDF
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
              Send Email
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
              Convert to Invoice
            </Button>
          )}
          {!invoice.is_estimate && invoice.status !== 'paid' && (
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
              {pollingPayment ? "Checking..." : "Pay Now"}
            </Button>
          )}
        </div>
      </div>

      {/* Payment Success/Cancel Message */}
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetail;
