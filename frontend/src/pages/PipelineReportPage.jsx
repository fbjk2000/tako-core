import { useT } from '../useT';
import React, { useState, useEffect } from 'react';
import { useAuth, API } from '../App';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  BarChart3, 
  TrendingUp, 
  Euro, 
  Users, 
  Target,
  RefreshCw,
  Calendar,
  Percent,
  Lock
} from 'lucide-react';

const PipelineReportPage = () => {
  const { token, user } = useAuth();
  const [pipelineData, setPipelineData] = useState(null);
  const { t } = useT();
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const isAdmin = ['admin', 'owner', 'super_admin'].includes(user?.role);

  useEffect(() => {
    fetchPipelineReport();
    if (isAdmin) {
      fetchTeamSummary();
    }
  }, []);

  const fetchPipelineReport = async () => {
    try {
      const response = await axios.get(`${API}/pipeline/report`, {
        headers,
        withCredentials: true
      });
      setPipelineData(response.data);
    } catch (error) {
      toast.error(t('pipeline.toastFetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamSummary = async () => {
    try {
      const response = await axios.get(`${API}/pipeline/team-summary`, {
        headers,
        withCredentials: true
      });
      setTeamData(response.data);
    } catch (error) {
      // silent
    }
  };

  const getStageColor = (stageId) => {
    const colors = {
      lead: 'bg-slate-100 text-slate-700',
      qualified: 'bg-teal-100 text-teal-700',
      proposal: 'bg-amber-100 text-amber-700',
      negotiation: 'bg-teal-100 text-teal-700',
      won: 'bg-emerald-100 text-emerald-700',
      lost: 'bg-rose-100 text-rose-700'
    };
    return colors[stageId] || 'bg-slate-100 text-slate-700';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="pipeline-report-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2" data-testid="pipeline-title">
              <BarChart3 className="w-6 h-6" />
              {t('pipeline.title')}
            </h1>
            <p className="text-slate-600 mt-1">
              {pipelineData?.is_admin_view
                ? t('pipeline.adminViewDesc')
                : t('pipeline.personalViewDesc')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(() => {
              const teamSize = teamData?.members?.length || 0;
              // Only show view-scope badges when there's a real team (>1 member).
              // Single-seat users don't need an "Admin View" / "Personal View" label.
              const hasTeam = teamSize > 1 || (!isAdmin && !!user?.organization_id);
              if (!hasTeam) return null;
              return pipelineData?.is_admin_view ? (
                <Badge className="bg-[#0EA5A0]">
                  <Users className="w-3 h-3 mr-1" />
                  {t('pipeline.adminView')}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-slate-500">
                  <Lock className="w-3 h-3 mr-1" />
                  {t('pipeline.personalView')}
                </Badge>
              );
            })()}
            <Button variant="outline" onClick={() => { fetchPipelineReport(); if(isAdmin) fetchTeamSummary(); }} data-testid="refresh-btn">
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('pipeline.refresh')}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card data-testid="total-value-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                  <Euro className="w-6 h-6 text-[#0EA5A0]" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('pipeline.totalPipelineValue')}</p>
                  <p className="text-2xl font-bold text-slate-900">
                    €{(pipelineData?.total_value || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="weighted-value-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('pipeline.weightedValue')}</p>
                  <p className="text-2xl font-bold text-slate-900">
                    €{(pipelineData?.weighted_value || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="deals-count-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('pipeline.totalDeals')}</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {pipelineData?.deals?.length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="stages" className="space-y-6">
          <TabsList data-testid="report-tabs">
            <TabsTrigger value="stages">{t('pipeline.tabByStage')}</TabsTrigger>
            <TabsTrigger value="deals">{t('pipeline.tabAllDeals')}</TabsTrigger>
            {isAdmin && (teamData?.members?.length || 0) > 1 && (
              <TabsTrigger value="team">{t('pipeline.tabTeamSummary')}</TabsTrigger>
            )}
          </TabsList>

          {/* Stages Tab */}
          <TabsContent value="stages">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pipelineData?.stages?.map((stage, index) => (
                <Card key={stage.id} data-testid={`stage-card-${stage.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge className={getStageColor(stage.id)}>{stage.name}</Badge>
                      <span className="text-sm text-slate-500">{t('pipeline.dealsCount').replace('{count}', stage.count)}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">{t('pipeline.totalValue')}</span>
                        <span className="font-bold text-slate-900">
                          €{stage.value.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">{t('pipeline.weightedValue')}</span>
                        <span className="font-semibold text-emerald-600">
                          €{stage.weighted_value.toLocaleString(undefined, {maximumFractionDigits: 0})}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-teal-500 rounded-full transition-all"
                            style={{ 
                              width: `${pipelineData.total_value > 0 
                                ? (stage.value / pipelineData.total_value * 100) 
                                : 0}%` 
                            }}
                          />
                        </div>
                        <p className="text-xs text-slate-400 mt-1 text-right">
                          {t('pipeline.percentOfPipeline').replace('{pct}', pipelineData.total_value > 0
                            ? (stage.value / pipelineData.total_value * 100).toFixed(1)
                            : 0)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Deals Tab */}
          <TabsContent value="deals">
            <Card>
              <CardHeader>
                <CardTitle>{t('pipeline.allDealsTitle')}</CardTitle>
                <CardDescription>
                  {pipelineData?.is_admin_view
                    ? t('pipeline.allDealsDescAdmin')
                    : t('pipeline.allDealsDescPersonal')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pipelineData?.deals?.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">{t('pipeline.noDealsFound')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full" data-testid="deals-table">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('pipeline.colDeal')}</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('pipeline.colStage')}</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('pipeline.colValue')}</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('pipeline.colProbability')}</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('pipeline.colWeighted')}</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('pipeline.colCloseDate')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pipelineData?.deals?.map((deal, index) => (
                          <tr 
                            key={deal.deal_id} 
                            className="border-b border-slate-100 hover:bg-slate-50"
                            data-testid={`deal-row-${index}`}
                          >
                            <td className="py-3 px-4">
                              <p className="font-medium text-slate-900">{deal.name}</p>
                              {deal.tags && deal.tags.length > 0 && (
                                <div className="flex gap-1 mt-1">
                                  {deal.tags.slice(0, 2).map((tag, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">{tag}</Badge>
                                  ))}
                                  {deal.tags.length > 2 && (
                                    <Badge variant="outline" className="text-xs">+{deal.tags.length - 2}</Badge>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={getStageColor(deal.stage)}>
                                {deal.stage}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              €{(deal.value || 0).toLocaleString()}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1">
                                <Percent className="w-3 h-3 text-slate-400" />
                                <span className={`font-medium ${
                                  (deal.probability || 0) >= 70 ? 'text-emerald-600' :
                                  (deal.probability || 0) >= 40 ? 'text-amber-600' : 'text-slate-600'
                                }`}>
                                  {deal.probability || 0}%
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-emerald-600 font-medium">
                              €{((deal.value || 0) * ((deal.probability || 0) / 100)).toLocaleString(undefined, {maximumFractionDigits: 0})}
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-500">
                              {deal.expected_close_date ? (
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(deal.expected_close_date).toLocaleDateString()}
                                </div>
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Tab (Admin Only) */}
          {isAdmin && (
            <TabsContent value="team">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    {t('pipeline.teamSummaryTitle')}
                  </CardTitle>
                  <CardDescription>{t('pipeline.teamSummaryDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {!teamData?.members?.length ? (
                    <p className="text-center text-slate-500 py-8">{t('pipeline.noTeamData')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full" data-testid="team-table">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('pipeline.colTeamMember')}</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('pipeline.colDeals')}</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('pipeline.totalValue')}</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('pipeline.weightedValue')}</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('pipeline.colWonValue')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamData.members.map((member, index) => (
                            <tr 
                              key={member.user_id} 
                              className="border-b border-slate-100 hover:bg-slate-50"
                              data-testid={`team-row-${index}`}
                            >
                              <td className="py-3 px-4">
                                <p className="font-medium text-slate-900">{member.name}</p>
                                <p className="text-xs text-slate-500">{member.email}</p>
                              </td>
                              <td className="py-3 px-4">
                                <span className="bg-teal-100 text-teal-700 px-2 py-1 rounded-full text-sm font-medium">
                                  {member.deal_count}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-900">
                                €{member.total_value.toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-emerald-600 font-medium">
                                €{member.weighted_value.toLocaleString(undefined, {maximumFractionDigits: 0})}
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-emerald-600 font-bold">
                                  €{member.won_value.toLocaleString()}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default PipelineReportPage;
