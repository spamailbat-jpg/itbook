'use strict';

const GATEWAY_URL = window.localStorage.getItem('gatewayUrl') || `${window.location.protocol}//localhost:8765`;
const courseId = new URLSearchParams(window.location.search).get('courseId');

const usernamePage = document.querySelector('#username-page');
const chatPage     = document.querySelector('#chat-page');
const messageForm  = document.querySelector('#messageForm');
const messageInput = document.querySelector('#message');
const messageArea  = document.querySelector('#messageArea');
const headerStatus = document.querySelector('#header-status');
const logoutBtn    = document.querySelector('#logout-btn');

let stompClient = null;
let currentUser = null; // { id, name, avatarUrl }

const colors = ['#667eea','#764ba2','#f093fb','#4facfe','#43e97b','#fa709a','#30cfd0','#a8edea'];
const reactionEmojis = ['👍','❤️','😂','😮','😢','🔥'];

function getAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = 31 * hash + name.charCodeAt(i);
    return colors[Math.abs(hash % colors.length)];
}

function getToken() {
    return localStorage.getItem('token');
}

// ─── Auth & Connect ───────────────────────────────────────────────────────────

async function init() {
    if (!courseId) {
        alert('No course selected');
        window.location.href = '/courses.html';
        return;
    }

    const token = getToken();
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Verify token and get user info from user-service via gateway
    try {
        const res = await fetch(`${GATEWAY_URL}/user-service/api/auth/verify`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) {
            localStorage.clear();
            window.location.href = '/login.html';
            return;
        }
        const data = await res.json();
        currentUser = { id: data.userId, name: data.name, avatarUrl: data.avatarUrl };
        // Fetch course title for header
        try {
            const res = await fetch(`${GATEWAY_URL}/courses-service/api/courses/${courseId}`);
            if (res.ok) {
                const course = await res.json();
                const titleEl = document.getElementById('courseTitle');
                if (titleEl) titleEl.textContent = course.title + ' — Chat';
                document.title = course.title + ' Chat | ITBook';
            }
        } catch (_) {}
    } catch (e) {
        console.error('Auth failed', e);
        window.location.href = '/login.html';
        return;
    }

    // Load chat history before connecting WebSocket
    await loadHistory();

    // Connect WebSocket
    connect();
}

async function loadHistory() {
    try {
        const res = await fetch(`${GATEWAY_URL}/chat-service/api/chat/course/${courseId}/history`, {
            headers: { 'Authorization': 'Bearer ' + getToken() }
        });
        if (res.ok) {
            const messages = await res.json();
            messages.forEach(renderMessage);
            messageArea.scrollTop = messageArea.scrollHeight;
        }
    } catch (e) {
        console.error('Failed to load history', e);
    }
}

function connect() {
    const socket = new SockJS(`${GATEWAY_URL}/chat-service/ws`);
    stompClient = Stomp.over(socket);
    stompClient.connect({}, onConnected, onError);
}

function onConnected() {
    // Subscribe to this course's topic
    stompClient.subscribe('/topic/course/' + courseId, onMessageReceived);

    // Subscribe to personal error queue
    stompClient.subscribe('/user/queue/errors', (msg) => {
        console.error('Server error:', msg.body);
        alert(msg.body);
    });

    // Send JOIN - JWT is sent as content for server-side auth
    stompClient.send('/app/chat.addUser', {}, JSON.stringify({
        courseId: parseInt(courseId),
        content:  getToken(),   // server verifies this JWT
        type:    'JOIN'
    }));

    if (usernamePage) usernamePage.classList.add('hidden');
    if (chatPage)     chatPage.classList.remove('hidden');
    headerStatus.textContent = 'Active now';
}

function onError() {
    headerStatus.textContent = 'Connection failed';
    headerStatus.style.color = '#e74c3c';
}

// ─── Send Message ─────────────────────────────────────────────────────────────

function sendMessage(event) {
    event.preventDefault();
    const content = messageInput.value.trim();
    if (!content || !stompClient) return;

    stompClient.send('/app/chat.sendMessage', {}, JSON.stringify({
        courseId: parseInt(courseId),
        content,
        type: 'MESSAGE'
    }));

    messageInput.value = '';
    messageInput.style.height = 'auto';
}

// ─── Receive Message ──────────────────────────────────────────────────────────

function onMessageReceived(payload) {
    const message = JSON.parse(payload.body);
    if (message.type !== 'MESSAGE') return; // ← ignore JOIN/LEAVE

    const existing = document.querySelector(`[data-message-id="${message.id}"]`);
    if (existing) {
        existing.replaceWith(buildMessageElement(message));
        return;
    }
    renderMessage(message);
    messageArea.scrollTop = messageArea.scrollHeight;
}

function renderMessage(message) {
    if (message.type !== 'MESSAGE') return; // ← ignore JOIN/LEAVE from history
    const el = buildMessageElement(message);
    messageArea.appendChild(el);
}

