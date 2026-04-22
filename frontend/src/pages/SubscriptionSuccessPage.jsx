import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth, API } from '../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import {
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  ArrowRight,
  Download,
  Mail
} from 'lucide-react';

const SubscriptionSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [status, setStatus] = useState('loading'); // loading, success, failed, expired
  const [paymentData, setPaymentData] = useState(null);
  const [pollCount, setPollCount] = useState(0);

  const sessionId = searchParams.get('session_id');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (sessionId) {
      pollPaymentStatus();
    } else {
      setStatus('failed');
    }
  }, [sessionId]);

  const pollPaymentStatus = async () => {
    if (pollCount >= 10) {
      setStatus('expired');
      return;
    }

    try {
      const response = await axios.get(
        `${API}/subscriptions/status/${sessionId}`,
        { headers, withCredentials: true }
      );

      setPaymentData(response.data);

      if (response.data.payment_status === 'paid') {
        setStatus('success');
        toast.success('Payment confirmed. TAKO is yours.');
      } else if (response.data.status === 'expired') {
        setStatus('expired');
      } else {
        // Keep polling
        setPollCount(prev => prev + 1);
        setTimeout(pollPaymentStatus, 2000);
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      setPollCount(prev => prev + 1);
      setTimeout(pollPaymentStatus, 2000);
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center py-12">
            <Loader2 className="w-16 h-16 text-[#0EA5A0] animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Processing Payment</h2>
            <p className="text-slate-600">Please wait while we confirm your payment...</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Successful!</h2>
            <p className="text-slate-600 mb-8">
              Thank you for purchasing TAKO. Your invoice has been sent to your email.
            </p>

            {paymentData && (
              <div className="bg-slate-50 rounded-xl p-6 mb-8 text-left max-w-md mx-auto">
                <h3 className="font-semibold text-slate-900 mb-4">Payment Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Transaction ID</span>
                    <span className="font-mono text-slate-900">{paymentData.transaction_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Amount</span>
                    <span className="font-semibold text-slate-900">
                      {paymentData.currency?.toUpperCase()} {(paymentData.amount_total / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Status</span>
                    <span className="text-emerald-600 font-medium">Paid</span>
                  </div>
                  {paymentData.invoice_id && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Invoice</span>
                      <Link
                        to={`/settings?tab=billing`}
                        className="text-[#0EA5A0] hover:text-teal-700 font-medium"
                      >
                        View Invoice
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate('/dashboard')}
                className="bg-[#0EA5A0] hover:bg-teal-700"
                data-testid="go-to-dashboard"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/settings?tab=billing')}
                data-testid="view-invoice"
              >
                <FileText className="w-4 h-4 mr-2" />
                View Invoices
              </Button>
            </div>

            <div className="mt-8 p-4 bg-teal-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 text-teal-700">
                <Mail className="w-5 h-5" />
                <span>Invoice and Terms & Conditions have been sent to your email</span>
              </div>
            </div>
          </div>
        );

      case 'failed':
        return (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-12 h-12 text-rose-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Failed</h2>
            <p className="text-slate-600 mb-8">
              We couldn't process your payment. Please try again or contact support.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => navigate('/pricing')}
                className="bg-[#0EA5A0] hover:bg-teal-700"
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/support')}
              >
                Contact Support
              </Button>
            </div>
          </div>
        );

      case 'expired':
        return (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-12 h-12 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Session Expired</h2>
            <p className="text-slate-600 mb-8">
              Your checkout session has expired. Please start a new checkout.
            </p>
            <Button
              onClick={() => navigate('/pricing')}
              className="bg-[#0EA5A0] hover:bg-teal-700"
            >
              Return to Pricing
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-12">
      <Card className="w-full max-w-2xl" data-testid="subscription-success-card">
        <CardContent className="p-8">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionSuccessPage;
