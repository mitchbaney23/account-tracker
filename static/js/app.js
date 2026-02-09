// ============================================================================
// API Client
// ============================================================================

const API = {
    baseUrl: '/api',

    async request(endpoint, options = {}) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || 'Request failed');
        }

        return response.json();
    },

    accounts: {
        getAll: () => API.request('/accounts'),
        getById: (id) => API.request(`/accounts/${id}`),
        update: (id, data) => API.request(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        getActivities: (id) => API.request(`/accounts/${id}/activities`),
        getTasks: (id) => API.request(`/accounts/${id}/tasks`),
        getNotes: (id) => API.request(`/accounts/${id}/notes`),
        getDeals: (id) => API.request(`/accounts/${id}/deals`),
        getContacts: (id) => API.request(`/accounts/${id}/contacts`),
        snooze: (id) => API.request(`/accounts/${id}/snooze`, { method: 'POST' })
    },

    activities: {
        create: (data) => API.request('/activities', { method: 'POST', body: JSON.stringify(data) })
    },

    tasks: {
        create: (data) => API.request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => API.request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id) => API.request(`/tasks/${id}`, { method: 'DELETE' })
    },

    notes: {
        create: (data) => API.request('/notes', { method: 'POST', body: JSON.stringify(data) })
    },

    deals: {
        create: (data) => API.request('/deals', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => API.request(`/deals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id) => API.request(`/deals/${id}`, { method: 'DELETE' })
    },

    contacts: {
        create: (data) => API.request('/contacts', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => API.request(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id) => API.request(`/contacts/${id}`, { method: 'DELETE' })
    },

    dashboard: {
        getStats: () => API.request('/dashboard')
    },

    sync: {
        getStatus: () => API.request('/sync/status'),
        run: () => API.request('/sync', { method: 'POST' })
    }
};

// ============================================================================
// State Management
// ============================================================================

const State = {
    accounts: [],
    filter: 'untouched',
    sortBy: 'name',
    currentAccountId: null,
    lastActiveDate: null,
    quickLogAccountId: null,
    quickLogType: null
};

// ============================================================================
// Utility Functions
// ============================================================================

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMoney(value) {
    if (!value || value === 0) return '$0';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
}

function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

function daysSince(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = today - date;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function daysUntil(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = date - today;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function getActivityTypeIcon(type) {
    const icons = { call: '📞', email: '📧', meeting: '👥', research: '🔍', event_invite: '📅', internal: '🏢', other: '📝' };
    return icons[type] || '📝';
}

function getActivityTypeLabel(type) {
    const labels = { call: 'Call', email: 'Email', meeting: 'Meeting', research: 'Research', event_invite: 'Event Invite', internal: 'Internal', other: 'Other' };
    return labels[type] || type;
}

function getStageName(stage) {
    const names = { discovery: 'Discovery', design: 'Design', proposal: 'Proposal', negotiation: 'Negotiation', closed_won: 'Won', closed_lost: 'Lost' };
    return names[stage] || stage;
}

function getRoleName(role) {
    const names = { champion: 'Champion', decision_maker: 'Decision Maker', technical_eval: 'Tech Eval', influencer: 'Influencer', blocker: 'Blocker', other: 'Other' };
    return names[role] || role || '';
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ============================================================================
// Toast Notifications
// ============================================================================

function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), duration);
}

// ============================================================================
// Modal Management
// ============================================================================

const Modal = {
    open(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    },
    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    },
    closeAll() {
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
        document.body.style.overflow = '';
    }
};

// ============================================================================
// Dashboard Stats Bar
// ============================================================================

async function loadDashboard() {
    try {
        const stats = await API.dashboard.getStats();

        document.getElementById('stat-weekly').textContent =
            `${stats.weekly_touches}/${stats.total_accounts}`;
        document.getElementById('stat-pipeline').textContent =
            formatMoney(stats.total_pipeline);
        document.getElementById('stat-renewals').textContent =
            stats.upcoming_renewals;
        document.getElementById('stat-overdue').textContent =
            stats.overdue_tasks;
        document.getElementById('stat-streak').textContent =
            stats.touch_streak > 0 ? `🔥 ${stats.touch_streak}d` : '0d';
    } catch (error) {
        console.error('Failed to load dashboard:', error);
    }
}

// ============================================================================
// Account Card Rendering
// ============================================================================

function renderAccountCard(account, index) {
    const days = daysSince(account.last_activity_date);
    let daysText = 'No activity';
    let daysColor = 'color: var(--text-muted)';

    if (days !== null) {
        if (days === 0) { daysText = 'Today'; daysColor = 'color: var(--accent-green)'; }
        else if (days === 1) { daysText = 'Yesterday'; daysColor = 'color: var(--accent-green)'; }
        else if (days <= 3) { daysText = `${days}d ago`; daysColor = 'color: var(--accent-green)'; }
        else if (days <= 7) { daysText = `${days}d ago`; daysColor = 'color: var(--accent-amber)'; }
        else { daysText = `${days}d ago`; daysColor = 'color: var(--accent-red)'; }
    }

    const touchedClass = account.touched_today ? 'touched' : '';

    // Status indicator
    const statusDot = account.touched_today
        ? '<div class="w-3 h-3 rounded-full bg-emerald-400"></div>'
        : '<div class="w-3 h-3 rounded-full bg-amber-400 animate-pulse-soft"></div>';

    // Renewal badge
    let renewalBadge = '';
    if (account.renewal_date) {
        const daysLeft = daysUntil(account.renewal_date);
        if (daysLeft !== null) {
            if (daysLeft < 0) {
                renewalBadge = `<span class="renewal-badge renewal-overdue">OVERDUE ${Math.abs(daysLeft)}d</span>`;
            } else if (daysLeft <= 30) {
                renewalBadge = `<span class="renewal-badge renewal-urgent">Renewal ${daysLeft}d</span>`;
            } else if (daysLeft <= 60) {
                renewalBadge = `<span class="renewal-badge renewal-warning">Renewal ${daysLeft}d</span>`;
            } else {
                renewalBadge = `<span class="renewal-badge renewal-safe">Renews ${formatDate(account.renewal_date)}</span>`;
            }
        }
    }

    // Deal info
    let dealBadge = '';
    if (account.active_deals > 0) {
        const pipelineStr = account.pipeline_value > 0 ? ` · ${formatMoney(account.pipeline_value)}` : '';
        const stageStr = account.top_deal_stage ? `<span class="stage-pill stage-${account.top_deal_stage}" style="margin-left:4px">${getStageName(account.top_deal_stage)}</span>` : '';
        dealBadge = `<span class="deal-badge">${account.active_deals} deal${account.active_deals > 1 ? 's' : ''}${pipelineStr}${stageStr}</span>`;
    }

    // Contact count
    const contactInfo = account.contact_count > 0
        ? `<span style="color: var(--text-muted); font-size: 0.7rem;">👤 ${account.contact_count}</span>`
        : '';

    return `
        <div class="account-card card-entering ${touchedClass} cursor-pointer"
             data-account-id="${account.id}"
             style="animation-delay: ${index * 0.04}s">
            <div class="p-5">
                <!-- Top row: name + status -->
                <div class="flex justify-between items-start mb-3">
                    <div class="flex-1 min-w-0 pr-3">
                        <div class="flex items-center gap-2 mb-0.5">
                            ${statusDot}
                            <h3 class="font-bold text-white text-sm leading-tight truncate">${account.name}</h3>
                        </div>
                        <p class="text-xs ml-5" style="color: var(--text-muted)">${account.industry || ''}</p>
                    </div>
                    ${contactInfo}
                </div>

                <!-- Stats row -->
                <div class="flex items-center gap-2 mb-3">
                    <div class="card-stat-box flex-1">
                        <div class="stat-label">Last Touch</div>
                        <div class="stat-value" style="${daysColor}">${daysText}</div>
                    </div>
                    <div class="card-stat-box flex-1">
                        <div class="stat-label">Open Tasks</div>
                        <div class="stat-value" style="color: ${account.open_tasks > 0 ? 'var(--accent-amber)' : 'var(--text-secondary)'}">${account.open_tasks}</div>
                    </div>
                </div>

                <!-- Badges row -->
                ${(renewalBadge || dealBadge) ? `<div class="flex flex-wrap gap-2 mb-3">${renewalBadge}${dealBadge}</div>` : ''}

                <!-- Last activity description -->
                ${account.last_activity_description ? `
                    <p class="text-xs truncate mb-3 italic" style="color: var(--text-muted)">"${account.last_activity_description}"</p>
                ` : ''}

                <!-- Quick Log Actions -->
                <div class="flex items-center gap-2">
                    <div class="quick-log-row flex-1">
                        <button class="quick-log-btn" data-account-id="${account.id}" data-account-name="${account.name}" data-type="call" title="Log Call">📞</button>
                        <button class="quick-log-btn" data-account-id="${account.id}" data-account-name="${account.name}" data-type="email" title="Log Email">📧</button>
                        <button class="quick-log-btn" data-account-id="${account.id}" data-account-name="${account.name}" data-type="meeting" title="Log Meeting">👥</button>
                        <button class="quick-log-btn" data-account-id="${account.id}" data-account-name="${account.name}" data-type="research" title="Log Research">🔍</button>
                        <button class="quick-log-btn more-btn" data-account-id="${account.id}" data-account-name="${account.name}" data-type="more" title="More options">•••</button>
                    </div>
                    <button class="btn-view-details btn-secondary px-3 py-2 rounded-lg text-xs font-semibold"
                            data-account-id="${account.id}">View</button>
                    ${!account.touched_today ? `
                    <button class="btn-snooze btn-secondary px-2 py-2 rounded-lg text-xs"
                            data-account-id="${account.id}" title="Skip for today">💤</button>
                    ` : ''}
                </div>

                <!-- Quick log inline form (hidden by default) -->
                <div class="quick-log-inline hidden" data-account-id="${account.id}">
                    <input type="text" placeholder="What did you do?" class="quick-log-input">
                    <button class="quick-log-submit btn-primary rounded-lg text-xs font-semibold px-3" data-account-id="${account.id}">Log</button>
                </div>
            </div>
        </div>
    `;
}

function renderAccounts() {
    const grid = document.getElementById('accounts-grid');
    const allDone = document.getElementById('all-done');
    let accounts = [...State.accounts];

    // Apply filter
    if (State.filter === 'touched') {
        accounts = accounts.filter(a => a.touched_today);
    } else if (State.filter === 'untouched') {
        accounts = accounts.filter(a => !a.touched_today);
    }

    // Apply sort
    if (State.sortBy === 'name') {
        accounts.sort((a, b) => a.name.localeCompare(b.name));
    } else if (State.sortBy === 'touched') {
        accounts.sort((a, b) => (a.touched_today === b.touched_today) ? 0 : a.touched_today ? 1 : -1);
    } else if (State.sortBy === 'tasks') {
        accounts.sort((a, b) => b.open_tasks - a.open_tasks);
    } else if (State.sortBy === 'renewal') {
        accounts.sort((a, b) => {
            if (!a.renewal_date && !b.renewal_date) return 0;
            if (!a.renewal_date) return 1;
            if (!b.renewal_date) return -1;
            return a.renewal_date.localeCompare(b.renewal_date);
        });
    } else if (State.sortBy === 'pipeline') {
        accounts.sort((a, b) => (b.pipeline_value || 0) - (a.pipeline_value || 0));
    }

    if (State.filter === 'untouched' && accounts.length === 0 && State.accounts.length > 0) {
        grid.innerHTML = '';
        allDone.classList.remove('hidden');
    } else {
        allDone.classList.add('hidden');
        grid.innerHTML = accounts.map((account, index) => renderAccountCard(account, index)).join('');
    }
}

function updateProgress() {
    const touched = State.accounts.filter(a => a.touched_today).length;
    const total = State.accounts.length;
    const percentage = total > 0 ? (touched / total) * 100 : 0;

    document.getElementById('touched-count').textContent = touched;
    document.getElementById('total-count').textContent = total;
    document.getElementById('progress-bar').style.width = `${percentage}%`;
}

// ============================================================================
// Account Detail Modal
// ============================================================================

async function openAccountDetail(accountId) {
    State.currentAccountId = accountId;
    const account = State.accounts.find(a => a.id === accountId);
    if (!account) return;

    document.getElementById('detail-account-name').textContent = account.name;
    document.getElementById('detail-account-industry').textContent = account.industry || '';
    document.getElementById('detail-account-location').textContent = account.location || '';

    // Show renewal info
    const renewalInfo = document.getElementById('detail-renewal-info');
    if (account.renewal_date) {
        const daysLeft = daysUntil(account.renewal_date);
        const valueStr = account.annual_value ? ` · ${formatMoney(account.annual_value)}/yr` : '';
        let renewalClass = 'renewal-safe';
        if (daysLeft < 0) renewalClass = 'renewal-overdue';
        else if (daysLeft <= 30) renewalClass = 'renewal-urgent';
        else if (daysLeft <= 60) renewalClass = 'renewal-warning';
        renewalInfo.innerHTML = `<span class="renewal-badge ${renewalClass}">Renewal: ${formatDate(account.renewal_date)}${valueStr}</span>`;
    } else {
        renewalInfo.innerHTML = '<span class="text-xs" style="color: var(--text-muted)">No renewal date set</span>';
    }

    // Reset tabs
    document.querySelectorAll('.detail-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector('.detail-tab[data-tab="activities"]').classList.add('active');

    document.querySelectorAll('.detail-tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById('detail-activities').classList.remove('hidden');

    Modal.open('detail-modal');
    await loadAccountActivities(accountId);
}

async function loadAccountActivities(accountId) {
    const list = document.getElementById('activities-list');
    const empty = document.getElementById('no-activities');

    try {
        const data = await API.accounts.getActivities(accountId);
        if (data.activities.length === 0) {
            list.innerHTML = '';
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');
            list.innerHTML = data.activities.map(a => `
                <div class="item-card">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-base">${getActivityTypeIcon(a.activity_type)}</span>
                        <span class="font-medium text-sm text-white">${getActivityTypeLabel(a.activity_type)}</span>
                        <span class="text-xs" style="color: var(--text-muted)">${formatDate(a.activity_date)}</span>
                    </div>
                    <p class="text-sm" style="color: var(--text-secondary)">${a.description}</p>
                </div>
            `).join('');
        }
    } catch (error) {
        list.innerHTML = '<p class="text-red-400 text-sm">Failed to load activities</p>';
    }
}

async function loadAccountTasks(accountId) {
    const list = document.getElementById('tasks-list');
    const empty = document.getElementById('no-tasks');

    try {
        const data = await API.accounts.getTasks(accountId);
        if (data.tasks.length === 0) {
            list.innerHTML = '';
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');
            list.innerHTML = data.tasks.map(task => `
                <div class="item-card flex items-start gap-3">
                    <input type="checkbox" class="task-checkbox mt-1 w-4 h-4 rounded"
                           data-task-id="${task.id}" ${task.status === 'completed' ? 'checked' : ''}>
                    <div class="flex-1 min-w-0">
                        <p class="font-medium text-sm ${task.status === 'completed' ? 'line-through' : 'text-white'}" style="${task.status === 'completed' ? 'color: var(--text-muted)' : ''}">${task.title}</p>
                        ${task.description ? `<p class="text-xs mt-0.5" style="color: var(--text-muted)">${task.description}</p>` : ''}
                        ${task.due_date ? `<p class="text-xs mt-1" style="color: var(--text-muted)">Due: ${formatDate(task.due_date)}</p>` : ''}
                    </div>
                    <button class="delete-task" style="color: var(--text-muted)" data-task-id="${task.id}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            `).join('');
        }
    } catch (error) {
        list.innerHTML = '<p class="text-red-400 text-sm">Failed to load tasks</p>';
    }
}

