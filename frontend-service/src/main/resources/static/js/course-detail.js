const courseId = new URLSearchParams(window.location.search).get('id');
const DEFAULT_GATEWAY_URL = `${window.location.protocol}//localhost:8765`;
const GATEWAY_URL = window.localStorage.getItem('gatewayUrl') || window.ITBOOK_GATEWAY_URL || DEFAULT_GATEWAY_URL;

let currentCourse = null;
let isUserEnrolled = false;

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
        const response = await fetch(`${GATEWAY_URL}/courses-service/api/courses/${courseIdValue}/users`);
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
    const user = JSON.parse(localStorage.getItem('user') || 'null');

    if (!token || !user?.id) {
        isUserEnrolled = false;
        updateEnrollButtonState(false);
        return;
    }

    try {
        const response = await fetch(`${GATEWAY_URL}/courses-service/api/courses/${courseIdValue}/enrolled/${user.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Failed to check enrollment status');
        }

        isUserEnrolled = await response.json();
        updateEnrollButtonState(isUserEnrolled);
    } catch (error) {
        console.error('Error checking enrollment status:', error);
        isUserEnrolled = false;
        updateEnrollButtonState(false);
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
    const user = JSON.parse(localStorage.getItem('user') || 'null');

    if (!token || !user?.id) {
        alert('Please login first');
        window.location.href = '/login.html';
        return;
    }

    try {
        const response = await fetch(`${GATEWAY_URL}/courses-service/api/courses/${currentCourse.id}/enroll/${user.id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
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
    const message = input.value.trim();
    if (message) {
        const messageArea = document.getElementById('messageArea');
        const msg = document.createElement('div');
        msg.className = 'message sent';
        msg.innerHTML = `
            <div class="message-avatar">U</div>
            <div class="message-body">
                <div class="message-header">
                    <strong>You</strong>
                    <span class="message-time">Now</span>
                </div>
                <p class="message-text">${message}</p>
            </div>
        `;
        messageArea.appendChild(msg);
        messageArea.scrollTop = messageArea.scrollHeight;
        input.value = '';
    }
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
    loadCourse();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}
