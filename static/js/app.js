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
        getActivities: (id) => API.request(`/accounts/${id}/activities`),
        getTasks: (id) => API.request(`/accounts/${id}/tasks`),
        getNotes: (id) => API.request(`/accounts/${id}/notes`),
        snooze: (id) => API.request(`/accounts/${id}/snooze`, { method: 'POST' })
    },

    activities: {
        create: (data) => API.request('/activities', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    },

    tasks: {
        create: (data) => API.request('/tasks', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        update: (id, data) => API.request(`/tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        }),
        delete: (id) => API.request(`/tasks/${id}`, {
            method: 'DELETE'
        })
    },

    notes: {
        create: (data) => API.request('/notes', {
            method: 'POST',
            body: JSON.stringify(data)
        })
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
    filter: 'untouched',  // Default to untouched - daily workflow
    sortBy: 'name',
    currentAccountId: null,
    lastActiveDate: null
};

// ============================================================================
// Utility Functions
// ============================================================================

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

function daysSince(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    const diffTime = today - date;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function getActivityTypeIcon(type) {
    const icons = {
        call: '📞',
        email: '📧',
        meeting: '👥',
        research: '🔍',
        event_invite: '📅',
        internal: '🏢',
        other: '📝'
    };
    return icons[type] || '📝';
}

function getActivityTypeLabel(type) {
    const labels = {
        call: 'Call',
        email: 'Email',
        meeting: 'Meeting',
        research: 'Research',
        event_invite: 'Event Invite',
        internal: 'Internal',
        other: 'Other'
    };
    return labels[type] || type;
}

// ============================================================================
// Toast Notifications
// ============================================================================

function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    toastMessage.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, duration);
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
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
        document.body.style.overflow = '';
    }
};

// ============================================================================
// Account Card Rendering
// ============================================================================

function renderAccountCard(account, index) {
    const days = daysSince(account.last_activity_date);
    let daysText = 'No activities yet';
    let daysColor = 'text-gray-400';
    let urgencyBadge = '';

    if (days !== null) {
        if (days === 0) {
            daysText = 'Today';
            daysColor = 'text-green-600';
        } else if (days === 1) {
            daysText = 'Yesterday';
            daysColor = 'text-green-600';
        } else if (days <= 3) {
            daysText = `${days} days ago`;
            daysColor = 'text-green-600';
        } else if (days <= 7) {
            daysText = `${days} days ago`;
            daysColor = 'text-yellow-600';
        } else {
            daysText = `${days} days ago`;
            daysColor = 'text-red-500';
            urgencyBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">Overdue</span>`;
        }
    }

    const touchedClass = account.touched_today ? 'touched' : '';
    const statusIcon = account.touched_today
        ? '<div class="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center"><svg class="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg></div>'
        : '<div class="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center"><svg class="w-6 h-6 text-amber-500 animate-pulse-soft" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path></svg></div>';

    return `
        <div class="account-card card-entering ${touchedClass} cursor-pointer"
             data-account-id="${account.id}"
             style="animation-delay: ${index * 0.05}s">
            <div class="p-6">
                <!-- Top row: name + status icon -->
                <div class="flex justify-between items-start mb-4">
                    <div class="flex-1 min-w-0 pr-3">
                        <h3 class="font-bold text-lg text-gray-900 leading-tight mb-1">${account.name}</h3>
                        <p class="text-sm text-gray-400">${account.industry}</p>
                    </div>
                    ${statusIcon}
                </div>

                <!-- Stats row -->
                <div class="flex items-center gap-3 mb-5">
                    <div class="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-center">
                        <div class="text-xs text-gray-400 mb-0.5">Last Touch</div>
                        <div class="text-sm font-semibold ${daysColor}">${daysText}</div>
                    </div>
                    <div class="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-center">
                        <div class="text-xs text-gray-400 mb-0.5">Open Tasks</div>
                        <div class="text-sm font-semibold ${account.open_tasks > 0 ? 'text-amber-600' : 'text-gray-700'}">${account.open_tasks}</div>
                    </div>
                </div>

                ${urgencyBadge ? `<div class="mb-4">${urgencyBadge}</div>` : ''}

                ${account.last_activity_description ? `
                    <p class="text-sm text-gray-500 truncate mb-5 italic">"${account.last_activity_description}"</p>
                ` : ''}

                <!-- Action buttons -->
                <div class="flex gap-2">
                    <button class="btn-log-activity flex-1 btn-primary px-4 py-2.5 rounded-xl text-sm font-semibold"
                            data-account-id="${account.id}" data-account-name="${account.name}">
                        Log Activity
                    </button>
                    <button class="btn-add-task btn-secondary px-3 py-2.5 rounded-xl text-sm font-semibold"
                            data-account-id="${account.id}" data-account-name="${account.name}">
                        Task
                    </button>
                    <button class="btn-view-details btn-secondary px-3 py-2.5 rounded-xl text-sm font-semibold"
                            data-account-id="${account.id}">
                        View
                    </button>
                    ${!account.touched_today ? `
                    <button class="btn-snooze btn-secondary px-3 py-2.5 rounded-xl text-sm font-semibold"
                            data-account-id="${account.id}" title="Skip for today">
                        💤
                    </button>
                    ` : ''}
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
    }

    // Show "all done" if filtering untouched and none left
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
    document.getElementById('detail-account-industry').textContent = account.industry;
    document.getElementById('detail-account-location').textContent = account.location;

    // Reset tabs
    document.querySelectorAll('.detail-tab').forEach(tab => {
        tab.classList.remove('active', 'border-blue-600', 'text-blue-600');
        tab.classList.add('border-transparent', 'text-gray-500');
    });
    document.querySelector('.detail-tab[data-tab="activities"]').classList.add('active', 'border-blue-600', 'text-blue-600');

    document.querySelectorAll('.detail-tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById('detail-activities').classList.remove('hidden');

    Modal.open('detail-modal');

    // Load activities
    await loadAccountActivities(accountId);
}

async function loadAccountActivities(accountId) {
    const list = document.getElementById('activities-list');
    const noActivities = document.getElementById('no-activities');

    try {
        const data = await API.accounts.getActivities(accountId);

        if (data.activities.length === 0) {
            list.innerHTML = '';
            noActivities.classList.remove('hidden');
        } else {
            noActivities.classList.add('hidden');
            list.innerHTML = data.activities.map(activity => `
                <div class="bg-gray-50 rounded-xl p-4">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-lg">${getActivityTypeIcon(activity.activity_type)}</span>
                        <span class="font-medium">${getActivityTypeLabel(activity.activity_type)}</span>
                        <span class="text-gray-400 text-sm">${formatDate(activity.activity_date)}</span>
                    </div>
                    <p class="text-gray-600 text-sm">${activity.description}</p>
                </div>
            `).join('');
        }
    } catch (error) {
        list.innerHTML = '<p class="text-red-500">Failed to load activities</p>';
    }
}

async function loadAccountTasks(accountId) {
    const list = document.getElementById('tasks-list');
    const noTasks = document.getElementById('no-tasks');

    try {
        const data = await API.accounts.getTasks(accountId);

        if (data.tasks.length === 0) {
            list.innerHTML = '';
            noTasks.classList.remove('hidden');
        } else {
            noTasks.classList.add('hidden');
            list.innerHTML = data.tasks.map(task => `
                <div class="bg-gray-50 rounded-xl p-4 flex items-start gap-3">
                    <input type="checkbox" class="task-checkbox mt-1 w-4 h-4 text-blue-600 rounded"
                           data-task-id="${task.id}" ${task.status === 'completed' ? 'checked' : ''}>
                    <div class="flex-1">
                        <p class="font-medium ${task.status === 'completed' ? 'line-through text-gray-400' : ''}">${task.title}</p>
                        ${task.description ? `<p class="text-gray-500 text-sm">${task.description}</p>` : ''}
                        ${task.due_date ? `<p class="text-sm text-gray-400 mt-1">Due: ${formatDate(task.due_date)}</p>` : ''}
                    </div>
                    <button class="delete-task text-gray-400 hover:text-red-500" data-task-id="${task.id}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            `).join('');
        }
    } catch (error) {
        list.innerHTML = '<p class="text-red-500">Failed to load tasks</p>';
    }
}

