const courseId = new URLSearchParams(window.location.search).get('id');
const DEFAULT_GATEWAY_URL = `${window.location.protocol}//localhost:8765`;
const GATEWAY_URL = window.localStorage.getItem('gatewayUrl') || window.ITBOOK_GATEWAY_URL || DEFAULT_GATEWAY_URL;

let currentCourse = null;
let isUserEnrolled = false;
let stompClient = null;

function getCurrentUser() {
    return JSON.parse(localStorage.getItem('user') || 'null');
}

function escapeHtml(value) {
    return (value || '').replace(/[&<>"]/g, (char) => {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
        return map[char] || char;
    });
}

function formatTime(timestamp) {
    if (!timestamp) {
        return 'Now';
    }
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return 'Now';
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function setChatLockState(message) {
    const input = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    const messageArea = document.getElementById('messageArea');

    if (input) {
        input.disabled = true;
        input.placeholder = message;
    }
    if (sendButton) {
        sendButton.disabled = true;
    }
    if (messageArea) {
        messageArea.innerHTML = `<p class="student-list-empty">${escapeHtml(message)}</p>`;
    }
}

function enableChatInput() {
    const input = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');

    if (input) {
        input.disabled = false;
        input.placeholder = 'Type your message...';
    }
    if (sendButton) {
        sendButton.disabled = false;
    }
}

function appendMessage(message, currentUserId) {
    const messageArea = document.getElementById('messageArea');
    if (!messageArea) return;

    const senderName = message.sender || `User ${message.userId || ''}`;
    const initials = (senderName.trim().charAt(0) || 'U').toUpperCase();
    const isMine = currentUserId && Number(message.userId) === Number(currentUserId);
    const messageClass = isMine ? 'message sent' : 'message';

    const content = message.content || '';
    const type = message.type || 'CHAT';
    if (type !== 'CHAT' && !content) {
        return;
    }

    const renderedText = type === 'CHAT' ? escapeHtml(content) : `<em>${escapeHtml(content)}</em>`;

    const msg = document.createElement('div');
    msg.className = messageClass;
    msg.innerHTML = `
        <div class="message-avatar">${initials}</div>
        <div class="message-body">
            <div class="message-header">
                <strong>${escapeHtml(senderName)}</strong>
                <span class="message-time">${formatTime(message.timestamp)}</span>
            </div>
            <p class="message-text">${renderedText}</p>
        </div>
    `;

    messageArea.appendChild(msg);
    messageArea.scrollTop = messageArea.scrollHeight;
}

async function loadChatHistory(courseIdValue) {
    const token = localStorage.getItem('token');
    if (!token) {
        setChatLockState('Login and enroll in this course to join chat.');
        return;
    }

    try {
        const response = await fetch(`${GATEWAY_URL}/chat-service/api/chat/courses/${courseIdValue}/messages`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (response.status === 403) {
            setChatLockState('Only enrolled students can access this course chat.');
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to load chat history');
        }

        const messages = await response.json();
        const messageArea = document.getElementById('messageArea');
        if (messageArea) {
            messageArea.innerHTML = '';
        }

        const currentUser = getCurrentUser();
        messages.forEach((message) => appendMessage(message, currentUser?.id));

        if (!messages.length && messageArea) {
            messageArea.innerHTML = '<p class="student-list-empty">No messages yet. Start the conversation.</p>';
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
        setChatLockState('Chat service is unavailable right now.');
    }
}

function connectCourseChat(courseIdValue) {
    const token = localStorage.getItem('token');
    const user = getCurrentUser();

    if (!token || !user?.id || !isUserEnrolled || typeof SockJS === 'undefined' || typeof Stomp === 'undefined') {
        return;
    }

    enableChatInput();

    const socket = new SockJS(`${GATEWAY_URL}/chat-service/ws`);
    stompClient = Stomp.over(socket);
    stompClient.debug = () => {};

    stompClient.connect(
        { Authorization: `Bearer ${token}` },
        () => {
            stompClient.subscribe(`/topic/course/${courseIdValue}`, (payload) => {
                const message = JSON.parse(payload.body);
                const messageArea = document.getElementById('messageArea');
                if (messageArea && messageArea.querySelector('.student-list-empty')) {
                    messageArea.innerHTML = '';
                }
                appendMessage(message, user.id);
            });

            stompClient.send(`/app/chat.join/${courseIdValue}`, { Authorization: `Bearer ${token}` }, JSON.stringify({ type: 'JOIN' }));
        },
        (error) => {
            console.error('Chat connection error:', error);
            setChatLockState('Unable to connect to realtime chat.');
        }
    );
}

function updateEnrollButtonState(enrolled) {
    const enrollButton = document.getElementById('enrollButton');
    const enrollButtonText = document.getElementById('enrollButtonText');
    const enrollButtonIcon = document.getElementById('enrollButtonIcon');
    const enrollNote = document.getElementById('enrollNote');

    if (!enrollButton || !enrollButtonText || !enrollButtonIcon || !enrollNote) {
        return;
    }

    enrollButton.disabled = enrolled;

    if (enrolled) {
        enrollButtonText.textContent = 'Already Enrolled';
        enrollButtonIcon.className = 'fas fa-check';
        enrollNote.textContent = 'You are already enrolled in this course';
    } else {
        enrollButtonText.textContent = 'Enroll Now';
        enrollButtonIcon.className = 'fas fa-plus';
        enrollNote.textContent = 'Join 50,000+ students learning today';
    }
}

function renderStudents(students) {
    const studentsList = document.getElementById('studentsList');
    if (!studentsList) {
        return;
    }

    if (!students.length) {
        studentsList.innerHTML = '<li class="student-list-empty">No students enrolled yet.</li>';
        return;
    }

    studentsList.innerHTML = students.map((student) => {
        const displayName = student.fullName || student.email || `User ${student.id}`;
        const initials = (displayName.trim().charAt(0) || 'U').toUpperCase();
        return `
            <li class="student-item">
                <div class="student-avatar">${initials}</div>
                <div class="student-info">
                    <strong>${displayName}</strong>
                    <span>${student.email || 'No email available'}</span>
                </div>
            </li>
        `;
    }).join('');
}

async function loadEnrolledStudents(courseIdValue) {
    try {
        const response = await fetch(`${GATEWAY_URL}/courses-service/api/courses/${courseIdValue}/students`);
        if (!response.ok) {
            throw new Error('Failed to fetch students');
        }

        const students = await response.json();
        renderStudents(students);
    } catch (error) {
        console.error('Error loading enrolled students:', error);
        renderStudents([]);
    }
}

async function checkEnrollmentStatus(courseIdValue) {
    const token = localStorage.getItem('token');
    const user = getCurrentUser();

    if (!token || !user?.id) {
        isUserEnrolled = false;
        updateEnrollButtonState(false);
        setChatLockState('Login and enroll in this course to join chat.');
        return;
    }

    try {
        const response = await fetch(`${GATEWAY_URL}/courses-service/api/courses/${courseIdValue}/enrolled/${user.id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Failed to check enrollment status');
        }

        isUserEnrolled = await response.json();
        updateEnrollButtonState(isUserEnrolled);

        if (!isUserEnrolled) {
            setChatLockState('Enroll in this course to access the chat room.');
        }
    } catch (error) {
        console.error('Error checking enrollment status:', error);
        isUserEnrolled = false;
        updateEnrollButtonState(false);
        setChatLockState('Chat is unavailable until enrollment is confirmed.');
    }
}

async function loadCourse() {
    if (!courseId) {
        showError();
        return;
    }

    showLoading();

    try {
        const response = await fetch(`${GATEWAY_URL}/courses-service/api/courses/${courseId}`);
        if (!response.ok) throw new Error('Course not found');

        currentCourse = await response.json();
        displayCourse(currentCourse);

        await Promise.all([
            checkEnrollmentStatus(currentCourse.id),
            loadEnrolledStudents(currentCourse.id)
        ]);

        if (isUserEnrolled) {
            await loadChatHistory(currentCourse.id);
            connectCourseChat(currentCourse.id);
        }
    } catch (error) {
        console.error('Error loading course:', error);
        showError();
    }
}

function displayCourse(course) {
    document.getElementById('courseTitle').textContent = course.title;
    document.getElementById('courseDesc').textContent = course.description;
    document.getElementById('courseStudents').textContent = course.students || 0;
    document.getElementById('overviewDesc').textContent = course.description;

    const heroBackground = document.getElementById('heroBackground');
    if (course.image && heroBackground) {
        heroBackground.style.backgroundImage = `url('/img/courses/${course.image}')`;
    }

    if (course.bookUrl) {
        document.getElementById('bookFrame').src = course.bookUrl;
    }
    if (course.slidesUrl) {
        document.getElementById('slidesFrame').src = course.slidesUrl;
    }

    document.getElementById('loadingIndicator').style.display = 'none';
    document.getElementById('courseHeader').style.display = 'block';
    document.getElementById('courseContainer').style.display = 'block';
    document.getElementById('errorMessage').style.display = 'none';
}

function showLoading() {
    document.getElementById('loadingIndicator').style.display = 'flex';
    document.getElementById('courseHeader').style.display = 'none';
    document.getElementById('courseContainer').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
}

function showError() {
    document.getElementById('loadingIndicator').style.display = 'none';
    document.getElementById('courseHeader').style.display = 'none';
    document.getElementById('courseContainer').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'flex';
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');

    const clickedButton = window.event?.target?.closest('.tab-nav-btn');
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
}

async function enrollCourse() {
    if (!currentCourse || isUserEnrolled) {
        return;
    }

    const token = localStorage.getItem('token');
    const user = getCurrentUser();

    if (!token || !user?.id) {
        alert('Please login first');
        window.location.href = '/login.html';
        return;
    }

    try {
        const response = await fetch(`${GATEWAY_URL}/courses-service/api/courses/${currentCourse.id}/enroll/${user.id}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
            alert('Successfully enrolled!');
            isUserEnrolled = true;
            updateEnrollButtonState(true);
            await loadCourse();
        } else {
            const message = await response.text();
            alert(message || 'Failed to enroll');
        }
    } catch (error) {
        console.error('Error enrolling:', error);
        alert('An error occurred');
    }
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input?.value?.trim();

    if (!message || !stompClient || !stompClient.connected || !currentCourse?.id) {
        return;
    }

    const token = localStorage.getItem('token');
    stompClient.send(
        `/app/chat.send/${currentCourse.id}`,
        { Authorization: `Bearer ${token}` },
        JSON.stringify({ content: message, type: 'CHAT' })
    );

    input.value = '';
}

function initializePage() {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    setChatLockState('Loading chat...');
    loadCourse();
}

window.addEventListener('beforeunload', () => {
    if (stompClient && stompClient.connected) {
        stompClient.disconnect();
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}
