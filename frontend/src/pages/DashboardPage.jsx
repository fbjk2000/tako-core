import { useT } from '../useT';
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, API } from '../App';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { SmartSearch, AIEmailComposer } from '../components/AIAssistant';
import OnboardingChecklist from '../components/OnboardingChecklist';
import {
  Users,
  Target,
  CheckSquare,
  TrendingUp,
  Plus,
  ArrowRight,
  Zap,
  Sparkles
} from 'lucide-react';

const DashboardPage = () => {
  const { user, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const { t } = useT();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for payment status in URL
    const params = new URLSearchParams(location.search);
    const paymentStatus = params.get('payment');
    const sessionId = params.get('session_id');

    if (paymentStatus === 'success' && sessionId) {
      pollPaymentStatus(sessionId);
    }

    fetchStats();
  }, [location]);

  const pollPaymentStatus = async (sessionId) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/payments/status/${sessionId}`, {
        headers,
        withCredentials: true
      });
      
      if (response.data.payment_status === 'paid') {
        toast.success('Payment successful! Your subscription has been activated.');
      }
    } catch (error) {
      console.error('Payment status check error:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/dashboard/stats`, {
        headers,
        withCredentials: true
      });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Leads',
      value: stats?.total_leads || 0,
      icon: <Users className="w-5 h-5" />,
      color: 'bg-teal-100 text-[#0EA5A0]',
      link: '/leads'
    },
    {
      title: 'Active Deals',
      value: stats?.total_deals || 0,
      icon: <Target className="w-5 h-5" />,
      color: 'bg-emerald-100 text-emerald-600',
      link: '/deals'
    },
    {
      title: 'Open Tasks',
      value: stats?.total_tasks || 0,
      icon: <CheckSquare className="w-5 h-5" />,
      color: 'bg-amber-100 text-amber-600',
      link: '/tasks'
    },
    {
      title: 'Pipeline Value',
      value: `€${(stats?.deal_value || 0).toLocaleString()}`,
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'bg-rose-100 text-rose-600',
      link: '/deals'
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8" data-testid="dashboard-page">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="dashboard-title">
              {(() => {
                const hasActivity = (stats?.total_leads || 0) + (stats?.total_deals || 0) + (stats?.total_tasks || 0) > 0;
                const firstName = user?.name?.split(' ')[0] || 'there';
                return hasActivity ? `Welcome back, ${firstName}!` : `Welcome, ${firstName}!`;
              })()}
            </h1>
            <p className="text-slate-600 mt-1">
              {(stats?.total_leads || 0) + (stats?.total_deals || 0) + (stats?.total_tasks || 0) > 0
                ? "Here's what's happening with your sales today."
                : "Let's get your CRM set up — follow the checklist below to launch fast."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <SmartSearch onSelectResult={(type, item) => {
              if (type === 'lead') navigate(`/leads`);
              else if (type === 'deal') navigate(`/deals`);
              else if (type === 'task') navigate(`/tasks`);
            }} />
            <AIEmailComposer />
            <Link to="/leads">
              <Button variant="outline" data-testid="add-lead-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Lead
              </Button>
            </Link>
            <Link to="/deals">
              <Button className="bg-[#0EA5A0] hover:bg-teal-700" data-testid="create-deal-btn">
                <Plus className="w-4 h-4 mr-2" />
                Create Deal
              </Button>
            </Link>
          </div>
        </div>

        {/* Onboarding Checklist — auto-hides when dismissed */}
        <OnboardingChecklist />

        {/* AI Assistant Card */}
        <Card className="bg-gradient-to-r from-[#0EA5A0]/5 to-teal-50 border-teal-100">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0EA5A0] to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">AI Assistant Ready</h3>
                <p className="text-sm text-slate-600">Use Smart Search to find anything, or generate AI-powered emails in seconds.</p>
              </div>
              <div className="flex gap-2">
                <SmartSearch />
                <AIEmailComposer />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => (
            <Link key={index} to={stat.link}>
              <Card 
                className="hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                data-testid={`stat-card-${index}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center`}>
                      {stat.icon}
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                    <p className="text-sm text-slate-600">{stat.title}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Leads */}
          <Card data-testid="recent-leads-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">{ t('dashboard.recentLeads') }</CardTitle>
              <Link to="/leads">
                <Button variant="ghost" size="sm">View all</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : stats?.recent_leads?.length > 0 ? (
                <div className="space-y-3">
                  {stats.recent_leads.map((lead, index) => (
                    <div
                      key={lead.lead_id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/leads?detail=${lead.lead_id}`)}
                      data-testid={`recent-lead-${index}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                          <span className="text-[#0EA5A0] font-medium">
                            {lead.first_name?.[0]}{lead.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {lead.first_name} {lead.last_name}
                          </p>
                          <p className="text-sm text-slate-500">{lead.company || 'No company'}</p>
                        </div>
                      </div>
                      {lead.ai_score && (
                        <div className="flex items-center gap-1 text-sm">
                          <Zap className="w-4 h-4 text-amber-500" />
                          <span className="font-medium">{lead.ai_score}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600">No leads yet</p>
                  <Link to="/leads">
                    <Button variant="outline" size="sm" className="mt-3">
                      Add your first lead
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Tasks */}
          <Card data-testid="recent-tasks-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">{ t('dashboard.recentTasks') }</CardTitle>
              <Link to="/tasks">
                <Button variant="ghost" size="sm">View all</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : stats?.recent_tasks?.length > 0 ? (
                <div className="space-y-3">
                  {stats.recent_tasks.map((task, index) => (
                    <div
                      key={task.task_id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => navigate('/tasks')}
                      data-testid={`recent-task-${index}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          task.priority === 'high' ? 'bg-rose-500' :
                          task.priority === 'medium' ? 'bg-amber-500' : 'bg-slate-300'
                        }`} />
                        <div>
                          <p className="font-medium text-slate-900">{task.title}</p>
                          <p className="text-sm text-slate-500 capitalize">{task.status}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        task.status === 'done' ? 'bg-emerald-100 text-emerald-700' :
                        task.status === 'in_progress' ? 'bg-teal-100 text-teal-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600">No tasks yet</p>
                  <Link to="/tasks">
                    <Button variant="outline" size="sm" className="mt-3">
                      Create your first task
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions for new users */}
        {!user?.organization_id && (
          <Card className="bg-gradient-to-r from-teal-50 to-white border-teal-100" data-testid="setup-card">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-[#0EA5A0]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">Complete your setup</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Create an organization to start managing leads, deals, and collaborate with your team.
                  </p>
                </div>
                <Link to="/settings">
                  <Button className="bg-[#0EA5A0] hover:bg-teal-700" data-testid="setup-org-btn">
                    Set Up Organization
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
