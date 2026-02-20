import { useState, useEffect } from "react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { toast } from "sonner";
import { Save, Building, Key, Loader2, Lock, Eye, EyeOff } from "lucide-react";

const Settings = () => {
  const { isOwner, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: ""
  });
  const [settings, setSettings] = useState({
    company_name: "",
    company_address: "",
    company_phone: "",
    company_email: "",
    tax_rate: 0,
    facebook_api_token: "",
    facebook_page_id: ""
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get("/settings");
      setSettings(response.data);
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isOwner) {
      toast.error("Only owners can update settings");
      return;
    }

    setSaving(true);
    try {
      await api.put("/settings", {
        ...settings,
        tax_rate: parseFloat(settings.tax_rate) || 0
      });
      toast.success("Settings saved successfully");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings({ ...settings, [field]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl" data-testid="settings-page">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          {isOwner ? "Manage your store settings" : "View store settings"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Building className="h-5 w-5 text-accent" />
              </div>
              <div>
                <CardTitle className="font-heading text-lg">Company Information</CardTitle>
                <CardDescription>This information appears on invoices and estimates</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={settings.company_name}
                  onChange={(e) => handleChange("company_name", e.target.value)}
                  placeholder="Your Flooring Store"
                  disabled={!isOwner}
                  data-testid="company-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_email">Email</Label>
                <Input
                  id="company_email"
                  type="email"
                  value={settings.company_email}
                  onChange={(e) => handleChange("company_email", e.target.value)}
                  placeholder="contact@yourstore.com"
                  disabled={!isOwner}
                  data-testid="company-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_phone">Phone</Label>
                <Input
                  id="company_phone"
                  value={settings.company_phone}
                  onChange={(e) => handleChange("company_phone", e.target.value)}
                  placeholder="(555) 123-4567"
                  disabled={!isOwner}
                  data-testid="company-phone-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax_rate">Default Tax Rate (%)</Label>
                <Input
                  id="tax_rate"
                  type="number"
                  step="0.01"
                  value={settings.tax_rate}
                  onChange={(e) => handleChange("tax_rate", e.target.value)}
                  placeholder="0.00"
                  disabled={!isOwner}
                  data-testid="tax-rate-input"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="company_address">Address</Label>
                <Input
                  id="company_address"
                  value={settings.company_address}
                  onChange={(e) => handleChange("company_address", e.target.value)}
                  placeholder="123 Main St, City, State 12345"
                  disabled={!isOwner}
                  data-testid="company-address-input"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Facebook Lead Ads Integration (Owner Only) */}
        {isOwner && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Key className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="font-heading text-lg">Facebook Lead Ads Integration</CardTitle>
                  <CardDescription>Connect your Facebook page to automatically import leads</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-2">How to get your Facebook API credentials:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Facebook Developers</a></li>
                  <li>Create or select your app</li>
                  <li>Go to Settings &gt; Basic to get your App Token</li>
                  <li>Your Page ID can be found in your Facebook Page's About section</li>
                </ol>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="facebook_api_token">Facebook API Token</Label>
                  <Input
                    id="facebook_api_token"
                    type="password"
                    value={settings.facebook_api_token}
                    onChange={(e) => handleChange("facebook_api_token", e.target.value)}
                    placeholder="••••••••••••••••"
                    data-testid="facebook-token-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook_page_id">Facebook Page ID</Label>
                  <Input
                    id="facebook_page_id"
                    value={settings.facebook_page_id}
                    onChange={(e) => handleChange("facebook_page_id", e.target.value)}
                    placeholder="123456789012345"
                    data-testid="facebook-page-id-input"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{user?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <p className="font-medium capitalize">{user?.role}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        {isOwner && (
          <div className="flex justify-end">
            <Button 
              type="submit" 
              className="bg-accent hover:bg-accent/90"
              disabled={saving}
              data-testid="save-settings-button"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
        )}
      </form>
    </div>
  );
};

export default Settings;
