'use strict';

const usernamePage = document.querySelector('#username-page');
const chatPage = document.querySelector('#chat-page');
const usernameForm = document.querySelector('#usernameForm');
const messageForm = document.querySelector('#messageForm');
const messageInput = document.querySelector('#message');
const messageArea = document.querySelector('#messageArea');
const headerStatus = document.querySelector('#header-status');
const logoutBtn = document.querySelector('#logout-btn');

let stompClient = null;
let username = null;
let selectedMessageId = null;

const colors = [
    '#667eea', '#764ba2', '#f093fb', '#4facfe',
    '#43e97b', '#fa709a', '#30cfd0', '#a8edea'
];

const reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

function getAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = 31 * hash + name.charCodeAt(i);
    }
    return colors[Math.abs(hash % colors.length)];
}

function connect(event) {
    username = document.querySelector('#name').value.trim();

    if (username) {
        usernamePage.classList.add('hidden');
        chatPage.classList.remove('hidden');

        const socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);
        stompClient.connect({}, onConnected, onError);
    }
    event.preventDefault();
}

function onConnected() {
    stompClient.subscribe('/topic/public', onMessageReceived);
    stompClient.send('/app/chat.addUser', {},
        JSON.stringify({ sender: username, type: 'JOIN' })
    );
    headerStatus.textContent = 'Active now';
}

function onError(error) {
    headerStatus.textContent = 'Connection failed';
    headerStatus.style.color = '#e74c3c';
}

function sendMessage(event) {
    const messageContent = messageInput.value.trim();
    if (messageContent && stompClient) {
        const chatMessage = {
            sender: username,
            content: messageContent,
            type: 'MESSAGE'
        };
        stompClient.send('/app/chat.sendMessage', {}, JSON.stringify(chatMessage));
        messageInput.value = '';
        messageInput.style.height = 'auto';
    }
    event.preventDefault();
}

function onMessageReceived(payload) {
    const message = JSON.parse(payload.body);

    // Check if message already exists (to avoid duplicates on edit/delete)
    const existingElement = document.querySelector(`[data-message-id="${message.id}"]`);
    if (existingElement && message.type === 'MESSAGE') {
        // Update existing message
        updateMessageElement(existingElement, message);
        return;
    }

    const messageElement = document.createElement('div');

    if (message.type === 'JOIN') {
        messageElement.classList.add('event-message');
        messageElement.innerHTML = `<p>👋 <strong>${message.sender}</strong> joined the chat</p>`;
    } else if (message.type === 'LEAVE') {
        messageElement.classList.add('event-message');
        messageElement.innerHTML = `<p>👋 <strong>${message.sender}</strong> left the chat</p>`;
    } else {
        messageElement.classList.add('message-group');
        messageElement.classList.add(message.sender === username ? 'sent' : 'received');
        messageElement.setAttribute('data-message-id', message.id);

        renderMessageContent(messageElement, message);
    }

    messageArea.appendChild(messageElement);
    messageArea.scrollTop = messageArea.scrollHeight;
}