function buildMessageElement(message) {
    const el = document.createElement('div');

    if (message.type === 'JOIN' || message.type === 'LEAVE') return el;

    const isMine = message.sender === currentUser?.name;
    el.classList.add('message-group', isMine ? 'sent' : 'received');
    el.setAttribute('data-message-id', message.id);

    const avatarColor   = getAvatarColor(message.sender);
    const senderInitial = message.sender?.[0]?.toUpperCase() ?? '?';
    const avatarHtml    = message.avatarUrl
        ? `<div class="avatar"><img src="${GATEWAY_URL}${message.avatarUrl}" alt="avatar"></div>`
        : `<div class="avatar" style="background-color:${avatarColor}">${senderInitial}</div>`;

    const deletedClass = message.isDeleted ? ' deleted' : '';
    const editedLabel  = message.editedAt  ? '<span class="edited-label">(edited)</span>' : '';

    // Reactions — outside message-content to avoid triggering message hover
    let reactionsHtml = '';
    if (message.reactions && message.reactions !== '{}') {
        try {
            const reactions = JSON.parse(message.reactions);
            if (Object.keys(reactions).length > 0) {
                reactionsHtml = '<div class="reactions-container">'
                    + Object.entries(reactions)
                        .map(([emoji, users]) => {
                            const names = Array.isArray(users) ? users.join(', ') : String(users);
                            const count = Array.isArray(users) ? users.length : users;
                            return `
                                <span class="reaction" data-emoji="${emoji}" onclick="toggleReactionUsers(this)">
                                    ${emoji} ${count}
                                </span>
                                <span class="reaction-names" style="display:none">${escapeHtml(names)}</span>
                            `;
                        })
                        .join('')
                    + '</div>';
            }
        } catch (_) {}
    }

    const actionButtons = isMine
        ? `<div class="message-actions">
                <button class="action-btn edit-btn"     data-id="${message.id}" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete-btn"   data-id="${message.id}" title="Delete"><i class="fas fa-trash"></i></button>
                <button class="action-btn reaction-btn" data-id="${message.id}" title="React"><i class="fas fa-smile"></i></button>
           </div>`
        : `<button class="action-btn reaction-btn" data-id="${message.id}" title="React"><i class="fas fa-smile"></i></button>`;

    // reactionsHtml is OUTSIDE .message-content so hovering it won't trigger message actions
    el.innerHTML = `
        ${!isMine ? avatarHtml : ''}
        <div class="message-content">
            ${!isMine ? `<div class="message-sender">${escapeHtml(message.sender)}</div>` : ''}
            <div class="message-wrapper">
                <div class="message-text${deletedClass}">${escapeHtml(message.content)} ${editedLabel}</div>
                ${actionButtons}
            </div>
            ${reactionsHtml}
        </div>
    `;

    el.querySelector('.edit-btn')?.addEventListener('click', () => openEditModal(message));
    el.querySelector('.delete-btn')?.addEventListener('click', () => deleteMessage(message.id));
    el.querySelector('.reaction-btn')?.addEventListener('click', (e) => showReactionPicker(e, message.id));

    return el;
}

function toggleReactionUsers(el) {
    const names = el.nextElementSibling;
    // close all others first
    document.querySelectorAll('.reaction-names').forEach(n => {
        if (n !== names) n.style.display = 'none';
    });
    names.style.display = names.style.display === 'none' ? 'inline' : 'none';
}

// close on outside click
document.addEventListener('click', (e) => {
    if (!e.target.closest('.reaction')) {
        document.querySelectorAll('.reaction-names').forEach(n => n.style.display = 'none');
    }
});

// ─── Actions ──────────────────────────────────────────────────────────────────

function openEditModal(message) {
    const newContent = prompt('Edit message:', message.content);
    if (newContent?.trim()) {
        stompClient.send('/app/chat.editMessage', {}, JSON.stringify({
            id:      message.id,
            content: newContent.trim(),
            type:    'MESSAGE'
        }));
    }
}

function deleteMessage(id) {
    if (confirm('Delete this message?')) {
        stompClient.send('/app/chat.deleteMessage', {}, JSON.stringify({ id, type: 'MESSAGE' }));
    }
}

function showReactionPicker(event, messageId) {
    event.stopPropagation();
    document.querySelector('.reaction-picker')?.remove();

    const picker = document.createElement('div');
    picker.className = 'reaction-picker';
    picker.innerHTML = reactionEmojis.map(e => `<span class="reaction-emoji" data-emoji="${e}">${e}</span>`).join('');

    event.target.closest('.reaction-btn').parentElement.appendChild(picker);

    picker.querySelectorAll('.reaction-emoji').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            addReaction(messageId, el.dataset.emoji);
            picker.remove();
        });
    });

    setTimeout(() => {
        document.addEventListener('click', function close(e) {
            if (!e.target.closest('.reaction-picker') && !e.target.closest('.reaction-btn')) {
                picker.remove();
                document.removeEventListener('click', close);
            }
        });
    }, 0);
}

function addReaction(messageId, emoji) {
    stompClient.send('/app/chat.addReaction', {}, JSON.stringify({
        id: messageId,
        originalContent: emoji,
        type: 'MESSAGE'
    }));
}

function logout() {
    if (stompClient?.connected) {
        stompClient.send('/app/chat.addUser', {}, JSON.stringify({
            courseId: parseInt(courseId),
            sender: currentUser?.name,
            type: 'LEAVE'
        }));
        stompClient.disconnect(() => {
            localStorage.clear();
            window.location.href = '/login.html';
        });
    } else {
        localStorage.clear();
        window.location.href = '/login.html';
    }
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

messageInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
});

messageInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        messageForm.dispatchEvent(new Event('submit'));
    }
});

messageForm.addEventListener('submit', sendMessage);
logoutBtn?.addEventListener('click', logout);

// Start
init();