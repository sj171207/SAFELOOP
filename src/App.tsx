import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  AlertTriangle, 
  Shield, 
  BarChart3, 
  User as UserIcon, 
  Plus, 
  Bell,
  Navigation,
  LogOut,
  Camera,
  CheckCircle2,
  XCircle,
  Loader2,
  Menu,
  X,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format } from 'date-fns';
import { cn } from './lib/utils';
import { User, Report, SafetyAlert } from './types';
import { checkImageForAI, getSafetyAlerts } from './lib/gemini';

// --- Components ---

const getAddressFromCoords = async (lat: number, lng: number, apiKey: string) => {
  try {
    const res = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${apiKey}`);
    const data = await res.json();
    return data.features?.[0]?.properties?.formatted || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (err) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

const searchAddress = async (text: string, apiKey: string) => {
  try {
    const res = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(text)}&apiKey=${apiKey}`);
    const data = await res.json();
    if (data.features && data.features.length > 0) {
      const prop = data.features[0].properties;
      return {
        lat: prop.lat,
        lng: prop.lon,
        address: prop.formatted
      };
    }
    return null;
  } catch (err) {
    return null;
  }
};

const getAutocompleteSuggestions = async (text: string, apiKey: string) => {
  if (!text || text.length < 3) return [];
  try {
    const res = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&apiKey=${apiKey}&limit=5`);
    const data = await res.json();
    return data.features.map((f: any) => ({
      address: f.properties.formatted,
      lat: f.properties.lat,
      lng: f.properties.lon
    }));
  } catch (err) {
    console.error("Autocomplete error:", err);
    return [];
  }
};

const Navbar = ({ user, onLogout, activeTab, setActiveTab }: { 
  user: User | null, 
  onLogout: () => void, 
  activeTab: string, 
  setActiveTab: (tab: string) => void 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { id: 'map', label: 'Safety Map', icon: MapPin },
    { id: 'report', label: 'Report Hazard', icon: Plus },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'alerts', label: 'Live Alerts', icon: Bell },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/20 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 p-2 rounded-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">SafeLoop</span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
                activeTab === item.id 
                  ? "bg-emerald-50 text-emerald-700 font-medium" 
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-slate-900">{user.name}</p>
                <button onClick={onLogout} className="text-xs text-slate-500 hover:text-red-500">Logout</button>
              </div>
              <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full border-2 border-emerald-500" />
            </div>
          ) : (
            <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium">Sign In</button>
          )}
          <button className="md:hidden" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-slate-100 p-4 flex flex-col gap-2"
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-left",
                  activeTab === item.id ? "bg-emerald-50 text-emerald-700" : "text-slate-600"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const ReportForm = ({ user, onReportSuccess }: { user: User | null, onReportSuccess: () => void }) => {
  const [type, setType] = useState<Report['type']>('accident');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isCheckingAI, setIsCheckingAI] = useState(false);
  const [aiResult, setAiResult] = useState<{ isAI: boolean; reason: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [address, setAddress] = useState<string>('Detecting address...');
  const [manualAddress, setManualAddress] = useState('');
  const [suggestions, setSuggestions] = useState<{address: string, lat: number, lng: number}[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const geoapifyKey = process.env.GEOAPIFY_API_KEY || '';

  const refreshLocation = () => {
    setAddress('Detecting address...');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ lat, lng });
        const addr = await getAddressFromCoords(lat, lng, geoapifyKey);
        setAddress(addr);
      }, (err) => {
        console.error("Geolocation error:", err);
        setAddress("Location access denied. Please enable GPS.");
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
    }
  };

  useEffect(() => {
    refreshLocation();
  }, [geoapifyKey]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (manualAddress.length >= 3) {
        const results = await getAutocompleteSuggestions(manualAddress, geoapifyKey);
        setSuggestions(results);
      } else {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [manualAddress, geoapifyKey]);

  const handleSelectSuggestion = (s: {address: string, lat: number, lng: number}) => {
    setLocation({ lat: s.lat, lng: s.lng });
    setAddress(s.address);
    setManualAddress(s.address);
    setSuggestions([]);
  };

  const handleManualSearch = async () => {
    if (!manualAddress.trim()) return;
    setIsSearching(true);
    const result = await searchAddress(manualAddress, geoapifyKey);
    if (result) {
      setLocation({ lat: result.lat, lng: result.lng });
      setAddress(result.address);
      setSuggestions([]);
    } else {
      alert("Address not found. Please try a more specific location.");
    }
    setIsSearching(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setImage(base64);
        setIsCheckingAI(true);
        const result = await checkImageForAI(base64);
        setAiResult(result);
        setIsCheckingAI(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !location || !image || (aiResult?.isAI)) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          type,
          description,
          latitude: location.lat,
          longitude: location.lng,
          image_url: image,
          is_ai_generated: aiResult?.isAI
        })
      });
      if (res.ok) {
        onReportSuccess();
        setDescription('');
        setImage(null);
        setAiResult(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100"
    >
      <div className="bg-emerald-600 p-6 text-white">
        <h2 className="text-2xl font-bold">Report a Hazard</h2>
        <p className="text-emerald-100 text-sm mt-1">Help keep your community safe by reporting road issues.</p>
      </div>
      
      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(['accident', 'pothole', 'construction', 'weather', 'other'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                "py-3 px-4 rounded-xl border text-sm font-medium capitalize transition-all",
                type === t 
                  ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm" 
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the situation..."
            className="w-full h-32 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Media Upload</label>
          <div className="relative group">
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleImageUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className={cn(
              "w-full h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all",
              image ? "border-emerald-500 bg-emerald-50" : "border-slate-200 group-hover:border-slate-300 bg-slate-50"
            )}>
              {image ? (
                <img src={image} alt="Preview" className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <>
                  <div className="p-3 bg-white rounded-full shadow-sm">
                    <Camera className="w-6 h-6 text-slate-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-700">Click or drag to upload</p>
                    <p className="text-xs text-slate-500">Images or Videos (Max 10MB)</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {isCheckingAI && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 text-blue-700 rounded-xl animate-pulse">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">AI Safety Check in progress...</span>
          </div>
        )}

        {aiResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-4 rounded-xl flex items-start gap-3",
              aiResult.isAI ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
            )}
          >
            {aiResult.isAI ? <XCircle className="w-5 h-5 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 mt-0.5" />}
            <div>
              <p className="text-sm font-bold">{aiResult.isAI ? "AI Content Detected" : "Authenticity Verified"}</p>
              <p className="text-xs opacity-90 mt-0.5">{aiResult.reason}</p>
              {aiResult.isAI && (
                <p className="text-xs font-bold mt-2 uppercase tracking-wider">Warning: Please do not upload AI-generated hazards.</p>
              )}
            </div>
          </motion.div>
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Detected Location</p>
              <p className="text-sm font-medium text-slate-700">
                {address}
              </p>
              {location && (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  GPS: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </p>
              )}
            </div>
            <button 
              type="button"
              onClick={refreshLocation}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              title="Refresh GPS"
            >
              <Navigation className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="relative">
            <div className="flex gap-2">
              <input 
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="Wrong location? Search your address manually..."
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <button
                type="button"
                onClick={handleManualSearch}
                disabled={isSearching}
                className="bg-slate-900 text-white px-4 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
              </button>
            </div>

            <AnimatePresence>
              {suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 overflow-hidden"
                >
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectSuggestion(s)}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors flex items-start gap-3"
                    >
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      <span className="text-slate-700">{s.address}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <button
          type="submit"
          disabled={!location || !image || isCheckingAI || aiResult?.isAI || isSubmitting}
          className={cn(
            "w-full py-4 rounded-2xl font-bold text-white transition-all shadow-lg",
            (!location || !image || isCheckingAI || aiResult?.isAI || isSubmitting)
              ? "bg-slate-300 cursor-not-allowed shadow-none"
              : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
          )}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </span>
          ) : "Submit Report"}
        </button>
      </form>
    </motion.div>
  );
};

const SafetyMap = ({ reports }: { reports: Report[] }) => {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>({ lat: 0, lng: 0 });
  const [isLocating, setIsLocating] = useState(true);
  const rawKey = process.env.GEOAPIFY_API_KEY || '';
  const geoapifyKey = rawKey.includes('apiKey=') 
    ? new URLSearchParams(rawKey.split('?')[1]).get('apiKey') || rawKey
    : rawKey;
  const mapStyle = `https://maps.geoapify.com/v1/styles/osm-bright/style.json?apiKey=${geoapifyKey}`;

  const updateLocation = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsLocating(false);
      }, (err) => {
        console.error(err);
        setIsLocating(false);
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
    }
  };

  useEffect(() => {
    updateLocation();
  }, []);

  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'accident': return 'text-red-500';
      case 'pothole': return 'text-amber-500';
      case 'construction': return 'text-blue-500';
      default: return 'text-emerald-500';
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] rounded-3xl overflow-hidden shadow-2xl border border-white/20 relative">
      <Map
        initialViewState={{
          latitude: userLocation.lat,
          longitude: userLocation.lng,
          zoom: 13
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
      >
        <NavigationControl position="top-right" />
        
        {/* User Marker */}
        <Marker latitude={userLocation.lat} longitude={userLocation.lng}>
          <div className="relative">
            <div className="absolute -inset-4 bg-emerald-500/20 rounded-full animate-ping" />
            <div className="w-6 h-6 bg-emerald-600 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
              <Navigation className="w-3 h-3 text-white fill-current" />
            </div>
          </div>
        </Marker>

        {reports.map((report) => (
          <Marker
            key={report.id}
            latitude={report.latitude}
            longitude={report.longitude}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedReport(report);
            }}
          >
            <div className={cn("cursor-pointer transition-transform hover:scale-110", getMarkerColor(report.type))}>
              <MapPin className="w-8 h-8 fill-current stroke-white stroke-2" />
            </div>
          </Marker>
        ))}

        {selectedReport && (
          <Popup
            latitude={selectedReport.latitude}
            longitude={selectedReport.longitude}
            onClose={() => setSelectedReport(null)}
            closeButton={true}
            closeOnClick={false}
            anchor="bottom"
            className="z-50"
          >
            <div className="p-2 max-w-xs">
              <img src={selectedReport.image_url} alt="Report" className="w-full h-32 object-cover rounded-lg mb-2" />
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                  selectedReport.type === 'accident' ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                )}>
                  {selectedReport.type}
                </span>
                <span className="text-[10px] text-slate-400">{format(new Date(selectedReport.created_at), 'MMM d, h:mm a')}</span>
              </div>
              <p className="text-sm font-medium text-slate-800">{selectedReport.description}</p>
              <p className="text-[10px] text-slate-500 mt-1">Reported by {selectedReport.user_name}</p>
            </div>
          </Popup>
        )}
      </Map>

      {/* Floating Map Controls */}
      <div className="absolute top-6 left-6 flex flex-col gap-2">
        <div className="glass p-4 rounded-2xl shadow-lg border border-white/40 max-w-[240px]">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            SafeLoop Intelligence
          </h3>
          <p className="text-xs text-slate-500 mt-1">Showing real-time hazards within 30km radius.</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /> Accidents</span>
              <span className="font-bold text-slate-700">{reports.filter(r => r.type === 'accident').length}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /> Potholes</span>
              <span className="font-bold text-slate-700">{reports.filter(r => r.type === 'pothole').length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-10 right-6">
        <button 
          onClick={updateLocation}
          className={cn(
            "bg-emerald-600 text-white p-4 rounded-full shadow-2xl hover:bg-emerald-700 transition-all active:scale-95",
            isLocating && "animate-pulse"
          )}
        >
          {isLocating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Navigation className="w-6 h-6" />}
        </button>
      </div>
    </div>
  );
};

