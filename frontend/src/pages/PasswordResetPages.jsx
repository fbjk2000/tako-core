import { useT } from '../useT';
import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const { t } = useT();
  const [sent, setSent] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNotFound(false);
    setLoading(true);
    try {
      await axios.post(`${API}/auth/forgot-password?email=${encodeURIComponent(email)}`);
      setSent(true);
    } catch (err) {
      if (err.response?.data?.detail === 'no_account') {
        setNotFound(true);
      } else {
        toast.error('Something went wrong.');
      }
    }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/"><img src="/logo-horizontal.svg" alt="TAKO" className="h-7 mx-auto mb-4" /></Link>
          <CardTitle style={{ fontFamily: "'Syne'" }}>{sent ? 'Check your email' : 'Reset your password'}</CardTitle>
          <CardDescription>{sent ? `We sent a reset link to ${email}` : 'Enter your email and we will send you a reset link.'}</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-slate-600">Did not receive it? Check your spam folder or try again.</p>
              <Button variant="outline" onClick={() => setSent(false)} className="w-full">{ t('auth.tryAgain') }</Button>
              <Link to="/login"><Button variant="ghost" className="w-full">{ t('auth.backToSignIn') }</Button></Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setNotFound(false); }} required placeholder="you@company.com" />
              </div>
              {notFound && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                  <p className="text-sm text-amber-800 font-medium mb-1">{ t('auth.noAccountFound') }</p>
                  <p className="text-xs text-amber-600 mb-3">You need an account before you can reset your password.</p>
                  <Link to={`/signup?email=${encodeURIComponent(email)}`}>
                    <Button size="sm" className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs">{ t('auth.signUpWith') }</Button>
                  </Link>
                </div>
              )}
              <Button type="submit" disabled={loading} className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white">
                {loading ? 'Sending...' : 'Send reset link'}
              </Button>
              <Link to="/login"><Button variant="ghost" className="w-full">{ t('auth.backToSignIn') }</Button></Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const { t } = useT();
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { toast.error('Passwords do not match.'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/auth/reset-password?token=${encodeURIComponent(token)}&new_password=${encodeURIComponent(password)}`);
      setDone(true);
      toast.success('Password reset successfully.');
    } catch (e) { toast.error(e.response?.data?.detail || 'Reset failed.'); }
    finally { setLoading(false); }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <p className="text-slate-600">Invalid reset link.</p>
          <Link to="/forgot-password"><Button className="mt-4">Request a new link</Button></Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/"><img src="/logo-horizontal.svg" alt="TAKO" className="h-7 mx-auto mb-4" /></Link>
          <CardTitle style={{ fontFamily: "'Syne'" }}>{done ? 'Password reset' : 'Set new password'}</CardTitle>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-slate-600">Your password has been updated. You can now sign in.</p>
              <Link to="/login"><Button className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white">Sign in</Button></Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>New password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="At least 6 characters" /></div>
              <div><Label>Confirm password</Label><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Type it again" /></div>
              <Button type="submit" disabled={loading} className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white">
                {loading ? 'Resetting...' : 'Reset password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
