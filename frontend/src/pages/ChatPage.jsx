import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth, API } from '../App';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Send,
  Hash,
  Plus,
  Users,
  Search,
  MoreVertical,
  Smile,
  Reply,
  Edit,
  Trash2,
  AtSign,
  MessageSquare,
  Bell,
  Check,
  CheckCheck,
  Loader2,
  UserCircle,
  Target,
  CheckSquare,
  Building,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Archive
} from 'lucide-react';

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👀'];

// Channel type icons and colors
const CHANNEL_CONFIG = {
  general: { icon: Hash, color: 'text-slate-600', bg: 'bg-slate-100' },
  lead: { icon: UserCircle, color: 'text-blue-600', bg: 'bg-blue-100' },
  deal: { icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  task: { icon: CheckSquare, color: 'text-orange-600', bg: 'bg-orange-100' },
  project: { icon: Hash, color: 'text-teal-600', bg: 'bg-teal-100' },
  company: { icon: Building, color: 'text-teal-600', bg: 'bg-teal-100' }
};

const ChatPage = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [channels, setChannels] = useState([]);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [contextEntity, setContextEntity] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showNewChannelDialog, setShowNewChannelDialog] = useState(false);
  const [newChannel, setNewChannel] = useState({ name: '', description: '' });
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({});
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const getH = () => token ? { Authorization: `Bearer ${token}` } : {};

  const toggleSection = (section) => setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));

  const archiveChannel = async (channelId) => {
    try {
      await axios.put(`${API}/chat/channels/${channelId}/archive`, {}, { headers: getH(), withCredentials: true });
      toast.success('Channel archived');
      setActiveChannel(null);
      fetchChannels();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to archive');
    }
  };

  // Load contextual channel from URL params
  const loadContextualChannel = useCallback(async (contextType, contextId) => {
    if (!token) return;
    try {
      const response = await axios.get(`${API}/chat/context/${contextType}/${contextId}`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      setActiveChannel(response.data);
      setContextEntity(response.data.entity);
      setChannels(prev => {
        const exists = prev.find(c => c.channel_id === response.data.channel_id);
        if (!exists) return [...prev, response.data];
        return prev;
      });
    } catch (error) {
      console.error('Failed to load contextual channel:', error);
      toast.error('Failed to load discussion');
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch channels
  const fetchChannels = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API}/chat/channels`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
      setChannels(response.data.channels || []);
      
      // Check for contextual channel in URL
      const contextType = searchParams.get('type');
      const contextId = searchParams.get('id');
      
      if (contextType && contextId) {
        // Load contextual channel
        await loadContextualChannel(contextType, contextId);
      } else {
        // Set active channel from URL or default to general
        const urlChannel = searchParams.get('channel');
        if (urlChannel) {
          const channel = response.data.channels?.find(c => c.channel_id === urlChannel);
          if (channel) {
            setActiveChannel(channel);
            setContextEntity(null);
          }
        } else if (response.data.channels?.length > 0) {
          const generalChannel = response.data.channels.find(c => c.channel_id === 'general');
          setActiveChannel(generalChannel || response.data.channels[0]);
          setContextEntity(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch channels:', error);
    }
  }, [token, searchParams, loadContextualChannel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch messages for active channel
  const fetchMessages = useCallback(async (channelId) => {
    if (!channelId) return;
    try {
      const response = await axios.get(`${API}/chat/channels/${channelId}/messages`, {
        headers: getH(),
        withCredentials: true,
        params: { limit: 50 }
      });
      setMessages(response.data.messages || []);
      setLastFetchTime(new Date().toISOString());
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  }, [token]);

  // Poll for new messages
  const pollNewMessages = useCallback(async () => {
    if (!activeChannel || !lastFetchTime) return;
    try {
      const response = await axios.get(`${API}/chat/messages/new`, {
        headers: getH(),
        withCredentials: true,
        params: { 
          since: lastFetchTime,
          channel_id: activeChannel.channel_id
        }
      });
      if (response.data.messages?.length > 0) {
        setMessages(prev => [...prev, ...response.data.messages]);
        setLastFetchTime(new Date().toISOString());
      }
    } catch (error) {
      console.error('Failed to poll messages:', error);
    }
  }, [activeChannel, lastFetchTime, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch organization members
  const fetchMembers = useCallback(async () => {
    if (!user?.organization_id) return;
    try {
      const response = await axios.get(`${API}/organizations/${user.organization_id}/members`, {
        headers: getH(),
        withCredentials: true
      });
      setMembers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  }, [user?.organization_id, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchChannels();
    fetchMembers();
    setLoading(false);
  }, []);

  useEffect(() => {
    if (activeChannel) {
      fetchMessages(activeChannel.channel_id);
      // Update URL based on channel type
      if (activeChannel.channel_type && activeChannel.channel_type !== 'general' && activeChannel.related_id) {
        setSearchParams({ type: activeChannel.channel_type, id: activeChannel.related_id });
      } else {
        setSearchParams({ channel: activeChannel.channel_id });
      }
    }
  }, [activeChannel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle channel selection with proper context reset
  const handleChannelSelect = (channel) => {
    setActiveChannel(channel);
    setContextEntity(channel.entity || null);
  };

  // Memoize channel groupings to avoid re-filtering on every render
  const generalChannels = useMemo(() => channels.filter(c => c.channel_type === 'general' || !c.channel_type), [channels]);
  const leadChannels = useMemo(() => channels.filter(c => c.channel_type === 'lead'), [channels]);
  const dealChannels = useMemo(() => channels.filter(c => c.channel_type === 'deal'), [channels]);
  const projectChannels = useMemo(() => channels.filter(c => c.channel_type === 'project'), [channels]);

  // Get the link to navigate to the related entity
  const getEntityLink = () => {
    if (!activeChannel || !activeChannel.channel_type || activeChannel.channel_type === 'general') return null;
    const entityId = activeChannel.related_id;
    const links = {
      lead: `/leads?detail=${entityId}`,
      deal: `/deals?detail=${entityId}`,
      task: `/tasks`,
      company: `/companies`
    };
    return links[activeChannel.channel_type];
  };

  useEffect(() => {
    // Poll for new messages every 3 seconds
    pollIntervalRef.current = setInterval(pollNewMessages, 3000);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [pollNewMessages]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChannel || sending) return;

    setSending(true);
    try {
      const response = await axios.post(
        `${API}/chat/channels/${activeChannel.channel_id}/messages`,
        {
          content: newMessage,
          reply_to: replyTo?.message_id || null
        },
        { headers: getH(), withCredentials: true }
      );
      
      setMessages(prev => [...prev, response.data]);
      setNewMessage('');
      setReplyTo(null);
      setLastFetchTime(new Date().toISOString());
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleEditMessage = async (messageId, content) => {
    try {
      await axios.put(
        `${API}/chat/messages/${messageId}?content=${encodeURIComponent(content)}`,
        {},
        { headers: getH(), withCredentials: true }
      );
      setMessages(prev => prev.map(m => 
        m.message_id === messageId ? { ...m, content, is_edited: true } : m
      ));
      setEditingMessage(null);
      toast.success('Message updated');
    } catch (error) {
      toast.error('Failed to edit message');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await axios.delete(`${API}/chat/messages/${messageId}`, {
        headers: getH(),
        withCredentials: true
      });
      setMessages(prev => prev.filter(m => m.message_id !== messageId));
      toast.success('Message deleted');
    } catch (error) {
      toast.error('Failed to delete message');
    }
  };

  const handleReaction = async (messageId, emoji) => {
    try {
      const response = await axios.post(
        `${API}/chat/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`,
        {},
        { headers: getH(), withCredentials: true }
      );
      setMessages(prev => prev.map(m => 
        m.message_id === messageId ? { ...m, reactions: response.data.reactions } : m
      ));
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!newChannel.name.trim()) return;
    
    try {
      const response = await axios.post(
        `${API}/chat/channels`,
        {
          name: newChannel.name,
          description: newChannel.description,
          channel_type: 'general'
        },
        { headers: getH(), withCredentials: true }
      );
      setChannels(prev => [...prev, response.data]);
      setActiveChannel(response.data);
      setShowNewChannelDialog(false);
      setNewChannel({ name: '', description: '' });
      toast.success('Channel created');
    } catch (error) {
      toast.error('Failed to create channel');
    }
  };

  const insertMention = (member) => {
    const mentionText = `@[${member.name}](${member.user_id}) `;
    setNewMessage(prev => prev + mentionText);
    inputRef.current?.focus();
  };

  const formatMessageContent = (content) => {
    // Replace mention syntax with styled mentions
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      parts.push(
        <span key={match.index} className="bg-teal-100 text-[#0EA5A0] px-1 rounded font-medium">
          @{match[1]}
        </span>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Loader2 className="w-8 h-8 animate-spin text-[#0EA5A0]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-140px)] flex gap-4" data-testid="chat-page">
        {/* Channels Sidebar */}
        <Card className="w-64 flex-shrink-0 flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#0EA5A0]" />
                Team Chat
              </CardTitle>
              <Dialog open={showNewChannelDialog} onOpenChange={setShowNewChannelDialog}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="new-channel-btn">
                    <Plus className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Channel</DialogTitle>
                    <DialogDescription>Add a new channel for your team to collaborate</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateChannel} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="channel-name">Channel Name</Label>
                      <Input
                        id="channel-name"
                        placeholder="e.g., sales-team"
                        value={newChannel.name}
                        onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                        data-testid="channel-name-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="channel-desc">Description (optional)</Label>
                      <Input
                        id="channel-desc"
                        placeholder="What's this channel about?"
                        value={newChannel.description}
                        onChange={(e) => setNewChannel({ ...newChannel, description: e.target.value })}
                      />
                    </div>
                    <Button type="submit" className="w-full bg-[#0EA5A0] hover:bg-teal-700" data-testid="create-channel-btn">
                      Create Channel
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-2 overflow-auto">
            {/* Group channels by type */}
            <div className="space-y-2">
              {/* General Channels - Collapsible */}
              <div>
                <button onClick={() => toggleSection('channels')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 px-3 uppercase w-full hover:text-slate-700" data-testid="toggle-channels">
                  {collapsedSections.channels ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Channels
                </button>
                {!collapsedSections.channels && (
                  <div className="space-y-1 mt-1">
                    {generalChannels.map((channel) => {
                      const config = CHANNEL_CONFIG[channel.channel_type || 'general'];
                      const Icon = config.icon;
                      return (
                        <button key={channel.channel_id} onClick={() => handleChannelSelect(channel)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${activeChannel?.channel_id === channel.channel_id ? 'bg-teal-100 text-[#0EA5A0]' : 'hover:bg-slate-100 text-slate-700'}`} data-testid={`channel-${channel.channel_id}`}>
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{channel.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Lead Discussions - Collapsible */}
              {leadChannels.length > 0 && (
                <div>
                  <button onClick={() => toggleSection('leads')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 px-3 uppercase w-full hover:text-slate-700" data-testid="toggle-leads">
                    {collapsedSections.leads ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    <UserCircle className="w-3 h-3" /> Lead Discussions
                  </button>
                  {!collapsedSections.leads && (
                    <div className="space-y-1 mt-1">
                      {leadChannels.map((channel) => (
                        <button key={channel.channel_id} onClick={() => handleChannelSelect(channel)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${activeChannel?.channel_id === channel.channel_id ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-700'}`} data-testid={`channel-${channel.channel_id}`}>
                          <UserCircle className="w-4 h-4 flex-shrink-0 text-blue-600" />
                          <span className="truncate">{channel.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Deal Discussions - Collapsible */}
              {dealChannels.length > 0 && (
                <div>
                  <button onClick={() => toggleSection('deals')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 px-3 uppercase w-full hover:text-slate-700" data-testid="toggle-deals">
                    {collapsedSections.deals ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    <Target className="w-3 h-3" /> Deal Discussions
                  </button>
                  {!collapsedSections.deals && (
                    <div className="space-y-1 mt-1">
                      {dealChannels.map((channel) => (
                        <button key={channel.channel_id} onClick={() => handleChannelSelect(channel)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${activeChannel?.channel_id === channel.channel_id ? 'bg-emerald-100 text-emerald-700' : 'hover:bg-slate-100 text-slate-700'}`} data-testid={`channel-${channel.channel_id}`}>
                          <Target className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                          <span className="truncate">{channel.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Project Channels - Collapsible */}
              {projectChannels.length > 0 && (
                <div>
                  <button onClick={() => toggleSection('projects')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 px-3 uppercase w-full hover:text-slate-700" data-testid="toggle-projects">
                    {collapsedSections.projects ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Project Channels
                  </button>
                  {!collapsedSections.projects && (
                    <div className="space-y-1 mt-1">
                      {projectChannels.map((channel) => (
                        <button key={channel.channel_id} onClick={() => handleChannelSelect(channel)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${activeChannel?.channel_id === channel.channel_id ? 'bg-teal-100 text-teal-700' : 'hover:bg-slate-100 text-slate-700'}`} data-testid={`channel-${channel.channel_id}`}>
                          <Hash className="w-4 h-4 flex-shrink-0 text-teal-600" />
                          <span className="truncate">{channel.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>

          {/* Team Members */}
          <div className="border-t p-3">
            <button
              onClick={() => setShowMembers(!showMembers)}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 w-full"
            >
              <Users className="w-4 h-4" />
              <span>Team Members ({members.length})</span>
            </button>
            {showMembers && (
              <div className="mt-2 space-y-1 max-h-40 overflow-auto">
                {members.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-slate-100 cursor-pointer"
                    onClick={() => insertMention(member)}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.picture} />
                      <AvatarFallback className="text-xs bg-teal-100 text-[#0EA5A0]">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{member.name}</span>
                    {member.user_id === user?.user_id && (
                      <Badge variant="outline" className="text-xs ml-auto">You</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Chat Area */}
        <Card className="flex-1 flex flex-col">
          {activeChannel ? (
            <>
              {/* Channel Header */}
              <CardHeader className="border-b py-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {(() => {
                        const config = CHANNEL_CONFIG[activeChannel.channel_type || 'general'];
                        const Icon = config.icon;
                        return <Icon className={`w-5 h-5 ${config.color}`} />;
                      })()}
                      {activeChannel.name}
                      {activeChannel.channel_type && activeChannel.channel_type !== 'general' && (
                        <Badge variant="outline" className={`text-xs ${CHANNEL_CONFIG[activeChannel.channel_type]?.color}`}>
                          {activeChannel.channel_type}
                        </Badge>
                      )}
                    </CardTitle>
                    {activeChannel.description && (
                      <p className="text-sm text-slate-500 mt-1">{activeChannel.description}</p>
                    )}
                  </div>
                  {/* Link to entity for contextual channels */}
                  <div className="flex items-center gap-2">
                    {activeChannel.channel_type && activeChannel.channel_type !== 'general' && getEntityLink() && (
                      <Link
                        to={getEntityLink()}
                        className="flex items-center gap-1 text-sm text-slate-600 hover:text-[#0EA5A0] transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View {activeChannel.channel_type}
                      </Link>
                    )}
                    {activeChannel.channel_id !== 'general' && (user?.role === 'admin' || user?.role === 'owner' || user?.role === 'super_admin' || user?.email === 'florian@unyted.world') && (
                      <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-500" onClick={() => archiveChannel(activeChannel.channel_id)} data-testid="archive-channel-btn">
                        <Archive className="w-4 h-4 mr-1" /> Archive
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Context entity info card */}
                {contextEntity && activeChannel.channel_type === 'lead' && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <UserCircle className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {contextEntity.first_name} {contextEntity.last_name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {contextEntity.job_title && `${contextEntity.job_title} at `}{contextEntity.company || 'No company'}
                        </p>
                      </div>
                      <Badge variant="outline" className="ml-auto capitalize">{contextEntity.status}</Badge>
                    </div>
                  </div>
                )}
                
                {contextEntity && activeChannel.channel_type === 'deal' && (
                  <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Target className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{contextEntity.name}</p>
                        <p className="text-sm text-slate-500">
                          €{contextEntity.value?.toLocaleString()} • Stage: {contextEntity.stage}
                        </p>
                      </div>
                      <Badge variant="outline" className="ml-auto">{contextEntity.probability}% probability</Badge>
                    </div>
                  </div>
                )}
              </CardHeader>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">No messages yet. Start the conversation!</p>
                      {activeChannel.channel_type && activeChannel.channel_type !== 'general' && (
                        <p className="text-sm text-slate-400 mt-1">
                          Discuss this {activeChannel.channel_type} with your team
                        </p>
                      )}
                    </div>
                  ) : (
                    messages.map((message, index) => {
                      const isOwnMessage = message.sender_id === user?.user_id;
                      const showAvatar = index === 0 || 
                        messages[index - 1]?.sender_id !== message.sender_id;
                      
                      return (
                        <div
                          key={message.message_id}
                          className={`group flex gap-3 ${showAvatar ? 'mt-4' : 'mt-1'}`}
                          data-testid={`message-${message.message_id}`}
                        >
                          {showAvatar ? (
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarImage src={message.sender_picture} />
                              <AvatarFallback className="bg-teal-100 text-[#0EA5A0] text-sm">
                                {getInitials(message.sender_name)}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="w-8 flex-shrink-0" />
                          )}

                          <div className="flex-1 min-w-0">
                            {showAvatar && (
                              <div className="flex items-baseline gap-2 mb-1">
                                <span className="font-semibold text-slate-900">
                                  {message.sender_name}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {formatTime(message.created_at)}
                                </span>
                                {message.is_edited && (
                                  <span className="text-xs text-slate-400">(edited)</span>
                                )}
                              </div>
                            )}

                            {/* Reply indicator */}
                            {message.reply_to && (
                              <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                                <Reply className="w-3 h-3" />
                                <span>Replying to a message</span>
                              </div>
                            )}

                            {/* Message content */}
                            {editingMessage === message.message_id ? (
                              <div className="flex gap-2">
                                <Input
                                  defaultValue={message.content}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleEditMessage(message.message_id, e.target.value);
                                    } else if (e.key === 'Escape') {
                                      setEditingMessage(null);
                                    }
                                  }}
                                  autoFocus
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingMessage(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <p className="text-slate-700 break-words">
                                {formatMessageContent(message.content)}
                              </p>
                            )}

                            {/* Reactions */}
                            {Object.keys(message.reactions || {}).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {Object.entries(message.reactions).map(([emoji, users]) => (
                                  <button
                                    key={emoji}
                                    onClick={() => handleReaction(message.message_id, emoji)}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-sm transition-colors ${
                                      users.includes(user?.user_id)
                                        ? 'bg-teal-100 text-[#0EA5A0]'
                                        : 'bg-slate-100 hover:bg-slate-200'
                                    }`}
                                  >
                                    <span>{emoji}</span>
                                    <span className="text-xs">{users.length}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Message actions */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-start gap-1">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <Smile className="w-4 h-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-2">
                                <div className="flex gap-1">
                                  {EMOJI_LIST.map((emoji) => (
                                    <button
                                      key={emoji}
                                      onClick={() => handleReaction(message.message_id, emoji)}
                                      className="text-lg hover:bg-slate-100 p-1 rounded"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setReplyTo(message);
                                inputRef.current?.focus();
                              }}
                            >
                              <Reply className="w-4 h-4" />
                            </Button>

                            {isOwnMessage && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setEditingMessage(message.message_id)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-rose-600 hover:text-rose-700"
                                  onClick={() => handleDeleteMessage(message.message_id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="border-t p-4">
                {replyTo && (
                  <div className="flex items-center gap-2 mb-2 text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                    <Reply className="w-4 h-4" />
                    <span>Replying to {replyTo.sender_name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 ml-auto"
                      onClick={() => setReplyTo(null)}
                    >
                      <span className="sr-only">Cancel reply</span>
                      ×
                    </Button>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" type="button">
                        <AtSign className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2">
                      <p className="text-xs text-slate-500 mb-2">Mention a team member</p>
                      <div className="space-y-1 max-h-40 overflow-auto">
                        {members.map((member) => (
                          <button
                            key={member.user_id}
                            type="button"
                            onClick={() => insertMention(member)}
                            className="w-full flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-slate-100"
                          >
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-xs bg-teal-100 text-[#0EA5A0]">
                                {getInitials(member.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{member.name}</span>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Input
                    ref={inputRef}
                    placeholder={`Message #${activeChannel.name}`}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1"
                    data-testid="chat-input"
                  />

                  <Button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="bg-[#0EA5A0] hover:bg-teal-700"
                    data-testid="send-message-btn"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-700">Select a channel</h3>
                <p className="text-slate-500">Choose a channel to start chatting</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ChatPage;
