import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, API } from '../App';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';
import { ArrowLeft, Mail, Lock, User, Building, Eye, EyeOff, Users } from 'lucide-react';

const SignupPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register, user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [inviteCode, setInviteCode] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    organization_name: ''
  });

  // Check for invite code or prefilled email in URL
  useEffect(() => {
    const code = searchParams.get('invite');
    const prefillEmail = searchParams.get('email');
    if (prefillEmail) {
      setFormData(prev => ({ ...prev, email: prefillEmail }));
    }
    if (code) {
      setInviteCode(code);
      // If already logged in, accept invite directly
      if (token && user) {
        acceptInviteForExistingUser(code);
      } else {
        validateInvite(code);
      }
    }
  }, [searchParams, token, user]);

  const acceptInviteForExistingUser = async (code) => {
    try {
      const res = await axios.post(`${API}/organizations/invites/accept?invite_code=${code}`, {}, {
        headers: { Authorization: `Bearer ${token}` }, withCredentials: true
      });
      toast.success(res.data.message || 'Joined organisation');
      navigate('/dashboard');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not accept invite');
      validateInvite(code);
    }
  };

  const validateInvite = async (code) => {
    try {
      const response = await axios.get(`${API}/invites/validate/${code}`);
      setInviteInfo(response.data);
      // Pre-fill email if it's an email-specific invite
      if (response.data.email) {
        setFormData(prev => ({ ...prev, email: response.data.email }));
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid or expired invitation');
      setInviteCode(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const registerData = { ...formData };
      if (inviteCode) {
        registerData.invite_code = inviteCode;
        delete registerData.organization_name;
      }
      // Pass affiliate ref code from URL
      const refCode = searchParams.get('ref');
      if (refCode) registerData.ref_code = refCode;
      
      await register(registerData);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="p-6">
        <Link to="/" className="inline-flex items-center text-slate-600 hover:text-slate-900 transition-colors" data-testid="back-to-home">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to home
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md border-slate-200 shadow-lg" data-testid="signup-card">
          <CardHeader className="text-center pb-2">
            <img 
              src="/logo-horizontal.svg"
              alt="TAKO" 
              className="h-10 mx-auto mb-4"
            />
            <CardTitle className="text-2xl font-bold text-slate-900" data-testid="signup-title">
              {inviteInfo ? 'Join your team' : 'Create your account'}
            </CardTitle>
            <CardDescription className="text-slate-600">
              {inviteInfo ? `You've been invited to join ${inviteInfo.organization_name}` : 'Start your free trial — no credit card required'}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6 pt-4">
            {/* Invitation Banner */}
            {inviteInfo && (
              <div className="p-4 bg-purple-50 border border-purple-100 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#A100FF]/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#A100FF]" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Joining {inviteInfo.organization_name}</p>
                    <span className="text-sm text-slate-600">You'll be added as a <Badge variant="outline" className="ml-1">{inviteInfo.role}</Badge></span>
                  </div>
                </div>
              </div>
            )}

            {/* Google Signup */}
            <Button
              variant="outline"
              className="w-full h-12"
              onClick={handleGoogleSignup}
              data-testid="google-signup-btn"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-slate-500">or continue with email</span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-700">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    className="pl-10 h-12"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="name-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">Work Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    className="pl-10 h-12"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    data-testid="email-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    className="pl-10 pr-10 h-12"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={8}
                    data-testid="password-input"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="toggle-password"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Only show organization name if not joining via invite */}
              {!inviteInfo && (
                <div className="space-y-2">
                  <Label htmlFor="organization" className="text-slate-700">Organization Name <span className="text-slate-400">(optional)</span></Label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="organization"
                      type="text"
                      placeholder="Your Company"
                      className="pl-10 h-12"
                      value={formData.organization_name}
                      onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                      data-testid="organization-input"
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 bg-[#A100FF] hover:bg-purple-700"
                disabled={loading}
                data-testid="signup-submit-btn"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  inviteInfo ? `Join ${inviteInfo.organization_name}` : 'Create Account'
                )}
              </Button>
            </form>

            <p className="text-center text-xs text-slate-500">
              By signing up, you agree to our Terms of Service and Privacy Policy
            </p>

            <p className="text-center text-sm text-slate-600">
              Already have an account?{' '}
              <Link to="/login" className="text-[#A100FF] hover:text-purple-700 font-medium" data-testid="login-link">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default SignupPage;
