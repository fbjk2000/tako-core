import { useT } from '../useT';
import React, { useState, useEffect } from 'react';
import { useAuth, API } from '../App';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Plus, Search, Target, CheckSquare, MessageSquare, Users, MoreVertical,
  Trash2, Edit2, Save, Calendar, X, Clock
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';

const ProjectsPage = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const { t } = useT();
  const [deals, setDeals] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [newProject, setNewProject] = useState({ name: '', description: '', deal_id: '', members: [] });
  // Task creation within project
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', assigned_to: '', due_date: '' });
  // Task detail view
  const [taskDetail, setTaskDetail] = useState(null);
  const [taskEditMode, setTaskEditMode] = useState(false);
  const [taskEditData, setTaskEditData] = useState({});
  const [newComment, setNewComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [taskTab, setTaskTab] = useState('subtasks');

  const getAx = () => ({ headers: { Authorization: `Bearer ${token}` }, withCredentials: true });

  useEffect(() => {
    if (!token) return;
    fetchProjects(); fetchDeals(); fetchMembers();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProjects = async () => {
    try { const r = await axios.get(`${API}/projects`, getAx()); setProjects(r.data); }
    catch { toast.error('Failed to load projects'); }
    finally { setLoading(false); }
  };
  const fetchDeals = async () => { try { const r = await axios.get(`${API}/deals`, getAx()); setDeals(r.data); } catch (err) { console.error(err); } };
  const fetchMembers = async () => {
    try {
      const orgRes = await axios.get(`${API}/organizations/current`, getAx());
      if (orgRes.data?.organization_id) {
        const r = await axios.get(`${API}/organizations/${orgRes.data.organization_id}/members`, getAx());
        setMembers(r.data || []);
      }
    } catch (err) { console.error(err); }
  };

  const handleCreate = async () => {
    if (!newProject.name.trim()) return;
    try {
      const payload = { ...newProject, deal_id: newProject.deal_id === 'none' ? null : newProject.deal_id || null };
      const r = await axios.post(`${API}/projects`, payload, getAx());
      toast.success('Project created');
      setShowCreate(false);
      setNewProject({ name: '', description: '', deal_id: '', members: [] });
      fetchProjects();
      openProject(r.data.project_id);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const openProject = async (id) => {
    try { const r = await axios.get(`${API}/projects/${id}`, getAx()); setSelectedProject(r.data); }
    catch { toast.error('Failed to load project'); }
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim() || !selectedProject) return;
    try {
      const payload = { ...newTask, project_id: selectedProject.project_id, related_deal_id: selectedProject.deal_id || undefined };
      if (!payload.due_date) delete payload.due_date;
      if (!payload.assigned_to) payload.assigned_to = user?.user_id;
      await axios.post(`${API}/tasks`, payload, getAx());
      toast.success('Task added');
      setShowAddTask(false);
      setNewTask({ title: '', description: '', priority: 'medium', assigned_to: '', due_date: '' });
      openProject(selectedProject.project_id);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const handleTaskStatus = async (taskId, status) => {
    try {
      await axios.put(`${API}/tasks/${taskId}`, { status }, getAx());
      openProject(selectedProject.project_id);
    } catch (err) { console.error(err); }
  };

  const handleDeleteProject = async (id) => {
    if (!window.confirm('Delete this project?')) return;
    try { await axios.delete(`${API}/projects/${id}`, getAx()); toast.success('Deleted'); setSelectedProject(null); fetchProjects(); }
    catch { toast.error('Failed'); }
  };

  const handleUpdateStatus = async (id, status) => {
    try { await axios.put(`${API}/projects/${id}`, { status }, getAx()); fetchProjects(); if (selectedProject?.project_id === id) openProject(id); }
    catch {}
  };

  const openTaskDetail = (task) => {
    setTaskDetail(task); setTaskEditData({ ...task }); setTaskEditMode(false); setTaskTab('subtasks'); setNewComment(''); setNewSubtask('');
  };

  const refreshTaskDetail = async (taskId) => {
    if (selectedProject) await openProject(selectedProject.project_id);
    try { const res = await axios.get(`${API}/tasks`, getAx()); const fresh = res.data.find(t => t.task_id === taskId); if (fresh) { setTaskDetail(fresh); setTaskEditData({ ...fresh }); } } catch (err) { console.error(err); }
  };

  const handleSaveTask = async () => {
    if (!taskDetail) return;
    try { const { task_id, organization_id, created_by, created_at, _id, subtasks, comments, activity, subtask_count, subtasks_done, ...updates } = taskEditData; await axios.put(`${API}/tasks/${taskDetail.task_id}`, updates, getAx()); toast.success('Task updated'); setTaskEditMode(false); refreshTaskDetail(taskDetail.task_id); } catch (err) { console.error(err); toast.error('Failed'); }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !taskDetail) return;
    try { await axios.post(`${API}/tasks/${taskDetail.task_id}/comments?content=${encodeURIComponent(newComment)}`, {}, getAx()); setNewComment(''); refreshTaskDetail(taskDetail.task_id); } catch (err) { console.error(err); }
  };

  const handleAddSubtaskDetail = async () => {
    if (!newSubtask.trim() || !taskDetail) return;
    try { await axios.post(`${API}/tasks/${taskDetail.task_id}/subtasks?title=${encodeURIComponent(newSubtask)}`, {}, getAx()); setNewSubtask(''); refreshTaskDetail(taskDetail.task_id); } catch (err) { console.error(err); }
  };

  const handleToggleSubtask = async (subId, done) => {
    if (!taskDetail) return;
    try { await axios.put(`${API}/tasks/${taskDetail.task_id}/subtasks/${subId}?done=${done}`, {}, getAx()); refreshTaskDetail(taskDetail.task_id); } catch (err) { console.error(err); }
  };

  const getDaysAgo = (dateStr) => { if (!dateStr) return null; return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000); };

  const handleReopenTask = async () => {
    if (!taskDetail) return;
    try { await axios.post(`${API}/tasks/${taskDetail.task_id}/reopen`, {}, getAx()); toast.success('Task reopened'); refreshTaskDetail(taskDetail.task_id); }
    catch (err) { console.error(err); toast.error('Failed'); }
  };



  const statusColors = { active: 'bg-emerald-100 text-emerald-700', on_hold: 'bg-amber-100 text-amber-700', completed: 'bg-blue-100 text-blue-700' };
  const priorityColors = { low: 'bg-slate-400', medium: 'bg-amber-400', high: 'bg-rose-500' };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="projects-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{ t('projects.title') }</h1>
            <p className="text-slate-500 text-sm mt-1">{ t('projects.subtitle') }</p>
          </div>
          <Button className="bg-[#0EA5A0] hover:bg-teal-700" onClick={() => setShowCreate(true)} data-testid="new-project-btn">
            <Plus className="w-4 h-4 mr-2" /> New Project
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin" /></div>
        ) : projects.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="font-medium text-slate-600">{ t('projects.noProjects') }</p>
            <p className="text-sm text-slate-400 mt-1">Create a project to organize tasks around a deal</p>
            <Button className="mt-4 bg-[#0EA5A0] hover:bg-teal-700" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" /> Create Project</Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(p => (
              <Card key={p.project_id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openProject(p.project_id)} data-testid={`project-card-${p.project_id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{p.name}</h3>
                      {p.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{p.description}</p>}
                    </div>
                    <Badge className={`${statusColors[p.status] || 'bg-slate-100'} text-xs`}>{p.status}</Badge>
                  </div>
                  <Progress value={p.progress} className="h-2 mb-2" />
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{p.tasks_done}/{p.task_count} tasks done</span>
                    <span>{p.progress}%</span>
                  </div>
                  {p.deal_id && <div className="mt-2 text-xs text-teal-600 bg-teal-50 px-2 py-0.5 rounded inline-block"><Target className="w-3 h-3 inline mr-1" />Linked deal</div>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Project Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle><Plus className="w-5 h-5 inline mr-2 text-[#0EA5A0]" />{ t('projects.newProject') }</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Project Name *</Label><Input value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} placeholder="Q2 Enterprise Onboarding" data-testid="project-name" /></div>
              <div><Label>Description</Label><Textarea value={newProject.description} onChange={e => setNewProject({ ...newProject, description: e.target.value })} rows={2} placeholder="Project goals and scope..." /></div>
              <div><Label>Link to Deal</Label>
                <Select value={newProject.deal_id || 'none'} onValueChange={v => setNewProject({ ...newProject, deal_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select deal" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">No deal</SelectItem>{deals.map(d => <SelectItem key={d.deal_id} value={d.deal_id}>{d.name} — €{d.value?.toLocaleString()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} className="w-full bg-[#0EA5A0] hover:bg-teal-700" data-testid="create-project-submit"><Plus className="w-4 h-4 mr-2" /> Create Project</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Project Detail Dialog */}
        <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
          <DialogContent className="max-w-3xl">
            {selectedProject && (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedProject.name}</h2>
                    {selectedProject.description && <p className="text-sm text-slate-500 mt-1">{selectedProject.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={selectedProject.status} onValueChange={v => handleUpdateStatus(selectedProject.project_id, v)}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="on_hold">On Hold</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteProject(selectedProject.project_id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1"><span>{selectedProject.tasks_done}/{selectedProject.task_count} tasks</span><span>{selectedProject.progress}%</span></div>
                  <Progress value={selectedProject.progress} className="h-2" />
                </div>

                {/* Linked Deal */}
                {selectedProject.deal && (
                  <div className="bg-teal-50 border border-teal-100 rounded-lg p-3 flex items-center justify-between">
                    <div><p className="text-sm font-medium text-teal-900"><Target className="w-4 h-4 inline mr-1" />{selectedProject.deal.name}</p><p className="text-xs text-teal-600">€{selectedProject.deal.value?.toLocaleString()} — {selectedProject.deal.stage}</p></div>
                    <Button size="sm" variant="outline" onClick={() => { setSelectedProject(null); navigate(`/deals`); }}>{ t('projects.viewDeal') }</Button>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button size="sm" className="bg-[#0EA5A0] hover:bg-teal-700" onClick={() => setShowAddTask(true)} data-testid="add-task-to-project"><Plus className="w-4 h-4 mr-1" />{ t('projects.addTask') }</Button>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedProject(null); navigate(`/chat?type=project&id=${selectedProject.project_id}`); }}><MessageSquare className="w-4 h-4 mr-1" />{ t('projects.projectChat') }</Button>
                </div>

                {/* Tasks */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-slate-700">Tasks</h3>
                  {selectedProject.tasks?.length === 0 ? (
                    <p className="text-sm text-slate-400 py-4 text-center">No tasks yet. Add one to get started.</p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {selectedProject.tasks?.map(task => {
                        const stale = getDaysAgo(task.updated_at) > 7;
                        const ownerName = task.assigned_to ? (members.find(m => m.user_id === task.assigned_to)?.name || 'Assigned') : 'Unassigned';
                        return (
                        <div key={task.task_id} className={`flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors ${stale ? 'border-amber-200 bg-amber-50/30' : ''}`} onClick={() => openTaskDetail(task)} data-testid={`project-task-${task.task_id}`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <button onClick={(e) => { e.stopPropagation(); handleTaskStatus(task.task_id, task.status === 'done' ? 'todo' : 'done'); }} className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${task.status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>
                              {task.status === 'done' && <CheckSquare className="w-3 h-3" />}
                            </button>
                            <div className="min-w-0">
                              <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'}`}>{task.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${priorityColors[task.priority] || 'bg-slate-400'}`} />
                                <span className="text-xs text-slate-500">{task.priority}</span>
                                <span className="text-xs text-[#0EA5A0] font-medium">{ownerName}</span>
                                {task.due_date && <span className="text-xs text-slate-400"><Calendar className="w-3 h-3 inline mr-0.5" />{new Date(task.due_date).toLocaleDateString()}</span>}
                                {task.subtasks?.length > 0 && <span className="text-xs text-slate-400"><CheckSquare className="w-3 h-3 inline mr-0.5" />{task.subtasks.filter(s => s.done).length}/{task.subtasks.length}</span>}
                                {task.comments?.length > 0 && <span className="text-xs text-slate-400"><MessageSquare className="w-3 h-3 inline mr-0.5" />{task.comments.length}</span>}
                                {stale && <Badge variant="outline" className="text-[10px] h-4 text-amber-600 border-amber-300">stale</Badge>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <Select value={task.status} onValueChange={v => handleTaskStatus(task.task_id, v)}>
                              <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="todo">To Do</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="done">Done</SelectItem></SelectContent>
                            </Select>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Members */}
                <div>
                  <h3 className="font-semibold text-sm text-slate-700 mb-2"><Users className="w-4 h-4 inline mr-1" /> Team ({selectedProject.members?.length || 0})</h3>
                  <div className="flex gap-2 flex-wrap">
                    {selectedProject.members?.map(mid => {
                      const m = members.find(x => x.user_id === mid);
                      return m ? <Badge key={mid} variant="outline" className="text-xs">{m.name}</Badge> : null;
                    })}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Task to Project Dialog */}
        <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Task to Project</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div><Label>Title *</Label><Input value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} placeholder="Task description" data-testid="project-task-title" /></div>
              <div><Label>Description</Label><Textarea value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Priority</Label>
                  <Select value={newTask.priority} onValueChange={v => setNewTask({ ...newTask, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Assign To</Label>
                  <Select value={newTask.assigned_to || 'self'} onValueChange={v => setNewTask({ ...newTask, assigned_to: v === 'self' ? '' : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="self">Myself</SelectItem>{members.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Due Date</Label><Input type="date" value={newTask.due_date} onChange={e => setNewTask({ ...newTask, due_date: e.target.value })} /></div>
              <Button onClick={handleAddTask} className="w-full bg-[#0EA5A0] hover:bg-teal-700" data-testid="submit-project-task"><Plus className="w-4 h-4 mr-2" />{ t('projects.addTask') }</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Task Detail Dialog (from within project) */}
      <Dialog open={!!taskDetail} onOpenChange={() => { setTaskDetail(null); setTaskEditMode(false); }}>
        <DialogContent className="max-w-lg">
          {taskDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{taskEditMode ? t('forms.editTask') : taskDetail.title}</span>
                  <div className="flex gap-1">
                    {!taskEditMode && taskDetail.status === 'done' && <Button size="sm" variant="outline" onClick={() => { handleReopenTask(); }}>{t('tasks.reopen')}</Button>}
                    {!taskEditMode && <Button size="sm" variant="outline" onClick={() => setTaskEditMode(true)}><Edit2 className="w-3.5 h-3.5 mr-1" />{t('common.edit')}</Button>}
                  </div>
                </DialogTitle>
              </DialogHeader>
              {taskEditMode ? (
                <div className="space-y-3 pt-2">
                  <div><Label>{t('forms.title')}</Label><Input value={taskEditData.title || ''} onChange={e => setTaskEditData({...taskEditData, title: e.target.value})} /></div>
                  <div><Label>{t('forms.description')}</Label><Textarea value={taskEditData.description || ''} onChange={e => setTaskEditData({...taskEditData, description: e.target.value})} rows={3} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t('forms.status')}</Label><Select value={taskEditData.status} onValueChange={v => setTaskEditData({...taskEditData, status: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todo">To Do</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="done">Done</SelectItem></SelectContent></Select></div>
                    <div><Label>{t('forms.priority')}</Label><Select value={taskEditData.priority} onValueChange={v => setTaskEditData({...taskEditData, priority: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select></div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSaveTask} className="bg-[#0EA5A0] hover:bg-[#0B8C88] text-white"><Save className="w-4 h-4 mr-2" />{t('common.save')}</Button>
                    <Button variant="outline" onClick={() => { setTaskEditMode(false); setTaskEditData({...taskDetail}); }}>{t('common.cancel')}</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  {taskDetail.description && <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">{t('forms.description')}</p><p className="text-sm text-slate-700 whitespace-pre-wrap">{taskDetail.description}</p></div>}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Status</p><p className="text-sm font-medium capitalize">{taskDetail.status?.replace('_', ' ')}</p></div>
                    <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Priority</p><div className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded-full ${priorityColors[taskDetail.priority]}`} /><span className="text-sm font-medium capitalize">{taskDetail.priority}</span></div></div>
                    {taskDetail.assigned_to && <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Owner</p><p className="text-sm font-medium">{members.find(m => m.user_id === taskDetail.assigned_to)?.name || 'Assigned'}</p></div>}
                    {taskDetail.due_date && <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Due</p><p className="text-sm font-medium">{new Date(taskDetail.due_date).toLocaleDateString()}</p></div>}
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 border-b">
                    {[['subtasks', t('tasks.subtasks')], ['comments', t('tasks.updates')], ['activity', t('tasks.history')]].map(([key, label]) => (
                      <button key={key} onClick={() => setTaskTab(key)} className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${taskTab === key ? 'border-[#0EA5A0] text-[#0EA5A0]' : 'border-transparent text-slate-500'}`}>{label}
                        {key === 'subtasks' && taskDetail.subtasks?.length > 0 && <span className="ml-1 text-xs bg-slate-100 px-1.5 rounded-full">{taskDetail.subtasks.filter(s=>s.done).length}/{taskDetail.subtasks.length}</span>}
                        {key === 'comments' && taskDetail.comments?.length > 0 && <span className="ml-1 text-xs bg-slate-100 px-1.5 rounded-full">{taskDetail.comments.length}</span>}
                      </button>
                    ))}
                  </div>

                  {taskTab === 'subtasks' && (
                    <div className="space-y-2">
                      {taskDetail.subtasks?.map(sub => (
                        <div key={sub.id} className="flex items-center gap-2 py-1.5">
                          <button onClick={() => handleToggleSubtask(sub.id, !sub.done)} className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${sub.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>{sub.done && <CheckSquare className="w-3 h-3" />}</button>
                          <span className={`text-sm ${sub.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{sub.title}</span>
                        </div>
                      ))}
                      {(!taskDetail.subtasks || taskDetail.subtasks.length === 0) && <p className="text-xs text-slate-400 py-2">{t('tasks.noSubtasks')}</p>}
                      <div className="flex gap-2 pt-2">
                        <Input value={newSubtask} onChange={e => setNewSubtask(e.target.value)} placeholder={t('tasks.addSubtask')} className="h-8 text-sm" onKeyDown={e => { if (e.key === 'Enter') handleAddSubtaskDetail(); }} />
                        <Button size="sm" onClick={handleAddSubtaskDetail} disabled={!newSubtask.trim()} className="h-8"><Plus className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  )}

                  {taskTab === 'comments' && (
                    <div className="space-y-3">
                      {taskDetail.comments?.length > 0 ? (
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {taskDetail.comments.map(c => (
                            <div key={c.id} className="bg-slate-50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1"><span className="text-xs font-medium text-slate-900">{c.by_name}</span><span className="text-xs text-slate-400">{new Date(c.at).toLocaleString()}</span></div>
                              <p className="text-sm text-slate-700">{c.content}</p>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-xs text-slate-400 py-2">{t('tasks.noUpdates')}</p>}
                      <div className="flex gap-2">
                        <Input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder={t('tasks.addComment')} className="h-8 text-sm" onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }} />
                        <Button size="sm" onClick={handleAddComment} disabled={!newComment.trim()} className="h-8"><MessageSquare className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  )}

                  {taskTab === 'activity' && (
                    <div className="max-h-[200px] overflow-y-auto">
                      {taskDetail.activity?.length > 0 ? (
                        <div className="space-y-1">
                          {[...taskDetail.activity].reverse().map((a, i) => (
                            <div key={i} className="flex items-start gap-2 py-1.5 text-xs">
                              <Clock className="w-3 h-3 text-slate-300 mt-0.5 shrink-0" />
                              <div>
                                <span className="font-medium text-slate-700">{a.by_name || 'System'}</span>{' '}
                                {a.action === 'created' && <span className="text-slate-500">{t('tasks.activity.created')}</span>}
                                {a.action === 'comment_added' && <span className="text-slate-500">{t('tasks.activity.commentAdded')}</span>}
                                {a.action === 'subtask_added' && <span className="text-slate-500">{t('tasks.activity.subtaskAdded')}: {a.detail}</span>}
                                {a.action === 'subtask_completed' && <span className="text-emerald-600">{t('tasks.activity.subtaskCompleted')}: {a.detail}</span>}
                                {a.action === 'reopened' && <span className="text-blue-600">{t('tasks.activity.reopened')}</span>}
                                {a.action?.endsWith('_changed') && <span className="text-slate-500">{t('tasks.activity.changed')} {a.action.replace('_changed', '')} to <span className="font-medium">{a.to}</span></span>}
                                <span className="text-slate-300 ml-2">{new Date(a.at).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-xs text-slate-400 py-2">{t('tasks.noActivity')}</p>}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ProjectsPage;