async function loadAccountDeals(accountId) {
    const list = document.getElementById('deals-list');
    const empty = document.getElementById('no-deals');

    try {
        const data = await API.accounts.getDeals(accountId);
        if (data.deals.length === 0) {
            list.innerHTML = '';
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');
            list.innerHTML = data.deals.map(deal => `
                <div class="item-card">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="font-medium text-sm text-white truncate">${deal.name}</span>
                            <span class="stage-pill stage-${deal.stage}">${getStageName(deal.stage)}</span>
                        </div>
                        <div class="flex items-center gap-2 flex-shrink-0">
                            <button class="edit-deal text-xs" style="color: var(--accent-blue)" data-deal-id="${deal.id}">Edit</button>
                            <button class="delete-deal" style="color: var(--text-muted)" data-deal-id="${deal.id}">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-3 text-xs" style="color: var(--text-muted)">
                        ${deal.value ? `<span>💰 ${formatMoney(deal.value)}</span>` : ''}
                        ${deal.products ? `<span>📦 ${deal.products}</span>` : ''}
                        ${deal.expected_close_date ? `<span>📅 Close: ${formatDate(deal.expected_close_date)}</span>` : ''}
                    </div>
                    ${deal.notes ? `<p class="text-xs mt-2" style="color: var(--text-muted)">${deal.notes}</p>` : ''}
                </div>
            `).join('');
        }
    } catch (error) {
        list.innerHTML = '<p class="text-red-400 text-sm">Failed to load deals</p>';
    }
}

