import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { toast } from "sonner";
import { Plus, FileText, Trash2, Search, Eye, Calculator, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";
import debounce from "lodash.debounce";

const Invoices = () => {
  const { isOwner } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("invoices");
  
  // Form state
  const [isEstimate, setIsEstimate] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: ""
  });
  const [items, setItems] = useState([]);
  const [taxRate, setTaxRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [states, setStates] = useState([]);

  useEffect(() => {
    fetchData();
    fetchStates();
  }, []);

  const fetchStates = async () => {
    try {
      const response = await api.get("/address/states");
      setStates(response.data);
    } catch (error) {
      console.error("Failed to fetch states");
    }
  };

  const fetchAddressSuggestions = useCallback(
    debounce(async (query) => {
      if (query.length < 2) {
        setAddressSuggestions([]);
        return;
      }
      try {
        const response = await api.get(`/address/suggestions?query=${encodeURIComponent(query)}`);
        setAddressSuggestions(response.data);
        setShowAddressSuggestions(response.data.length > 0);
      } catch (error) {
        console.error("Failed to fetch suggestions");
      }
    }, 300),
    []
  );

  const handleAddressChange = (value) => {
    setCustomerForm({ ...customerForm, address: value });
    fetchAddressSuggestions(value);
  };

  const selectAddressSuggestion = (suggestion) => {
    setCustomerForm({
      ...customerForm,
      address: suggestion.full_address
    });
    setShowAddressSuggestions(false);
  };

  const fetchData = async () => {
    try {
      const [invoicesRes, estimatesRes, productsRes, customersRes] = await Promise.all([
        api.get("/invoices?is_estimate=false"),
        api.get("/invoices?is_estimate=true"),
        api.get("/products"),
        api.get("/customers")
      ]);
      setInvoices(invoicesRes.data);
      setEstimates(estimatesRes.data);
      setProducts(productsRes.data);
      setCustomers(customersRes.data);
    } catch (error) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setItems([...items, {
      product_id: "",
      product_name: "",
      sqft_needed: "",
      sqft_per_box: 0,
      boxes_needed: 0,
      unit_price: 0,
      total_price: 0
    }]);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    const item = newItems[index];
    
    if (field === "product_id") {
      const product = products.find(p => p.id === value);
      if (product) {
        item.product_id = value;
        item.product_name = product.name;
        item.sqft_per_box = product.sqft_per_box;
        item.unit_price = product.selling_price;
        
        // Recalculate boxes if sqft already entered
        if (item.sqft_needed) {
          item.boxes_needed = Math.ceil(parseFloat(item.sqft_needed) / product.sqft_per_box);
          item.total_price = item.boxes_needed * product.selling_price;
        }
      }
    } else if (field === "sqft_needed") {
      item.sqft_needed = value;
      if (item.sqft_per_box > 0 && value) {
        item.boxes_needed = Math.ceil(parseFloat(value) / item.sqft_per_box);
        item.total_price = item.boxes_needed * item.unit_price;
      }
    }
    
    setItems(newItems);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculations = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount - discount;
    return { subtotal, taxAmount, total };
  }, [items, taxRate, discount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    const customerId = selectedCustomer || crypto.randomUUID();
    
    const payload = {
      customer_id: customerId,
      customer_name: customerForm.name,
      customer_email: customerForm.email,
      customer_phone: customerForm.phone,
      customer_address: customerForm.address,
      items: items.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        sqft_needed: parseFloat(item.sqft_needed),
        sqft_per_box: item.sqft_per_box,
        boxes_needed: item.boxes_needed,
        unit_price: item.unit_price,
        total_price: item.total_price
      })),
      subtotal: calculations.subtotal,
      tax_rate: taxRate,
      tax_amount: calculations.taxAmount,
      discount: discount,
      total: calculations.total,
      notes: notes,
      status: "draft",
      is_estimate: isEstimate
    };

    try {
      await api.post("/invoices", payload);
      toast.success(`${isEstimate ? "Estimate" : "Invoice"} created successfully`);
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create document");
    }
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setCustomerForm({ name: "", email: "", phone: "", address: "" });
    setItems([]);
    setTaxRate(0);
    setDiscount(0);
    setNotes("");
    setIsEstimate(false);
  };

  const handleCustomerSelect = (customerId) => {
    if (customerId === "new" || !customerId) {
      setSelectedCustomer(null);
      setCustomerForm({ name: "", email: "", phone: "", address: "" });
    } else {
      setSelectedCustomer(customerId);
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setCustomerForm({
          name: customer.name,
          email: customer.email || "",
          phone: customer.phone || "",
          address: customer.address || ""
        });
      }
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this?")) return;
    
    try {
      await api.delete(`/invoices/${id}`);
      toast.success("Deleted successfully");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete");
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
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredEstimates = estimates.filter(est => 
    est.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    est.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderTable = (data, type) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Number</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, index) => (
            <motion.tr
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.05 }}
              className="border-b hover:bg-muted/30 transition-colors"
              data-testid={`${type}-row-${item.id}`}
            >
              <TableCell className="font-medium font-mono text-sm">{item.invoice_number}</TableCell>
              <TableCell>{item.customer_name}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(item.created_at)}</TableCell>
              <TableCell className="text-right tabular-nums font-medium">{formatCurrency(item.total)}</TableCell>
              <TableCell>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  item.status === 'paid' ? 'bg-green-100 text-green-700' :
                  item.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                  item.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                  'bg-stone-100 text-stone-700'
                }`}>
                  {item.status}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" asChild>
                    <Link to={`/invoices/${item.id}`} data-testid={`view-${type}-${item.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  {isOwner && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(item.id)}
                      data-testid={`delete-${type}-${item.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </motion.tr>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6" data-testid="invoices-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Invoices & Estimates</h1>
          <p className="text-muted-foreground mt-1">Create and manage invoices and estimates</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button 
                variant="outline"
                onClick={() => setIsEstimate(true)}
                data-testid="new-estimate-button"
              >
                <Calculator className="h-4 w-4 mr-2" />
                New Estimate
              </Button>
            </DialogTrigger>
            <DialogTrigger asChild>
              <Button 
                className="bg-accent hover:bg-accent/90"
                onClick={() => setIsEstimate(false)}
                data-testid="new-invoice-button"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-heading">
                  Create {isEstimate ? "Estimate" : "Invoice"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                {/* Customer Section */}
                <div className="space-y-4">
                  <h3 className="font-medium">Customer Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Select Existing Customer</Label>
                      <Select value={selectedCustomer || "new"} onValueChange={(v) => handleCustomerSelect(v === "new" ? null : v)}>
                        <SelectTrigger data-testid="customer-select">
                          <SelectValue placeholder="Select or enter new" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New Customer</SelectItem>
                          {customers.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer_name">Customer Name *</Label>
                      <Input
                        id="customer_name"
                        value={customerForm.name}
                        onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                        required
                        data-testid="customer-name-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer_email">Email</Label>
                      <Input
                        id="customer_email"
                        type="email"
                        value={customerForm.email}
                        onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                        data-testid="customer-email-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer_phone">Phone</Label>
                      <Input
                        id="customer_phone"
                        value={customerForm.phone}
                        onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                        data-testid="customer-phone-input"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="customer_address">Address</Label>
                      <Input
                        id="customer_address"
                        value={customerForm.address}
                        onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                        data-testid="customer-address-input"
                      />
                    </div>
                  </div>
                </div>

                {/* Items Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Items</h3>
                    <Button type="button" variant="outline" size="sm" onClick={addItem} data-testid="add-item-button">
                      <Plus className="h-4 w-4 mr-1" /> Add Item
                    </Button>
                  </div>
                  
                  {items.length === 0 ? (
                    <div className="text-center py-8 bg-muted/30 rounded-lg border-2 border-dashed">
                      <p className="text-muted-foreground mb-2">No items added yet</p>
                      <Button type="button" variant="outline" size="sm" onClick={addItem}>
                        <Plus className="h-4 w-4 mr-1" /> Add First Item
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {items.map((item, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/30 rounded-lg">
                          <div className="col-span-12 md:col-span-4 space-y-1">
                            <Label className="text-xs">Product</Label>
                            <Select 
                              value={item.product_id} 
                              onValueChange={(v) => updateItem(index, "product_id", v)}
                            >
                              <SelectTrigger data-testid={`item-product-select-${index}`}>
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} ({p.sqft_per_box} sq ft/box)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-4 md:col-span-2 space-y-1">
                            <Label className="text-xs">Sq Ft Needed</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.sqft_needed}
                              onChange={(e) => updateItem(index, "sqft_needed", e.target.value)}
                              placeholder="0.00"
                              data-testid={`item-sqft-input-${index}`}
                            />
                          </div>
                          <div className="col-span-4 md:col-span-2 space-y-1">
                            <Label className="text-xs">Boxes</Label>
                            <Input
                              value={item.boxes_needed || 0}
                              readOnly
                              className="bg-muted"
                              data-testid={`item-boxes-${index}`}
                            />
                          </div>
                          <div className="col-span-3 md:col-span-2 space-y-1">
                            <Label className="text-xs">Unit Price</Label>
                            <Input
                              value={formatCurrency(item.unit_price || 0)}
                              readOnly
                              className="bg-muted"
                            />
                          </div>
                          <div className="col-span-3 md:col-span-1 space-y-1">
                            <Label className="text-xs">Total</Label>
                            <Input
                              value={formatCurrency(item.total_price || 0)}
                              readOnly
                              className="bg-muted font-medium"
                            />
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon"
                              className="text-destructive"
                              onClick={() => removeItem(index)}
                              data-testid={`remove-item-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Totals Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Additional notes or terms..."
                      rows={4}
                      data-testid="invoice-notes"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Tax Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={taxRate}
                        onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                        className="w-24 text-right"
                        data-testid="tax-rate-input"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Discount ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={discount}
                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                        className="w-24 text-right"
                        data-testid="discount-input"
                      />
                    </div>
                    <div className="border-t pt-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span className="tabular-nums">{formatCurrency(calculations.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tax ({taxRate}%):</span>
                        <span className="tabular-nums">{formatCurrency(calculations.taxAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Discount:</span>
                        <span className="tabular-nums">-{formatCurrency(discount)}</span>
                      </div>
                      <div className="flex justify-between font-medium text-lg border-t pt-2">
                        <span>Total:</span>
                        <span className="tabular-nums">{formatCurrency(calculations.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-accent hover:bg-accent/90" data-testid="create-invoice-button">
                    Create {isEstimate ? "Estimate" : "Invoice"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by number or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="invoice-search-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="invoices" data-testid="invoices-tab">
            Invoices ({filteredInvoices.length})
          </TabsTrigger>
          <TabsTrigger value="estimates" data-testid="estimates-tab">
            Estimates ({filteredEstimates.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="invoices">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
              ) : filteredInvoices.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium text-lg mb-1">No invoices found</h3>
                  <p className="text-muted-foreground text-sm">Create your first invoice to get started</p>
                </div>
              ) : (
                renderTable(filteredInvoices, "invoice")
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="estimates">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
              ) : filteredEstimates.length === 0 ? (
                <div className="p-12 text-center">
                  <Calculator className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium text-lg mb-1">No estimates found</h3>
                  <p className="text-muted-foreground text-sm">Create an estimate to quote your customers</p>
                </div>
              ) : (
                renderTable(filteredEstimates, "estimate")
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Invoices;
