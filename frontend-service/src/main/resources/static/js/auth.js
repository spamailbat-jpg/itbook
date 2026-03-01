(() => {
  const GATEWAY_URL = localStorage.getItem('gatewayUrl') || `${window.location.protocol}//localhost:8765`;

  const togglePassword = (toggleId, inputId) => {
    const toggle = document.getElementById(toggleId);
    const input = document.getElementById(inputId);
    if (!toggle || !input) return;
    toggle.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
      toggle.classList.toggle('fa-eye-slash');
    });
  };

  const setRuleState = (el, valid) => {
    const icon = el.querySelector('i');
    if (!icon) return;
    icon.className = valid ? 'fas fa-check-circle' : 'fas fa-times-circle';
    el.style.color = valid ? '#7dffb8' : '#ff8895';
  };

  function bindSignup() {
    togglePassword('togglePassword', 'password');
    togglePassword('toggleConfirmPassword', 'confirmPassword');

    const passwordEl = document.getElementById('password');
    const form = document.querySelector('.formSignup');
    if (!passwordEl || !form) return;

    const validatePassword = (password) => {
      const checks = {
        'req-length': password.length >= 8,
        'req-case': /[a-z]/.test(password) && /[A-Z]/.test(password),
        'req-symbols': /\d/.test(password) && /[^A-Za-z0-9]/.test(password)
      };
      Object.entries(checks).forEach(([id, valid]) => {
        const node = document.getElementById(id);
        if (node) setRuleState(node, valid);
      });
      return Object.values(checks).every(Boolean);
    };

    passwordEl.addEventListener('input', e => validatePassword(e.target.value));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const password = formData.get('password') || '';
      const confirmPassword = formData.get('confirmPassword') || '';

      if (!validatePassword(password)) return alert('Password does not meet requirements.');
      if (password !== confirmPassword) return alert("Passwords don't match");

      try {
        const res = await fetch(`${GATEWAY_URL}/user-service/api/auth/signup`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.get('email'), fullName: formData.get('fullName'), password, confirmPassword
          })
        });
        const data = await res.json();
        if (res.ok) {
          alert('Account created! Please login.');
          window.location.href = '/login.html';
        } else {
          alert(data.message || 'Signup failed');
        }
      } catch (err) {
        console.error(err);
        alert('Connection error. Please try again.');
      }
    });
  }

  function bindResetPassword() {
    togglePassword('toggleNewPassword', 'newPassword');
    togglePassword('toggleConfirmNewPassword', 'confirmNewPassword');

    const form = document.getElementById('resetPasswordForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const newPassword = formData.get('newPassword') || '';
      const confirmNewPassword = formData.get('confirmNewPassword') || '';
      if (newPassword !== confirmNewPassword) return alert("Passwords don't match");

      try {
        const response = await fetch(`${GATEWAY_URL}/user-service/api/auth/resetPassword`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: formData.get('email'), newPassword, confirmNewPassword })
        });
        const data = await response.json();
        if (response.ok) {
          alert('Password updated successfully');
          window.location.href = '/login.html';
        } else {
          alert(data.message || 'Reset failed');
        }
      } catch (error) {
        console.error(error);
        alert('Connection error. Please try again.');
      }
    });
  }

  function bindLogin() {
    togglePassword('togglePassword', 'password');
    const form = document.querySelector('form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      try {
        const response = await fetch(`${GATEWAY_URL}/user-service/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.get('email'),
            password: formData.get('password')
          })
        });
        const data = await response.json();
        if (response.ok) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify({
            id: data.userId, name: data.name, email: data.email
          }));
          window.location.href = '/courses.html';
        } else {
          alert(data.message || 'Login failed');
        }
      } catch (error) {
        console.error(error);
        alert('Connection error. Please try again.');
      }
    });
  }

  const page = document.body.dataset.page;
  if (page === 'signup') bindSignup();
  if (page === 'reset') bindResetPassword();
  if (page === 'login') bindLogin();
})();