async function loadAccountContacts(accountId) {
    const list = document.getElementById('contacts-list');
    const empty = document.getElementById('no-contacts');

    try {
        const data = await API.accounts.getContacts(accountId);
        if (data.contacts.length === 0) {
            list.innerHTML = '';
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');
            list.innerHTML = data.contacts.map(contact => `
                <div class="contact-card">
                    <div class="contact-avatar">${getInitials(contact.name)}</div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-0.5">
                            <span class="font-medium text-sm text-white">${contact.name}</span>
                            ${contact.role ? `<span class="role-badge role-${contact.role}">${getRoleName(contact.role)}</span>` : ''}
                        </div>
                        ${contact.title ? `<p class="text-xs" style="color: var(--text-muted)">${contact.title}</p>` : ''}
                        <div class="flex flex-wrap gap-3 mt-1 text-xs" style="color: var(--text-muted)">
                            ${contact.email ? `<span>✉ ${contact.email}</span>` : ''}
                            ${contact.phone ? `<span>📞 ${contact.phone}</span>` : ''}
                            ${contact.last_contacted ? `<span>Last: ${formatDate(contact.last_contacted)}</span>` : ''}
                        </div>
                        ${contact.notes ? `<p class="text-xs mt-1" style="color: var(--text-muted)">${contact.notes}</p>` : ''}
                    </div>
                    <div class="flex flex-col gap-1 flex-shrink-0">
                        <button class="edit-contact text-xs" style="color: var(--accent-blue)" data-contact-id="${contact.id}">Edit</button>
                        <button class="delete-contact text-xs" style="color: var(--text-muted)" data-contact-id="${contact.id}">Del</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        list.innerHTML = '<p class="text-red-400 text-sm">Failed to load contacts</p>';
    }
}

async function loadAccountNotes(accountId) {
    const list = document.getElementById('notes-list');
    const empty = document.getElementById('no-notes');

    try {
        const data = await API.accounts.getNotes(accountId);
        if (data.notes.length === 0) {
            list.innerHTML = '';
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');
            list.innerHTML = data.notes.map(note => `
                <div class="item-card">
                    <p class="text-xs mb-1" style="color: var(--text-muted)">${formatDate(note.note_date)}</p>
                    <p class="text-sm" style="color: var(--text-secondary)">${note.content}</p>
                </div>
            `).join('');
        }
    } catch (error) {
        list.innerHTML = '<p class="text-red-400 text-sm">Failed to load notes</p>';
    }
}

// ============================================================================
// Form Handlers
// ============================================================================

async function handleActivitySubmit(e) {
    e.preventDefault();
    const accountId = document.getElementById('activity-account-id').value;
    const activityType = document.getElementById('activity-type').value;
    const description = document.getElementById('activity-description').value;
    const activityDate = document.getElementById('activity-date').value || getTodayStr();

    try {
        await API.activities.create({
            account_id: parseInt(accountId),
            activity_type: activityType,
            description: description,
            activity_date: activityDate
        });

        Modal.close('activity-modal');
        e.target.reset();

        if (State.filter === 'untouched') {
            const card = document.querySelector(`.account-card[data-account-id="${accountId}"]`);
            if (card) {
                card.classList.add('card-completing');
                setTimeout(async () => {
                    await loadAccounts();
                    showToast('Activity logged ✓');
                }, 600);
                return;
            }
        }

        showToast('Activity logged ✓');
        await loadAccounts();
    } catch (error) {
        showToast('Failed: ' + error.message);
    }
}

async function handleTaskSubmit(e) {
    e.preventDefault();
    const accountId = document.getElementById('task-account-id').value;
    const title = document.getElementById('task-title').value;
    const description = document.getElementById('task-description').value;
    const dueDate = document.getElementById('task-due-date').value || null;

    try {
        await API.tasks.create({ account_id: parseInt(accountId), title, description: description || null, due_date: dueDate });
        Modal.close('task-modal');
        e.target.reset();
        showToast('Task added ✓');
        await loadAccounts();
    } catch (error) {
        showToast('Failed: ' + error.message);
    }
}

async function handleNoteSubmit(e) {
    e.preventDefault();
    const accountId = document.getElementById('note-account-id').value;
    const content = document.getElementById('note-content').value;

    try {
        await API.notes.create({ account_id: parseInt(accountId), content });
        Modal.close('note-modal');
        e.target.reset();
        showToast('Note added ✓');
        await loadAccounts();
    } catch (error) {
        showToast('Failed: ' + error.message);
    }
}

async function handleDealSubmit(e) {
    e.preventDefault();
    const dealId = document.getElementById('deal-id').value;
    const accountId = document.getElementById('deal-account-id').value;

    const data = {
        account_id: parseInt(accountId),
        name: document.getElementById('deal-name').value,
        stage: document.getElementById('deal-stage').value,
        value: document.getElementById('deal-value').value ? parseFloat(document.getElementById('deal-value').value) : null,
        products: document.getElementById('deal-products').value || null,
        expected_close_date: document.getElementById('deal-close-date').value || null,
        notes: document.getElementById('deal-notes').value || null
    };

    try {
        if (dealId) {
            await API.deals.update(dealId, data);
            showToast('Deal updated ✓');
        } else {
            await API.deals.create(data);
            showToast('Deal created ✓');
        }
        Modal.close('deal-modal');
        e.target.reset();
        document.getElementById('deal-id').value = '';
        await loadAccounts();
        // Refresh deals tab if detail modal is open
        if (State.currentAccountId) {
            await loadAccountDeals(State.currentAccountId);
        }
    } catch (error) {
        showToast('Failed: ' + error.message);
    }
}

async function handleContactSubmit(e) {
    e.preventDefault();
    const contactId = document.getElementById('contact-id').value;
    const accountId = document.getElementById('contact-account-id').value;

    const data = {
        account_id: parseInt(accountId),
        name: document.getElementById('contact-name').value,
        title: document.getElementById('contact-title').value || null,
        role: document.getElementById('contact-role').value || null,
        email: document.getElementById('contact-email').value || null,
        phone: document.getElementById('contact-phone').value || null,
        notes: document.getElementById('contact-notes').value || null
    };

    try {
        if (contactId) {
            await API.contacts.update(contactId, data);
            showToast('Contact updated ✓');
        } else {
            await API.contacts.create(data);
            showToast('Contact added ✓');
        }
        Modal.close('contact-modal');
        e.target.reset();
        document.getElementById('contact-id').value = '';
        await loadAccounts();
        if (State.currentAccountId) {
            await loadAccountContacts(State.currentAccountId);
        }
    } catch (error) {
        showToast('Failed: ' + error.message);
    }
}

async function handleAccountEditSubmit(e) {
    e.preventDefault();
    const accountId = document.getElementById('edit-account-id').value;

    const data = {
        industry: document.getElementById('edit-industry').value || null,
        location: document.getElementById('edit-location').value || null,
        renewal_date: document.getElementById('edit-renewal-date').value || null,
        annual_value: document.getElementById('edit-annual-value').value ? parseFloat(document.getElementById('edit-annual-value').value) : null
    };

    try {
        await API.accounts.update(accountId, data);
        Modal.close('account-edit-modal');
        showToast('Account updated ✓');
        await loadAccounts();
        await loadDashboard();
    } catch (error) {
        showToast('Failed: ' + error.message);
    }
}

// ============================================================================
// Quick Log Handler
// ============================================================================

async function handleQuickLog(accountId, activityType, description) {
    try {
        await API.activities.create({
            account_id: parseInt(accountId),
            activity_type: activityType,
            description: description,
            activity_date: getTodayStr()
        });

        if (State.filter === 'untouched') {
            const card = document.querySelector(`.account-card[data-account-id="${accountId}"]`);
            if (card) {
                card.classList.add('card-completing');
                setTimeout(async () => {
                    await loadAccounts();
                    showToast(`${getActivityTypeLabel(activityType)} logged ✓`);
                }, 600);
                return;
            }
        }

        showToast(`${getActivityTypeLabel(activityType)} logged ✓`);
        await loadAccounts();
    } catch (error) {
        showToast('Failed: ' + error.message);
    }
}

// ============================================================================
// Sync
// ============================================================================

async function updateSyncStatus() {
    try {
        const status = await API.sync.getStatus();
        const badge = document.getElementById('unsynced-badge');
        if (status.total_unsynced > 0) {
            badge.textContent = status.total_unsynced;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch (error) {
        console.error('Failed to get sync status:', error);
    }
}

async function handleSync() {
    const btn = document.getElementById('sync-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="animate-spin">⟳</span> Syncing...';

    try {
        await API.sync.run();
        showToast('Sync completed ✓');
        await updateSyncStatus();
    } catch (error) {
        showToast('Sync failed: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            <span>Sync</span>
            <span id="unsynced-badge" class="hidden bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">0</span>
        `;
        await updateSyncStatus();
    }
}

// ============================================================================
// Daily Reset Check
// ============================================================================

function checkDailyReset() {
    const today = getTodayStr();
    const lastDate = localStorage.getItem('lastActiveDate');

    if (lastDate && lastDate !== today) {
        const notification = document.getElementById('new-day-notification');
        notification.classList.remove('hidden');
        setTimeout(() => notification.classList.add('hidden'), 4000);
    }

    localStorage.setItem('lastActiveDate', today);
}

// ============================================================================
// Event Listeners Setup
// ============================================================================

function setupEventListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            State.filter = btn.dataset.filter;
            renderAccounts();
        });
    });

    // Sort select
    document.getElementById('sort-select').addEventListener('change', (e) => {
        State.sortBy = e.target.value;
        renderAccounts();
    });

    // Card grid actions (delegated)
    document.getElementById('accounts-grid').addEventListener('click', async (e) => {
        const quickLogBtn = e.target.closest('.quick-log-btn');
        const quickLogSubmit = e.target.closest('.quick-log-submit');
        const viewDetailsBtn = e.target.closest('.btn-view-details');
        const snoozeBtn = e.target.closest('.btn-snooze');
        const card = e.target.closest('.account-card');

        // Quick log button
        if (quickLogBtn) {
            e.stopPropagation();
            const accountId = quickLogBtn.dataset.accountId;
            const accountName = quickLogBtn.dataset.accountName;
            const type = quickLogBtn.dataset.type;

            if (type === 'more') {
                // Open full activity modal
                document.getElementById('activity-account-id').value = accountId;
                document.getElementById('activity-modal-account').textContent = accountName;
                document.getElementById('activity-date').value = getTodayStr();
                Modal.open('activity-modal');
                return;
            }

            // Show inline form
            const inlineForm = card.querySelector(`.quick-log-inline[data-account-id="${accountId}"]`);
            if (inlineForm) {
                // Hide all other inline forms
                document.querySelectorAll('.quick-log-inline').forEach(f => f.classList.add('hidden'));
                inlineForm.classList.remove('hidden');
                State.quickLogAccountId = accountId;
                State.quickLogType = type;
                const input = inlineForm.querySelector('.quick-log-input');
                input.placeholder = `Quick ${getActivityTypeLabel(type)} note...`;
                input.focus();
            }
            return;
        }

        // Quick log submit
        if (quickLogSubmit) {
            e.stopPropagation();
            const accountId = quickLogSubmit.dataset.accountId;
            const inlineForm = quickLogSubmit.closest('.quick-log-inline');
            const input = inlineForm.querySelector('.quick-log-input');
            const description = input.value.trim();

            if (description && State.quickLogType) {
                await handleQuickLog(accountId, State.quickLogType, description);
                inlineForm.classList.add('hidden');
                input.value = '';
            }
            return;
        }

        // Snooze
        if (snoozeBtn) {
            e.stopPropagation();
            const accountId = snoozeBtn.dataset.accountId;
            const cardEl = snoozeBtn.closest('.account-card');
            try {
                await API.accounts.snooze(accountId);
                if (State.filter === 'untouched' && cardEl) {
                    cardEl.classList.add('card-completing');
                    setTimeout(async () => {
                        await loadAccounts();
                        showToast('Account snoozed 💤');
                    }, 600);
                } else {
                    await loadAccounts();
                    showToast('Account snoozed 💤');
                }
            } catch (error) {
                showToast('Failed: ' + error.message);
            }
            return;
        }

        // View details
        if (viewDetailsBtn) {
            e.stopPropagation();
            openAccountDetail(parseInt(viewDetailsBtn.dataset.accountId));
            return;
        }

        // Click on card
        if (card) {
            openAccountDetail(parseInt(card.dataset.accountId));
        }
    });

    // Quick log inline — Enter key to submit
    document.getElementById('accounts-grid').addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && e.target.classList.contains('quick-log-input')) {
            e.preventDefault();
            const inlineForm = e.target.closest('.quick-log-inline');
            const accountId = inlineForm.dataset.accountId;
            const description = e.target.value.trim();

            if (description && State.quickLogType) {
                await handleQuickLog(accountId, State.quickLogType, description);
                inlineForm.classList.add('hidden');
                e.target.value = '';
            }
        }
        if (e.key === 'Escape' && e.target.classList.contains('quick-log-input')) {
            const inlineForm = e.target.closest('.quick-log-inline');
            inlineForm.classList.add('hidden');
            e.target.value = '';
        }
    });

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => Modal.closeAll());
    });

    // Modal backdrop clicks
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', () => Modal.closeAll());
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') Modal.closeAll();
    });

    // Form submissions
    document.getElementById('activity-form').addEventListener('submit', handleActivitySubmit);
    document.getElementById('task-form').addEventListener('submit', handleTaskSubmit);
    document.getElementById('note-form').addEventListener('submit', handleNoteSubmit);
    document.getElementById('deal-form').addEventListener('submit', handleDealSubmit);
    document.getElementById('contact-form').addEventListener('submit', handleContactSubmit);
    document.getElementById('account-edit-form').addEventListener('submit', handleAccountEditSubmit);

    // Detail modal tabs
    document.querySelectorAll('.detail-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.querySelectorAll('.detail-tab-content').forEach(c => c.classList.add('hidden'));
            const tabName = tab.dataset.tab;
            document.getElementById(`detail-${tabName}`).classList.remove('hidden');

            if (tabName === 'activities') await loadAccountActivities(State.currentAccountId);
            else if (tabName === 'tasks') await loadAccountTasks(State.currentAccountId);
            else if (tabName === 'deals') await loadAccountDeals(State.currentAccountId);
            else if (tabName === 'contacts') await loadAccountContacts(State.currentAccountId);
            else if (tabName === 'notes') await loadAccountNotes(State.currentAccountId);
        });
    });

    // Detail modal action buttons
    document.querySelectorAll('.detail-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const account = State.accounts.find(a => a.id === State.currentAccountId);
            if (!account) return;

            if (action === 'activity') {
                document.getElementById('activity-account-id').value = State.currentAccountId;
                document.getElementById('activity-modal-account').textContent = account.name;
                document.getElementById('activity-date').value = getTodayStr();
                Modal.close('detail-modal');
                Modal.open('activity-modal');
            } else if (action === 'task') {
                document.getElementById('task-account-id').value = State.currentAccountId;
                document.getElementById('task-modal-account').textContent = account.name;
                Modal.close('detail-modal');
                Modal.open('task-modal');
            } else if (action === 'note') {
                document.getElementById('note-account-id').value = State.currentAccountId;
                document.getElementById('note-modal-account').textContent = account.name;
                Modal.close('detail-modal');
                Modal.open('note-modal');
            } else if (action === 'deal') {
                document.getElementById('deal-account-id').value = State.currentAccountId;
                document.getElementById('deal-id').value = '';
                document.getElementById('deal-modal-title').textContent = 'Add Deal';
                document.getElementById('deal-modal-account').textContent = account.name;
                document.getElementById('deal-form').reset();
                Modal.close('detail-modal');
                Modal.open('deal-modal');
            } else if (action === 'contact') {
                document.getElementById('contact-account-id').value = State.currentAccountId;
                document.getElementById('contact-id').value = '';
                document.getElementById('contact-modal-title').textContent = 'Add Contact';
                document.getElementById('contact-modal-account').textContent = account.name;
                document.getElementById('contact-form').reset();
                Modal.close('detail-modal');
                Modal.open('contact-modal');
            }
        });
    });

    // Detail edit button
    document.getElementById('detail-edit-btn').addEventListener('click', () => {
        const account = State.accounts.find(a => a.id === State.currentAccountId);
        if (!account) return;

        document.getElementById('edit-account-id').value = account.id;
        document.getElementById('edit-industry').value = account.industry || '';
        document.getElementById('edit-location').value = account.location || '';
        document.getElementById('edit-renewal-date').value = account.renewal_date || '';
        document.getElementById('edit-annual-value').value = account.annual_value || '';

        Modal.close('detail-modal');
        Modal.open('account-edit-modal');
    });

    // Task checkbox and delete (delegated)
    document.getElementById('tasks-list').addEventListener('click', async (e) => {
        const checkbox = e.target.closest('.task-checkbox');
        const deleteBtn = e.target.closest('.delete-task');

        if (checkbox) {
            const taskId = checkbox.dataset.taskId;
            const status = checkbox.checked ? 'completed' : 'open';
            try {
                await API.tasks.update(taskId, { status });
                await loadAccountTasks(State.currentAccountId);
                await loadAccounts();
            } catch (error) {
                showToast('Failed to update task');
            }
        }

        if (deleteBtn) {
            const taskId = deleteBtn.dataset.taskId;
            if (confirm('Delete this task?')) {
                try {
                    await API.tasks.delete(taskId);
                    await loadAccountTasks(State.currentAccountId);
                    await loadAccounts();
                    showToast('Task deleted');
                } catch (error) {
                    showToast('Failed to delete task');
                }
            }
        }
    });

    // Deal actions (delegated)
    document.getElementById('deals-list').addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-deal');
        const deleteBtn = e.target.closest('.delete-deal');

        if (editBtn) {
            const dealId = editBtn.dataset.dealId;
            try {
                const deals = await API.accounts.getDeals(State.currentAccountId);
                const deal = deals.deals.find(d => d.id == dealId);
                if (deal) {
                    const account = State.accounts.find(a => a.id === State.currentAccountId);
                    document.getElementById('deal-id').value = deal.id;
                    document.getElementById('deal-account-id').value = deal.account_id;
                    document.getElementById('deal-modal-title').textContent = 'Edit Deal';
                    document.getElementById('deal-modal-account').textContent = account ? account.name : '';
                    document.getElementById('deal-name').value = deal.name;
                    document.getElementById('deal-stage').value = deal.stage;
                    document.getElementById('deal-value').value = deal.value || '';
                    document.getElementById('deal-products').value = deal.products || '';
                    document.getElementById('deal-close-date').value = deal.expected_close_date || '';
                    document.getElementById('deal-notes').value = deal.notes || '';
                    Modal.close('detail-modal');
                    Modal.open('deal-modal');
                }
            } catch (error) {
                showToast('Failed to load deal');
            }
        }

        if (deleteBtn) {
            const dealId = deleteBtn.dataset.dealId;
            if (confirm('Delete this deal?')) {
                try {
                    await API.deals.delete(dealId);
                    await loadAccountDeals(State.currentAccountId);
                    await loadAccounts();
                    await loadDashboard();
                    showToast('Deal deleted');
                } catch (error) {
                    showToast('Failed to delete deal');
                }
            }
        }
    });

    // Contact actions (delegated)
    document.getElementById('contacts-list').addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-contact');
        const deleteBtn = e.target.closest('.delete-contact');

        if (editBtn) {
            const contactId = editBtn.dataset.contactId;
            try {
                const contacts = await API.accounts.getContacts(State.currentAccountId);
                const contact = contacts.contacts.find(c => c.id == contactId);
                if (contact) {
                    const account = State.accounts.find(a => a.id === State.currentAccountId);
                    document.getElementById('contact-id').value = contact.id;
                    document.getElementById('contact-account-id').value = contact.account_id;
                    document.getElementById('contact-modal-title').textContent = 'Edit Contact';
                    document.getElementById('contact-modal-account').textContent = account ? account.name : '';
                    document.getElementById('contact-name').value = contact.name;
                    document.getElementById('contact-title').value = contact.title || '';
                    document.getElementById('contact-role').value = contact.role || '';
                    document.getElementById('contact-email').value = contact.email || '';
                    document.getElementById('contact-phone').value = contact.phone || '';
                    document.getElementById('contact-notes').value = contact.notes || '';
                    Modal.close('detail-modal');
                    Modal.open('contact-modal');
                }
            } catch (error) {
                showToast('Failed to load contact');
            }
        }

        if (deleteBtn) {
            const contactId = deleteBtn.dataset.contactId;
            if (confirm('Delete this contact?')) {
                try {
                    await API.contacts.delete(contactId);
                    await loadAccountContacts(State.currentAccountId);
                    await loadAccounts();
                    showToast('Contact deleted');
                } catch (error) {
                    showToast('Failed to delete contact');
                }
            }
        }
    });

    // Sync button
    document.getElementById('sync-btn').addEventListener('click', handleSync);
}

// ============================================================================
// Load Data
// ============================================================================

async function loadAccounts() {
    const loading = document.getElementById('loading');

    loading.classList.remove('hidden');

    try {
        const data = await API.accounts.getAll();
        State.accounts = data.accounts;
        renderAccounts();
        updateProgress();
        await loadDashboard();
    } catch (error) {
        showToast('Failed to load accounts: ' + error.message);
    } finally {
        loading.classList.add('hidden');
    }
}

// ============================================================================
// Initialization
// ============================================================================

async function init() {
    // Set today's date
    document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Set default date for activity form
    document.getElementById('activity-date').value = getTodayStr();

    // Check for daily reset
    checkDailyReset();

    // Setup event listeners
    setupEventListeners();

    // Load accounts and dashboard
    await loadAccounts();

    // Update sync status
    await updateSyncStatus();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
