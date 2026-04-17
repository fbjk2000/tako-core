import { useT } from '../useT';
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, API } from '../App';
import { safeInternalPath } from '../utils/safeRedirect';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react';

const CHECKOUT_INTENT_KEY = 'tako_checkout_intent';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const { t } = useT();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(formData.email, formData.password);
      toast.success('Welcome back!');
      // Restore checkout intent if present, otherwise honour ProtectedRoute redirect or go to dashboard
      if (localStorage.getItem(CHECKOUT_INTENT_KEY)) {
        navigate('/pricing', { replace: true });
      } else {
        const rawFrom = location.state?.from?.pathname;
        const from = safeInternalPath(rawFrom, '/dashboard');
        navigate(from !== '/login' ? from : '/dashboard', { replace: true });
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API}/auth/google/login`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="p-6">
        <Link to="/" className="inline-flex items-center text-slate-600 hover:text-slate-900 transition-colors" data-testid="back-to-home">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('auth.backToSignIn')}
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md border-slate-200 shadow-lg" data-testid="login-card">
          <CardHeader className="text-center pb-2">
            <img 
              src="/logo-horizontal.svg" 
              alt="TAKO" 
              className="h-10 mx-auto mb-4"
            />
            <CardTitle className="text-2xl font-bold text-slate-900" data-testid="login-title">{ t('auth.welcomeBack') }</CardTitle>
            <CardDescription className="text-slate-600">{ t('auth.signInDesc') }</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6 pt-4">
            {/* Google Login */}
            <Button
              variant="outline"
              className="w-full h-12"
              onClick={handleGoogleLogin}
              data-testid="google-login-btn"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {t('auth.continueGoogle')}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-slate-500">{ t('auth.orEmail') }</span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">{ t('auth.email') }</Label>
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-700">{ t('auth.password') }</Label>
                  <Link to="/forgot-password" className="text-sm text-[#0EA5A0] hover:text-teal-700">{ t('auth.forgotPassword') }</Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-10 pr-10 h-12"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
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

              <Button
                type="submit"
                className="w-full h-12 bg-[#0EA5A0] hover:bg-teal-700"
                disabled={loading}
                data-testid="login-submit-btn"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  t('auth.signIn')
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-600">
              { t('auth.noAccount') }{' '}
              <Link to="/signup" className="text-[#0EA5A0] hover:text-teal-700 font-medium" data-testid="signup-link">
                {t('auth.signUpFree')}
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default LoginPage;
