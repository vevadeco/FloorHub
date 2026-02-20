import { useState, useEffect } from "react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Wrench, Phone, Mail, Star } from "lucide-react";
import { motion } from "framer-motion";

const specialties = [
  "Installation",
  "Hardwood",
  "Tile",
  "Carpet",
  "Vinyl",
  "Laminate",
  "Refinishing",
  "Demolition",
  "Subfloor",
  "General"
];

const initialFormData = {
  name: "",
  company: "",
  phone: "",
  email: "",
  specialty: "",
  address: "",
  notes: "",
  rating: 5
};

const Contractors = () => {
  const { isOwner } = useAuth();
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContractor, setEditingContractor] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState("all");

  useEffect(() => {
    fetchContractors();
  }, []);

  const fetchContractors = async () => {
    try {
      const response = await api.get("/contractors");
      setContractors(response.data);
    } catch (error) {
      toast.error("Failed to fetch contractors");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
      ...formData,
      rating: parseInt(formData.rating)
    };

    try {
      if (editingContractor) {
        await api.put(`/contractors/${editingContractor.id}`, payload);
        toast.success("Contractor updated successfully");
      } else {
        await api.post("/contractors", payload);
        toast.success("Contractor added successfully");
      }
      setDialogOpen(false);
      setEditingContractor(null);
      setFormData(initialFormData);
      fetchContractors();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save contractor");
    }
  };

  const handleEdit = (contractor) => {
    setEditingContractor(contractor);
    setFormData({
      name: contractor.name,
      company: contractor.company || "",
      phone: contractor.phone,
      email: contractor.email || "",
      specialty: contractor.specialty || "",
      address: contractor.address || "",
      notes: contractor.notes || "",
      rating: contractor.rating || 5
    });
    setDialogOpen(true);
  };

  const handleDelete = async (contractorId) => {
    if (!window.confirm("Are you sure you want to delete this contractor?")) return;
    
    try {
      await api.delete(`/contractors/${contractorId}`);
      toast.success("Contractor deleted");
      fetchContractors();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete contractor");
    }
  };

  const filteredContractors = contractors.filter(contractor => {
    const matchesSearch = contractor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (contractor.company && contractor.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
                         contractor.phone.includes(searchQuery);
    const matchesSpecialty = filterSpecialty === "all" || contractor.specialty === filterSpecialty;
    return matchesSearch && matchesSpecialty;
  });

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-3 w-3 ${i < rating ? 'fill-orange-400 text-orange-400' : 'text-stone-300'}`}
      />
    ));
  };

  return (
    <div className="space-y-6" data-testid="contractors-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Contractor Phonebook</h1>
          <p className="text-muted-foreground mt-1">
            {isOwner ? "Manage your contractor directory" : "View contractor directory"}
          </p>
        </div>
        {isOwner && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingContractor(null);
              setFormData(initialFormData);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90" data-testid="add-contractor-button">
                <Plus className="h-4 w-4 mr-2" />
                Add Contractor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-heading">
                  {editingContractor ? "Edit Contractor" : "Add New Contractor"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      data-testid="contractor-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      data-testid="contractor-company-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                      data-testid="contractor-phone-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      data-testid="contractor-email-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="specialty">Specialty</Label>
                    <Select value={formData.specialty || "select-specialty"} onValueChange={(v) => setFormData({ ...formData, specialty: v === "select-specialty" ? "" : v })}>
                      <SelectTrigger data-testid="contractor-specialty-select">
                        <SelectValue placeholder="Select specialty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="select-specialty">None</SelectItem>
                        {specialties.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rating">Rating</Label>
                    <Select value={formData.rating.toString()} onValueChange={(v) => setFormData({ ...formData, rating: parseInt(v) })}>
                      <SelectTrigger data-testid="contractor-rating-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(r => (
                          <SelectItem key={r} value={r.toString()}>
                            {r} Star{r > 1 ? 's' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      data-testid="contractor-address-input"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    data-testid="contractor-notes-input"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-accent hover:bg-accent/90" data-testid="contractor-submit-button">
                    {editingContractor ? "Update" : "Add"} Contractor
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contractors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="contractor-search-input"
              />
            </div>
            <Select value={filterSpecialty} onValueChange={setFilterSpecialty}>
              <SelectTrigger className="w-full sm:w-48" data-testid="specialty-filter-select">
                <SelectValue placeholder="All Specialties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Specialties</SelectItem>
                {specialties.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filteredContractors.length === 0 ? (
            <div className="p-12 text-center">
              <Wrench className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg mb-1">No contractors found</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {isOwner ? "Add contractors to your phonebook" : "No contractors in the directory yet"}
              </p>
              {isOwner && (
                <Button className="bg-accent hover:bg-accent/90" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Contractor
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Contractor</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Specialty</TableHead>
                    <TableHead>Rating</TableHead>
                    {isOwner && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContractors.map((contractor, index) => (
                    <motion.tr
                      key={contractor.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b hover:bg-muted/30 transition-colors"
                      data-testid={`contractor-row-${contractor.id}`}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{contractor.name}</p>
                          {contractor.company && (
                            <p className="text-xs text-muted-foreground">{contractor.company}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <a href={`tel:${contractor.phone}`} className="hover:text-accent transition-colors">
                              {contractor.phone}
                            </a>
                          </div>
                          {contractor.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <a href={`mailto:${contractor.email}`} className="hover:text-accent transition-colors text-muted-foreground">
                                {contractor.email}
                              </a>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {contractor.specialty && (
                          <span className="text-xs bg-secondary px-2 py-1 rounded-full">
                            {contractor.specialty}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          {renderStars(contractor.rating || 5)}
                        </div>
                      </TableCell>
                      {isOwner && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleEdit(contractor)}
                              data-testid={`edit-contractor-${contractor.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(contractor.id)}
                              data-testid={`delete-contractor-${contractor.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Contractors;
