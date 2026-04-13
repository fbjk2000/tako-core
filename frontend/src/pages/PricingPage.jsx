import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, API } from '../App';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Check,
  ArrowLeft,
  CreditCard,
  Shield,
  Zap,
  Tag,
  Users,
  Percent,
  Bitcoin
} from 'lucide-react';

const PricingPage = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [userCount, setUserCount] = useState(1);
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [useCrypto, setUseCrypto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validatingCode, setValidatingCode] = useState(false);
  const [unytStatus, setUnytStatus] = useState('');

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const plans = {
    monthly: {
      id: 'monthly',
      name: 'Pro Monthly',
      price: 15,
      interval: 'month',
      description: 'Pay monthly, cancel anytime'
    },
    annual: {
      id: 'annual',
      name: 'Pro Annual',
      price: 144,
      pricePerMonth: 12,
      interval: 'year',
      description: 'Save 20% with annual billing',
      discount: 20
    }
  };

  const calculatePricing = () => {
    const plan = plans[selectedPlan];
    const basePrice = plan.price * userCount;
    
    let discountAmount = 0;
    if (appliedDiscount) {
      discountAmount = basePrice * (appliedDiscount.discount_percentage / 100);
    }
    
    let cryptoDiscount = 0;
    if (useCrypto) {
      cryptoDiscount = (basePrice - discountAmount) * 0.05;
    }
    
    const netAmount = basePrice - discountAmount - cryptoDiscount;
    const vatRate = 20;
    const vatAmount = netAmount * (vatRate / 100);
    const totalAmount = netAmount + vatAmount;
    
    return {
      basePrice,
      discountAmount,
      cryptoDiscount,
      netAmount,
      vatRate,
      vatAmount,
      totalAmount,
      currency: useCrypto ? 'USD' : 'EUR'
    };
  };

  const validateDiscountCode = async () => {
    if (!discountCode.trim()) return;
    
    setValidatingCode(true);
    try {
      const response = await axios.post(`${API}/discount-codes/validate`, {
        code: discountCode.toUpperCase()
      });
      
      if (response.data.valid) {
        setAppliedDiscount(response.data.discount);
        toast.success(`Discount code applied: ${response.data.discount.discount_percentage}% off!`);
      } else {
        setAppliedDiscount(null);
        toast.error('Invalid or expired discount code');
      }
    } catch (error) {
      setAppliedDiscount(null);
      toast.error('Invalid discount code');
    } finally {
      setValidatingCode(false);
    }
  };

  const handleCheckout = async () => {
    if (!user) {
      toast.error('Please sign in to subscribe');
      navigate('/login');
      return;
    }

    setLoading(true);
    
    if (useCrypto) {
      // UNYT wallet payment
      try {
        if (!window.ethereum) { toast.error('Please install MetaMask or another Web3 wallet'); setLoading(false); return; }
        
        const { ethers } = await import('ethers');
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send('eth_requestAccounts', []);
        
        try {
          await provider.send('wallet_switchEthereumChain', [{ chainId: '0xa4b1' }]);
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            await provider.send('wallet_addEthereumChain', [{
              chainId: '0xa4b1', chainName: 'Arbitrum One',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://arb1.arbitrum.io/rpc'], blockExplorerUrls: ['https://arbiscan.io']
            }]);
          }
        }
        
        const signer = provider.getSigner();
        const wallet = await signer.getAddress();
        const pricing = calculatePricing();
        const unytAmount = pricing.totalAmount / 0.50;
        const unytWei = ethers.utils.parseUnits(unytAmount.toFixed(0), 18);
        
        setUnytStatus(`Sending ${unytAmount.toFixed(0)} UNYT...`);
        
        const erc20Abi = ['function transfer(address to, uint256 amount) returns (bool)'];
        const contract = new ethers.Contract('0x5305bF91163D97D0d93188611433F86D1bb69898', erc20Abi, signer);
        const tx = await contract.transfer('0xFf98458bEBA08e0a8967D45Ce216D9Ee5fdecD1A', unytWei);
        
        setUnytStatus('Transaction sent. Waiting for confirmation...');
        await tx.wait();
        
        toast.success('UNYT payment confirmed! Your subscription is being activated.');
        setUnytStatus('');
        navigate('/settings?tab=billing');
      } catch (err) {
        console.error(err);
        toast.error(err.reason || err.message || 'Transaction failed');
        setUnytStatus('');
      }
      setLoading(false);
      return;
    }

    // Stripe checkout
    try {
      const response = await axios.post(
        `${API}/subscriptions/checkout`,
        {
          plan_id: selectedPlan,
          user_count: userCount,
          discount_code: appliedDiscount?.code || null,
          use_crypto: false,
          origin_url: window.location.origin
        },
        { headers, withCredentials: true }
      );

      window.location.href = response.data.checkout_url;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create checkout session');
      setLoading(false);
    }
  };

  const pricing = calculatePricing();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="p-6">
        <Link to="/" className="inline-flex items-center text-slate-600 hover:text-slate-900 transition-colors" data-testid="back-link">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to home
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-slate-900 mb-4" data-testid="pricing-title">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-slate-600">
            Start free with up to 3 users. Pay only for additional team members.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Plan Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Plans */}
            <Card>
              <CardHeader>
                <CardTitle>Select Your Plan</CardTitle>
                <CardDescription>Choose between monthly or annual billing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(plans).map(([key, plan]) => (
                  <label
                    key={key}
                    htmlFor={`plan-${key}`}
                    className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      selectedPlan === key
                        ? 'border-[#0EA5A0] bg-teal-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    data-testid={`plan-${key}`}
                  >
                    <input
                      type="radio"
                      id={`plan-${key}`}
                      name="plan"
                      value={key}
                      checked={selectedPlan === key}
                      onChange={() => setSelectedPlan(key)}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-4">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedPlan === key ? 'border-[#0EA5A0]' : 'border-slate-300'
                      }`}>
                        {selectedPlan === key && (
                          <div className="w-3 h-3 rounded-full bg-[#0EA5A0]" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{plan.name}</p>
                        <p className="text-sm text-slate-500">{plan.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">
                        €{plan.pricePerMonth || plan.price}
                        <span className="text-sm font-normal text-slate-500">/user/month</span>
                      </p>
                      {plan.discount && (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          Save {plan.discount}%
                        </Badge>
                      )}
                    </div>
                  </label>
                ))}
              </CardContent>
            </Card>

            {/* User Count */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Team Size
                </CardTitle>
                <CardDescription>How many additional users do you need?</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setUserCount(Math.max(1, userCount - 1))}
                    data-testid="decrease-users"
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    value={userCount}
                    onChange={(e) => setUserCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 text-center text-lg font-semibold"
                    min={1}
                    data-testid="users-input"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setUserCount(userCount + 1)}
                    data-testid="increase-users"
                  >
                    +
                  </Button>
                </div>
                <p className="text-sm text-slate-500 mt-3">
                  <Check className="w-4 h-4 inline text-emerald-500 mr-1" />
                  First 3 users are always <strong>free</strong>. You're adding {userCount} paid user(s).
                </p>
              </CardContent>
            </Card>

            {/* Discount Code */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  Discount Code
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                    placeholder="Enter code"
                    className="flex-1"
                    data-testid="discount-code-input"
                  />
                  <Button
                    variant="outline"
                    onClick={validateDiscountCode}
                    disabled={validatingCode || !discountCode.trim()}
                    data-testid="apply-discount-btn"
                  >
                    {validatingCode ? 'Checking...' : 'Apply'}
                  </Button>
                </div>
                {appliedDiscount && (
                  <div className="mt-3 p-3 bg-emerald-50 rounded-lg flex items-center justify-between">
                    <span className="text-emerald-700 font-medium">
                      <Percent className="w-4 h-4 inline mr-1" />
                      {appliedDiscount.discount_percentage}% discount applied
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAppliedDiscount(null);
                        setDiscountCode('');
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* UNYT Token Payment Option */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bitcoin className="w-5 h-5" />
                  Pay with UNYT Token
                </CardTitle>
                <CardDescription>Get an additional 5% discount when paying with UNYT on Arbitrum</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">Enable UNYT Payment</p>
                    <p className="text-sm text-slate-500">Pay via MetaMask with UNYT tokens (Arbitrum)</p>
                  </div>
                  <Switch
                    checked={useCrypto}
                    onCheckedChange={setUseCrypto}
                    data-testid="crypto-toggle"
                  />
                </div>
                {useCrypto && (
                  <div className="mt-3 space-y-2">
                    <div className="p-3 bg-amber-50 rounded-lg">
                      <p className="text-amber-700 text-sm font-medium">
                        <Zap className="w-4 h-4 inline mr-1" />
                        5% discount applied. You will pay {(calculatePricing().totalAmount / 0.50).toFixed(0)} UNYT at EUR 0.50 per token.
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">Requires MetaMask or a compatible Web3 wallet connected to Arbitrum One.</p>
                    {unytStatus && <p className="text-sm text-[#0EA5A0] font-medium animate-pulse">{unytStatus}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Plan</span>
                    <span className="font-medium">{plans[selectedPlan].name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Users</span>
                    <span className="font-medium">{userCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="font-medium">€{pricing.basePrice.toFixed(2)}</span>
                  </div>
                  
                  {pricing.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount ({appliedDiscount?.discount_percentage}%)</span>
                      <span>-€{pricing.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {pricing.cryptoDiscount > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Crypto Discount (5%)</span>
                      <span>-€{pricing.cryptoDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between text-slate-500">
                    <span>UK VAT ({pricing.vatRate}%)</span>
                    <span>+€{pricing.vatAmount.toFixed(2)}</span>
                  </div>
                  
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-lg">
                      <span className="font-semibold">Total</span>
                      <span className="font-bold text-[#0EA5A0]" data-testid="total-price">
                        {useCrypto ? '$' : '€'}{pricing.totalAmount.toFixed(2)}
                        <span className="text-xs font-normal text-slate-500 block text-right">
                          /{selectedPlan === 'annual' ? 'year' : 'month'}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full h-12 bg-[#0EA5A0] hover:bg-teal-700"
                  onClick={handleCheckout}
                  disabled={loading}
                  data-testid="checkout-btn"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5 mr-2" />
                      {useCrypto ? 'Connect Wallet and Pay with UNYT' : 'Pay with Card'}
                    </>
                  )}
                </Button>

                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    Secure payment via Stripe
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Check className="w-4 h-4 text-emerald-500" />
                    14-day money-back guarantee
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Check className="w-4 h-4 text-emerald-500" />
                    Cancel anytime
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Features */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4">All plans include:</h3>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                'Unlimited leads & deals',
                'Deal pipeline with stages',
                'Task management',
                'AI lead scoring',
                'Email campaigns via Kit.com',
                'LinkedIn data import',
                'Team collaboration',
                'Analytics dashboard',
                'Pipeline reports',
                'Discount codes system',
                'Affiliate program',
                'Priority support'
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  {feature}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PricingPage;
