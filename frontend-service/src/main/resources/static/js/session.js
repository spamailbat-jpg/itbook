const DEFAULT_GATEWAY_URL = `${window.location.protocol}//localhost:8765`;
const GATEWAY_URL = window.localStorage.getItem('gatewayUrl') || window.ITBOOK_GATEWAY_URL || DEFAULT_GATEWAY_URL;

function getToken() {
    return localStorage.getItem('token');
}

function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

async function checkAuth() {
    const token = getToken();
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    try {
        const response = await fetch(`${GATEWAY_URL}/user-service/api/auth/verify`, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });

        if (response.ok) {
            const user = await response.json();
            if (document.getElementById('navUserName')) {
                document.getElementById('navUserName').textContent = user.name;
            }
            if (document.getElementById('userName')) {
                document.getElementById('userName').textContent = user.name;
            }
            if (document.getElementById('userEmail')) {
                document.getElementById('userEmail').textContent = user.email;
            }
            if (document.getElementById('navUserAvatar')) {
                if (user.avatarUrl) {
                    document.getElementById('navUserAvatar').innerHTML = `<img src="${GATEWAY_URL}${user.avatarUrl}" alt="Avatar">`;
                } else {
                    document.getElementById('navUserAvatar').textContent = user.name.charAt(0).toUpperCase();
                }
            }
            if (document.getElementById('avatarDisplay')) {
                if (user.avatarUrl) {
                    document.getElementById('avatarDisplay').innerHTML = `<img src="${GATEWAY_URL}${user.avatarUrl}" alt="Avatar">`;
                }
            }

            // Show page after auth verified
            document.body.style.display = 'block';
        } else {
            localStorage.clear();
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.clear();
        window.location.href = '/login.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const avatarUpload = document.getElementById('avatarUpload');
    if (avatarUpload) {
        avatarUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);

            const token = getToken();
            const response = await fetch(`${GATEWAY_URL}/user-service/api/auth/upload-avatar`, {
                method: 'POST',
                headers: {'Authorization': `Bearer ${token}`},
                body: formData
            });

            const data = await response.json();
            if (response.ok) {
                const fullUrl = `${GATEWAY_URL}${data.avatarUrl}`;
                const avatarDisplay = document.getElementById('avatarDisplay');
                const navAvatar = document.getElementById('navUserAvatar');
                if (avatarDisplay) avatarDisplay.innerHTML = `<img src="${fullUrl}" alt="Avatar">`;
                if (navAvatar) navAvatar.innerHTML = `<img src="${fullUrl}" alt="Avatar">`;
                alert('Avatar updated');
            } else {
                alert('Error: ' + (data.error || 'Upload failed'));
            }
        });
    }

    const currentPage = window.location.pathname.split('/').pop();
    const publicPages = ['login.html', 'signUp.html', 'resetPassword.html', 'index.html', ''];

    if (!publicPages.includes(currentPage)) {
        // Hide page initially
        document.body.style.display = 'none';
        checkAuth();
    }
});

function logout() {
    localStorage.clear();
    window.location.href = '/login.html';
}