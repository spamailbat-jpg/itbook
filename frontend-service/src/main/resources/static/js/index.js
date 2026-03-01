(() => {
  const token = localStorage.getItem('token');
  const isLoggedIn = Boolean(token);

  const goLogin = () => window.location.href = '/login.html';
  const goCourses = () => window.location.href = isLoggedIn ? '/courses.html' : '/login.html';
  const goSignup = () => window.location.href = '/signUp.html';

  document.getElementById('goLogin')?.addEventListener('click', goLogin);
  document.getElementById('goCourses')?.addEventListener('click', goCourses);
  document.getElementById('heroStart')?.addEventListener('click', goCourses);
  document.getElementById('heroSignup')?.addEventListener('click', goSignup);
})();
