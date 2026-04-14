import { useT } from '../useT';
import React, { useState, useEffect } from 'react';
import { useAuth, API } from '../App';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { Plus, MoreVertical, Calendar, Trash2, Filter, X, User, Edit2, Save, GripVertical, MessageSquare, CheckSquare, Clock, RotateCcw, LayoutGrid, List, Search, FolderOpen } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Badge } from '../components/ui/badge';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const TasksPage = () => {
  const { token, user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const { t } = useT();
  const [members, setMembers] = useState([]);
  const [viewMode, setViewMode] = useState('kanban');
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterDue, setFilterDue] = useState('');
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [taskStages, setTaskStages] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [newComment, setNewComment] = useState('');

  // Auto-open create dialog from cross-link navigation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') === 'true') {
      setIsAddDialogOpen(true);
      const lid = params.get('lead_id');
      if (lid) setNewTask(prev => ({...prev, related_lead_id: lid}));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);
  const [newSubtask, setNewSubtask] = useState('');
  const [detailTab, setDetailTab] = useState('details');

  const [newTask, setNewTask] = useState({
    title: '', description: '', status: 'todo', priority: 'medium',
    due_date: '', assigned_to: ''
  });

  const getAx = () => ({ headers: { Authorization: `Bearer ${token}` }, withCredentials: true });

  const defaultStatuses = [
    { id: 'todo', name: t('tasks.statuses.todo'), color: 'border-slate-300' },
    { id: 'in_progress', name: t('tasks.statuses.in_progress'), color: 'border-blue-400' },
    { id: 'done', name: t('tasks.statuses.done'), color: 'border-emerald-400' }
  ];
  const stageColors = ['border-slate-300', 'border-blue-400', 'border-amber-400', 'border-purple-400', 'border-emerald-400'];
  const statuses = taskStages.length > 0
    ? taskStages.map((s, i) => ({ id: s.id, name: s.name, color: stageColors[i % stageColors.length] }))
    : defaultStatuses;

  const priorities = [
    { value: 'low', label: 'Low', color: 'bg-slate-400' },
    { value: 'medium', label: 'Medium', color: 'bg-amber-400' },
    { value: 'high', label: 'High', color: 'bg-rose-500' }
  ];

  useEffect(() => { if (!token) return; fetchTasks(); fetchMembers(); fetchProjects(); fetchTaskStages(); }, [token, filterStatus, filterOwner, filterProject, filterPriority, filterDue, searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTasks = async () => {
    try {
      let url = `${API}/tasks`;
      const params = [];
      if (filterStatus) params.push(`status=${filterStatus}`);
      if (filterOwner) params.push(`assigned_to=${filterOwner}`);
      if (filterProject) params.push(`project_id=${filterProject}`);
      if (params.length) url += `?${params.join('&')}`;
      const res = await axios.get(url, getAx());
      setTasks(res.data);
    } catch { toast.error('Failed to load tasks'); }
    finally { setLoading(false); }
  };

  const fetchProjects = async () => {
    try {
      const res = await axios.get(`${API}/projects`, getAx());
      setProjects(res.data || []);
    } catch {}
  };

  const fetchTaskStages = async () => {
    try {
      const res = await axios.get(`${API}/settings/stages`, getAx());
      if (res.data?.task_stages?.length) setTaskStages(res.data.task_stages);
    } catch {}
  };

  const fetchMembers = async () => {
    try {
      const orgRes = await axios.get(`${API}/organizations/current`, getAx());
      if (orgRes.data?.organization_id) {
        const res = await axios.get(`${API}/organizations/${orgRes.data.organization_id}/members`, getAx());
        setMembers(res.data || []);
      }
    } catch (err) { console.error(err); }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    try {
      const data = { ...newTask };
      if (!data.due_date) delete data.due_date;
      if (!data.assigned_to) data.assigned_to = user?.user_id;
      await axios.post(`${API}/tasks`, data, getAx());
      toast.success('Task created');
      setIsAddDialogOpen(false);
      setNewTask({ title: '', description: '', status: 'todo', priority: 'medium', due_date: '', assigned_to: '' });
      fetchTasks();
    } catch { toast.error('Failed to create task'); }
  };

  const handleStatusChange = async (taskId, status) => {
    try {
      setTasks(prev => prev.map(t => t.task_id === taskId ? { ...t, status } : t));
      await axios.put(`${API}/tasks/${taskId}`, { status }, getAx());
      fetchTasks();
    } catch { toast.error('Failed'); }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await axios.delete(`${API}/tasks/${taskId}`, getAx());
      toast.success('Task deleted');
      setSelectedTask(null);
      fetchTasks();
    } catch { toast.error('Failed'); }
  };

  const handleSaveTask = async () => {
    if (!selectedTask) return;
    try {
      const { title, description, status, priority, due_date, assigned_to, related_lead_id, related_deal_id, project_id } = editData;
      const updates = { title, description, status, priority, assigned_to, related_lead_id, related_deal_id, project_id };
      if (due_date) updates.due_date = due_date;
      await axios.put(`${API}/tasks/${selectedTask.task_id}`, updates, getAx());
      toast.success('Task updated');
      setEditMode(false);
      fetchTasks();
      const updated = await axios.get(`${API}/tasks`, getAx());
      const fresh = updated.data.find(t => t.task_id === selectedTask.task_id);
      if (fresh) { setSelectedTask(fresh); setEditData(fresh); }
    } catch (err) { console.error(err); toast.error('Failed to update'); }
  };

  const openTaskDetail = (task) => {
    setSelectedTask(task);
    setEditData({ ...task });
    setEditMode(false);
    setDetailTab('details');
    setNewComment('');
    setNewSubtask('');
    // Refresh the task to get latest comments/subtasks
    refreshTask(task.task_id);
  };

  const refreshTask = async (taskId) => {
    try {
      const res = await axios.get(`${API}/tasks`, getAx());
      const fresh = res.data.find(t => t.task_id === taskId);
      if (fresh) { setSelectedTask(fresh); setEditData({ ...fresh }); }
    } catch (err) { console.error(err); }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTask) return;
    try {
      await axios.post(`${API}/tasks/${selectedTask.task_id}/comments?content=${encodeURIComponent(newComment)}`, {}, getAx());
      setNewComment('');
      refreshTask(selectedTask.task_id);
      fetchTasks();
    } catch { toast.error('Failed to add comment'); }
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.trim() || !selectedTask) return;
    try {
      await axios.post(`${API}/tasks/${selectedTask.task_id}/subtasks?title=${encodeURIComponent(newSubtask)}`, {}, getAx());
      setNewSubtask('');
      refreshTask(selectedTask.task_id);
      fetchTasks();
    } catch { toast.error('Failed to add subtask'); }
  };

  const handleToggleSubtask = async (subtaskId, done) => {
    if (!selectedTask) return;
    try {
      await axios.put(`${API}/tasks/${selectedTask.task_id}/subtasks/${subtaskId}?done=${done}`, {}, getAx());
      refreshTask(selectedTask.task_id);
      fetchTasks();
    } catch (err) { console.error(err); }
  };

  const handleReopenTask = async () => {
    if (!selectedTask) return;
    try {
      await axios.post(`${API}/tasks/${selectedTask.task_id}/reopen`, {}, getAx());
      toast.success('Task reopened');
      refreshTask(selectedTask.task_id);
      fetchTasks();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId;
    if (newStatus === result.source.droppableId) return;
    handleStatusChange(taskId, newStatus);
  };

  const filteredTasks = tasks.filter(task => {
    if (filterPriority && task.priority !== filterPriority) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterDue === 'overdue') return task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
    if (filterDue === 'today') { const d = new Date(task.due_date); const t = new Date(); return task.due_date && d.toDateString() === t.toDateString(); }
    if (filterDue === 'this_week') { const d = new Date(task.due_date); const now = new Date(); const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7); return task.due_date && d >= now && d <= weekEnd; }
    return true;
  });

  const getStatusTasks = (statusId) => filteredTasks.filter(t => t.status === statusId);
  const getOwnerName = (uid) => members.find(m => m.user_id === uid)?.name || 'Unknown';
  const hasFilters = filterStatus || filterOwner || filterProject || filterPriority || filterDue || searchQuery;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="tasks-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{ t('tasks.title') }</h1>
            <p className="text-slate-500 text-sm mt-1">{ t('tasks.subtitle') }</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border border-slate-200 rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('kanban')} className={`px-3 py-1.5 text-sm flex items-center gap-1 ${viewMode === 'kanban' ? 'bg-[#0EA5A0] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`} data-testid="kanban-view-btn">
                <LayoutGrid className="w-3.5 h-3.5" /> Kanban
              </button>
              <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 text-sm flex items-center gap-1 ${viewMode === 'list' ? 'bg-[#0EA5A0] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`} data-testid="list-view-btn">
                <List className="w-3.5 h-3.5" /> {t('deals.list')}
              </button>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0EA5A0] hover:bg-[#0B8C88] text-white" data-testid="add-task-btn">
                  <Plus className="w-4 h-4 mr-2" /> {t('forms.newTask')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
              <form onSubmit={handleAddTask} className="space-y-3 pt-2">
                <div><Label>{ t('common.create') }</Label><Input value={newTask.title} onChange={(e) => setNewTask({...newTask, title: e.target.value})} required data-testid="task-title" /></div>
                <div><Label>Description</Label><Textarea value={newTask.description} onChange={(e) => setNewTask({...newTask, description: e.target.value})} rows={2} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Priority</Label>
                    <Select value={newTask.priority} onValueChange={(v) => setNewTask({...newTask, priority: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{priorities.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Assign To</Label>
                    <Select value={newTask.assigned_to || 'self'} onValueChange={(v) => setNewTask({...newTask, assigned_to: v === 'self' ? '' : v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="self">Myself</SelectItem>{members.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Due Date</Label><Input type="date" value={newTask.due_date} onChange={(e) => setNewTask({...newTask, due_date: e.target.value})} /></div>
                <Button type="submit" className="w-full bg-[#0EA5A0] hover:bg-[#0B8C88] text-white" data-testid="submit-task">{ t('common.create') }</Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card className="px-4 py-3">
          <div className="space-y-2">
            {/* Row 1: search + stage + priority + project */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="relative flex-1 min-w-[140px] max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search tasks…"
                  data-testid="filter-search"
                  className="h-9 w-full pl-8 pr-3 text-sm rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5A0]/30 focus:border-[#0EA5A0]"
                />
              </div>
              <Select value={filterStatus || 'all'} onValueChange={(v) => setFilterStatus(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-32 h-9 flex-shrink-0" data-testid="filter-status"><SelectValue placeholder="All Stages" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Stages</SelectItem>{statuses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filterPriority || 'all'} onValueChange={(v) => setFilterPriority(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-36 h-9 flex-shrink-0" data-testid="filter-priority"><SelectValue placeholder="All Priorities" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />Low</span></SelectItem>
                  <SelectItem value="medium"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Medium</span></SelectItem>
                  <SelectItem value="high"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />High</span></SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterProject || 'all'} onValueChange={(v) => setFilterProject(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-36 h-9 flex-shrink-0" data-testid="filter-project"><SelectValue placeholder="All Projects" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(p => <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterDue || 'all'} onValueChange={(v) => setFilterDue(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-36 h-9 flex-shrink-0" data-testid="filter-due"><SelectValue placeholder="Any Due Date" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Due Date</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="today">Due Today</SelectItem>
                  <SelectItem value="this_week">Due This Week</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterOwner || 'all'} onValueChange={(v) => setFilterOwner(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-32 h-9 flex-shrink-0" data-testid="filter-owner"><SelectValue placeholder="All Owners" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Owners</SelectItem>{members.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
              {hasFilters && (
                <Button variant="ghost" size="sm" className="h-9 flex-shrink-0 text-slate-500" onClick={() => { setFilterStatus(''); setFilterOwner(''); setFilterProject(''); setFilterPriority(''); setFilterDue(''); setSearchQuery(''); }}>
                  <X className="w-3 h-3 mr-1" />Clear
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Kanban with DnD */}
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-[#0EA5A0] border-t-transparent rounded-full animate-spin" /></div>
        ) : viewMode === 'list' ? (
          /* List View */
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-slate-50">
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">{t('forms.title')}</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">{t('forms.status')}</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">{t('forms.priority')}</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">{t('forms.assignTo')}</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-slate-500">{t('forms.dueDate')}</th>
                  <th className="py-3 px-4 w-20"></th>
                </tr></thead>
                <tbody>
                  {filteredTasks.map(task => (
                    <tr key={task.task_id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => openTaskDetail(task)} data-testid={`task-list-${task.task_id}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${priorities.find(p => p.value === task.priority)?.color || 'bg-slate-400'}`} />
                          <span className="font-medium">{task.title}</span>
                          {task.subtask_count > 0 && <Badge variant="secondary" className="text-xs">{task.subtasks_done}/{task.subtask_count}</Badge>}
                          {task.comments?.length > 0 && <Badge variant="outline" className="text-xs">{task.comments.length} {t('tasks.updates').toLowerCase()}</Badge>}
                        </div>
                      </td>
                      <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                        <Select value={task.status} onValueChange={v => handleStatusChange(task.task_id, v)}>
                          <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{statuses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${task.priority === 'high' ? 'bg-rose-100 text-rose-700' : task.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{task.priority}</span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">{task.assigned_to ? getOwnerName(task.assigned_to) : '-'}</td>
                      <td className="py-3 px-4 text-xs text-slate-500">{task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}</td>
                      <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="text-red-500 h-7" onClick={() => handleDeleteTask(task.task_id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTasks.length === 0 && <p className="text-center text-slate-500 py-8">{t('tasks.dropHere')}</p>}
            </CardContent>
          </Card>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid md:grid-cols-3 gap-6">
              {statuses.map((status) => (
                <Droppable droppableId={status.id} key={status.id}>
                  {(provided, snapshot) => (
                    <div data-testid={`column-${status.id}`}>
                      <Card className={`border-t-4 ${status.color} ${snapshot.isDraggingOver ? 'ring-2 ring-[#0EA5A0]/20' : ''}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold">{status.name}</CardTitle>
                            <span className="text-xs bg-slate-100 px-2 py-1 rounded-full">{getStatusTasks(status.id).length}</span>
                          </div>
                        </CardHeader>
                        <CardContent ref={provided.innerRef} {...provided.droppableProps} className="space-y-3 min-h-[200px]">
                          {getStatusTasks(status.id).map((task, idx) => (
                            <Draggable key={task.task_id} draggableId={task.task_id} index={idx}>
                              {(provided, snapshot) => (
                                <div ref={provided.innerRef} {...provided.draggableProps}
                                  className={`bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow ${snapshot.isDragging ? 'shadow-lg ring-2 ring-[#0EA5A0]/20' : ''}`}
                                  data-testid={`task-card-${task.task_id}`}
                                >
                                  <div className="p-3">
                                    <div className="flex items-start gap-2">
                                      <div {...provided.dragHandleProps} className="mt-1 cursor-grab active:cursor-grabbing">
                                        <GripVertical className="w-4 h-4 text-slate-300" />
                                      </div>
                                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openTaskDetail(task)}>
                                        <div className="flex items-center gap-2 mb-1">
                                          <div className={`w-2 h-2 rounded-full ${priorities.find(p => p.value === task.priority)?.color || 'bg-slate-400'}`} />
                                          <p className="font-medium text-slate-900 text-sm truncate">{task.title}</p>
                                        </div>
                                        {task.description && <p className="text-xs text-slate-500 line-clamp-2">{task.description}</p>}
                                        {task.assigned_to && <div className="flex items-center gap-1 mt-2 text-xs text-[#0EA5A0]"><User className="w-3 h-3" />{getOwnerName(task.assigned_to)}</div>}
                                        {task.due_date && <div className="flex items-center gap-1 mt-1 text-xs text-slate-400"><Calendar className="w-3 h-3" />{new Date(task.due_date).toLocaleDateString()}</div>}
                                        {task.subtask_count > 0 && <div className="flex items-center gap-1 mt-1 text-xs text-slate-400"><CheckSquare className="w-3 h-3" />{task.subtasks_done}/{task.subtask_count}</div>}
                                        {task.comments?.length > 0 && <div className="flex items-center gap-1 mt-1 text-xs text-slate-400"><MessageSquare className="w-3 h-3" />{task.comments.length}</div>}
                                        {task.updated_at && Math.floor((Date.now() - new Date(task.updated_at).getTime()) / 86400000) > 7 && <Badge variant="outline" className="text-[10px] h-4 text-amber-600 border-amber-300 mt-1">stale</Badge>}
                                      </div>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"><MoreVertical className="w-3 h-3" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => { openTaskDetail(task); setEditMode(true); }}><Edit2 className="w-3 h-3 mr-2" />{ t('common.edit') }</DropdownMenuItem>
                                          {statuses.map(s => <DropdownMenuItem key={s.id} onClick={() => handleStatusChange(task.task_id, s.id)} disabled={s.id === task.status}>{ s.name }</DropdownMenuItem>)}
                                          <DropdownMenuItem className="text-rose-600" onClick={() => handleDeleteTask(task.task_id)}><Trash2 className="w-3 h-3 mr-2" />{ t('common.delete') }</DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          {getStatusTasks(status.id).length === 0 && <p className="text-center text-sm text-slate-400 py-8">{ t('tasks.dropHere') }</p>}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          </DragDropContext>
        )}
      </div>

      {/* Task Detail / Edit Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => { setSelectedTask(null); setEditMode(false); }}>
        <DialogContent className="max-w-lg">
          {selectedTask && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{ editMode ? t('common.edit') : selectedTask.title }</span>
                  <div className="flex gap-1">
                    {!editMode && selectedTask.status === 'done' && <Button size="sm" variant="outline" onClick={handleReopenTask} data-testid="reopen-task-btn"><RotateCcw className="w-3.5 h-3.5 mr-1" /> Reopen</Button>}
                    {!editMode && <Button size="sm" variant="outline" onClick={() => setEditMode(true)} data-testid="edit-task-btn"><Edit2 className="w-3.5 h-3.5 mr-1" /> Edit</Button>}
                  </div>
                </DialogTitle>
              </DialogHeader>
              {editMode ? (
                <div className="space-y-3 pt-2">
                  <div><Label>Title</Label><Input value={editData.title || ''} onChange={e => setEditData({...editData, title: e.target.value})} data-testid="edit-task-title" /></div>
                  <div><Label>Description</Label><Textarea value={editData.description || ''} onChange={e => setEditData({...editData, description: e.target.value})} rows={3} data-testid="edit-task-desc" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Status</Label>
                      <Select value={editData.status} onValueChange={v => setEditData({...editData, status: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{statuses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Priority</Label>
                      <Select value={editData.priority} onValueChange={v => setEditData({...editData, priority: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{priorities.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Assign To</Label>
                      <Select value={editData.assigned_to || 'none'} onValueChange={v => setEditData({...editData, assigned_to: v === 'none' ? null : v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="none">Unassigned</SelectItem>{members.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Due Date</Label><Input type="date" value={editData.due_date ? editData.due_date.split('T')[0] : ''} onChange={e => setEditData({...editData, due_date: e.target.value || null})} /></div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSaveTask} className="bg-[#0EA5A0] hover:bg-[#0B8C88] text-white" data-testid="save-task-btn"><Save className="w-4 h-4 mr-2" />{ t('common.save') }</Button>
                    <Button variant="outline" onClick={() => { setEditMode(false); setEditData({...selectedTask}); }}>{ t('common.cancel') }</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  {/* Description (stable) */}
                  {selectedTask.description && (
                    <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500 mb-1">{ t('common.description') || 'Description' }</p><p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedTask.description}</p></div>
                  )}
                  
                  {/* Info row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">{ t('tasks.statuses.todo') ? 'Status' : 'Status' }</p><p className="text-sm font-medium capitalize">{selectedTask.status?.replace('_', ' ')}</p></div>
                    <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">{ 'Prioritaet' }</p>
                      <div className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded-full ${priorities.find(p => p.value === selectedTask.priority)?.color}`} /><span className="text-sm font-medium capitalize">{selectedTask.priority}</span></div>
                    </div>
                    {selectedTask.assigned_to && <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Owner</p><p className="text-sm font-medium">{getOwnerName(selectedTask.assigned_to)}</p></div>}
                    {selectedTask.due_date && <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Due</p><p className="text-sm font-medium">{new Date(selectedTask.due_date).toLocaleDateString()}</p></div>}
                  </div>

                  {/* Tabs: Subtasks | Comments | Activity */}
                  <div className="flex gap-1 border-b">
                    {[['details', t('tasks.subtasks')], ['comments', t('tasks.updates')], ['activity', t('tasks.history')]].map(([key, label]) => (
                      <button key={key} onClick={() => setDetailTab(key)} className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${detailTab === key ? 'border-[#0EA5A0] text-[#0EA5A0]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{label}
                        {key === 'details' && selectedTask.subtasks?.length > 0 && <span className="ml-1 text-xs bg-slate-100 px-1.5 rounded-full">{selectedTask.subtasks_done || selectedTask.subtasks?.filter(s => s.done).length || 0}/{selectedTask.subtasks?.length}</span>}
                        {key === 'comments' && selectedTask.comments?.length > 0 && <span className="ml-1 text-xs bg-slate-100 px-1.5 rounded-full">{selectedTask.comments.length}</span>}
                      </button>
                    ))}
                  </div>

                  {/* Subtasks tab */}
                  {detailTab === 'details' && (
                    <div className="space-y-2">
                      {selectedTask.subtasks?.map(sub => (
                        <div key={sub.id} className="flex items-center gap-2 py-1.5">
                          <button onClick={() => handleToggleSubtask(sub.id, !sub.done)} className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${sub.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-slate-400'}`}>
                            {sub.done && <CheckSquare className="w-3 h-3" />}
                          </button>
                          <span className={`text-sm ${sub.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{sub.title}</span>
                        </div>
                      ))}
                      {(!selectedTask.subtasks || selectedTask.subtasks.length === 0) && <p className="text-xs text-slate-400 py-2">{ t('tasks.noSubtasks') }</p>}
                      <div className="flex gap-2 pt-2">
                        <Input value={newSubtask} onChange={e => setNewSubtask(e.target.value)} placeholder={t('tasks.addSubtask')} className="h-8 text-sm" onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); }} data-testid="add-subtask-input" />
                        <Button size="sm" onClick={handleAddSubtask} disabled={!newSubtask.trim()} className="h-8" data-testid="add-subtask-btn"><Plus className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  )}

                  {/* Comments/Updates tab */}
                  {detailTab === 'comments' && (
                    <div className="space-y-3">
                      {selectedTask.comments?.length > 0 ? (
                        <div className="space-y-2 max-h-[250px] overflow-y-auto">
                          {selectedTask.comments.map(c => (
                            <div key={c.id} className="bg-slate-50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-slate-900">{c.by_name}</span>
                                <span className="text-xs text-slate-400">{new Date(c.at).toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-slate-700">{c.content}</p>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-xs text-slate-400 py-2">{ t('tasks.noUpdates') }</p>}
                      <div className="flex gap-2">
                        <Input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder={t('tasks.addComment')} className="h-8 text-sm" onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }} data-testid="add-comment-input" />
                        <Button size="sm" onClick={handleAddComment} disabled={!newComment.trim()} className="h-8" data-testid="add-comment-btn"><MessageSquare className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  )}

                  {/* Activity/History tab */}
                  {detailTab === 'activity' && (
                    <div className="max-h-[300px] overflow-y-auto">
                      {selectedTask.activity?.length > 0 ? (
                        <div className="space-y-1">
                          {[...selectedTask.activity].reverse().map((a, i) => (
                            <div key={i} className="flex items-start gap-2 py-1.5 text-xs">
                              <Clock className="w-3 h-3 text-slate-300 mt-0.5 shrink-0" />
                              <div>
                                <span className="font-medium text-slate-700">{a.by_name || 'System'}</span>
                                {' '}
                                {a.action === 'created' && <span className="text-slate-500">{ t('tasks.activity.created') }</span>}
                                {a.action === 'comment_added' && <span className="text-slate-500">{ t('tasks.activity.commentAdded') }</span>}
                                {a.action === 'subtask_added' && <span className="text-slate-500">added subtask: {a.detail}</span>}
                                {a.action === 'subtask_completed' && <span className="text-emerald-600">completed: {a.detail}</span>}
                                {a.action === 'subtask_reopened' && <span className="text-amber-600">unchecked: {a.detail}</span>}
                                {a.action === 'reopened' && <span className="text-blue-600">{ t('tasks.activity.reopened') }</span>}
                                {a.action?.endsWith('_changed') && <span className="text-slate-500">changed {a.action.replace('_changed', '')} from <span className="text-slate-400">{a.from || 'none'}</span> to <span className="font-medium">{a.to}</span></span>}
                                <span className="text-slate-300 ml-2">{new Date(a.at).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-xs text-slate-400 py-2">{ t('tasks.noActivity') }</p>}
                    </div>
                  )}

                  {/* Bottom actions */}
                  <div className="flex gap-2 pt-1 border-t">
                    <Button size="sm" variant="outline" className="text-red-500" onClick={() => handleDeleteTask(selectedTask.task_id)}><Trash2 className="w-3.5 h-3.5 mr-1" /> { t('common.delete') }</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default TasksPage;