async function loadAccountNotes(accountId) {
    const list = document.getElementById('notes-list');
    const noNotes = document.getElementById('no-notes');

    try {
        const data = await API.accounts.getNotes(accountId);

        if (data.notes.length === 0) {
            list.innerHTML = '';
            noNotes.classList.remove('hidden');
        } else {
            noNotes.classList.add('hidden');
            list.innerHTML = data.notes.map(note => `
                <div class="bg-gray-50 rounded-xl p-4">
                    <p class="text-gray-400 text-xs mb-1">${formatDate(note.note_date)}</p>
                    <p class="text-gray-700">${note.content}</p>
                </div>
            `).join('');
        }
    } catch (error) {
        list.innerHTML = '<p class="text-red-500">Failed to load notes</p>';
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

        // Animate the card out if we're on the untouched filter
        if (State.filter === 'untouched') {
            const card = document.querySelector(`.account-card[data-account-id="${accountId}"]`);
            if (card) {
                card.classList.add('card-completing');
                // Wait for animation then reload
                setTimeout(async () => {
                    await loadAccounts();
                    showToast('Activity logged! ✓');
                }, 600);
                return;
            }
        }

        showToast('Activity logged! ✓');
        await loadAccounts();
    } catch (error) {
        showToast('Failed to log activity: ' + error.message);
    }
}