function updateMessageElement(element, message) {
    // Clear existing content but keep the class
    const messageContent = element.querySelector('.message-content');
    if (!messageContent) return;

    messageContent.innerHTML = '';

    if (message.sender !== username) {
        messageContent.innerHTML += `<div class="message-sender">${message.sender}</div>`;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper';

    let reactionsHtml = '';
    if (message.reactions && message.reactions !== '{}') {
        try {
            const reactions = JSON.parse(message.reactions);
            if (Object.keys(reactions).length > 0) {
                reactionsHtml = '<div class="reactions-container">';
                for (const [emoji, count] of Object.entries(reactions)) {
                    reactionsHtml += `<span class="reaction" data-emoji="${emoji}">${emoji} ${count}</span>`;
                }
                reactionsHtml += '</div>';
            }
        } catch (e) {
            // reactions parsing failed
        }
    }

    const editedLabel = message.editedAt ? '<span class="edited-label">(edited)</span>' : '';
    const deletedClass = message.isDeleted ? ' deleted' : '';

    const messageActions = message.sender === username ? `
        <div class="message-actions">
            <button class="action-btn edit-btn" data-id="${message.id}" title="Edit">
                <i class="fas fa-edit"></i>
            </button>
            <button class="action-btn delete-btn" data-id="${message.id}" title="Delete">
                <i class="fas fa-trash"></i>
            </button>
            <button class="action-btn reaction-btn" data-id="${message.id}" title="React">
                <i class="fas fa-smile"></i>
            </button>
        </div>
    ` : `
        <button class="action-btn reaction-btn" data-id="${message.id}" title="React">
            <i class="fas fa-smile"></i>
        </button>
    `;

    wrapper.innerHTML = `
        <div class="message-text${deletedClass}">${escapeHtml(message.content)} ${editedLabel}</div>
        ${messageActions}
    `;

    if (reactionsHtml) {
        wrapper.innerHTML += reactionsHtml;
    }

    messageContent.appendChild(wrapper);

    // Add event listeners for actions
    const editBtn = messageContent.querySelector('.edit-btn');
    const deleteBtn = messageContent.querySelector('.delete-btn');
    const reactionBtn = messageContent.querySelector('.reaction-btn');

    if (editBtn) editBtn.addEventListener('click', () => openEditModal(message));
    if (deleteBtn) deleteBtn.addEventListener('click', () => deleteMessage(message.id));
    if (reactionBtn) reactionBtn.addEventListener('click', (e) => showReactionPicker(e, message.id));
}

function renderMessageContent(messageElement, message) {
    const avatarColor = getAvatarColor(message.sender);
    const senderInitial = message.sender[0].toUpperCase();

    let reactionsHtml = '';
    if (message.reactions && message.reactions !== '{}') {
        try {
            const reactions = JSON.parse(message.reactions);
            if (Object.keys(reactions).length > 0) {
                reactionsHtml = '<div class="reactions-container">';
                for (const [emoji, count] of Object.entries(reactions)) {
                    reactionsHtml += `<span class="reaction" data-emoji="${emoji}">${emoji} ${count}</span>`;
                }
                reactionsHtml += '</div>';
            }
        } catch (e) {
            // reactions parsing failed
        }
    }

    const editedLabel = message.editedAt ? '<span class="edited-label">(edited)</span>' : '';
    const deletedClass = message.isDeleted ? ' deleted' : '';

    const messageActions = message.sender === username ? `
        <div class="message-actions">
            <button class="action-btn edit-btn" data-id="${message.id}" title="Edit">
                <i class="fas fa-edit"></i>
            </button>
            <button class="action-btn delete-btn" data-id="${message.id}" title="Delete">
                <i class="fas fa-trash"></i>
            </button>
            <button class="action-btn reaction-btn" data-id="${message.id}" title="React">
                <i class="fas fa-smile"></i>
            </button>
        </div>
    ` : `
        <button class="action-btn reaction-btn" data-id="${message.id}" title="React">
            <i class="fas fa-smile"></i>
        </button>
    `;

    messageElement.innerHTML = `
        ${message.sender !== username ? `<div class="avatar" style="background-color: ${avatarColor}">${senderInitial}</div>` : ''}
        <div class="message-content">
            ${message.sender !== username ? `<div class="message-sender">${message.sender}</div>` : ''}
            <div class="message-wrapper">
                <div class="message-text${deletedClass}">${escapeHtml(message.content)} ${editedLabel}</div>
                ${messageActions}
            </div>
            ${reactionsHtml}
        </div>
    `;

    // Add event listeners for actions
    const editBtn = messageElement.querySelector('.edit-btn');
    const deleteBtn = messageElement.querySelector('.delete-btn');
    const reactionBtn = messageElement.querySelector('.reaction-btn');

    if (editBtn) editBtn.addEventListener('click', () => openEditModal(message));
    if (deleteBtn) deleteBtn.addEventListener('click', () => deleteMessage(message.id));
    if (reactionBtn) reactionBtn.addEventListener('click', (e) => showReactionPicker(e, message.id));
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function logout() {
    if (stompClient && stompClient.connected) {
        stompClient.send('/app/chat.addUser', {},
            JSON.stringify({ sender: username, type: 'LEAVE' })
        );
        stompClient.disconnect(() => {
            username = null;
            usernamePage.classList.remove('hidden');
            chatPage.classList.add('hidden');
            messageArea.innerHTML = '';
            messageInput.value = '';
        });
    }
}

// Auto-expand textarea as user types
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
});

// Send message on Enter (Shift+Enter for new line)
messageInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        messageForm.dispatchEvent(new Event('submit'));
    }
});

// Delete message
function deleteMessage(messageId) {
    if (confirm('Are you sure you want to delete this message?')) {
        const chatMessage = {
            id: messageId,
            type: 'MESSAGE'
        };
        stompClient.send('/app/chat.deleteMessage', {}, JSON.stringify(chatMessage));
    }
}

// Open edit modal
function openEditModal(message) {
    const newContent = prompt('Edit message:', message.content);
    if (newContent && newContent.trim() !== '') {
        const editedMessage = {
            id: message.id,
            content: newContent.trim(),
            type: 'MESSAGE'
        };
        stompClient.send('/app/chat.editMessage', {}, JSON.stringify(editedMessage));
    }
}

// Show reaction picker
function showReactionPicker(event, messageId) {
    event.stopPropagation();

    // Remove existing picker
    const existingPicker = document.querySelector('.reaction-picker');
    if (existingPicker) {
        existingPicker.remove();
        return;
    }

    const picker = document.createElement('div');
    picker.className = 'reaction-picker';
    picker.innerHTML = reactionEmojis.map(emoji =>
        `<span class="reaction-emoji" data-emoji="${emoji}">${emoji}</span>`
    ).join('');

    const btn = event.target.closest('.reaction-btn');
    btn.parentElement.appendChild(picker);

    picker.querySelectorAll('.reaction-emoji').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            addReaction(messageId, el.dataset.emoji);
            picker.remove();
        });
    });

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', function closePickerOnClick(e) {
            if (!e.target.closest('.reaction-picker') && !e.target.closest('.reaction-btn')) {
                picker.remove();
                document.removeEventListener('click', closePickerOnClick);
            }
        });
    }, 0);
}

// Add reaction
function addReaction(messageId, emoji) {
    const chatMessage = {
        id: messageId,
        originalContent: emoji,
        type: 'MESSAGE'
    };
    stompClient.send('/app/chat.addReaction', {}, JSON.stringify(chatMessage));
}

// Event listeners
usernameForm.addEventListener('submit', connect);
messageForm.addEventListener('submit', sendMessage);
logoutBtn.addEventListener('click', logout);