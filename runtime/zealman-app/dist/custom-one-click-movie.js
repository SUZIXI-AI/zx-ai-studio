(() => {
  const PAGE_ID = 'page-one-click-movie';
  const NAV_ID = 'zx-one-click-movie-nav';
  const API_BASE = '/wuli-api/api/hyperframes';
  const state = {
    active: false,
    tab: 'create',
    templates: [],
    jobs: [],
    activeJobId: '',
    userTemplates: [],
    projectTitle: '',
    chatDraft: '',
    chatMessages: [],
    agentEvents: [],
    activeEventSource: null,
    activeJobPollTimer: null,
    activeJobPolling: false,
    eventSeqSeen: {},
    templatePickerOpen: false,
    templateQuery: '',
    modelChoice: '',
    modelDrafts: { claude: '', openai: '', custom: '' },
    customChannels: [],
    modelModalProvider: '',
    hiddenJobs: [],
    keys: {},
    loading: false,
    selectedTemplate: 'no-template',
    prompt: '',
    duration: 60,
    durationMode: '60',
    customDuration: 90,
    aspect: '9:16',
    quality: 'standard',
    provider: 'openai',
    model: '',
    assetMode: 'upload',
    files: [],
    uploadedAssets: [],
    keyForm: {
      claude_api_key: '',
      openai_api_key: '',
      custom_api_key: '',
      claude_api_url: 'https://api.anthropic.com/v1/messages',
      openai_api_url: 'https://api.openai.com/v1',
      custom_api_url: '',
      claude_model: 'claude-sonnet-4-6',
      openai_model: 'gpt-5',
      custom_model: '',
      claude_protocol: 'anthropic',
      openai_protocol: 'auto',
      custom_protocol: 'auto',
    },
    ttsForm: {
      provider: 'none',
      openai_api_key: '',
      openai_api_url: 'https://api.openai.com/v1/audio/speech',
      openai_model: 'gpt-4o-mini-tts',
      openai_voice: 'alloy',
      google_api_key: '',
      google_api_url: 'https://texttospeech.googleapis.com/v1/text:synthesize',
      google_voice: 'cmn-CN-Standard-A',
      google_language_code: 'cmn-CN',
      minimax_api_key: '',
      minimax_api_url: 'https://api.minimax.chat/v1/t2a_v2',
      minimax_model: 'speech-2.8-turbo',
      minimax_voice: 'Chinese (Mandarin)_Warm_Bestie',
      minimax_group_id: '',
    },
    saving: false,
    creating: false,
    chatSending: false,
    chatAbortController: null,
    chatDraftVersion: 0,
    ignoreNextChatDraftChange: false,
    testingProvider: '',
    testingTtsProvider: '',
    loadedOnce: false,
  };

  const tabs = [
    ['create', '新建作品'],
    ['works', '我的作品'],
    ['templates', '参考示例'],
    ['settings', '设置'],
  ];
  const durationOptions = [[5, '5 秒'], [12, '12 秒'], [30, '30 秒'], [60, '1 分钟'], ['custom', '自定义']];
  const aspectOptions = ['16:9', '9:16', '1:1'];
  const qualityOptions = [['draft', '快速'], ['standard', '高清'], ['high', '精细']];
  const providerOptions = [['openai', 'GPT'], ['claude', 'Claude'], ['custom', '自定义']];
  const providerLabels = { claude: 'Claude', openai: 'GPT', custom: '自定义' };
  const customProviderKey = channelOrId => `custom:${String(typeof channelOrId === 'object' ? channelOrId?.id : channelOrId || '').trim()}`;
  const isExtraCustomProvider = provider => String(provider || '').startsWith('custom:');
  function findCustomChannel(provider) {
    const id = String(provider || '').split(':')[1] || provider;
    return (state.customChannels || []).find(item => String(item.id) === String(id));
  }
  function providerDisplayName(provider) {
    if (provider === 'claude') return 'Claude 通道';
    if (provider === 'openai') return 'GPT 通道';
    if (isExtraCustomProvider(provider)) {
      const channel = findCustomChannel(provider);
      return channel?.name || '自定义通道';
    }
    return '自定义通道';
  }

  function providerShortName(provider) {
    if (provider === 'claude') return 'Claude';
    if (provider === 'openai') return 'GPT';
    if (isExtraCustomProvider(provider)) return findCustomChannel(provider)?.name || '自定义 API';
    return '自定义';
  }

  const protocolOptions = [
    ['auto', '自动兼容（推荐）'],
    ['openai_chat', 'OpenAI Chat (/v1/chat/completions)'],
    ['openai_responses', 'OpenAI Responses (/v1/responses)'],
    ['openai_responses_compact', 'OpenAI Responses Compact (/v1/responses/compact)'],
    ['anthropic', 'Anthropic (/v1/messages)'],
    ['gemini', 'Gemini (/v1beta/models/{model}:generateContent)'],
  ];
  const statusText = {
    queued: '\u6392\u961f\u4e2d',
    ai_generating: '\u751f\u6210\u811a\u672c',
    inspecting: '\u68c0\u67e5\u5e03\u5c40',
    rendering: '\u6e32\u67d3\u4e2d',
    verifying: '\u9a8c\u8bc1\u6210\u7247',
    completed: '\u5df2\u5b8c\u6210',
    failed: '\u5931\u8d25',
    cancelled: '\u5df2\u53d6\u6d88',
  };
  const runningStatuses = new Set(['queued', 'ai_generating', 'inspecting', 'rendering', 'verifying']);
  const assetPreviewUrls = new Map();
  const publicStepTitles = {
    design: '理解需求',
    storyboard: '分镜脚本',
    tts: '逐句配音',
    captions: '字幕时间轴',
    composition: '组装画面',
    inspect: '画面检查',
    render: '渲染视频',
    verify: '成片检查',
  };
  const stepStatusText = {
    pending: '等待中',
    running: '进行中',
    done: '已完成',
    skipped: '已跳过',
    warning: '需留意',
    failed: '失败',
    cancelled: '已暂停',
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const byText = text => Array.from(document.querySelectorAll('button,a')).find(el => (el.textContent || '').replace(/\s+/g, '').includes(text));
  const formatTime = value => {
    if (!value) return '-';
    try { return new Date(Number(value) * 1000).toLocaleString(); } catch (_) { return '-'; }
  };

  const HIDDEN_JOBS_KEY = 'zx_hf_hidden_jobs';
  const USER_TEMPLATES_KEY = 'zx_hf_user_templates';
  function loadUserTemplates() {
    try {
      const raw = localStorage.getItem(USER_TEMPLATES_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter(item => item && item.id && item.source_template_id) : [];
    } catch (_) {
      return [];
    }
  }
  function persistUserTemplates() {
    try { localStorage.setItem(USER_TEMPLATES_KEY, JSON.stringify(state.userTemplates || [])); } catch (_) {}
  }

  const loadHiddenJobs = () => {
    try {
      const raw = localStorage.getItem(HIDDEN_JOBS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.map(item => String(item)).filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  };
  const persistHiddenJobs = () => {
    try { localStorage.setItem(HIDDEN_JOBS_KEY, JSON.stringify(state.hiddenJobs || [])); } catch (_) {}
  };

  function normalizeCustomChannel(item = {}, index = 0) {
    const id = String(item.id || `custom-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || `custom-${Date.now()}-${index}`;
    return {
      id,
      name: String(item.name || `自定义 API ${index + 1}`).trim(),
      api_url: String(item.api_url || '').trim(),
      api_key: String(item.api_key || '').includes('***') ? '' : String(item.api_key || '').trim(),
      model: String(item.model || '').trim(),
      protocol: String(item.protocol || 'auto').trim() || 'auto',
    };
  }

  function createCustomChannel() {
    const channel = normalizeCustomChannel({}, (state.customChannels || []).length);
    state.customChannels = [...(state.customChannels || []), channel];
    state.modelDrafts[customProviderKey(channel)] = '';
    toast('已新增一个自定义 API 通道，请填写后保存', 'success');
    render();
  }

  function removeCustomChannel(id) {
    const channel = findCustomChannel(id);
    const name = channel?.name || '这个自定义 API';
    if (!confirm(`确定删除 ${name} 吗？`)) return;
    state.customChannels = (state.customChannels || []).filter(item => String(item.id) !== String(id));
    delete state.modelDrafts[customProviderKey(id)];
    if (state.provider === customProviderKey(id)) {
      state.provider = 'openai';
      state.model = '';
      state.modelChoice = '';
      ensureModelChoice();
    }
    render();
  }

  function updateCustomChannel(id, field, value) {
    state.customChannels = (state.customChannels || []).map(item => (
      String(item.id) === String(id) ? { ...item, [field]: value } : item
    ));
  }
  const visibleJobs = list => {
    const hidden = new Set((state.hiddenJobs || []).map(item => String(item)));
    return (list || []).filter(job => !hidden.has(String(job.job_id || job.id || '')));
  };

  const jobIdOf = job => String(job?.job_id || job?.id || '');
  const getActiveJob = () => (state.jobs || []).find(job => jobIdOf(job) === String(state.activeJobId || '')) || null;
  const isJobRunning = job => runningStatuses.has(String(job?.status || ''));

  function cleanStepDetail(text = '') {
    return String(text || '')
      .replace(/DESIGN\.md/gi, '需求方案')
      .replace(/storyboard\.json/gi, '分镜')
      .replace(/captions\.js/gi, '字幕')
      .replace(/index\.html/gi, '画面')
      .replace(/HyperFrames/gi, '系统')
      .replace(/FFmpeg/gi, '系统')
      .replace(/MP4/gi, '视频')
      .replace(/inspect/gi, '检查')
      .trim();
  }

  function describeJobProgress(job) {
    const status = String(job?.status || '');
    const steps = Array.isArray(job?.steps) ? job.steps : [];
    const lines = [];
    if (status === 'queued') {
      lines.push('收到，我会按你的题目和需求开始生成。');
    }
    steps.forEach(step => {
      const rawStatus = String(step.status || 'pending');
      const icon = rawStatus === 'done' ? '✓' : rawStatus === 'running' ? '●' : rawStatus === 'failed' ? '!' : rawStatus === 'cancelled' ? '⏸' : '○';
      const title = publicStepTitles[step.key] || step.title || '处理步骤';
      const detail = cleanStepDetail(step.detail || '');
      const suffix = detail && rawStatus !== 'pending' ? `（${detail}）` : '';
      lines.push(`${icon} ${rawStatus === 'done' ? '已完成 ' : ''}${title}${rawStatus === 'running' ? '中...' : ''}${suffix}`);
    });
    if (!lines.length) lines.push(statusText[status] || '正在处理');
    return lines.slice(-8).join('\n');
  }

  state.hiddenJobs = loadHiddenJobs();
  state.userTemplates = loadUserTemplates();
  function toast(message, type = 'info') {
    let box = document.querySelector('.zx-hf-toast-wrap');
    if (!box) {
      box = document.createElement('div');
      box.className = 'zx-hf-toast-wrap';
      document.body.appendChild(box);
    }
    const item = document.createElement('div');
    item.className = `zx-hf-toast zx-hf-toast-${type}`;
    item.textContent = message;
    box.appendChild(item);
    setTimeout(() => item.classList.add('show'), 10);
    setTimeout(() => { item.classList.remove('show'); setTimeout(() => item.remove(), 220); }, 2800);
  }


  function showFullText(text) {
    const content = String(text || '').trim();
    if (!content) return;
    document.querySelector('.zx-hf-fulltext-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'zx-hf-fulltext-overlay';
    overlay.innerHTML = `
      <div class="zx-hf-fulltext-dialog" role="dialog" aria-modal="true">
        <div class="zx-hf-fulltext-head">
          <strong>\u5b8c\u6574\u5185\u5bb9</strong>
          <button type="button" data-fulltext-close>\u5173\u95ed</button>
        </div>
        <pre></pre>
      </div>
    `;
    overlay.querySelector('pre').textContent = content;
    const close = () => overlay.remove();
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    overlay.querySelector('[data-fulltext-close]')?.addEventListener('click', close);
    const onKey = event => {
      if (event.key === 'Escape') {
        close();
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
  }


  function showVideoPreview(src, title = '') {
    const url = String(src || '').trim();
    if (!url) return;
    document.querySelector('.zx-hf-video-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'zx-hf-video-overlay';
    overlay.innerHTML = `
      <div class="zx-hf-video-dialog" role="dialog" aria-modal="true">
        <div class="zx-hf-video-head">
          <strong>${esc(title || '\u89c6\u9891\u9884\u89c8')}</strong>
          <button type="button" data-video-close>\u5173\u95ed</button>
        </div>
        <video controls autoplay playsinline src="${esc(url)}"></video>
      </div>
    `;
    const close = () => {
      const video = overlay.querySelector('video');
      if (video) video.pause();
      overlay.remove();
      if (state.active) showPage();
    };
    overlay.addEventListener('click', event => { if (event.target === overlay) { event.preventDefault(); event.stopPropagation(); close(); } });
    overlay.querySelector('[data-video-close]')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      close();
    });
    const onKey = event => {
      if (event.key === 'Escape') {
        close();
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
  }

  async function request(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || `请求失败：${res.status}`);
    }
    const contentType = res.headers.get('content-type') || '';
    return contentType.includes('application/json') ? res.json() : res.text();
  }

  function appendChatMessage(message) {
    state.chatMessages = [...(state.chatMessages || []), message].slice(-80);
  }

  function eventKey(event) {
    return String(event?.seq || `${event?.type || 'event'}-${event?.time || Date.now()}-${event?.text || event?.message || ''}`);
  }

  function rememberJobEvent(jobId, event) {
    if (!jobId || !event) return false;
    if (!state.eventSeqSeen[jobId]) state.eventSeqSeen[jobId] = {};
    const key = eventKey(event);
    if (state.eventSeqSeen[jobId][key]) return false;
    state.eventSeqSeen[jobId][key] = true;
    state.agentEvents = [...(state.agentEvents || []), { ...event, jobId }].slice(-160);
    return true;
  }

  function syncJobEvents(job) {
    const jobId = jobIdOf(job);
    if (!jobId) return false;
    let changed = false;
    (Array.isArray(job?.events) ? job.events : []).forEach(event => {
      if (rememberJobEvent(jobId, event)) changed = true;
    });
    return changed;
  }

  function closeJobEvents() {
    try { state.activeEventSource?.close(); } catch (_) {}
    state.activeEventSource = null;
  }

  function upsertJob(job) {
    const id = jobIdOf(job);
    if (!id) return;
    const list = state.jobs || [];
    const index = list.findIndex(item => jobIdOf(item) === id);
    state.jobs = index >= 0 ? list.map((item, idx) => idx === index ? job : item) : [job, ...list];
  }

  function finalTextForJob(job) {
    const status = String(job?.status || '');
    if (status === 'completed') return '\u89c6\u9891\u5df2\u751f\u6210\u5b8c\u6210\uff0c\u4e0b\u65b9\u53ef\u76f4\u63a5\u9884\u89c8\u548c\u4e0b\u8f7d\u3002';
    if (status === 'cancelled') return '\u5df2\u6682\u505c\u751f\u6210\uff0c\u4f60\u53ef\u4ee5\u7ee7\u7eed\u8f93\u5165\u4fee\u6539\u610f\u89c1\u540e\u91cd\u65b0\u751f\u6210\u3002';
    return `\u4efb\u52a1${statusText[status] || status || '\u5f02\u5e38'}\uff1a${job?.error || '\u8bf7\u5230\u6211\u7684\u4f5c\u54c1\u91cc\u67e5\u770b\u8be6\u60c5'}`;
  }

  function applyJobSnapshot(job, renderNow = true) {
    const jobId = jobIdOf(job);
    if (!jobId) return false;
    upsertJob(job);
    syncJobEvents(job);
    if (isJobRunning(job)) {
      const status = String(job.status || '');
      const detail = describeJobProgress(job);
      const next = { role: 'assistant', text: detail, time: Date.now(), jobId, liveStatus: status, progressNotice: true };
      const existingIndex = (state.chatMessages || []).findIndex(item => item.jobId === jobId && item.liveStatus);
      if (existingIndex >= 0) {
        if (state.chatMessages[existingIndex].text !== detail || state.chatMessages[existingIndex].liveStatus !== status) {
          state.chatMessages = state.chatMessages.map((item, idx) => idx === existingIndex ? next : item).slice(-80);
        }
      } else {
        state.chatMessages = [...(state.chatMessages || []), next].slice(-80);
      }
      if (renderNow) renderChatUpdate();
      return false;
    }
    const status = String(job.status || '');
    const done = { role: 'assistant', text: finalTextForJob(job), time: Date.now(), jobId, doneNotice: true, videoUrl: status === 'completed' ? `${API_BASE}/download/${encodeURIComponent(jobId)}` : '' };
    const existingIndex = (state.chatMessages || []).findIndex(item => item.jobId === jobId && (item.liveStatus || item.workStart || item.pending));
    if (existingIndex >= 0) {
      state.chatMessages = state.chatMessages.map((item, idx) => idx === existingIndex ? done : item).slice(-80);
    } else if (!(state.chatMessages || []).some(item => item.jobId === jobId && item.doneNotice)) {
      state.chatMessages = [...(state.chatMessages || []), done].slice(-80);
    }
    closeJobEvents();
    stopActiveJobPoll();
    if (state.activeJobId === jobId) state.activeJobId = '';
    if (renderNow) renderChatUpdate();
    return true;
  }

  function stopActiveJobPoll() {
    if (state.activeJobPollTimer) clearInterval(state.activeJobPollTimer);
    state.activeJobPollTimer = null;
    state.activeJobPolling = false;
  }

  function startActiveJobPoll(jobId) {
    if (!jobId) return;
    if (state.activeJobPollTimer?.jobId === jobId) return;
    stopActiveJobPoll();
    const tick = async () => {
      if (!state.active || state.activeJobPolling) return;
      state.activeJobPolling = true;
      try {
        const job = await request(`/jobs/${encodeURIComponent(jobId)}`);
        applyJobSnapshot(job, true);
      } catch (_) {
      } finally {
        state.activeJobPolling = false;
      }
    };
    const timer = setInterval(tick, 3000);
    timer.jobId = jobId;
    state.activeJobPollTimer = timer;
    tick();
  }

  function connectJobEvents(jobId) {
    if (!jobId) return;
    if (typeof EventSource === 'undefined') {
      startActiveJobPoll(jobId);
      return;
    }
    if (state.activeEventSource?.jobId === jobId) return;
    closeJobEvents();
    try {
      const source = new EventSource(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/events`);
      source.jobId = jobId;
      source.onmessage = event => {
        try {
          const data = JSON.parse(event.data || '{}');
          if (data.type === 'close') {
            closeJobEvents();
            startActiveJobPoll(jobId);
            return;
          }
          if (rememberJobEvent(jobId, data)) renderChatUpdate();
        } catch (_) {}
      };
      source.onerror = () => {
        startActiveJobPoll(jobId);
      };
      state.activeEventSource = source;
      startActiveJobPoll(jobId);
    } catch (_) {
      closeJobEvents();
      startActiveJobPoll(jobId);
    }
  }

  async function loadAll(silent = false) {
    if (!silent) { state.loading = true; render(); }
    try {
      const [templateData, jobData, keyData] = await Promise.all([
        request('/templates'),
        request('/jobs?limit=20'),
        request('/api-keys'),
      ]);
      state.templates = templateData.templates || [];
      state.jobs = visibleJobs(jobData.jobs || []);
      let eventsChanged = false;
      state.jobs.forEach(job => { if (syncJobEvents(job)) eventsChanged = true; });
      if (!state.activeJobId) {
        const runningJob = state.jobs.find(isJobRunning);
        if (runningJob) {
          state.activeJobId = jobIdOf(runningJob);
          startActiveJobPoll(state.activeJobId);
        }
      }
      state.keys = keyData || {};
      state.keyForm.claude_api_url = state.keys.claude_api_url || state.keyForm.claude_api_url;
      state.keyForm.openai_api_url = state.keys.openai_api_url || state.keyForm.openai_api_url;
      state.keyForm.custom_api_url = state.keys.custom_api_url || state.keyForm.custom_api_url;
      state.keyForm.claude_model = state.keys.claude_model || state.keyForm.claude_model;
      state.keyForm.openai_model = state.keys.openai_model || state.keyForm.openai_model;
      state.keyForm.custom_model = state.keys.custom_model || state.keyForm.custom_model;
      state.keyForm.claude_protocol = state.keys.claude_protocol || state.keyForm.claude_protocol;
      state.keyForm.openai_protocol = state.keys.openai_protocol || state.keyForm.openai_protocol;
      state.keyForm.custom_protocol = state.keys.custom_protocol || state.keyForm.custom_protocol;
      const tts = state.keys.tts_config || {};
      Object.keys(state.ttsForm).forEach(key => {
        if (key.endsWith('_api_key')) {
          state.ttsForm[key] = '';
        } else if (tts[key] !== undefined && tts[key] !== null) {
          state.ttsForm[key] = tts[key];
        }
      });
      state.customChannels = Array.isArray(state.keys.custom_channels)
        ? state.keys.custom_channels.map((item, index) => normalizeCustomChannel(item, index))
        : [];
      state.customChannels.forEach(channel => {
        const provider = customProviderKey(channel);
        if (!(provider in state.modelDrafts)) state.modelDrafts[provider] = '';
      });
      ensureModelChoice();
      if (state.templates.length && !state.templates.some(t => t.id === state.selectedTemplate)) {
        state.selectedTemplate = state.templates[0].id;
      }
      state.loadedOnce = true;
    } catch (error) {
      if (!silent) toast(error.message || '加载一键成片失败', 'error');
    } finally {
      state.loading = false;
      silent ? renderKeepScroll() : render();
    }
  }

  async function refreshJobs() {
    if (!state.active) return;
    if (state.tab !== 'works' && state.tab !== 'create' && !state.activeJobId) return;
    try {
      const jobData = await request('/jobs?limit=20');
      state.jobs = visibleJobs(jobData.jobs || []);
      if (!state.activeJobId) {
        const runningJob = state.jobs.find(isJobRunning);
        if (runningJob && state.tab === 'create') state.activeJobId = jobIdOf(runningJob);
      }
      const activeJob = getActiveJob();
      if (state.activeJobId && activeJob) {
        if (isJobRunning(activeJob)) {
          connectJobEvents(state.activeJobId);
          startActiveJobPoll(state.activeJobId);
        }
        applyJobSnapshot(activeJob, false);
      }
      renderChatUpdate();
    } catch (_) {}
  }

  function resolveDuration() {
    const raw = state.durationMode === 'custom' ? state.customDuration : state.durationMode;
    const value = Math.round(Number(raw || 0));
    return Math.max(3, Math.min(600, value || 5));
  }

  function validateAsset(file) {
    const name = String(file.name || '').toLowerCase();
    const isImage = /\.(jpg|jpeg|png|webp)$/.test(name);
    const isVideo = /\.mp4$/.test(name);
    if (!isImage && !isVideo) return '仅支持 jpg/png/webp/mp4';
    if (isImage && file.size > 10 * 1024 * 1024) return '图片不能超过 10MB';
    if (isVideo && file.size > 100 * 1024 * 1024) return '视频不能超过 100MB';
    return '';
  }

  function fileKey(file) {
    return [file?.name || '', file?.size || 0, file?.lastModified || 0].join('::');
  }

  function isImageAssetName(name = '') {
    return /\.(jpg|jpeg|png|webp)$/i.test(String(name || ''));
  }

  function localPreviewUrl(file) {
    const key = fileKey(file);
    if (!assetPreviewUrls.has(key)) {
      assetPreviewUrls.set(key, URL.createObjectURL(file));
    }
    return assetPreviewUrls.get(key);
  }

  function revokeLocalPreview(file) {
    const key = fileKey(file);
    const url = assetPreviewUrls.get(key);
    if (url) URL.revokeObjectURL(url);
    assetPreviewUrls.delete(key);
  }

  function clearAllLocalPreviews() {
    assetPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    assetPreviewUrls.clear();
  }

  function removeAssetPreview(kind, key) {
    if (kind === 'file') {
      const target = state.files.find(file => fileKey(file) === key);
      if (target) revokeLocalPreview(target);
      state.files = state.files.filter(file => fileKey(file) !== key);
    } else {
      state.uploadedAssets = state.uploadedAssets.filter(item => String(item.id || item.name || '') !== String(key));
    }
    renderKeepScroll();
  }

  function assetPreviewHtml() {
    const localItems = state.files.map(file => ({
      kind: 'file',
      key: fileKey(file),
      name: file.name || '素材',
      image: isImageAssetName(file.name),
      url: isImageAssetName(file.name) ? localPreviewUrl(file) : '',
    }));
    const uploadedItems = (state.uploadedAssets || []).map(item => ({
      kind: 'uploaded',
      key: String(item.id || item.name || ''),
      name: item.name || item.filename || '素材',
      image: isImageAssetName(item.name || item.filename),
      url: item.url || item.preview_url || '',
    })).filter(item => item.key);
    const items = [...localItems, ...uploadedItems].slice(0, 8);
    if (!items.length) return '';
    return items.map(item => `
      <div class="zx-hf-asset-thumb ${item.image && item.url ? 'image' : 'file'}" title="${esc(item.name)}">
        ${item.image && item.url
          ? `<img src="${esc(item.url)}" alt="${esc(item.name)}" />`
          : `<div class="zx-hf-asset-file"><i aria-hidden="true"></i><span>${esc(item.name)}</span></div>`}
        <button type="button" aria-label="移除素材" data-remove-asset-kind="${esc(item.kind)}" data-remove-asset-key="${esc(item.key)}">×</button>
      </div>
    `).join('');
  }

  async function uploadSelectedFiles() {
    const uploaded = [];
    for (const file of state.files) {
      const form = new FormData();
      form.append('file', file);
      uploaded.push(await request('/assets', { method: 'POST', body: form }));
    }
    if (uploaded.length) state.uploadedAssets = [...uploaded, ...state.uploadedAssets].slice(0, 20);
    return uploaded;
  }

  function buildJobPrompt(includeDraft = true) {
    const parts = [];
    if (state.projectTitle.trim()) parts.push(`\u4f5c\u54c1\u9898\u76ee\uff1a${state.projectTitle.trim()}`);
    if (state.prompt.trim()) parts.push(`\u9700\u6c42\u63cf\u8ff0\uff1a${state.prompt.trim()}`);
    const chats = (state.chatMessages || []).filter(item => item.role === 'user' && item.text).slice(-8);
    if (chats.length) parts.push(`\u804a\u5929\u8865\u5145\uff1a\n${chats.map(item => `- ${item.text}`).join('\n')}`);
    if (includeDraft && state.chatDraft.trim()) parts.push(`\u6700\u65b0\u8865\u5145\uff1a${state.chatDraft.trim()}`);
    return parts.join('\n\n').trim();
  }

  function hasMovieBrief() {
    return Boolean(state.projectTitle.trim());
  }

  function wantsGenerate(text = '') {
    const value = String(text || '').trim();
    return /(开始生成|重新生成|再生成|生成视频|生成成片|做一版|出一版|跑一版|开始渲染|渲染视频|制作视频|提交生成|go|start|render)/i.test(value);
  }

  async function createJob() {
    if (state.creating || state.chatSending) return;
    const finalPrompt = buildJobPrompt(true);
    if (!state.projectTitle.trim()) return toast('\u5148\u586b\u5199\u4f5c\u54c1\u9898\u76ee', 'error');
    if (!finalPrompt) return toast('\u5148\u544a\u8bc9 AI \u4f60\u60f3\u505a\u4ec0\u4e48\u89c6\u9891', 'error');
    const sourceTemplate = selectedTemplateSourceId();
    if (!sourceTemplate) return toast('\u8bf7\u9009\u62e9\u6709\u6548\u6a21\u677f', 'error');
    const finalDuration = resolveDuration();
    ensureModelChoice();
    const startMessageId = `job-start-${Date.now()}`;
    const userBrief = [
      state.projectTitle.trim() ? `\u9898\u76ee\uff1a${state.projectTitle.trim()}` : '',
      state.prompt.trim() ? `\u9700\u6c42\uff1a${state.prompt.trim()}` : '',
      state.chatDraft.trim() ? `\u6307\u4ee4\uff1a${state.chatDraft.trim()}` : '\u6307\u4ee4\uff1a\u751f\u6210\u89c6\u9891',
    ].filter(Boolean).join('\n');
    const input = document.querySelector(`#${PAGE_ID} [data-field="chatDraft"]`);
    if (input) input.value = '';
    state.chatDraft = '';
    state.chatDraftVersion += 1;
    state.ignoreNextChatDraftChange = true;
    state.chatMessages = [
      ...(state.chatMessages || []),
      { role: 'user', text: userBrief || finalPrompt, time: Date.now() },
      { role: 'assistant', text: '\u6536\u5230\uff0c\u6211\u6b63\u5728\u542f\u52a8\u751f\u6210\u4efb\u52a1...', time: Date.now(), pending: true, id: startMessageId },
    ].slice(-80);
    state.creating = true;
    renderChatUpdate();
    try {
      const uploaded = state.assetMode === 'upload' ? await uploadSelectedFiles() : [];
      const defaultModel = firstProviderModel(state.provider) || '';
      const styleReference = selectedTemplateStyleReference();
      const data = await request('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          template_id: sourceTemplate,
          prompt: finalPrompt,
          duration: finalDuration,
          aspect: state.aspect,
          quality: state.quality,
          provider: state.provider,
          model: state.model.trim() || defaultModel,
          asset_ids: uploaded.map(item => item.id),
          ...(styleReference ? { style_reference: styleReference } : {}),
        }),
      });
      const jobId = data.job_id || data.id || '';
      state.activeJobId = jobId;
      state.agentEvents = [];
      if (jobId) {
        connectJobEvents(jobId);
        startActiveJobPoll(jobId);
      }
      state.chatMessages = (state.chatMessages || []).map(item => (
        item.id === startMessageId
          ? { role: 'assistant', text: '\u6536\u5230\uff0c\u5f00\u59cb\u751f\u6210\u8fd9\u4e00\u7248\u89c6\u9891\u3002\u6211\u4f1a\u5728\u8fd9\u91cc\u540c\u6b65\u6bcf\u4e2a\u6b65\u9aa4\uff0c\u9700\u8981\u505c\u6b62\u65f6\u53ef\u4ee5\u70b9\u6682\u505c\u3002', time: Date.now(), jobId, workStart: true, progressNotice: true }
          : item
      )).slice(-80);
      toast('\u5df2\u5f00\u59cb\u751f\u6210', 'success');
      state.chatDraft = '';
      state.chatDraftVersion += 1;
      state.ignoreNextChatDraftChange = true;
      clearAllLocalPreviews();
      state.files = [];
      await loadAll(true);
      renderChatUpdate();
    } catch (error) {
      const msg = error.message || '\u63d0\u4ea4\u5931\u8d25';
      state.chatMessages = (state.chatMessages || []).map(item => (
        item.id === startMessageId
          ? { role: 'assistant', text: `\u8fd9\u6b21\u6ca1\u6709\u6210\u529f\u542f\u52a8\uff1a${msg}\n\u4f60\u53ef\u4ee5\u68c0\u67e5 API Key\u3001\u6a21\u578b\u3001URL\uff0c\u6216\u8005\u7a0d\u540e\u518d\u8bd5\u3002`, time: Date.now() }
          : item
      )).slice(-80);
      toast(msg, 'error');
    } finally {
      state.creating = false;
      renderChatUpdate();
    }
  }

  async function cancelActiveJob() {
    const activeJob = getActiveJob();
    const jobId = state.activeJobId || jobIdOf(activeJob);
    if (!jobId) return;
    state.creating = false;
    state.chatSending = false;
    try {
      await request(`/jobs/${encodeURIComponent(jobId)}/cancel`, { method: 'POST' });
      state.chatMessages = [...(state.chatMessages || []), { role: 'assistant', text: '已发送暂停请求。当前步骤会尽快停止，已经生成的中间文件会保留，后面可以继续调整后重新生成。', time: Date.now(), jobId }].slice(-80);
      state.activeJobId = '';
      await loadAll(true);
      toast('已暂停当前生成', 'success');
    } catch (error) {
      toast(error.message || '暂停失败', 'error');
    } finally {
      renderChatUpdate();
    }
  }

  function cancelChatResponse() {
    if (!state.chatSending) return;
    try { state.chatAbortController?.abort(); } catch (_) {}
    state.chatAbortController = null;
    state.chatSending = false;
    state.chatMessages = (state.chatMessages || []).filter(item => !item.pending);
    appendChatMessage({ role: 'assistant', text: '已暂停这次回复。你可以继续补充新的要求。', time: Date.now() });
    renderChatUpdate();
  }

  function handleAssistantAction() {
    const activeJob = getActiveJob();
    if (state.chatSending) {
      cancelChatResponse();
      return;
    }
    if (state.activeJobId && (!activeJob || isJobRunning(activeJob))) {
      cancelActiveJob();
      return;
    }
    state.activeJobId = '';
    const text = state.chatDraft.trim();
    if (!wantsGenerate(text)) {
      sendChatMessage();
      return;
    }
    createJob();
  }

  async function deleteJob(jobId) {
    if (!jobId) return;
    if (!confirm('\u786e\u5b9a\u8981\u5220\u9664\u8fd9\u4e2a\u4efb\u52a1\u5417\uff1f\u670d\u52a1\u5668\u4e0a\u7684\u89c6\u9891\u548c\u4e2d\u95f4\u4ea7\u7269\u4e5f\u4f1a\u4e00\u8d77\u5220\u9664\u3002')) return;
    try {
      const id = String(jobId);
      await request(`/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' });
      state.hiddenJobs = state.hiddenJobs.filter(item => item !== id);
      if (state.activeJobId === id) state.activeJobId = '';
      persistHiddenJobs();
      state.jobs = state.jobs.filter(job => String(job.job_id || job.id || '') !== id);
      render();
      toast('\u5df2\u5220\u9664', 'success');
    } catch (error) {
      toast(error.message || '\u5220\u9664\u5931\u8d25', 'error');
    }
  }


  async function continueJob(jobId) {
    if (!jobId) return;
    const id = String(jobId);
    const job = (state.jobs || []).find(item => String(item.job_id || item.id || '') === id);
    try {
      if (job?.status === 'completed' && job.request) {
        const req = job.request || {};
        await request('/jobs', {
          method: 'POST',
          body: JSON.stringify({
            template_id: req.template_id || job.template_id || 'social-clip',
            prompt: req.prompt || '',
            duration: Number(req.duration || 15),
            aspect: req.aspect || '9:16',
            quality: req.quality || 'standard',
            provider: req.provider || state.provider || 'openai',
            model: req.model || '',
            asset_ids: [],
            ...(req.style_reference ? { style_reference: req.style_reference } : {}),
          }),
        });
        toast('\u5df2\u91cd\u65b0\u63d0\u4ea4\u4e00\u4e2a\u65b0\u4efb\u52a1', 'success');
      } else {
        await request(`/jobs/${encodeURIComponent(id)}/continue`, { method: 'POST' });
        toast('\u7ee7\u7eed\u751f\u6210\u8bf7\u6c42\u5df2\u53d1\u9001', 'success');
      }
      state.tab = 'works';
      await loadAll(true);
    } catch (error) {
      toast(error.message || '\u751f\u6210\u8bf7\u6c42\u5931\u8d25', 'error');
    }
  }

  async function saveKeys() {
    state.saving = true; render();
    try {
      commitModelDrafts();
      const customChannels = (state.customChannels || []).map((item, index) => normalizeCustomChannel(item, index));
      const payload = {
        claude_api_url: state.keyForm.claude_api_url,
        openai_api_url: state.keyForm.openai_api_url,
        custom_api_url: state.keyForm.custom_api_url,
        claude_model: state.keyForm.claude_model,
        openai_model: state.keyForm.openai_model,
        custom_model: state.keyForm.custom_model,
        claude_protocol: state.keyForm.claude_protocol,
        openai_protocol: state.keyForm.openai_protocol,
        custom_protocol: state.keyForm.custom_protocol,
        custom_channels: customChannels,
        tts_config: { ...state.ttsForm },
      };
      if (state.keyForm.claude_api_key.trim()) payload.claude_api_key = state.keyForm.claude_api_key.trim();
      if (state.keyForm.openai_api_key.trim()) payload.openai_api_key = state.keyForm.openai_api_key.trim();
      if (state.keyForm.custom_api_key.trim()) payload.custom_api_key = state.keyForm.custom_api_key.trim();
      ['openai_api_key', 'google_api_key', 'minimax_api_key'].forEach(key => {
        if (!state.ttsForm[key]?.trim()) delete payload.tts_config[key];
      });
      await request('/api-keys', { method: 'POST', body: JSON.stringify(payload) });
      toast('API Key 已保存', 'success');
      state.keyForm.claude_api_key = '';
      state.keyForm.openai_api_key = '';
      state.keyForm.custom_api_key = '';
      state.ttsForm.openai_api_key = '';
      state.ttsForm.google_api_key = '';
      state.ttsForm.minimax_api_key = '';
      state.customChannels = customChannels.map(item => ({ ...item, api_key: '' }));
      await loadAll(true);
    } catch (error) {
      toast(error.message || '保存失败', 'error');
    } finally {
      state.saving = false; render();
    }
  }

  async function testApiProvider(provider) {
    state.testingProvider = provider;
    render();
    try {
      const channel = isExtraCustomProvider(provider) ? findCustomChannel(provider) : null;
      const payload = channel ? {
        provider,
        api_url: channel.api_url,
        api_key: channel.api_key,
        protocol: channel.protocol || 'auto',
      } : {
        provider,
        api_url: state.keyForm[`${provider}_api_url`],
        api_key: state.keyForm[`${provider}_api_key`],
        protocol: state.keyForm[`${provider}_protocol`],
      };
      const model = firstProviderModel(provider);
      if (model) payload.model = model;
      const res = await request('/api-keys/test', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const hit = res.resolved_url ? `\uff0c\u547d\u4e2d ${res.protocol || ''} ${res.resolved_url}` : '';
      toast(`${providerShortName(provider)} \u6d4b\u8bd5\u6210\u529f${hit}`, 'success');
    } catch (error) {
      toast(error.message || '\u6d4b\u8bd5\u5931\u8d25', 'error');
    } finally {
      state.testingProvider = '';
      render();
    }
  }

  async function testTtsProvider(provider) {
    state.testingTtsProvider = provider;
    renderKeepScroll();
    try {
      const payload = {
        provider,
        api_url: state.ttsForm[`${provider}_api_url`],
        api_key: state.ttsForm[`${provider}_api_key`],
        model: state.ttsForm[`${provider}_model`],
        voice: state.ttsForm[`${provider}_voice`],
        group_id: state.ttsForm.minimax_group_id,
      };
      const res = await request('/api-keys/tts-test', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast(`${provider === 'openai' ? 'GPT TTS' : provider === 'google' ? 'Google TTS' : 'MiniMax TTS'} 测试成功`, 'success');
    } catch (error) {
      toast(error.message || 'TTS 测试失败', 'error');
    } finally {
      state.testingTtsProvider = '';
      renderKeepScroll();
    }
  }

  function normalizeOptions(options) {
    return options.map(item => {
      const value = Array.isArray(item) ? item[0] : item;
      const label = Array.isArray(item) ? item[1] : item;
      return { value, label };
    });
  }

  function customSelect(label, field, options, current) {
    const normalized = normalizeOptions(options);
    const active = normalized.find(item => String(item.value) === String(current)) || normalized[0] || { value: '', label: '' };
    return `
      <div class="zx-hf-field zx-hf-custom-select-field">
        <span>${esc(label)}</span>
        <div class="zx-hf-select" data-select-field="${esc(field)}">
          <button type="button" class="zx-hf-select-trigger" data-select-trigger>
            <strong>${esc(active.label)}</strong>
            <i aria-hidden="true"></i>
          </button>
          <div class="zx-hf-select-menu">
            ${normalized.map(item => `
              <button type="button" data-select-option="${esc(item.value)}" class="${String(item.value) === String(current) ? 'active' : ''}">
                <span>${esc(item.label)}</span>
                <b aria-hidden="true"></b>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }


  function modelListFromString(value) {
    const seen = new Set();
    return String(value || '')
      .split(/[\n,\uFF0C;\uFF1B|]+/)
      .map(item => item.trim())
      .filter(item => {
        if (!item || seen.has(item)) return false;
        seen.add(item);
        return true;
      });
  }

  function joinModelList(models) {
    return modelListFromString(models).join(', ');
  }

  function getProviderModelList(provider) {
    if (isExtraCustomProvider(provider)) {
      const channel = findCustomChannel(provider);
      return modelListFromString(channel?.model || '');
    }
    const key = `${provider}_model`;
    return modelListFromString(state.keyForm[key] || state.keys[key] || '');
  }

  function setProviderModelList(provider, models) {
    const clean = modelListFromString(models);
    if (isExtraCustomProvider(provider)) {
      const channel = findCustomChannel(provider);
      if (channel) updateCustomChannel(channel.id, 'model', clean.join(', '));
    } else {
      const key = `${provider}_model`;
      state.keyForm[key] = clean.join(', ');
    }
    if (state.provider === provider && state.model && !clean.includes(state.model)) {
      state.model = clean[0] || '';
      state.modelChoice = state.model ? `${provider}::${state.model}` : '';
    }
    if (!state.modelChoice && clean[0]) {
      state.provider = provider;
      state.model = clean[0];
      state.modelChoice = `${provider}::${clean[0]}`;
    }
    return clean;
  }

  function firstProviderModel(provider) {
    if (isExtraCustomProvider(provider)) {
      return getProviderModelList(provider)[0] || '';
    }
    return getProviderModelList(provider)[0] || String(state.keyForm[`${provider}_model`] || state.keys[`${provider}_model`] || '').trim();
  }

  function addProviderModel(provider, shouldRender = true, draftOverride = '') {
    const draft = String(draftOverride || state.modelDrafts?.[provider] || '').trim();
    if (!draft) return false;
    const merged = [...getProviderModelList(provider), ...modelListFromString(draft)];
    setProviderModelList(provider, merged);
    state.modelDrafts[provider] = '';
    if (shouldRender) render();
    return true;
  }

  function removeProviderModel(provider, model) {
    const next = getProviderModelList(provider).filter(item => item !== model);
    setProviderModelList(provider, next);
    render();
  }

  function commitModelDrafts() {
    ['claude', 'openai', 'custom', ...(state.customChannels || []).map(customProviderKey)].forEach(provider => addProviderModel(provider, false));
  }

  function configuredModelOptions() {
    const defs = [
      { provider: 'openai', title: 'GPT', key: 'openai_api_key', model: 'openai_model' },
      { provider: 'claude', title: 'Claude', key: 'claude_api_key', model: 'claude_model' },
      { provider: 'custom', title: '\u81ea\u5b9a\u4e49', key: 'custom_api_key', model: 'custom_model' },
    ];
    const options = [];
    defs.forEach(item => {
      const hasSavedKey = Boolean(state.keys[item.key]);
      if (!hasSavedKey) return;
      getProviderModelList(item.provider).forEach(model => {
        options.push([`${item.provider}::${model}`, `${item.title} \u00b7 ${model}`]);
      });
    });
    (state.customChannels || []).forEach(channel => {
      const provider = customProviderKey(channel);
      const saved = (state.keys.custom_channels || []).find(item => String(item.id) === String(channel.id));
      const hasKey = Boolean(channel.api_key || saved?.api_key);
      if (!hasKey) return;
      getProviderModelList(provider).forEach(model => {
        options.push([`${provider}::${model}`, `${channel.name || '\u81ea\u5b9a\u4e49 API'} \u00b7 ${model}`]);
      });
    });
    if (options.length) return options;
    const fallback = firstProviderModel(state.provider) || state.model || 'gpt-5.5';
    return [[`${state.provider}::${fallback}`, `\u672a\u914d\u7f6e\uff0c\u5148\u7528 ${providerLabels[state.provider] || state.provider} \u00b7 ${fallback}`]];
  }

  function applyModelChoice(value) {
    const raw = String(value || '');
    const divider = raw.indexOf('::');
    const provider = divider >= 0 ? raw.slice(0, divider) : raw;
    const rest = divider >= 0 ? [raw.slice(divider + 2)] : [];
    const model = rest.join('::');
    if (provider) state.provider = provider;
    if (model) state.model = model;
    state.modelChoice = value || state.modelChoice;
  }

  function ensureModelChoice() {
    const options = configuredModelOptions();
    const values = options.map(item => String(item[0]));
    if (!state.modelChoice || !values.includes(String(state.modelChoice))) {
      state.modelChoice = values[0] || '';
    }
    if (state.modelChoice) applyModelChoice(state.modelChoice);
  }

  function allTemplates() {
    return [
      ...state.templates.map(item => ({ ...item, template_kind: 'system' })),
      ...state.userTemplates.map(item => ({ ...item, template_kind: 'user' })),
    ];
  }

  function getTemplateById(id) {
    return allTemplates().find(item => String(item.id) === String(id));
  }

  function selectedTemplateSourceId() {
    const item = getTemplateById(state.selectedTemplate);
    return item?.source_template_id || item?.id || state.selectedTemplate;
  }

  function selectedTemplateStyleReference() {
    const item = getTemplateById(state.selectedTemplate);
    return item?.template_kind === 'user' ? String(item.style_reference || item.styleReference || '') : '';
  }

  function compactTemplateName(value, fallback = '我的模板') {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    const base = text || fallback;
    return base.length > 20 ? `${base.slice(0, 20)}…` : base;
  }

  function defaultSavedTemplateName(value, fallback = '我的模板') {
    const text = String(value || '').replace(/作品题目[：:]/g, '').replace(/\s+/g, ' ').trim();
    return compactTemplateName(text, fallback);
  }

  function compactStyleReference(html = '') {
    const text = String(html || '').trim();
    if (!text) return '';
    const styles = Array.from(text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)).map(match => match[1].trim()).filter(Boolean);
    const bodyMatch = text.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    const body = (bodyMatch ? bodyMatch[1] : text)
      .replace(/<script\b[\s\S]*?<\/script>/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const scriptMatch = text.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
    const script = scriptMatch ? scriptMatch[1] : '';
    const animationBits = [
      ...(script.match(/(?:const|let|var|function)\s+ease[A-Za-z0-9_]*[\s\S]{0,900}/g) || []),
      ...(script.match(/function\s+render\s*\([^)]*\)\s*\{[\s\S]{0,2200}/g) || []),
      ...(script.match(/window\.__timelines[\s\S]{0,900}/g) || []),
    ].slice(0, 4).join('\n\n');
    return [
      styles[0] ? `CSS:\n${styles[0].slice(0, 7000)}` : '',
      body ? `HTML结构片段:\n${body.slice(0, 2600)}` : '',
      animationBits ? `动画/时间轴片段:\n${animationBits.slice(0, 3200)}` : '',
    ].filter(Boolean).join('\n\n').slice(0, 14000);
  }

  async function fetchJobStyleReference(jobId) {
    if (!jobId) return '';
    try {
      const html = await request(`/jobs/${encodeURIComponent(jobId)}/artifact/index.html`, {
        headers: { Accept: 'text/plain' },
      });
      return compactStyleReference(html);
    } catch (_) {
      return '';
    }
  }

  function applyTemplateSelection(id) {
    const item = getTemplateById(id);
    if (!item) return;
    state.selectedTemplate = item.id;
    state.templatePickerOpen = false;
    if (item.template_kind === 'user') {
      state.projectTitle = item.name || state.projectTitle;
      state.prompt = item.prompt || state.prompt;
      state.durationMode = item.durationMode || state.durationMode;
      state.customDuration = item.customDuration || state.customDuration;
      state.aspect = item.aspect || state.aspect;
      state.quality = item.quality || state.quality;
      if (item.modelChoice) applyModelChoice(item.modelChoice);
    }
  }

  function saveTemplatePreset() {
    const source = selectedTemplateSourceId();
    if (!source) return toast('\u5148\u9009\u62e9\u4e00\u4e2a\u57fa\u7840\u6a21\u677f', 'error');
    const existingStyleReference = selectedTemplateStyleReference();
    const fallbackName = defaultSavedTemplateName(state.projectTitle || state.prompt, '\u6211\u7684\u6a21\u677f');
    const name = window.prompt('\u7ed9\u8fd9\u5957\u80cc\u666f / \u98ce\u683c\u8d77\u4e2a\u5907\u6ce8\u540d', fallbackName);
    if (name === null) return;
    const displayName = compactTemplateName(name, fallbackName);
    const item = {
      id: `user-${Date.now()}`,
      name: displayName,
      description: state.prompt.trim() || '\u4ece\u804a\u5929\u5de5\u4f5c\u53f0\u4fdd\u5b58\u7684\u6a21\u677f',
      source_template_id: source,
      prompt: state.prompt,
      durationMode: state.durationMode,
      customDuration: state.customDuration,
      aspect: state.aspect,
      quality: state.quality,
      provider: state.provider,
      model: state.model,
      modelChoice: state.modelChoice,
      style_reference: existingStyleReference,
      created_at: Date.now(),
    };
    state.userTemplates = [item, ...(state.userTemplates || [])].slice(0, 60);
    persistUserTemplates();
    state.selectedTemplate = item.id;
    toast('\u5df2\u4fdd\u5b58\u5230\u6211\u7684\u6a21\u677f', 'success');
    render();
  }

  async function saveTemplateFromJob(jobId) {
    const id = String(jobId || '');
    const job = (state.jobs || []).find(item => String(item.job_id || item.id || '') === id);
    if (!job || !job.request) return toast('\u6ca1\u627e\u5230\u53ef\u4fdd\u5b58\u7684\u4efb\u52a1\u53c2\u6570', 'error');
    const req = job.request || {};
    const defaultName = (String(req.prompt || '').match(/\u4f5c\u54c1\u9898\u76ee[\uff1a:][^\n]+/) || [''])[0].replace(/^\u4f5c\u54c1\u9898\u76ee[\uff1a:]/, '').trim() || '\u6211\u7684\u6210\u7247\u6a21\u677f';
    const fallbackName = defaultSavedTemplateName(defaultName, '\u6211\u7684\u6a21\u677f');
    const name = window.prompt('\u7ed9\u8fd9\u5957\u80cc\u666f / \u98ce\u683c\u8d77\u4e2a\u5907\u6ce8\u540d', fallbackName);
    if (name === null) return;
    const displayName = compactTemplateName(name, fallbackName);
    toast('\u6b63\u5728\u63d0\u53d6\u8fd9\u4e00\u7248\u7684\u89c6\u89c9\u98ce\u683c...', 'info');
    const styleReference = await fetchJobStyleReference(id);
    const duration = Number(req.duration || 15);
    const durationMode = [5, 12, 30, 60].includes(duration) ? String(duration) : 'custom';
    const item = {
      id: `user-${Date.now()}`,
      name: displayName,
      description: String(req.prompt || '').slice(0, 180) || '\u4ece\u5df2\u751f\u6210\u4f5c\u54c1\u4fdd\u5b58\u7684\u6a21\u677f',
      source_template_id: req.template_id || job.template_id || 'social-clip',
      prompt: req.prompt || '',
      durationMode,
      customDuration: duration,
      aspect: req.aspect || '9:16',
      quality: req.quality || 'standard',
      provider: req.provider || state.provider,
      model: req.model || '',
      modelChoice: req.provider && req.model ? `${req.provider}::${req.model}` : '',
      style_reference: styleReference,
      created_at: Date.now(),
    };
    state.userTemplates = [item, ...(state.userTemplates || [])].slice(0, 60);
    persistUserTemplates();
    state.selectedTemplate = item.id;
    toast(styleReference ? '\u5df2\u4fdd\u5b58\u5230\u6a21\u677f\u5e93\uff0c\u5e76\u9501\u5b9a\u8fd9\u7248\u89c6\u89c9\u98ce\u683c' : '\u5df2\u4fdd\u5b58\u5230\u6a21\u677f\u5e93\uff0c\u4f46\u672a\u8bfb\u5230\u98ce\u683c\u4ea7\u7269', 'success');
    renderKeepScroll ? renderKeepScroll() : render();
  }

  function removeUserTemplate(id) {
    state.userTemplates = (state.userTemplates || []).filter(item => String(item.id) !== String(id));
    persistUserTemplates();
    if (state.selectedTemplate === id) state.selectedTemplate = state.templates[0]?.id || '';
    toast('\u5df2\u5220\u9664\u6a21\u677f', 'success');
    render();
  }

  function editUserTemplateBackground(id) {
    const item = (state.userTemplates || []).find(t => String(t.id) === String(id));
    if (!item) return;
    const next = window.prompt('\u4fee\u6539\u80cc\u666f / \u98ce\u683c\u5907\u6ce8\u540d', item.name || item.background_name || '');
    if (next === null) return;
    item.name = compactTemplateName(next, item.name || '\u6211\u7684\u6a21\u677f');
    persistUserTemplates();
    toast('\u5df2\u66f4\u65b0\u80cc\u666f\u5907\u6ce8', 'success');
    render();
  }

  async function sendChatMessage() {
    if (state.chatSending) return;
    const text = state.chatDraft.trim();
    if (!text && !state.projectTitle?.trim() && !state.prompt?.trim() && !state.files.length) return toast('先输入你想聊的内容，或上传参考素材', 'error');
    const input = document.querySelector(`#${PAGE_ID} [data-field="chatDraft"]`);
    if (input) input.value = '';
    ensureModelChoice();
    const fileText = state.files.length ? `
\u9644\u4ef6\uff1a${state.files.map(file => file.name).join(' / ')}` : '';
    const contextText = [
      state.projectTitle.trim() ? `\u9898\u76ee\uff1a${state.projectTitle.trim()}` : '',
      state.prompt.trim() ? `\u9700\u6c42\u63cf\u8ff0\uff1a${state.prompt.trim()}` : '',
    ].filter(Boolean).join('\n');
    const messageText = text || contextText;
    const userText = `${messageText}${fileText}`.trim();
    const previousMessages = (state.chatMessages || []).slice(-10);
    const pendingId = `chat-pending-${Date.now()}`;
    state.chatMessages = [
      ...(state.chatMessages || []),
      { role: 'user', text: userText, time: Date.now() },
      { role: 'assistant', text: '\u6b63\u5728\u601d\u8003...', time: Date.now(), pending: true, id: pendingId },
    ].slice(-80);
    state.chatDraft = '';
    state.chatDraftVersion += 1;
    state.ignoreNextChatDraftChange = true;
    state.chatSending = true;
    state.chatAbortController = new AbortController();
    renderChatUpdate();
    try {
      const data = await request('/chat', {
        method: 'POST',
        signal: state.chatAbortController.signal,
        body: JSON.stringify({
          provider: state.provider,
          model: state.model,
          project_title: state.projectTitle,
          prompt: state.prompt,
          message: userText,
          messages: previousMessages,
          template_id: selectedTemplateSourceId(),
          duration: resolveDuration(),
          aspect: state.aspect,
          quality: state.quality,
          asset_names: state.files.map(file => file.name),
        }),
      });
      const replyBase = data.reply || '\u6211\u5df2\u8bb0\u5f55\u8fd9\u6b21\u4fee\u6539\uff0c\u4f46 AI \u6ca1\u6709\u8fd4\u56de\u5177\u4f53\u5185\u5bb9\u3002';
      const replyText = `${replyBase}\n\n如果方向已经可以，点下方“生成视频”，我就开始跑一版。`;
      state.chatMessages = (state.chatMessages || []).map(item => (
        item.id === pendingId ? { role: 'assistant', text: replyText, time: Date.now(), suggestGenerate: true } : item
      )).slice(-80);
    } catch (error) {
      if (error.name === 'AbortError') return;
      const msg = error.message || '\u53d1\u9001\u5931\u8d25';
      state.chatMessages = (state.chatMessages || []).map(item => (
        item.id === pendingId ? { role: 'assistant', text: `AI \u6682\u65f6\u6ca1\u6709\u56de\u590d\uff1a${msg}`, time: Date.now() } : item
      )).slice(-80);
      toast(msg, 'error');
    } finally {
      state.chatAbortController = null;
      state.chatSending = false;
      renderChatUpdate();
    }
  }
  function templateCards(list = allTemplates(), mode = 'grid') {
    if (!list.length) return '<div class="zx-hf-empty small">\u6682\u65e0\u6a21\u677f</div>';
    return list.map(item => `
      <button type="button" class="zx-hf-template system ${mode === 'compact' ? 'compact' : ''} ${item.id === state.selectedTemplate ? 'active' : ''}" data-template="${esc(item.id)}" title="${esc(item.description || item.name || '')}">
        <span class="zx-hf-card-mark" aria-hidden="true"></span>
        <strong>${esc(item.name)}</strong>
        <em>${esc(item.description || '')}</em>
        ${item.template_kind === 'user' ? '<b>\u6211\u7684\u6a21\u677f</b>' : ''}
      </button>
    `).join('');
  }

  function userTemplateCardHtml(item) {
    const titleText = compactTemplateName(item.name || item.style_name || item.background_name, '\u6211\u7684\u6a21\u677f');
    const fullText = String(item.prompt || item.description || item.name || '').trim();
    const active = item.id === state.selectedTemplate ? 'active' : '';
    return `
      <button type="button" class="zx-hf-template user compact ${active}" data-template="${esc(item.id)}" title="${esc(fullText || titleText)}">
        <span class="zx-hf-card-mark" aria-hidden="true"></span>
        <strong>${esc(titleText)}</strong>
        <em>${esc(item.style_reference ? '\u98ce\u683c\u5df2\u9501\u5b9a' : '\u57fa\u7840\u53c2\u8003')}</em>
        <b>\u6211\u7684\u6a21\u677f</b>
        <span class="zx-hf-template-acts" aria-label="\u6a21\u677f\u64cd\u4f5c">
          <i role="button" tabindex="0" data-user-template-bg="${esc(item.id)}" title="\u5907\u6ce8">\u5907\u6ce8</i>
          <i role="button" tabindex="0" data-user-template-delete="${esc(item.id)}" title="\u5220\u9664">\u5220\u9664</i>
        </span>
      </button>
    `;
  }

  function templatePickerHtml() {
    const query = state.templateQuery.trim().toLowerCase();
    const system = state.templates.filter(item => !query || `${item.name} ${item.description || ''}`.toLowerCase().includes(query));
    const mine = state.userTemplates.filter(item => !query || `${item.name} ${item.description || ''}`.toLowerCase().includes(query));
    return `
      <div class="zx-hf-template-picker">
        <div class="zx-hf-template-picker-head">
          <strong>\u9009\u62e9\u53c2\u8003\u793a\u4f8b</strong>
          <button type="button" data-close-template-picker>\u5173\u95ed</button>
        </div>
        <input class="zx-hf-template-search" data-template-query value="${esc(state.templateQuery)}" placeholder="\u641c\u7d22\u6a21\u677f\u540d\u79f0 / \u7528\u9014" />
        <div class="zx-hf-template-group"><span>\u5185\u7f6e\u53c2\u8003</span><div class="zx-hf-template-library compact">${templateCards(system, 'compact')}</div></div>
        <div class="zx-hf-template-group"><span>\u6211\u4fdd\u5b58\u7684\u53c2\u8003</span><div class="zx-hf-template-library compact">${mine.length ? mine.map(userTemplateCardHtml).join('') : '<div class="zx-hf-empty small">\u8dd1\u901a\u4e00\u7248\u540e\u53ef\u70b9\u201c\u4fdd\u5b58\u4e3a\u6a21\u677f\u201d</div>'}</div></div>
      </div>
    `;
  }

  function markdownLite(value) {
    return esc(value || '')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  function agentEventIcon(event) {
    const tool = String(event?.tool || event?.key || event?.type || '');
    if (tool === 'inspect') return '🔍';
    if (tool === 'snapshot') return '📸';
    if (tool === 'vision') return '👁';
    if (tool === 'composition') return '✏️';
    if (tool === 'render') return '🎬';
    if (tool === 'verify') return '✓';
    if (event?.type === 'done') return '✓';
    if (event?.type === 'error') return '!';
    return event?.status === 'running' ? '●' : '○';
  }

  function stepTimelineHtml(job) {
    const steps = Array.isArray(job?.steps) ? job.steps : [];
    if (!steps.length) return '';
    return `<div class="zx-hf-agent-progress">${steps.map(step => {
      const status = String(step.status || 'pending');
      const icon = status === 'done' ? '✓' : status === 'running' ? '●' : status === 'failed' ? '!' : status === 'cancelled' ? '⏸' : '○';
      const title = publicStepTitles[step.key] || step.title || step.key || '步骤';
      const detail = cleanStepDetail(step.detail || '');
      return `<div class="zx-hf-agent-progress-row ${esc(status)}"><i>${icon}</i><span>${esc(title)}</span>${detail && status !== 'pending' ? `<em>${esc(detail)}</em>` : ''}</div>`;
    }).join('')}</div>`;
  }

  function agentEventsHtml(job) {
    const jobId = state.activeJobId || jobIdOf(job);
    const events = (state.agentEvents || []).filter(item => !jobId || item.jobId === jobId).slice(-80);
    if (!events.length) return '';
    return `<div class="zx-hf-agent-event-list">${events.map(event => {
      const label = event.type === 'tool' ? `${event.tool || 'tool'}${event.round ? ` \u00b7 \u7b2c${event.round}\u8f6e` : ''}` : (event.type === 'thinking' ? 'AI thinking' : event.type || 'event');
      const text = event.text || event.detail || event.message || event.status || '';
      return `<div class="zx-hf-agent-event ${esc(event.type || '')}"><span>${agentEventIcon(event)}</span><strong>${esc(label)}</strong><em>${esc(text)}</em></div>`;
    }).join('')}</div>`;
  }

  function chatMessagesHtml() {
    const activeJob = getActiveJob();
    const base = state.chatMessages.length ? state.chatMessages : [
      { role: 'assistant', text: '告诉我你想做什么视频，我来帮你生成。你可以描述主题、风格、时长，也可以直接把文案发给我。' },
    ];
    const messageHtml = base.map(item => {
      const meta = item.role === 'user' ? '你' : (item.pending ? 'AI 正在处理' : 'AI');
      const flags = [
        esc(item.role),
        item.pending ? 'pending' : '',
        item.liveStatus ? 'live' : '',
        item.doneNotice ? 'done' : '',
        item.workStart ? 'work-start' : '',
        item.progressNotice ? 'progress-notice' : '',
        item.suggestGenerate ? 'with-action' : '',
      ].filter(Boolean).join(' ');
      const actions = item.suggestGenerate ? '<div class="zx-hf-chat-actions"><button type="button" data-generate-video>生成视频</button></div>' : '';
      const video = item.videoUrl ? `<div class="zx-hf-inline-video"><video src="${esc(item.videoUrl)}" controls preload="metadata"></video><div><a href="${esc(item.videoUrl)}" target="_blank" rel="noreferrer">下载视频</a><button type="button" data-video-src="${esc(item.videoUrl)}" data-video-title="一键成片预览">放大预览</button></div></div>` : '';
      return `<div class="zx-hf-chat-msg ${flags}"><span>${meta}</span><p>${markdownLite(item.text)}</p>${actions}${video}</div>`;
    }).join('');
    const timeline = state.activeJobId ? `<div class="zx-hf-chat-msg agent"><span>Agent</span>${stepTimelineHtml(activeJob)}${agentEventsHtml(activeJob)}</div>` : '';
    return messageHtml + timeline;
  }


  function renderCreate() {
    ensureModelChoice();
    const selected = getTemplateById(state.selectedTemplate) || state.templates[0] || {};
    const modelOptions = configuredModelOptions();
    const activeJob = getActiveJob();
    const jobRunning = state.activeJobId && (!activeJob || isJobRunning(activeJob));
    const running = state.chatSending || jobRunning;
    const draftReady = Boolean(state.chatDraft.trim() || state.projectTitle.trim() || state.prompt.trim() || state.files.length);
    const actionText = state.chatSending ? '暂停回复' : (jobRunning ? '暂停生成' : (state.creating ? '提交中' : '发送'));
    const actionClass = `${running ? 'zx-hf-send-button pause' : 'zx-hf-send-button'} ${draftReady ? 'ready' : ''}`;
    return `
      <div class="zx-hf-workbench zx-hf-chat-workbench zx-hf-agent-workbench">
        <section class="zx-hf-card zx-hf-chat-card zx-hf-agent-card">
          <div class="zx-hf-agent-topbar">
            <label><span>标题</span><input data-field="projectTitle" value="${esc(state.projectTitle)}" placeholder="选填，方便保存和查找" /></label>
            <div class="zx-hf-agent-status">${state.activeJobId ? `\u6b63\u5728\u5904\u7406 \u00b7 ${esc(statusText[activeJob?.status] || activeJob?.status || '\u8fd0\u884c\u4e2d')}` : '\u548c AI \u6c9f\u901a\u9700\u6c42\uff0c\u6ee1\u610f\u540e\u8bf4\u201c\u5f00\u59cb\u751f\u6210\u201d'}</div>
          </div>
          <div class="zx-hf-chat-log">${chatMessagesHtml()}</div>
          <div class="zx-hf-chat-files">${assetPreviewHtml()}</div>
          <div class="zx-hf-chat-composer">
            <textarea data-field="chatDraft" data-chat-draft-version="${state.chatDraftVersion}" placeholder="描述你想做的视频，或上传素材...">${esc(state.chatDraft)}</textarea>
            <div class="zx-hf-chat-toolbar">
              <label class="zx-hf-upload-icon-btn" title="上传素材"><input type="file" data-chat-file accept=".jpg,.jpeg,.png,.webp,.mp4" multiple /><span aria-hidden="true"></span></label>
              <span class="zx-hf-composer-hint">${state.chatSending ? 'AI 正在回复，点击右侧可暂停' : (jobRunning ? '正在生成，可继续输入修改意见' : '回车发送，Shift+Enter 换行')}</span>
              <button type="button" class="${actionClass}" data-assistant-action aria-label="${actionText}" title="${actionText}"><span aria-hidden="true"></span></button>
            </div>
          </div>
        </section>
        <aside class="zx-hf-card zx-hf-control-card zx-hf-agent-settings">
          <details open>
            <summary><strong>\u9ad8\u7ea7\u8bbe\u7f6e</strong><span>${esc(resolveDuration())}\u79d2 \u00b7 ${esc(state.aspect)} \u00b7 ${esc(providerLabels[state.provider] || state.provider)}</span></summary>
            <div class="zx-hf-selected-template">
              <span>参考示例</span>
              <strong>${esc(selected.name || '未选择')}</strong>
              <em>${esc(selected.description || '')}</em>
              <button type="button" data-open-template-picker>选择更多参考</button>
            </div>
            <div class="zx-hf-form-row two">
              ${customSelect('时长', 'durationMode', durationOptions, state.durationMode)}
              ${customSelect('画幅', 'aspect', aspectOptions, state.aspect)}
            </div>
            <div class="zx-hf-form-row two">
              ${customSelect('画质', 'quality', qualityOptions, state.quality)}
              ${customSelect('AI 模型', 'modelChoice', modelOptions, state.modelChoice)}
            </div>
            ${state.durationMode === 'custom' ? `<label class="zx-hf-field"><span>自定义时长（秒）</span><input type="number" min="3" max="600" step="1" data-field="customDuration" value="${esc(state.customDuration)}" /></label>` : ''}
            <div class="zx-hf-card-head mini"><div class="zx-hf-card-title"><strong>\u7d20\u6750</strong></div><div class="zx-hf-mini-tabs"><button type="button" data-asset-mode="upload" class="${state.assetMode === 'upload' ? 'active' : ''}" >\u4e0a\u4f20</button><button type="button" data-asset-mode="assets" class="${state.assetMode === 'assets' ? 'active' : ''}">\u7d20\u6750\u5e93</button></div></div>
            ${state.assetMode === 'upload' ? `<label class="zx-hf-upload compact"><span class="zx-hf-upload-mark" aria-hidden="true"></span><strong>\u9009\u62e9\u56fe\u7247\u6216 MP4 \u7d20\u6750</strong><em>\u4e5f\u53ef\u4ee5\u62d6\u5230\u4e0b\u65b9\u8f93\u5165\u6846</em><input type="file" data-file-input accept=".jpg,.jpeg,.png,.webp,.mp4" multiple /></label>` : `<div class="zx-hf-empty small">\u7d20\u6750\u5e93\u4f1a\u968f V1 \u4f5c\u54c1\u8d44\u6e90\u540c\u6b65\u63a5\u5165\u3002</div>`}
            <p class="zx-hf-note">模型列表来自“设置”里保存的 API 配置。</p>
          </details>
        </aside>
      </div>
    `;
  }


  function renderWorks() {
    return `
      <section class="zx-hf-card zx-hf-works-card">
        <div class="zx-hf-card-head">
          <div><h2>\u6211\u7684\u4f5c\u54c1</h2><p>\u4efb\u52a1\u72b6\u6001\u3001\u9884\u89c8\u5e27\u3001\u6d41\u6c34\u7ebf\u4ea7\u7269\u548c\u4e0b\u8f7d\u5165\u53e3</p></div>
          <button type="button" class="zx-hf-secondary" data-refresh>\u5237\u65b0</button>
        </div>
        <div class="zx-hf-job-list">
          ${state.jobs.length ? state.jobs.map(job => {
            const status = job.status || 'queued';
            const progress = Math.max(0, Math.min(100, Number(job.progress || 0)));
            const titleText = String(job.request?.prompt || job.template_id || job.job_id || '');
      const metaText = `${formatTime(job.created_at)} · ${job.template_id || ''} · ${job.request?.duration || '-'} 秒 · ${job.request?.aspect || ''}`;
            const errorText = job.error ? String(job.error) : '';
            const steps = Array.isArray(job.steps) ? job.steps : [];
            const frames = Array.isArray(job.preview_frames) ? job.preview_frames : [];
            const artifacts = job.artifacts || {};
            const artifactHtml = artifacts.design || artifacts.storyboard || artifacts.captions ? `<div class="zx-hf-artifacts">
              ${artifacts.design ? '<span>已生成方案</span>' : ''}
              ${artifacts.storyboard ? '<span>已生成分镜</span>' : ''}
              ${artifacts.captions ? '<span>已生成字幕</span>' : ''}
              <span>${artifacts.tts_enabled ? '\u5df2\u63a5\u5165\u8bed\u97f3' : '\u65e0\u58f0\u7248/\u672a\u914d\u7f6e\u8bed\u97f3'}</span>
            </div>` : '';
            const videoSrc = status === 'completed' ? `${API_BASE}/download/${encodeURIComponent(job.job_id)}` : '';
            const posterSrc = frames[0] ? `${API_BASE}${frames[0]}` : '';
            const previewHtml = videoSrc
              ? `<button type="button" class="zx-hf-video-preview" data-video-src="${esc(videoSrc)}" data-video-title="${esc(titleText.slice(0, 60) || '\u89c6\u9891\u9884\u89c8')}">${posterSrc ? `<img src="${esc(posterSrc)}" alt="\u89c6\u9891\u9884\u89c8" loading="lazy" />` : '<i aria-hidden="true"></i>'}<span>\u64ad\u653e\u5b8c\u6574\u89c6\u9891</span></button>`
              : frames.length
                ? `<div class="zx-hf-preview-strip">${frames.map((src, idx) => `<button type="button" class="zx-hf-preview-frame" data-full-text="\u9884\u89c8\u5e27 ${idx + 1}"><img src="${API_BASE}${esc(src)}" alt="\u9884\u89c8\u5e27 ${idx + 1}" loading="lazy" /></button>`).join('')}</div>`
                : '<div class="zx-hf-preview-placeholder">\u5b8c\u6210\u540e\u81ea\u52a8\u663e\u793a\u89c6\u9891\u9884\u89c8</div>';
            const stepHtml = steps.length ? `<div class="zx-hf-agent-steps">
              ${steps.map(step => {
                const stepTitle = String(publicStepTitles[step.key] || step.title || step.key || '\u6b65\u9aa4');
                const stepDetail = cleanStepDetail(step.detail || '');
                const stepFull = stepDetail ? `${stepTitle}\n${stepDetail}` : stepTitle;
                return `<div class="zx-hf-agent-step ${esc(step.status || 'pending')}">
                  <i aria-hidden="true"></i>
                  <div><strong class="zx-hf-click-text" role="button" tabindex="0" data-full-text="${esc(stepFull)}">${esc(stepTitle)}</strong><span class="zx-hf-click-text" role="button" tabindex="0" data-full-text="${esc(stepFull)}">${esc(stepDetail)}</span></div>
                </div>`;
              }).join('')}
            </div>` : '';
            const actions = status === 'completed'
              ? `<div class="zx-hf-job-actions-row"><a class="zx-hf-download" href="${API_BASE}/download/${encodeURIComponent(job.job_id)}" target="_blank" rel="noreferrer">\u4e0b\u8f7d</a><button type="button" class="zx-hf-save-template-action" data-save-job-template="${esc(job.job_id)}">\u4fdd\u5b58\u6a21\u677f</button><button type="button" class="zx-hf-continue zx-hf-continue-secondary" data-continue-job="${esc(job.job_id)}">\u91cd\u65b0\u751f\u6210</button><button type="button" class="zx-hf-delete" data-delete-job="${esc(job.job_id)}">\u5220\u9664</button></div>`
              : `<div class="zx-hf-job-actions-row"><button type="button" class="zx-hf-continue" data-continue-job="${esc(job.job_id)}">\u7ee7\u7eed\u751f\u6210</button><button type="button" class="zx-hf-delete" data-delete-job="${esc(job.job_id)}">\u5220\u9664</button></div>`;
            return `<div class="zx-hf-job zx-hf-job-rich">
              <div class="zx-hf-job-preview">${previewHtml}</div>
              <div class="zx-hf-job-content">
                <div class="zx-hf-job-topline"><span class="zx-hf-badge ${esc(status)}">${esc(statusText[status] || status)}</span><span>${progress}%</span></div>
                <div class="zx-hf-job-main"><strong class="zx-hf-click-text" role="button" tabindex="0" data-full-text="${esc(titleText)}">${esc(titleText)}</strong><span class="zx-hf-click-text" role="button" tabindex="0" data-full-text="${esc(metaText)}">${esc(metaText)}</span>${errorText ? `<em class="zx-hf-click-text" role="button" tabindex="0" data-full-text="${esc(errorText)}">${esc(errorText)}</em>` : ''}</div>
                <div class="zx-hf-progress"><i style="width:${progress}%"></i></div>
                ${artifactHtml}
                ${stepHtml}
                <div class="zx-hf-job-actions">${actions}</div>
              </div>
            </div>`;
          }).join('') : '<div class="zx-hf-empty">\u8fd8\u6ca1\u6709\u4f5c\u54c1</div>'}
        </div>
      </section>
    `;
  }

function renderTemplates() {
    const system = state.templates.map(item => ({ ...item, template_kind: 'system' }));
    const mine = state.userTemplates || [];
    return `
      <section class="zx-hf-card zx-hf-template-page">
        <div class="zx-hf-card-head"><div><h2>\u53c2\u8003\u793a\u4f8b</h2><p>\u8fd9\u4e9b\u53ea\u662f\u7ed9 AI \u770b\u7684\u98ce\u683c\u53c2\u8003\uff0c\u5b9e\u9645\u751f\u6210\u4f1a\u6839\u636e\u4f60\u7684\u9700\u6c42\u81ea\u7531\u521b\u4f5c\u3002</p></div></div>
        <div class="zx-hf-template-section"><strong>\u5185\u7f6e\u53c2\u8003</strong><div class="zx-hf-template-library">${templateCards(system)}</div></div>
        <div class="zx-hf-template-section"><strong>\u6211\u4fdd\u5b58\u7684\u53c2\u8003</strong><div class="zx-hf-template-library">${mine.length ? mine.map(userTemplateCardHtml).join('') : '<div class="zx-hf-empty">\u6682\u65e0\u81ea\u5b9a\u4e49\u6a21\u677f</div>'}</div></div>
      </section>
    `;
  }

  function renderSettings() {
    const providerCard = (provider, title, desc, channel = null, index = 0) => {
      const isExtra = Boolean(channel);
      const providerKey = isExtra ? customProviderKey(channel) : provider;
      const keyName = `${provider}_api_key`;
      const urlName = `${provider}_api_url`;
      const protocolName = `${provider}_protocol`;
      const savedKey = isExtra
        ? ((state.keys.custom_channels || []).find(item => String(item.id) === String(channel.id))?.api_key || '')
        : (state.keys[keyName] || '');
      const testing = state.testingProvider === providerKey;
      const models = getProviderModelList(providerKey);
      const draft = state.modelDrafts?.[providerKey] || '';
      const urlPlaceholder = provider === 'claude'
        ? 'https://api.anthropic.com/v1/messages'
        : provider === 'custom' || isExtra
          ? 'https://your-provider.example/v1'
          : 'https://api.openai.com/v1';
      const modelPlaceholder = provider === 'custom' || isExtra
        ? 'deepseek-chat / qwen-plus / moonshot-v1-8k'
        : provider === 'claude'
          ? 'claude-sonnet-4-6'
          : 'gpt-5.5';
      const keyPlaceholder = savedKey
        ? `\u5df2\u4fdd\u5b58\uff1a${savedKey}\uff0c\u8f93\u5165\u65b0 Key \u53ef\u8986\u76d6`
        : '\u8bf7\u8f93\u5165 API Key';
      const previewModels = models.slice(0, 2);
      const extraCount = Math.max(0, models.length - previewModels.length);
      const summaryText = models.length
        ? `${previewModels.join(' / ')}${extraCount ? ` \u7b49 ${models.length} \u4e2a` : ''}`
        : '\u6682\u65e0\u6a21\u578b\uff0c\u8bf7\u5148\u6dfb\u52a0\u4e00\u4e2a';
      return `
        <article class="zx-hf-provider-card ${provider === 'custom' ? 'custom' : ''} ${isExtra ? 'extra-custom' : ''}">
          <div class="zx-hf-provider-head">
            <div>
              <strong>${esc(isExtra ? (channel.name || `自定义 API ${index + 1}`) : title)}</strong>
              <p>${esc(desc)}</p>
            </div>
            <div class="zx-hf-provider-actions">
              ${isExtra ? `<button type="button" class="zx-hf-remove-channel" data-remove-custom-channel="${esc(channel.id)}">\u5220\u9664</button>` : ''}
              <button type="button" class="zx-hf-test-btn" data-test-provider="${esc(providerKey)}" ${testing ? 'disabled' : ''}>
                ${testing ? '\u6d4b\u8bd5\u4e2d...' : '\u6d4b\u8bd5\u8fde\u63a5'}
              </button>
            </div>
          </div>
          <div class="zx-hf-settings-fields">
            ${isExtra ? `<label class="zx-hf-field"><span>\u901a\u9053\u540d\u79f0</span><input data-custom-channel="${esc(channel.id)}" data-custom-field="name" value="${esc(channel.name)}" placeholder="\u4f8b\u5982\uff1a\u6211\u7684\u4e2d\u8f6c API" /></label>` : ''}
            <label class="zx-hf-field">
              <span>\u63a5\u53e3 URL</span>
              <input ${isExtra ? `data-custom-channel="${esc(channel.id)}" data-custom-field="api_url" value="${esc(channel.api_url)}"` : `data-key="${esc(urlName)}" value="${esc(state.keyForm[urlName])}"`} placeholder="${esc(urlPlaceholder)}" />
            </label>
            <label class="zx-hf-field zx-hf-protocol-field">
              <span>\u63a5\u53e3\u534f\u8bae</span>
              <select ${isExtra ? `data-custom-channel="${esc(channel.id)}" data-custom-field="protocol"` : `data-key="${esc(protocolName)}"`}>
                ${protocolOptions.map(([value, label]) => `<option value="${esc(value)}" ${(isExtra ? channel.protocol : state.keyForm[protocolName]) === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}
              </select>
              <small>\u81ea\u52a8\u517c\u5bb9\u4f1a\u6309\u5e38\u89c1\u4e2d\u8f6c\u7ad9\u683c\u5f0f\u4f9d\u6b21\u5c1d\u8bd5\uff1b\u624b\u52a8\u9009\u62e9\u53ef\u4ee5\u56fa\u5b9a\u534f\u8bae\u3002</small>
            </label>
            <label class="zx-hf-field">
              <span>API Key</span>
              <input class="zx-hf-api-key-input" type="password" ${isExtra ? `data-custom-channel="${esc(channel.id)}" data-custom-field="api_key" value="${esc(channel.api_key)}"` : `data-key="${esc(keyName)}" value="${esc(state.keyForm[keyName])}"`} placeholder="${esc(keyPlaceholder)}" />
            </label>
            <div class="zx-hf-field zx-hf-model-field">
              <span>\u6a21\u578b\u540d\u79f0</span>
              <div class="zx-hf-model-builder">
                <input data-model-draft="${esc(providerKey)}" value="${esc(draft)}" placeholder="${esc(modelPlaceholder)}" />
                <button type="button" class="zx-hf-model-add" data-add-model="${esc(providerKey)}">\u6dfb\u52a0</button>
              </div>
              <button type="button" class="zx-hf-model-vault" data-open-model-library="${esc(providerKey)}">
                <span><strong>\u5df2\u6536\u5f55 ${models.length} \u4e2a\u6a21\u578b</strong><em>${esc(summaryText)}</em></span>
                <b>\u67e5\u770b\u5168\u90e8</b>
              </button>
            </div>
          </div>
        </article>
      `;
    };
    const ttsCard = (provider, title, desc, fields) => {
      const selected = state.ttsForm.provider === provider;
      const savedKey = state.keys.tts_config?.[`${provider}_api_key`] || '';
      const testing = state.testingTtsProvider === provider;
      const apiPlaceholder = provider === 'openai'
        ? 'https://api.openai.com/v1/audio/speech'
        : provider === 'google'
          ? 'https://texttospeech.googleapis.com/v1/text:synthesize'
          : 'https://\u4f60\u7684URL\u5730\u5740/v1/t2a_v2';
      const minimaxNote = provider === 'minimax' ? `
            <div class="zx-hf-tts-note">
              <strong>&#x4f7f;&#x7528;&#x4e2d;&#x8f6c;&#x7ad9; MiniMax &#x8bed;&#x97f3;&#x7684;&#x586b;&#x6cd5;&#xff1a;</strong>
              <span>&#xb7; API &#x5730;&#x5740;&#xff1a;https://&#x4f60;&#x7684;URL&#x5730;&#x5740;/v1/t2a_v2</span>
              <span>&#xb7; &#x6a21;&#x578b;&#xff1a;speech-2.8-turbo / speech-2.6-turbo / speech-02-turbo</span>
              <span>&#xb7; API Key&#xff1a;&#x586b;&#x4f60;&#x8d2d;&#x4e70;&#x7684;&#x4e2d;&#x8f6c;&#x7ad9;&#x5bc6;&#x94a5;</span>
              <span>&#xb7; &#x97f3;&#x8272;&#xff1a;Chinese (Mandarin)_Warm_Bestie&#xff08;&#x6e29;&#x6696;&#x5973;&#x58f0;&#xff09;&#x7b49;</span>
              <span>&#x82e5;&#x7528; MiniMax &#x5b98;&#x65b9;&#x63a5;&#x53e3;&#xff0c;&#x5730;&#x5740;&#x586b; https://api.minimax.chat/v1/t2a_v2 &#x5e76;&#x586b;&#x5199; GroupId&#x3002;</span>
            </div>
          ` : '';
      const keyPlaceholder = savedKey
        ? `已保存：${savedKey}，输入新 Key 可覆盖`
        : '请输入 TTS API Key';
      return `
        <article class="zx-hf-provider-card zx-hf-tts-card ${selected ? 'active' : ''}">
          <div class="zx-hf-provider-head">
            <div>
              <strong>${esc(title)}</strong>
              <p>${esc(desc)}</p>
            </div>
            <div class="zx-hf-provider-actions">
              <button type="button" class="zx-hf-test-btn ${selected ? 'selected' : ''}" data-tts-select="${esc(provider)}">${selected ? '当前语音' : '设为语音'}</button>
              <button type="button" class="zx-hf-test-btn" data-test-tts="${esc(provider)}" ${testing ? 'disabled' : ''}>${testing ? '测试中...' : '测试语音'}</button>
            </div>
          </div>
          <div class="zx-hf-settings-fields zx-hf-tts-fields">
            ${minimaxNote}
            <label class="zx-hf-field">
              <span>接口 URL</span>
              <input data-tts-key="${esc(provider)}_api_url" value="${esc(state.ttsForm[`${provider}_api_url`] || '')}" placeholder="${esc(apiPlaceholder)}" />
            </label>
            <label class="zx-hf-field">
              <span>API Key</span>
              <input class="zx-hf-api-key-input" type="password" data-tts-key="${esc(provider)}_api_key" value="${esc(state.ttsForm[`${provider}_api_key`] || '')}" placeholder="${esc(keyPlaceholder)}" />
            </label>
            ${fields.map(item => `
              <label class="zx-hf-field">
                <span>${esc(item.label)}</span>
                <input data-tts-key="${esc(item.key)}" value="${esc(state.ttsForm[item.key] || '')}" placeholder="${esc(item.placeholder || '')}" />
              </label>
            `).join('')}
          </div>
        </article>
      `;
    };
    return `
      <section class="zx-hf-card zx-hf-settings">
        <div class="zx-hf-settings-head">
          <div class="zx-hf-card-title"><span class="zx-hf-card-mark" aria-hidden="true"></span><div><strong>AI API \u914d\u7f6e</strong><p>\u914d\u7f6e\u63a5\u53e3\u3001\u5bc6\u94a5\u548c\u53ef\u7528\u6a21\u578b\uff0c\u4fdd\u5b58\u540e\u518d\u8fdb\u884c\u8fde\u63a5\u6d4b\u8bd5\u3002</p></div></div>
          <div class="zx-hf-save-wrap">
            <span>\u4fee\u6539\u540e\u5148\u4fdd\u5b58\uff0c\u518d\u6d4b\u8bd5\u8fde\u63a5\u3002</span>
            <button type="button" class="zx-hf-primary inline" data-save-keys ${state.saving ? 'disabled' : ''}>${state.saving ? '\u4fdd\u5b58\u4e2d...' : '\u4fdd\u5b58\u8bbe\u7f6e'}</button>
          </div>
        </div>
        <div class="zx-hf-provider-grid">
          ${providerCard('claude', 'Claude \u901a\u9053', '\u9002\u5408 Claude / Anthropic \u517c\u5bb9\u63a5\u53e3\u3002')}
          ${providerCard('openai', 'GPT \u901a\u9053', '\u9002\u5408 OpenAI \u5b98\u65b9\u6216 OpenAI \u517c\u5bb9\u63a5\u53e3\u3002')}
          ${providerCard('custom', '\u81ea\u5b9a\u4e49\u901a\u9053', '\u9002\u5408 DeepSeek\u3001\u901a\u4e49\u3001Moonshot\u3001OpenRouter\u3001Gemini \u4e2d\u8f6c\u7ad9\u7b49\u63a5\u53e3\u3002')}
          ${(state.customChannels || []).map((channel, index) => providerCard('custom', channel.name || `自定义 API ${index + 1}`, '\u5355\u72ec\u4fdd\u5b58 URL\u3001Key \u548c\u6a21\u578b\uff0c\u751f\u6210\u65f6\u53ef\u76f4\u63a5\u9009\u62e9\u3002', channel, index)).join('')}
        </div>
        <button type="button" class="zx-hf-add-custom-api" data-add-custom-channel>
          <strong>\u6dfb\u52a0\u65b0\u7684\u81ea\u5b9a\u4e49 API</strong>
          <span>\u7ee7\u7eed\u6dfb\u52a0\u65b0\u670d\u52a1\u5546\u7684 URL\u3001Key \u548c\u591a\u4e2a\u6a21\u578b\uff0c\u4fdd\u5b58\u540e\u4f1a\u51fa\u73b0\u5728\u751f\u6210\u9875\u6a21\u578b\u4e0b\u62c9\u91cc\u3002</span>
        </button>
        <div class="zx-hf-settings-tip">
          <strong>\u4f7f\u7528\u63d0\u793a</strong>
          <span>API Key \u53ea\u4fdd\u5b58\u5728\u8fd0\u884c\u76ee\u5f55\uff0c\u4e0d\u8fdb\u5165\u955c\u50cf\u3002\u6bcf\u4e2a\u901a\u9053\u53ef\u6dfb\u52a0\u591a\u4e2a\u6a21\u578b\uff0c\u751f\u6210\u65f6\u4f1a\u5728\u6a21\u578b\u4e0b\u62c9\u91cc\u9009\u62e9\u3002</span>
        </div>
        <div class="zx-hf-settings-divider"></div>
        <div class="zx-hf-settings-subhead">
          <div><strong>TTS 语音配置</strong><p>配置配音服务商，后续视频流水线会用这里的语音 Key 生成旁白和字幕时间轴。</p></div>
          <span>支持 GPT TTS / Google TTS / MiniMax TTS</span>
        </div>
        <div class="zx-hf-provider-grid zx-hf-tts-grid">
          ${ttsCard('openai', 'GPT TTS', '适合 OpenAI 官方或兼容的 audio/speech 接口。', [
            { key: 'openai_model', label: '模型', placeholder: 'gpt-4o-mini-tts' },
            { key: 'openai_voice', label: '音色', placeholder: 'alloy / verse / shimmer' },
          ])}
          ${ttsCard('google', 'Google TTS', '适合 Google Cloud Text-to-Speech，填写 API Key 和中文音色。', [
            { key: 'google_language_code', label: '语言代码', placeholder: 'cmn-CN' },
            { key: 'google_voice', label: '音色名称', placeholder: 'cmn-CN-Standard-A' },
          ])}
          ${ttsCard('minimax', 'MiniMax TTS', '适合 MiniMax speech 系列，适合中文普通话短视频旁白。', [
            { key: 'minimax_model', label: '模型', placeholder: 'speech-2.8-turbo' },
            { key: 'minimax_voice', label: '音色', placeholder: 'Chinese (Mandarin)_Warm_Bestie' },
            { key: 'minimax_group_id', label: 'Group ID（可选）', placeholder: 'MiniMax GroupId' },
          ])}
        </div>
      </section>
    `;
  }

  function modelLibraryModalHtml() {
    const provider = state.modelModalProvider;
    if (!provider) return '';
    const models = getProviderModelList(provider);
    const draft = state.modelDrafts?.[provider] || '';
    const title = providerDisplayName(provider);
    const placeholder = provider === 'custom'
      ? 'deepseek-chat / qwen-plus / moonshot-v1-8k'
      : provider === 'claude'
        ? 'claude-sonnet-4-6'
        : 'gpt-5.5';
    return `
      <div class="zx-hf-model-modal" role="dialog" aria-modal="true">
        <div class="zx-hf-model-modal-backdrop" data-close-model-modal></div>
        <div class="zx-hf-model-modal-panel">
          <div class="zx-hf-model-modal-head">
            <div><span>${esc(title)}</span><strong>\u6a21\u578b\u5e93</strong><p>\u6dfb\u52a0\u591a\u4e2a\u6a21\u578b\uff0c\u751f\u6210\u65f6\u53ef\u5728 AI \u6a21\u578b\u4e0b\u62c9\u91cc\u9009\u62e9\u3002</p></div>
            <button type="button" data-close-model-modal>\u5173\u95ed</button>
          </div>
          <div class="zx-hf-model-modal-add">
            <input data-model-draft="${esc(provider)}" value="${esc(draft)}" placeholder="${esc(placeholder)}" />
            <button type="button" class="zx-hf-model-add" data-add-model="${esc(provider)}">\u6dfb\u52a0\u6a21\u578b</button>
          </div>
          <div class="zx-hf-model-modal-list">
            ${models.length ? models.map(model => `
              <div class="zx-hf-model-row">
                <span title="${esc(model)}">${esc(model)}</span>
                <button type="button" data-remove-model="${esc(provider)}" data-model="${esc(model)}">\u5220\u9664</button>
              </div>
            `).join('') : '<div class="zx-hf-model-empty">\u6682\u65e0\u6a21\u578b\uff0c\u8bf7\u5148\u5728\u4e0a\u65b9\u6dfb\u52a0\u4e00\u4e2a\u3002</div>'}
          </div>
        </div>
      </div>
    `;
  }

  function contentHtml() {
    if (state.loading) return '<div class="zx-hf-loading"><span></span>加载中...</div>';
    if (state.tab === 'works') return renderWorks();
    if (state.tab === 'templates') return renderTemplates();
    if (state.tab === 'settings') return renderSettings();
    return renderCreate();
  }

  function ensurePage() {
    let page = document.getElementById(PAGE_ID);
    const anchor = document.getElementById('page-system-management') || document.querySelector('[id^="page-"]');
    const parent = anchor?.parentElement;
    if (!parent) return page || null;
    if (!page) {
      page = document.createElement('div');
      page.id = PAGE_ID;
      page.className = 'zx-hf-page';
      page.style.display = 'none';
      page.style.pointerEvents = 'none';
    }
    if (page.parentElement !== parent) {
      parent.appendChild(page);
    }
    return page;
  }

  function ensureChatUiStyle() {
    let style = document.getElementById('zx-hf-chat-ui-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'zx-hf-chat-ui-style';
      document.head.appendChild(style);
    }
    style.textContent = `
      #${PAGE_ID} .zx-hf-chat-workbench{grid-template-columns:minmax(0,1fr) minmax(280px,340px)!important;gap:18px!important;height:calc(100vh - 178px)!important;min-height:620px!important}
      #${PAGE_ID} .zx-hf-chat-card{display:flex!important;flex-direction:column!important;min-width:0!important;min-height:0!important;padding:16px!important;background:rgba(255,255,255,.96)!important}
      #${PAGE_ID} .zx-hf-context-bar{display:grid!important;grid-template-columns:minmax(180px,300px) minmax(0,1fr)!important;gap:12px!important;align-items:end!important;margin-bottom:12px!important;padding:10px!important;border:1px solid #e5edf5!important;border-radius:18px!important;background:#f8fafc!important}
      #${PAGE_ID} .zx-hf-context-field{display:grid!important;gap:5px!important;min-width:0!important}
      #${PAGE_ID} .zx-hf-context-field span{display:flex!important;gap:6px!important;align-items:center!important;color:#64748b!important;font-size:12px!important;font-weight:850!important}
      #${PAGE_ID} .zx-hf-context-field b,#${PAGE_ID} .zx-hf-context-field em{font-style:normal!important;font-size:11px!important;font-weight:800!important;color:#94a3b8!important}
      #${PAGE_ID} .zx-hf-context-field.title b{color:#2563eb!important}
      #${PAGE_ID} .zx-hf-context-field input{height:38px!important;min-width:0!important;padding:0 12px!important;border:1px solid #dbe5f0!important;border-radius:12px!important;background:#fff!important;color:#0f172a!important;font-size:13px!important;outline:none!important;box-shadow:none!important}
      #${PAGE_ID} .zx-hf-context-field input:focus{border-color:#93c5fd!important;box-shadow:0 0 0 3px rgba(59,130,246,.12)!important}
      #${PAGE_ID} .zx-hf-chat-log{flex:1 1 auto!important;min-height:0!important;max-height:none!important;padding:8px 18px!important;border:1px solid #e5edf5!important;border-radius:16px!important;background:#fff!important;gap:0!important}
      #${PAGE_ID} .zx-hf-chat-msg{position:relative!important;max-width:100%!important;padding:12px 0!important;border:0!important;border-bottom:1px solid #f1f5f9!important;border-radius:0!important;background:transparent!important;color:#1e293b!important;box-shadow:none!important;margin:0!important}
      #${PAGE_ID} .zx-hf-chat-msg:not(.user){margin-right:0!important;margin-left:0!important;border-left:0!important}
      #${PAGE_ID} .zx-hf-chat-msg:not(.user)::before{display:none!important}
      #${PAGE_ID} .zx-hf-chat-msg.user{background:transparent!important;border-color:#f1f5f9!important;color:#1e293b!important;box-shadow:none!important}
      #${PAGE_ID} .zx-hf-chat-msg span{display:block!important;margin:0 0 4px!important;color:#64748b!important;font-size:12px!important;font-weight:600!important;letter-spacing:0!important}
      #${PAGE_ID} .zx-hf-chat-msg.user span{display:block!important;color:#64748b!important}
      #${PAGE_ID} .zx-hf-chat-msg p{margin:0!important;white-space:pre-wrap!important;overflow-wrap:anywhere!important;font-size:14px!important;line-height:1.7!important;color:#1e293b!important}
      #${PAGE_ID} .zx-hf-chat-msg.pending p::after{content:" ..."!important;color:#94a3b8!important;animation:zx-hf-chat-dots 1.1s steps(3,end) infinite!important}
      #${PAGE_ID} .zx-hf-chat-msg.live,#${PAGE_ID} .zx-hf-chat-msg.progress-notice{padding:10px 0!important;background:transparent!important;color:#64748b!important;box-shadow:none!important}
      #${PAGE_ID} .zx-hf-chat-msg.live span,#${PAGE_ID} .zx-hf-chat-msg.progress-notice span{color:#94a3b8!important}
      #${PAGE_ID} .zx-hf-chat-msg.live p,#${PAGE_ID} .zx-hf-chat-msg.progress-notice p{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace!important;font-size:13px!important;line-height:1.75!important;color:#64748b!important}
      #${PAGE_ID} .zx-hf-chat-actions{display:flex!important;gap:10px!important;margin-top:10px!important}
      #${PAGE_ID} .zx-hf-chat-actions button{height:auto!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;color:#2563eb!important;font-size:13px!important;font-weight:700!important;cursor:pointer!important;text-decoration:underline!important;text-underline-offset:3px!important}
      #${PAGE_ID} .zx-hf-chat-video{display:flex!important;align-items:center!important;gap:14px!important;margin-top:10px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important}
      #${PAGE_ID} .zx-hf-chat-video button,#${PAGE_ID} .zx-hf-chat-video a{border:0!important;background:transparent!important;color:#2563eb!important;font-size:13px!important;font-weight:700!important;cursor:pointer!important;text-decoration:underline!important;text-underline-offset:3px!important}
      #${PAGE_ID} .zx-hf-chat-files{display:flex!important;gap:8px!important;flex-wrap:wrap!important;min-height:0!important;margin:8px 0 0!important;padding:8px 12px!important}
      #${PAGE_ID} .zx-hf-chat-files:empty{display:none!important;height:0!important;margin:0!important;padding:0!important}
      #${PAGE_ID} .zx-hf-asset-thumb{position:relative!important;width:64px!important;height:64px!important;flex:0 0 64px!important;border:1px solid #e2e8f0!important;border-radius:8px!important;background:#f8fafc!important;overflow:visible!important}
      #${PAGE_ID} .zx-hf-asset-thumb img{display:block!important;width:100%!important;height:100%!important;object-fit:cover!important;border-radius:8px!important}
      #${PAGE_ID} .zx-hf-asset-file{width:100%!important;height:100%!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;padding:4px!important;color:#64748b!important;font-size:11px!important;line-height:1.15!important;text-align:center!important;word-break:break-all!important;overflow:hidden!important}
      #${PAGE_ID} .zx-hf-asset-file i{width:18px!important;height:22px!important;border:1.5px solid #94a3b8!important;border-radius:4px!important;position:relative!important;display:block!important}
      #${PAGE_ID} .zx-hf-asset-file i::after{content:"";position:absolute;right:-1.5px;top:-1.5px;border-left:7px solid transparent;border-bottom:7px solid #cbd5e1}
      #${PAGE_ID} .zx-hf-asset-thumb button{position:absolute!important;top:-6px!important;right:-6px!important;width:20px!important;height:20px!important;padding:0!important;border:1px solid #cbd5e1!important;border-radius:50%!important;background:#fff!important;color:#64748b!important;font-size:12px!important;font-weight:800!important;line-height:1!important;display:flex!important;align-items:center!important;justify-content:center!important;cursor:pointer!important;box-shadow:0 2px 8px rgba(15,23,42,.12)!important;z-index:2!important}
      #${PAGE_ID} .zx-hf-asset-thumb button:hover{background:#fee2e2!important;border-color:#fca5a5!important;color:#dc2626!important}
      #${PAGE_ID} .zx-hf-chat-composer{flex:0 0 auto!important;margin-top:12px!important;border:1px solid #dbe5f0!important;border-radius:22px!important;background:#fff!important;box-shadow:0 12px 28px rgba(15,23,42,.07)!important}
      #${PAGE_ID} .zx-hf-chat-composer textarea{min-height:76px!important;max-height:132px!important;padding:14px 58px 8px 14px!important;border:0!important;background:transparent!important;color:#0f172a!important;resize:none!important}
      #${PAGE_ID} .zx-hf-chat-toolbar .zx-hf-send-button{background:#cbd5e1!important;box-shadow:none!important}
      #${PAGE_ID} .zx-hf-chat-toolbar .zx-hf-send-button.ready{background:linear-gradient(180deg,#2f80ff,#1764e8)!important;box-shadow:0 10px 22px rgba(37,99,235,.22)!important}
      #${PAGE_ID} .zx-hf-chat-toolbar .zx-hf-send-button.pause{background:linear-gradient(180deg,#475569,#334155)!important}
      #${PAGE_ID} .zx-hf-control-card{padding:16px!important;border-radius:22px!important;background:rgba(255,255,255,.94)!important}
      #${PAGE_ID} .zx-hf-control-card .zx-hf-card-head h2{font-size:15px!important}
      #${PAGE_ID} .zx-hf-control-card .zx-hf-card-head p{font-size:12px!important;line-height:1.5!important}
      #${PAGE_ID} .zx-hf-agent-workbench{grid-template-columns:minmax(0,1fr) 320px!important;gap:16px!important;height:calc(100vh - 178px)!important;min-height:680px!important}
      #${PAGE_ID} .zx-hf-agent-card{display:flex!important;flex-direction:column!important;min-width:0!important;padding:0 18px 16px!important;overflow:hidden!important}
      #${PAGE_ID} .zx-hf-agent-topbar{flex:0 0 auto!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:14px!important;padding:14px 0!important;border-bottom:1px solid #e2e8f0!important}
      #${PAGE_ID} .zx-hf-agent-topbar label{display:flex!important;align-items:center!important;gap:10px!important;min-width:280px!important;flex:1!important;margin:0!important}
      #${PAGE_ID} .zx-hf-agent-topbar span{font-size:12px!important;font-weight:700!important;color:#64748b!important;white-space:nowrap!important}
      #${PAGE_ID} .zx-hf-agent-topbar input{height:34px!important;border:0!important;background:transparent!important;font-size:15px!important;font-weight:650!important;color:#0f172a!important;outline:0!important;width:100%!important}
      #${PAGE_ID} .zx-hf-agent-status{font-size:12px!important;color:#64748b!important;white-space:nowrap!important}
      #${PAGE_ID} .zx-hf-chat-log{flex:1 1 auto!important;min-height:0!important;overflow:auto!important;padding:10px 0 8px!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important}
      #${PAGE_ID} .zx-hf-chat-msg{max-width:100%!important;margin:0!important;padding:12px 0!important;border:0!important;border-bottom:1px solid #f1f5f9!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;color:#1e293b!important}
      #${PAGE_ID} .zx-hf-chat-msg.user{background:transparent!important;color:#1e293b!important;border-color:#f1f5f9!important;box-shadow:none!important}
      #${PAGE_ID} .zx-hf-chat-msg>span{display:block!important;margin:0 0 4px!important;font-size:12px!important;font-weight:700!important;color:#64748b!important}
      #${PAGE_ID} .zx-hf-chat-msg>p{margin:0!important;white-space:normal!important;font-size:14px!important;line-height:1.7!important;color:#1e293b!important}
      #${PAGE_ID} .zx-hf-chat-msg code{padding:1px 5px!important;border-radius:5px!important;background:#f1f5f9!important;font-family:monospace!important;font-size:12px!important}
      #${PAGE_ID} .zx-hf-chat-msg.pending p::after{content:'...';display:inline-block;animation:zxHfDots 1s infinite;color:#64748b!important}
      #${PAGE_ID} .zx-hf-agent-progress{display:grid!important;gap:5px!important;margin:4px 0 8px!important}
      #${PAGE_ID} .zx-hf-agent-progress-row{display:grid!important;grid-template-columns:22px max-content 1fr!important;gap:7px!important;align-items:start!important;font-size:13px!important;color:#64748b!important;line-height:1.45!important}
      #${PAGE_ID} .zx-hf-agent-progress-row i{font-style:normal!important;color:#94a3b8!important}
      #${PAGE_ID} .zx-hf-agent-progress-row.done i{color:#16a34a!important}#${PAGE_ID} .zx-hf-agent-progress-row.running i{color:#2563eb!important}#${PAGE_ID} .zx-hf-agent-progress-row.failed i{color:#dc2626!important}
      #${PAGE_ID} .zx-hf-agent-progress-row span{font-weight:650!important;color:#475569!important}#${PAGE_ID} .zx-hf-agent-progress-row em{font-style:normal!important;color:#64748b!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      #${PAGE_ID} .zx-hf-agent-event-list{display:grid!important;gap:5px!important;margin-top:8px!important}
      #${PAGE_ID} .zx-hf-agent-event{display:grid!important;grid-template-columns:22px 110px 1fr!important;gap:7px!important;align-items:start!important;font-size:13px!important;color:#64748b!important;line-height:1.45!important}
      #${PAGE_ID} .zx-hf-agent-event span{font-size:13px!important}#${PAGE_ID} .zx-hf-agent-event strong{font-weight:650!important;color:#64748b!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}#${PAGE_ID} .zx-hf-agent-event em{font-style:normal!important;color:#64748b!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      #${PAGE_ID} .zx-hf-inline-video{margin-top:10px!important;display:grid!important;grid-template-columns:180px 1fr!important;gap:12px!important;align-items:center!important}
      #${PAGE_ID} .zx-hf-inline-video video{width:180px!important;aspect-ratio:1/1!important;object-fit:cover!important;border-radius:10px!important;border:1px solid #e2e8f0!important;background:#000!important}
      #${PAGE_ID} .zx-hf-inline-video a,#${PAGE_ID} .zx-hf-inline-video button{border:0!important;background:transparent!important;color:#2563eb!important;padding:0!important;margin-right:12px!important;font-size:13px!important;cursor:pointer!important;text-decoration:none!important}
      #${PAGE_ID} .zx-hf-agent-settings{padding:0!important;overflow:hidden!important}
      #${PAGE_ID} .zx-hf-agent-settings details{height:auto!important;max-height:100%!important;padding:14px!important;overflow:auto!important}
      #${PAGE_ID} .zx-hf-agent-settings summary{list-style:none!important;cursor:pointer!important;display:flex!important;justify-content:space-between!important;align-items:center!important;gap:10px!important;margin-bottom:12px!important}
      #${PAGE_ID} .zx-hf-agent-settings summary::-webkit-details-marker{display:none!important}
      #${PAGE_ID} .zx-hf-agent-settings summary strong{font-size:15px!important;color:#0f172a!important}#${PAGE_ID} .zx-hf-agent-settings summary span{font-size:12px!important;color:#64748b!important;text-align:right!important}
      #${PAGE_ID} .zx-hf-tts-note{grid-column:1/-1!important;display:grid!important;gap:2px!important;margin:0!important;padding:10px 12px!important;border:1px solid #e5edf5!important;border-radius:8px!important;background:#f8fafc!important;color:#64748b!important;font-size:12px!important;line-height:1.7!important}
      #${PAGE_ID} .zx-hf-tts-note strong{display:block!important;margin:0!important;color:#334155!important;font-size:12px!important;font-weight:800!important;line-height:1.6!important}
      #${PAGE_ID} .zx-hf-tts-note span{display:block!important;margin:0!important;color:#64748b!important;font-size:12px!important;line-height:1.7!important}
      #${PAGE_ID} .zx-hf-template-section .zx-hf-template-library{max-height:calc(100vh - 320px)!important;overflow-y:auto!important;padding-right:4px!important}
      #${PAGE_ID} .zx-hf-template-picker{max-height:70vh!important;overflow-y:auto!important}
      #${PAGE_ID} .zx-hf-template-library{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(180px,1fr))!important;gap:14px!important;align-items:stretch!important}
      #${PAGE_ID} .zx-hf-template-library.compact{grid-template-columns:repeat(auto-fill,minmax(180px,1fr))!important;gap:10px!important}
      #${PAGE_ID} .zx-hf-template{position:relative!important;min-width:0!important;overflow:hidden!important}
      #${PAGE_ID} .zx-hf-template .zx-hf-card-mark{height:32px!important;min-height:32px!important;border-radius:10px!important}
      #${PAGE_ID} .zx-hf-template strong{white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      #${PAGE_ID} .zx-hf-template em{white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      #${PAGE_ID} .zx-hf-template-acts{position:absolute!important;top:8px!important;right:8px!important;display:none!important;gap:6px!important;z-index:3!important}
      #${PAGE_ID} .zx-hf-template:hover .zx-hf-template-acts{display:flex!important}
      #${PAGE_ID} .zx-hf-template-acts i{width:auto!important;height:22px!important;padding:0 8px!important;display:flex!important;align-items:center!important;justify-content:center!important;border-radius:6px!important;background:rgba(255,255,255,.92)!important;border:1px solid #e2e8f0!important;color:#475569!important;font-size:12px!important;line-height:1!important;cursor:pointer!important;font-style:normal!important;white-space:nowrap!important;box-shadow:0 4px 10px rgba(15,23,42,.08)!important}
      #${PAGE_ID} .zx-hf-template-acts i:hover{background:#eff6ff!important;color:#2563eb!important}
      #${PAGE_ID} .zx-hf-template-acts i:last-child{color:#dc2626!important}
      #${PAGE_ID} .zx-hf-template-acts i:last-child:hover{background:#fee2e2!important;color:#dc2626!important;border-color:#fecaca!important}
      #${PAGE_ID} .zx-hf-template-picker,
      .zx-hf-template-portal .zx-hf-template-picker{display:grid!important;gap:16px!important;max-height:70vh!important;overflow-y:auto!important;padding:0 2px 2px!important}
      .zx-hf-template-portal .zx-hf-template-dialog{width:min(820px,calc(100vw - 48px))!important;max-width:min(820px,calc(100vw - 48px))!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important}
      .zx-hf-template-portal .zx-hf-template-picker{padding:18px!important;border:1px solid #e2e8f0!important;border-radius:22px!important;background:#fff!important;box-shadow:0 28px 90px rgba(15,23,42,.28)!important}
      #${PAGE_ID} .zx-hf-template-picker-head,
      .zx-hf-template-portal .zx-hf-template-picker-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important;padding-bottom:2px!important}
      #${PAGE_ID} .zx-hf-template-picker-head strong,
      .zx-hf-template-portal .zx-hf-template-picker-head strong{font-size:15px!important;font-weight:850!important;color:#0f172a!important}
      #${PAGE_ID} .zx-hf-template-picker-head button,
      .zx-hf-template-portal .zx-hf-template-picker-head button{height:34px!important;padding:0 14px!important;border:1px solid #cbd5e1!important;border-radius:999px!important;background:#fff!important;color:#334155!important;font-size:13px!important;font-weight:750!important;cursor:pointer!important;box-shadow:0 8px 18px rgba(15,23,42,.05)!important}
      #${PAGE_ID} .zx-hf-template-search,
      .zx-hf-template-portal .zx-hf-template-search{height:44px!important;width:100%!important;padding:0 13px!important;border:1px solid #bfdbfe!important;border-radius:12px!important;background:#fff!important;color:#0f172a!important;font-size:14px!important;outline:0!important;box-shadow:0 0 0 3px rgba(59,130,246,.10)!important}
      #${PAGE_ID} .zx-hf-template-group,
      .zx-hf-template-portal .zx-hf-template-group{display:grid!important;gap:10px!important}
      #${PAGE_ID} .zx-hf-template-group>span,
      .zx-hf-template-portal .zx-hf-template-group>span{font-size:12px!important;font-weight:850!important;color:#64748b!important}
      #${PAGE_ID} .zx-hf-template-library,
      .zx-hf-template-portal .zx-hf-template-library{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(180px,1fr))!important;gap:12px!important;align-items:stretch!important}
      #${PAGE_ID} .zx-hf-template-library.compact,
      .zx-hf-template-portal .zx-hf-template-library.compact{grid-template-columns:repeat(auto-fill,minmax(180px,1fr))!important;gap:12px!important}
      #${PAGE_ID} .zx-hf-template,
      .zx-hf-template-portal .zx-hf-template{position:relative!important;display:grid!important;grid-template-rows:32px auto 1fr!important;gap:8px!important;min-width:0!important;min-height:128px!important;padding:15px!important;border:1px solid #dbe5f0!important;border-radius:16px!important;background:linear-gradient(180deg,#fff 0%,#fbfdff 100%)!important;color:#0f172a!important;text-align:left!important;overflow:hidden!important;box-shadow:0 10px 24px rgba(15,23,42,.045)!important;cursor:pointer!important;transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease!important}
      #${PAGE_ID} .zx-hf-template:hover,
      .zx-hf-template-portal .zx-hf-template:hover{transform:translateY(-1px)!important;border-color:#bfdbfe!important;box-shadow:0 18px 36px rgba(37,99,235,.10)!important}
      #${PAGE_ID} .zx-hf-template.active,
      .zx-hf-template-portal .zx-hf-template.active{border-color:#93c5fd!important;box-shadow:0 0 0 2px rgba(59,130,246,.16),0 18px 38px rgba(37,99,235,.12)!important}
      #${PAGE_ID} .zx-hf-template .zx-hf-card-mark,
      .zx-hf-template-portal .zx-hf-template .zx-hf-card-mark{display:block!important;width:18px!important;height:28px!important;min-height:28px!important;border-radius:8px!important;background:linear-gradient(180deg,#0f172a,#475569)!important;box-shadow:0 8px 16px rgba(15,23,42,.16)!important}
      #${PAGE_ID} .zx-hf-template.user .zx-hf-card-mark,
      .zx-hf-template-portal .zx-hf-template.user .zx-hf-card-mark{width:22px!important;height:22px!important;min-height:22px!important;border-radius:7px!important;background:linear-gradient(135deg,#1d4ed8,#0f172a)!important}
      #${PAGE_ID} .zx-hf-template strong,
      .zx-hf-template-portal .zx-hf-template strong{display:block!important;min-width:0!important;margin:0!important;color:#0f172a!important;font-size:14px!important;font-weight:850!important;line-height:1.35!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      #${PAGE_ID} .zx-hf-template em,
      .zx-hf-template-portal .zx-hf-template em{display:-webkit-box!important;min-width:0!important;margin:0!important;color:#64748b!important;font-size:12px!important;font-style:normal!important;font-weight:500!important;line-height:1.55!important;white-space:normal!important;overflow:hidden!important;text-overflow:ellipsis!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important}
      #${PAGE_ID} .zx-hf-template.user em,
      .zx-hf-template-portal .zx-hf-template.user em{-webkit-line-clamp:1!important;padding-right:0!important}
      #${PAGE_ID} .zx-hf-template b,
      .zx-hf-template-portal .zx-hf-template b{align-self:end!important;justify-self:start!important;display:inline-flex!important;align-items:center!important;max-width:100%!important;height:24px!important;padding:0 9px!important;border:1px solid #dbeafe!important;border-radius:999px!important;background:#eff6ff!important;color:#1d4ed8!important;font-size:12px!important;font-weight:800!important;line-height:1!important;white-space:nowrap!important}
      #${PAGE_ID} .zx-hf-template.user,
      .zx-hf-template-portal .zx-hf-template.user{padding-top:15px!important;padding-right:15px!important;min-height:140px!important}
      #${PAGE_ID} .zx-hf-template.user strong,
      .zx-hf-template-portal .zx-hf-template.user strong{padding-right:0!important}
      #${PAGE_ID} .zx-hf-template.user .zx-hf-template-acts,
      .zx-hf-template-portal .zx-hf-template.user .zx-hf-template-acts{position:absolute!important;top:10px!important;right:10px!important;display:flex!important;gap:6px!important;z-index:4!important}
      #${PAGE_ID} .zx-hf-template.user .zx-hf-template-acts i,
      .zx-hf-template-portal .zx-hf-template.user .zx-hf-template-acts i{width:auto!important;height:24px!important;padding:0 9px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border-radius:8px!important;background:#ffffff!important;border:1px solid #cbd5e1!important;color:#334155!important;font-size:12px!important;font-weight:800!important;line-height:1!important;cursor:pointer!important;font-style:normal!important;white-space:nowrap!important;box-shadow:0 8px 18px rgba(15,23,42,.10)!important}
      #${PAGE_ID} .zx-hf-template.user .zx-hf-template-acts i:hover,
      .zx-hf-template-portal .zx-hf-template.user .zx-hf-template-acts i:hover{background:#eff6ff!important;border-color:#bfdbfe!important;color:#1d4ed8!important}
      #${PAGE_ID} .zx-hf-template.user .zx-hf-template-acts i:last-child,
      .zx-hf-template-portal .zx-hf-template.user .zx-hf-template-acts i:last-child{border-color:#fecaca!important;color:#dc2626!important}
      #${PAGE_ID} .zx-hf-template.user .zx-hf-template-acts i:last-child:hover,
      .zx-hf-template-portal .zx-hf-template.user .zx-hf-template-acts i:last-child:hover{background:#fee2e2!important;color:#b91c1c!important}
      @keyframes zxHfDots{0%,20%{opacity:.2}50%{opacity:1}100%{opacity:.2}}
      @media (max-width:980px){#${PAGE_ID} .zx-hf-chat-workbench{grid-template-columns:1fr!important;height:auto!important;min-height:0!important}#${PAGE_ID} .zx-hf-context-bar{grid-template-columns:1fr!important}#${PAGE_ID} .zx-hf-chat-log{min-height:420px!important}}
    `;
  }


  function bindTemplatePortal(host) {
    if (!host) return;
    host.querySelectorAll('[data-close-template-picker]').forEach(btn => btn.addEventListener('click', () => {
      state.templatePickerOpen = false;
      render();
    }));
    host.querySelector('[data-template-query]')?.addEventListener('input', event => {
      state.templateQuery = event.target.value;
      render();
    });
    host.querySelectorAll('[data-template]').forEach(btn => btn.addEventListener('click', () => {
      applyTemplateSelection(btn.dataset.template);
      state.tab = 'create';
      render();
    }));
    host.querySelectorAll('[data-user-template-bg]').forEach(btn => btn.addEventListener('click', event => {
      event.stopPropagation();
      editUserTemplateBackground(btn.dataset.userTemplateBg);
    }));
    host.querySelectorAll('[data-user-template-delete]').forEach(btn => btn.addEventListener('click', event => {
      event.stopPropagation();
      removeUserTemplate(btn.dataset.userTemplateDelete);
      state.templatePickerOpen = true;
    }));
    host.querySelectorAll('[data-user-template-bg], [data-user-template-delete]').forEach(el => {
      el.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        el.click();
      });
    });
  }

  function syncTemplatePortal() {
    document.querySelectorAll('.zx-hf-template-portal').forEach(node => node.remove());
    if (!state.active || !state.templatePickerOpen) return;
    const host = document.createElement('div');
    host.className = 'zx-hf-template-portal';
    host.innerHTML = `<div class="zx-hf-template-backdrop" data-close-template-picker></div><div class="zx-hf-template-dialog">${templatePickerHtml()}</div>`;
    document.body.appendChild(host);
    bindTemplatePortal(host);
    setTimeout(() => {
      const input = host.querySelector('[data-template-query]');
      if (input) {
        input.focus();
        try { input.setSelectionRange(input.value.length, input.value.length); } catch (_) {}
      }
    }, 0);
  }

  function getScrollHost() {
    const page = ensurePage();
    return page?.querySelector('.zx-hf-scroll') || page || document.scrollingElement || document.documentElement;
  }

  function renderKeepScroll() {
    const host = getScrollHost();
    const top = host ? host.scrollTop : 0;
    const active = document.activeElement;
    const activeSelector = active?.dataset?.field ? `[data-field="${active.dataset.field}"]` : '';
    const activeValue = active && 'value' in active ? active.value : null;
    const chatLog = document.querySelector(`#${PAGE_ID} .zx-hf-chat-log`);
    const chatTop = chatLog ? chatLog.scrollTop : 0;
    render();
    requestAnimationFrame(() => {
      const nextHost = getScrollHost();
      if (nextHost) nextHost.scrollTop = top;
      const nextChatLog = document.querySelector(`#${PAGE_ID} .zx-hf-chat-log`);
      if (nextChatLog) nextChatLog.scrollTop = chatTop;
      if (activeSelector) {
        const nextActive = document.querySelector(`#${PAGE_ID} ${activeSelector}`);
        if (nextActive) {
          nextActive.focus({ preventScroll: true });
          if (activeValue !== null && nextActive.value === activeValue && typeof nextActive.setSelectionRange === 'function') {
            const pos = active.selectionStart ?? nextActive.value.length;
            nextActive.setSelectionRange(pos, pos);
          }
        }
      }
    });
  }

  function renderChatUpdate() {
    const host = getScrollHost();
    const log = document.querySelector(`#${PAGE_ID} .zx-hf-chat-log`);
    const hostTop = host ? host.scrollTop : 0;
    const nearBottom = log ? (log.scrollHeight - log.scrollTop - log.clientHeight < 80) : true;
    const active = document.activeElement;
    const keepChatFocus = active?.dataset?.field === 'chatDraft';
    const selectionStart = keepChatFocus ? active.selectionStart : null;
    const selectionEnd = keepChatFocus ? active.selectionEnd : null;
    const restore = () => {
      const nextHost = getScrollHost();
      const nextLog = document.querySelector(`#${PAGE_ID} .zx-hf-chat-log`);
      if (nextHost) nextHost.scrollTop = hostTop;
      if (nextLog && nearBottom) nextLog.scrollTop = nextLog.scrollHeight;
      if (keepChatFocus) {
        const nextInput = document.querySelector(`#${PAGE_ID} [data-field="chatDraft"]`);
        if (nextInput) {
          nextInput.focus({ preventScroll: true });
          if (typeof nextInput.setSelectionRange === 'function' && selectionStart !== null && selectionEnd !== null) {
            const end = nextInput.value.length;
            nextInput.setSelectionRange(Math.min(selectionStart, end), Math.min(selectionEnd, end));
          }
        }
      }
    };
    render();
    restore();
    requestAnimationFrame(restore);
  }

  function render() {
    const page = ensurePage();
    if (!page) return;
    ensureChatUiStyle();
    page.innerHTML = `
      <div class="zx-hf-scroll">
        <header class="zx-hf-hero">
          <div class="zx-hf-hero-icon"><span class="zx-hf-movie-mark" aria-hidden="true"></span></div>
          <div><h1>一键成片</h1><p>填写需求、选择模板，和 AI 沟通生成可预览下载的视频。</p></div>
          <div class="zx-hf-hero-actions"><button type="button" class="zx-hf-secondary" data-refresh-all>刷新</button><button type="button" class="zx-hf-primary inline" data-go-settings>API Key</button></div>
        </header>
        <nav class="zx-hf-tabs">${tabs.map(([id, label]) => `<button type="button" data-tab="${id}" class="${state.tab === id ? 'active' : ''}">${label}</button>`).join('')}</nav>
        <main class="zx-hf-content ${state.tab === 'create' && !state.loading ? 'zx-hf-create-content' : ''} ${state.tab === 'settings' && !state.loading ? 'zx-hf-settings-content' : ''}">${contentHtml()}</main>${modelLibraryModalHtml()}
      </div>
    `;
    bindPage(page);
    if (state.active) showPage();
    syncTemplatePortal();
  }

  function bindPage(page) {
    page.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => { state.tab = btn.dataset.tab; render(); if (state.tab === 'works') refreshJobs(); }));
    page.querySelector('[data-refresh-all]')?.addEventListener('click', () => loadAll());
    page.querySelector('[data-go-settings]')?.addEventListener('click', () => { state.tab = 'settings'; render(); });
    page.querySelectorAll('[data-template]').forEach(btn => btn.addEventListener('click', () => { applyTemplateSelection(btn.dataset.template); state.tab = 'create'; render(); }));
    page.querySelector('[data-open-template-picker]')?.addEventListener('click', () => { state.templatePickerOpen = true; render(); });
    page.querySelector('[data-close-template-picker]')?.addEventListener('click', () => { state.templatePickerOpen = false; render(); });
    page.querySelectorAll('[data-open-model-library]').forEach(btn => {
      btn.addEventListener('click', () => { state.modelModalProvider = btn.dataset.openModelLibrary; render(); });
    });
    page.querySelectorAll('[data-close-model-modal]').forEach(btn => {
      btn.addEventListener('click', () => { state.modelModalProvider = ''; render(); });
    });
    page.querySelector('[data-template-query]')?.addEventListener('input', event => { state.templateQuery = event.target.value; render(); });
    page.querySelectorAll('[data-user-template-delete]').forEach(btn => btn.addEventListener('click', event => { event.stopPropagation(); removeUserTemplate(btn.dataset.userTemplateDelete); }));
    page.querySelectorAll('[data-user-template-bg]').forEach(btn => btn.addEventListener('click', event => { event.stopPropagation(); editUserTemplateBackground(btn.dataset.userTemplateBg); }));
    page.querySelectorAll('[data-user-template-bg], [data-user-template-delete]').forEach(el => {
      el.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        el.click();
      });
    });
    page.querySelectorAll('[data-asset-mode]').forEach(btn => btn.addEventListener('click', () => { state.assetMode = btn.dataset.assetMode; render(); }));
    page.querySelectorAll('[data-remove-asset-key]').forEach(btn => {
      btn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        removeAssetPreview(btn.dataset.removeAssetKind, btn.dataset.removeAssetKey);
      });
    });
    page.querySelector('[data-assistant-action]')?.addEventListener('click', handleAssistantAction);
    page.querySelectorAll('[data-generate-video]').forEach(btn => {
      btn.addEventListener('click', () => {
        const activeJob = getActiveJob();
        if (state.activeJobId && (!activeJob || isJobRunning(activeJob))) return toast('\u5f53\u524d\u8fd8\u5728\u751f\u6210\uff0c\u9700\u8981\u5148\u6682\u505c\u518d\u91cd\u65b0\u751f\u6210', 'error');
        state.chatDraft = '';
        state.chatDraftVersion += 1;
        state.ignoreNextChatDraftChange = true;
        createJob();
      });
    });
    page.querySelector('[data-create]')?.addEventListener('click', createJob);
    page.querySelector('[data-send-chat]')?.addEventListener('click', sendChatMessage);
    page.querySelectorAll('[data-save-template]').forEach(btn => btn.addEventListener('click', saveTemplatePreset));
    page.querySelector('[data-refresh]')?.addEventListener('click', () => loadAll());
    page.querySelectorAll('[data-continue-job]').forEach(btn => {
      btn.addEventListener('click', () => continueJob(btn.dataset.continueJob));
    });
    page.querySelectorAll('[data-delete-job]').forEach(btn => {
      btn.addEventListener('click', () => deleteJob(btn.dataset.deleteJob));
    });
    page.querySelectorAll('[data-save-job-template]').forEach(btn => {
      btn.addEventListener('click', () => saveTemplateFromJob(btn.dataset.saveJobTemplate));
    });
    page.querySelectorAll('[data-video-src]').forEach(btn => {
      btn.addEventListener('click', () => showVideoPreview(btn.dataset.videoSrc, btn.dataset.videoTitle || ''));
    });
    page.querySelector('[data-save-keys]')?.addEventListener('click', saveKeys);

    page.querySelectorAll('[data-test-provider]').forEach(btn => {
      btn.addEventListener('click', () => testApiProvider(btn.dataset.testProvider));
    });
    page.querySelectorAll('[data-tts-select]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.ttsForm.provider = btn.dataset.ttsSelect;
        renderKeepScroll();
      });
    });
    page.querySelectorAll('[data-test-tts]').forEach(btn => {
      btn.addEventListener('click', () => testTtsProvider(btn.dataset.testTts));
    });
    page.querySelector('[data-add-custom-channel]')?.addEventListener('click', createCustomChannel);
    page.querySelectorAll('[data-remove-custom-channel]').forEach(btn => {
      btn.addEventListener('click', () => removeCustomChannel(btn.dataset.removeCustomChannel));
    });
    const acceptIncomingFiles = (files, event) => {
      const incoming = Array.from(files || []).filter(Boolean);
      if (!incoming.length) return;
      const errors = incoming.map(validateAsset).filter(Boolean);
      if (errors.length) {
        toast(errors[0], 'error');
        if (event?.target && 'value' in event.target) event.target.value = '';
        return;
      }
      const merged = [...state.files];
      incoming.forEach(file => {
        const exists = merged.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified);
        if (!exists) merged.push(file);
      });
      state.files = merged.slice(0, 8);
      if (event?.target && 'value' in event.target) event.target.value = '';
      toast(`\u5df2\u6dfb\u52a0 ${incoming.length} \u4e2a\u7d20\u6750`, 'success');
      render();
    };
    const ingestFiles = event => acceptIncomingFiles(event.target.files, event);
    page.querySelector('[data-file-input]')?.addEventListener('change', ingestFiles);
    page.querySelector('[data-chat-file]')?.addEventListener('change', ingestFiles);
    const composer = page.querySelector('.zx-hf-chat-composer');
    const chatDraftInput = page.querySelector('[data-field="chatDraft"]');
    if (composer) {
      ['dragenter', 'dragover'].forEach(type => composer.addEventListener(type, event => {
        event.preventDefault();
        event.stopPropagation();
        composer.classList.add('is-dragging');
      }));
      composer.addEventListener('dragleave', event => {
        if (!composer.contains(event.relatedTarget)) composer.classList.remove('is-dragging');
      });
      composer.addEventListener('drop', event => {
        event.preventDefault();
        event.stopPropagation();
        composer.classList.remove('is-dragging');
        acceptIncomingFiles(event.dataTransfer?.files, event);
      });
      composer.addEventListener('paste', event => {
        const files = Array.from(event.clipboardData?.files || []);
        if (!files.length) return;
        event.preventDefault();
        acceptIncomingFiles(files, event);
      });
    }
    if (chatDraftInput) {
      chatDraftInput.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          handleAssistantAction();
        }
      });
      chatDraftInput.addEventListener('paste', event => {
        const files = Array.from(event.clipboardData?.files || []);
        if (!files.length) return;
        event.preventDefault();
        acceptIncomingFiles(files, event);
      });
    }
    page.querySelectorAll('[data-field]').forEach(input => {
      const key = input.dataset.field;
      const readValue = () => ['duration', 'customDuration'].includes(key) ? Number(input.value) : input.value;
      input.addEventListener('input', () => {
        if (key === 'chatDraft') input.dataset.chatDraftVersion = String(state.chatDraftVersion);
        state[key] = readValue();
        if (key === 'customDuration') state.duration = resolveDuration();
        if (key === 'chatDraft' || key === 'projectTitle' || key === 'prompt') {
          const btn = page.querySelector('[data-assistant-action]');
          if (btn) {
            const ready = Boolean(state.chatDraft.trim() || state.projectTitle.trim() || state.prompt.trim() || state.files.length);
            btn.classList.toggle('ready', ready);
          }
        }
      });
      input.addEventListener('change', () => {
        if (key === 'chatDraft') {
          if (state.ignoreNextChatDraftChange || input.dataset.chatDraftVersion !== String(state.chatDraftVersion)) {
            state.ignoreNextChatDraftChange = false;
            return;
          }
        }
        state[key] = readValue();
        if (key === 'customDuration') state.duration = resolveDuration();
        if (key === 'provider') render();
      });
    });
    page.querySelectorAll('[data-select-trigger]').forEach(trigger => {
      trigger.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const select = trigger.closest('.zx-hf-select');
        const isOpen = select?.classList.contains('open');
        page.querySelectorAll('.zx-hf-select.open').forEach(item => item.classList.remove('open'));
        if (select && !isOpen) select.classList.add('open');
      });
    });
    page.querySelectorAll('[data-select-option]').forEach(option => {
      option.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const select = option.closest('.zx-hf-select');
        const key = select?.dataset.selectField;
        if (!key) return;
        const value = option.dataset.selectOption;
        if (key === 'durationMode') {
          state.durationMode = value;
          state.duration = resolveDuration();
        } else if (key === 'modelChoice') {
          applyModelChoice(value);
        } else {
          state[key] = key === 'duration' ? Number(value) : value;
        }
        render();
      });
    });
    page.querySelectorAll('[data-full-text]').forEach(el => {
      const open = event => {
        event.preventDefault();
        event.stopPropagation();
        showFullText(el.dataset.fullText || el.textContent || '');
      };
      el.addEventListener('click', open);
      el.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') open(event);
      });
    });

    page.querySelectorAll('[data-model-draft]').forEach(input => {
      input.addEventListener('input', () => {
        state.modelDrafts[input.dataset.modelDraft] = input.value;
      });
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          addProviderModel(input.dataset.modelDraft);
        }
      });
    });
    page.querySelectorAll('[data-add-model]').forEach(btn => {
      btn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const provider = btn.dataset.addModel;
        const input = btn.closest('.zx-hf-model-field, .zx-hf-model-modal-add')?.querySelector(`[data-model-draft="${provider}"]`);
        const value = input ? input.value : '';
        state.modelDrafts[provider] = value;
        if (!addProviderModel(provider, true, value)) toast('请先输入模型名称', 'error');
      });
    });
    page.querySelectorAll('[data-remove-model]').forEach(btn => {
      btn.addEventListener('click', () => removeProviderModel(btn.dataset.removeModel, btn.dataset.model));
    });

    page.querySelectorAll('[data-key]').forEach(input => {
      input.addEventListener('input', () => { state.keyForm[input.dataset.key] = input.value; });
      input.addEventListener('change', () => { state.keyForm[input.dataset.key] = input.value; });
    });
    page.querySelectorAll('[data-tts-key]').forEach(input => {
      input.addEventListener('input', () => { state.ttsForm[input.dataset.ttsKey] = input.value; });
      input.addEventListener('change', () => { state.ttsForm[input.dataset.ttsKey] = input.value; });
    });
    page.querySelectorAll('[data-custom-channel][data-custom-field]').forEach(input => {
      const syncCustom = () => updateCustomChannel(input.dataset.customChannel, input.dataset.customField, input.value);
      input.addEventListener('input', syncCustom);
      input.addEventListener('change', syncCustom);
    });
  }

  function updateNavActive() {
    const nav = document.getElementById(NAV_ID);
    if (!nav) return;
    document.body.classList.toggle('zx-hf-route-active', state.active);
    nav.classList.toggle('nav-item-active', state.active);
    nav.classList.toggle('zx-hf-nav-active', state.active);
    nav.setAttribute('aria-current', state.active ? 'page' : 'false');
  }

  function showPage() {
    const page = ensurePage();
    if (!page) return;
    document.querySelectorAll('[id^="page-"]').forEach(el => {
      if (el.id === PAGE_ID) return;
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
      el.classList.remove('page-enter');
    });
    page.style.display = 'flex';
    page.style.pointerEvents = 'auto';
    page.classList.add('page-enter');
    updateNavActive();
  }

  function activate() {
    state.active = true;
    render();
    showPage();
    if (!state.loadedOnce) loadAll();
    else if (state.tab === 'works') refreshJobs();
  }

  function deactivate() {
    if (!state.active) return;
    state.active = false;
    document.body.classList.remove('zx-hf-route-active');
    const page = document.getElementById(PAGE_ID);
    if (page) { page.style.display = 'none'; page.style.pointerEvents = 'none'; }
    document.querySelectorAll('.zx-hf-template-portal').forEach(node => node.remove());
    updateNavActive();
  }

  function ensureNav() {
    const existing = document.getElementById(NAV_ID);
    if (existing && existing.closest('.zx-hf-nav-wrap')) return;
    if (existing) existing.remove();
    const target = byText('并发生成') || byText('API生成') || byText('资源迁移') || byText('上传模型');
    if (!target || !target.parentElement) return;
    const targetWrap = target.closest('.select-none') || target.parentElement;
    const navParent = targetWrap?.parentElement;
    if (!navParent) return;
    const wrap = document.createElement('div');
    wrap.className = 'mb-0.5 select-none zx-hf-nav-wrap';
    const nav = document.createElement('a');
    nav.id = NAV_ID;
    nav.dataset.zxHfNav = '1';
    nav.className = 'group relative flex items-center px-3 py-2 text-sm font-semibold transition-all duration-200 rounded-xl cursor-pointer text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-100 hover:bg-gray-50 dark:hover:bg-white/[0.04]';
    nav.removeAttribute('href');
    nav.innerHTML = '<div class="zx-hf-nav-icon-box nav-icon-box flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 flex-shrink-0 text-gray-400 dark:text-slate-500 group-hover:text-gray-600 dark:group-hover:text-cyan-400/70"><span class="zx-hf-nav-icon" aria-hidden="true"></span></div><span class="ml-3 flex-1 truncate">一键成片</span>';
    nav.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); activate(); });
    wrap.appendChild(nav);
    navParent.insertBefore(wrap, targetWrap.nextSibling);
    updateNavActive();
  }

  function sync() {
    ensurePage();
    ensureNav();
    if (state.active) showPage();
    syncTemplatePortal();
  }

  document.addEventListener('click', event => {
    if (event.target.closest && event.target.closest('.zx-hf-template-portal, .zx-hf-video-overlay, .zx-hf-fulltext-overlay, .zx-hf-model-modal')) return;
    const nav = event.target.closest && event.target.closest('button,a');
    if (!nav || nav.id === NAV_ID || nav.closest(`#${PAGE_ID}`)) return;
    const text = (nav.textContent || '').trim();
    if (text && text !== '一键成片') deactivate();
  }, true);

  const start = () => {
    sync();
    if (location.hash === '#one-click-movie') {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {}
    }
    document.addEventListener('click', () => {
      document.querySelectorAll('.zx-hf-select.open').forEach(item => item.classList.remove('open'));
    });
    new MutationObserver(() => requestAnimationFrame(sync)).observe(document.getElementById('root') || document.body, { childList: true, subtree: true });
    setInterval(sync, 1200);
    setInterval(refreshJobs, 5000);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