async function handleTaskSubmit(e) {
    e.preventDefault();

    const accountId = document.getElementById('task-account-id').value;
    const title = document.getElementById('task-title').value;
    const description = document.getElementById('task-description').value;
    const dueDate = document.getElementById('task-due-date').value || null;

    try {
        await API.tasks.create({
            account_id: parseInt(accountId),
            title: title,
            description: description || null,
            due_date: dueDate
        });

        Modal.close('task-modal');
        e.target.reset();
        showToast('Task added ✓');
        await loadAccounts();
    } catch (error) {
        showToast('Failed to add task: ' + error.message);
    }
}

async function handleNoteSubmit(e) {
    e.preventDefault();

    const accountId = document.getElementById('note-account-id').value;
    const content = document.getElementById('note-content').value;

    try {
        await API.notes.create({
            account_id: parseInt(accountId),
            content: content
        });

        Modal.close('note-modal');
        e.target.reset();
        showToast('Note added ✓');
        await loadAccounts();
    } catch (error) {
        showToast('Failed to add note: ' + error.message);
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
            <span id="unsynced-badge" class="hidden bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">0</span>
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
        // Show new day notification
        const notification = document.getElementById('new-day-notification');
        notification.classList.remove('hidden');
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 4000);
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

    // Card actions (delegated)
    document.getElementById('accounts-grid').addEventListener('click', async (e) => {
        const logActivityBtn = e.target.closest('.btn-log-activity');
        const addTaskBtn = e.target.closest('.btn-add-task');
        const viewDetailsBtn = e.target.closest('.btn-view-details');
        const snoozeBtn = e.target.closest('.btn-snooze');
        const card = e.target.closest('.account-card');

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
                        showToast('Account snoozed for today 💤');
                    }, 600);
                } else {
                    await loadAccounts();
                    showToast('Account snoozed for today 💤');
                }
            } catch (error) {
                showToast('Failed to snooze: ' + error.message);
            }
            return;
        }

        if (logActivityBtn) {
            e.stopPropagation();
            const accountId = logActivityBtn.dataset.accountId;
            const accountName = logActivityBtn.dataset.accountName;
            document.getElementById('activity-account-id').value = accountId;
            document.getElementById('activity-modal-account').textContent = accountName;
            document.getElementById('activity-date').value = getTodayStr();
            Modal.open('activity-modal');
        } else if (addTaskBtn) {
            e.stopPropagation();
            const accountId = addTaskBtn.dataset.accountId;
            const accountName = addTaskBtn.dataset.accountName;
            document.getElementById('task-account-id').value = accountId;
            document.getElementById('task-modal-account').textContent = accountName;
            Modal.open('task-modal');
        } else if (viewDetailsBtn) {
            e.stopPropagation();
            openAccountDetail(parseInt(viewDetailsBtn.dataset.accountId));
        } else if (card) {
            openAccountDetail(parseInt(card.dataset.accountId));
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

    // Escape key to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            Modal.closeAll();
        }
    });

    // Form submissions
    document.getElementById('activity-form').addEventListener('submit', handleActivitySubmit);
    document.getElementById('task-form').addEventListener('submit', handleTaskSubmit);
    document.getElementById('note-form').addEventListener('submit', handleNoteSubmit);

    // Detail modal tabs
    document.querySelectorAll('.detail-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            document.querySelectorAll('.detail-tab').forEach(t => {
                t.classList.remove('active', 'border-blue-600', 'text-blue-600');
                t.classList.add('border-transparent', 'text-gray-500');
            });
            tab.classList.add('active', 'border-blue-600', 'text-blue-600');
            tab.classList.remove('border-transparent', 'text-gray-500');

            document.querySelectorAll('.detail-tab-content').forEach(content => {
                content.classList.add('hidden');
            });

            const tabName = tab.dataset.tab;
            document.getElementById(`detail-${tabName}`).classList.remove('hidden');

            if (tabName === 'activities') {
                await loadAccountActivities(State.currentAccountId);
            } else if (tabName === 'tasks') {
                await loadAccountTasks(State.currentAccountId);
            } else if (tabName === 'notes') {
                await loadAccountNotes(State.currentAccountId);
            }
        });
    });

    // Detail modal action buttons
    document.querySelectorAll('.detail-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const account = State.accounts.find(a => a.id === State.currentAccountId);

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
            }
        });
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
            if (confirm('Are you sure you want to delete this task?')) {
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

    // Sync button
    document.getElementById('sync-btn').addEventListener('click', handleSync);
}

// ============================================================================
// Load Data
// ============================================================================

async function loadAccounts() {
    const loading = document.getElementById('loading');
    const grid = document.getElementById('accounts-grid');

    loading.classList.remove('hidden');

    try {
        const data = await API.accounts.getAll();
        State.accounts = data.accounts;
        renderAccounts();
        updateProgress();
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

    // Load accounts
    await loadAccounts();

    // Update sync status
    await updateSyncStatus();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