const Dashboard = ({ reports }: { reports: Report[] }) => {
  const stats = [
    { label: 'Total Reports', value: reports.length, icon: AlertTriangle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Verified Hazards', value: reports.filter(r => !r.is_ai_generated).length, icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Resolved Issues', value: reports.filter(r => r.status === 'resolved').length, icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'AI Fake Attempts', value: reports.filter(r => r.is_ai_generated).length, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  const chartData = [
    { name: 'Mon', count: 4 },
    { name: 'Tue', count: 7 },
    { name: 'Wed', count: 5 },
    { name: 'Thu', count: 12 },
    { name: 'Fri', count: 15 },
    { name: 'Sat', count: 8 },
    { name: 'Sun', count: 3 },
  ];

  const pieData = [
    { name: 'Accidents', value: reports.filter(r => r.type === 'accident').length },
    { name: 'Potholes', value: reports.filter(r => r.type === 'pothole').length },
    { name: 'Construction', value: reports.filter(r => r.type === 'construction').length },
    { name: 'Others', value: reports.filter(r => !['accident', 'pothole', 'construction'].includes(r.type)).length },
  ];

  const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];

  return (
    <div className="space-y-8 pb-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
          >
            <div className={cn("p-3 w-fit rounded-2xl mb-4", stat.bg)}>
              <stat.icon className={cn("w-6 h-6", stat.color)} />
            </div>
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Weekly Safety Trends</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981', strokeWidth: 3, stroke: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Hazard Distribution</h3>
          <div className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-bold text-slate-900">{reports.length}</span>
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Reports</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
          <button className="text-sm font-medium text-emerald-600 hover:text-emerald-700">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                <th className="px-6 py-4">Reporter</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {reports.slice(0, 5).map((report) => (
                <tr key={report.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                        {report.user_name?.[0]}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{report.user_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase",
                      report.type === 'accident' ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                    )}>
                      {report.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <div className={cn("w-1.5 h-1.5 rounded-full", report.status === 'pending' ? "bg-amber-500" : "bg-emerald-500")} />
                      <span className="text-xs font-medium text-slate-600 capitalize">{report.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400">
                    {format(new Date(report.created_at), 'MMM d, h:mm a')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AlertsPanel = ({ reports }: { reports: Report[] }) => {
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          const res = await getSafetyAlerts({ lat: pos.coords.latitude, lng: pos.coords.longitude }, reports);
          setAlerts(res.alerts);
          setIsLoading(false);
        });
      }
    };
    fetchAlerts();
  }, [reports]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Safety Alerts</h2>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          LIVE UPDATES
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
          <p className="text-slate-500 font-medium">Analyzing nearby road conditions...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.length > 0 ? alerts.map((alert, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "p-6 rounded-3xl border-l-8 shadow-sm flex items-start gap-4",
                alert.severity === 'high' ? "bg-red-50 border-red-500" : 
                alert.severity === 'medium' ? "bg-amber-50 border-amber-500" : "bg-blue-50 border-blue-500"
              )}
            >
              <div className={cn(
                "p-3 rounded-2xl",
                alert.severity === 'high' ? "bg-red-100 text-red-600" : 
                alert.severity === 'medium' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
              )}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">{alert.title}</h3>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                    alert.severity === 'high' ? "bg-red-200 text-red-800" : 
                    alert.severity === 'medium' ? "bg-amber-200 text-amber-800" : "bg-blue-200 text-blue-800"
                  )}>
                    {alert.severity} Risk
                  </span>
                </div>
                <p className="text-slate-600 mt-1 text-sm leading-relaxed">{alert.description}</p>
                <div className="mt-4 flex items-center gap-4">
                  <button className="flex items-center gap-2 text-xs font-bold text-emerald-600 hover:underline">
                    <Navigation className="w-3 h-3" /> SUGGEST NEW ROUTE
                  </button>
                  <button className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600">
                    <Info className="w-3 h-3" /> MORE DETAILS
                  </button>
                </div>
              </div>
            </motion.div>
          )) : (
            <div className="bg-emerald-50 p-12 rounded-3xl text-center border border-emerald-100">
              <Shield className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-emerald-900">All Clear!</h3>
              <p className="text-emerald-700 mt-2">No significant hazards detected in your 30km radius.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('map');
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      setReports(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initApp = async () => {
      await fetchReports();
      
      // Mock Login - Register user on server to prevent foreign key errors
      const mockUser = {
        id: 'user_123',
        email: 'sanjays171207@gmail.com',
        name: 'Sanjay S',
        picture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sanjay'
      };
      
      try {
        await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockUser)
        });
        setUser(mockUser);
      } catch (err) {
        console.error("Login failed:", err);
      }
    };
    
    initApp();
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-emerald-200 rounded-full animate-spin border-t-emerald-600" />
            <Shield className="absolute inset-0 m-auto w-6 h-6 text-emerald-600" />
          </div>
          <p className="text-slate-500 font-medium animate-pulse">Initializing SafeLoop...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-20">
      <Navbar 
        user={user} 
        onLogout={() => setUser(null)} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'map' && (
            <motion.div
              key="map"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <SafetyMap reports={reports} />
            </motion.div>
          )}

          {activeTab === 'report' && (
            <motion.div
              key="report"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ReportForm user={user} onReportSuccess={() => {
                fetchReports();
                setActiveTab('map');
              }} />
            </motion.div>
          )}

          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Dashboard reports={reports} />
            </motion.div>
          )}

          {activeTab === 'alerts' && (
            <motion.div
              key="alerts"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AlertsPanel reports={reports} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Quick Action Button */}
      {activeTab !== 'report' && (
        <button
          onClick={() => setActiveTab('report')}
          className="fixed bottom-8 right-8 bg-emerald-600 text-white p-5 rounded-full shadow-2xl hover:bg-emerald-700 transition-all hover:scale-110 active:scale-95 z-40 group"
        >
          <Plus className="w-8 h-8" />
          <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            REPORT HAZARD
          </span>
        </button>
      )}
    </div>
  );
}
